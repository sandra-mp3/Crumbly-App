import { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "../firebase.js";
import { llm } from "../ai/index.js";
import { requireAuth, requireBakery } from "../middleware/auth.js";
import { HttpError } from "../types.js";
import { quoteDelivery } from "../delivery.js";
import { onCustomRequest, onQuote } from "../notify.js";

export const custom = Router();
const spec = z.object({ cakeType: z.string().trim().min(1).max(40), servings: z.number().int().min(1).max(300), flavour: z.string().trim().min(1).max(60),
  filling: z.string().max(60).default(""), frosting: z.string().max(60).default(""), colours: z.string().max(80).default(""), theme: z.string().max(80).default(""),
  event: z.string().max(60).default(""), message: z.string().max(60).default(""), description: z.string().max(800).default("") });
const place = z.object({ label: z.string().max(200), lat: z.number(), lng: z.number() });

// Crumbly Bot turns a free-text idea into a structured request. No tools, no data access: it only drafts form values.
custom.post("/crumbly-bot/cake-brief", async (req, res, next) => {
  try {
    const { idea } = z.object({ idea: z.string().trim().min(5).max(800) }).parse(req.body);
    const out = await llm.generate({ tools: [], messages: [{ role: "user", text: idea }],
      system: `You are Crumbly Bot. Turn the customer's cake idea into JSON only (no prose, no code fences) with keys: cakeType (Round, Tiered, Sheet or Cupcake set), servings (integer), flavour, filling, frosting, colours, theme (a short evocative name), event, message, description.
Use what the customer said; fill gaps with sensible suggestions (estimate servings from guest count). Never mention prices.` });
    const json = out.text?.match(/\{[\s\S]*\}/)?.[0];
    const parsed = spec.partial().safeParse(json ? JSON.parse(json) : null);
    if (!parsed.success) throw new HttpError(502, "Crumbly Bot couldn't turn that into a cake brief. Try adding a few more details.");
    res.json({ ok: true, data: parsed.data });
  } catch (e) { next(e instanceof SyntaxError ? new HttpError(502, "Crumbly Bot couldn't turn that into a cake brief. Try again.") : e); }
});

const createBody = z.object({ bakeryId: z.string().min(1), spec, fulfilment: z.enum(["PICKUP", "DELIVERY"]), address: place.optional(), neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), images: z.array(z.string().url().max(600)).max(3).default([]) })
  .refine((b) => b.fulfilment === "PICKUP" || !!b.address, { message: "A delivery address is required." });

custom.post("/custom-orders", requireAuth, async (req, res, next) => {
  try {
    const b = createBody.parse(req.body), uid = req.actor.uid!;
    if (b.neededBy < new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10)) throw new HttpError(400, "Custom cakes need at least 2 days' notice.");
    const prefix = encodeURIComponent(`inspiration/${uid}/`);
    if (!b.images.every((u) => u.startsWith("https://firebasestorage.googleapis.com/") && u.includes(prefix))) throw new HttpError(400, "Use photos uploaded from your account.");
    const bk = (await db.collection("bakeries").doc(b.bakeryId).get()).data();
    if (!bk || bk.status !== "active") throw new HttpError(404, "That bakery isn't taking requests right now.");
    const ref = db.collection("customOrders").doc();
    await ref.set({ customerId: uid, bakeryId: b.bakeryId, bakeryName: bk.name, spec: b.spec, fulfilment: b.fulfilment, address: b.address ?? null, neededBy: b.neededBy, images: b.images, status: "REQUESTED", createdAt: new Date() });
    await onCustomRequest(b.bakeryId, b.spec.theme || b.spec.cakeType);
    res.status(201).json({ ok: true, data: { id: ref.id } });
  } catch (e) { next(e); }
});

custom.get("/custom-orders", requireAuth, async (req, res, next) => {
  try {
    const biz = req.query.scope === "business";
    if (biz && !req.actor.bakeryId) throw new HttpError(403, "You don't have access to this bakery.");
    const s = await db.collection("customOrders").where(biz ? "bakeryId" : "customerId", "==", biz ? req.actor.bakeryId! : req.actor.uid!).orderBy("createdAt", "desc").limit(50).get();
    res.json({ ok: true, data: s.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (e) { next(e); }
});

const quoteBody = z.discriminatedUnion("action", [z.object({ action: z.literal("quote"), price: z.number().int().min(500).max(500000), note: z.string().max(300).default("") }), z.object({ action: z.literal("decline"), note: z.string().max(300).default("") })]);
custom.post("/custom-orders/:id/quote", requireAuth, requireBakery("BAKER_OWNER", "BAKER_MANAGER"), async (req, res, next) => {
  try {
    const b = quoteBody.parse(req.body), ref = db.collection("customOrders").doc(String(req.params.id)), cur = (await ref.get()).data();
    if (!cur || cur.bakeryId !== req.actor.bakeryId) throw new HttpError(404, "We couldn't find that request.");
    if (!["REQUESTED", "QUOTED"].includes(cur.status)) throw new HttpError(409, "This request has already been answered.");
    await ref.update(b.action === "quote" ? { status: "QUOTED", quote: b.price, bakerNote: b.note, quotedAt: new Date() } : { status: "DECLINED", bakerNote: b.note });
    await onQuote(cur.customerId as string, b.action === "quote" ? b.price : null);
    res.json({ ok: true, data: { id: ref.id } });
  } catch (e) { next(e); }
});

/** Accepting a quote creates a normal unpaid order, so the customer pays through the same M-Pesa flow. */
custom.post("/custom-orders/:id/respond", requireAuth, async (req, res, next) => {
  try {
    const { accept } = z.object({ accept: z.boolean() }).parse(req.body), ref = db.collection("customOrders").doc(String(req.params.id)), cur = (await ref.get()).data();
    if (!cur || cur.customerId !== req.actor.uid) throw new HttpError(404, "We couldn't find that request.");
    if (cur.status !== "QUOTED") throw new HttpError(409, "There's no quote to respond to.");
    if (!accept) { await ref.update({ status: "DECLINED_BY_CUSTOMER" }); return void res.json({ ok: true, data: { orderId: null } }); }
    let deliveryFee = 0, etaMinutes: number | null = null;
    if (cur.fulfilment === "DELIVERY") { const q = await quoteDelivery(cur.bakeryId, cur.address); if (!q.available) throw new HttpError(409, "This bakery no longer delivers to that address."); deliveryFee = q.fee; etaMinutes = q.minutes; }
    const orderRef = db.collection("orders").doc(createHash("sha256").update(`custom|${ref.id}`).digest("hex").slice(0, 28)), name = `Custom cake: ${cur.spec.theme || cur.spec.cakeType}`;
    await db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).data()?.status !== "QUOTED") throw new HttpError(409, "There's no quote to respond to.");
      tx.update(ref, { status: "ACCEPTED", orderId: orderRef.id });
      tx.create(orderRef, { customerId: cur.customerId, bakeryId: cur.bakeryId, customOrderId: ref.id, neededBy: cur.neededBy, items: [{ productId: `custom-${ref.id}`, name, qty: 1, unitPrice: cur.quote, lineTotal: cur.quote, notes: cur.spec.description }],
        fulfilment: cur.fulfilment, address: cur.address, subtotal: cur.quote, deliveryFee, etaMinutes, total: cur.quote + deliveryFee, status: "PENDING_PAYMENT", paymentStatus: "pending", statusHistory: [{ status: "PENDING_PAYMENT", at: new Date() }], createdAt: new Date() });
    });
    res.json({ ok: true, data: { orderId: orderRef.id } });
  } catch (e) { next(e); }
});
