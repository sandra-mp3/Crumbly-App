import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "../firebase.js";
import { requireAuth, requireBakery } from "../middleware/auth.js";
import { HttpError } from "../types.js";
import { canTransition, OrderStatus } from "../orders-transitions.js";
import { priceCart } from "../pricing.js";
import { evaluatePromo, placeOrderGroup } from "../place-order.js";
import { normaliseCode } from "../promotions.js";
import { onOrderStatus } from "../notify.js";
import { dayKey } from "../analytics.js";

export const orders = Router();

const createBody = z.object({
  items: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().min(1).max(50), notes: z.string().max(300).optional() })).min(1).max(30),
  fulfilment: z.enum(["PICKUP", "DELIVERY"]),
  neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), promoCode: z.string().trim().max(20).optional(),
  address: z.object({ label: z.string().max(120), lat: z.number(), lng: z.number() }).optional(),
}).refine((b) => b.fulfilment === "PICKUP" || !!b.address, { message: "A delivery address is required." });

/** One order per bakery. Prices, delivery fees and discounts are computed on the server only. */
orders.post("/orders", requireAuth, async (req, res, next) => {
  try {
    const key = req.header("idempotency-key");
    if (!key || key.length < 8 || key.length > 100) throw new HttpError(400, "Missing Idempotency-Key header.");
    const b = createBody.parse(req.body), uid = req.actor.uid!, today = dayKey(new Date()), needed = b.neededBy ?? today;
    if (needed < today || needed > dayKey(new Date(Date.now() + 30 * 864e5))) throw new HttpError(400, "Choose a date within the next 30 days.");
    const groups = await priceCart(b), code = b.promoCode ? normaliseCode(b.promoCode) : undefined;
    if (code) { const ev = await evaluatePromo(code, uid, groups); if (!ev.some((e) => e.ok)) { const bad = ev.find((e) => !e.ok); throw new HttpError(400, bad && !bad.ok ? bad.reason : "That code isn't valid."); } }
    const out: unknown[] = [];
    for (const group of groups) out.push(await placeOrderGroup({ uid, key, group, fulfilment: b.fulfilment, address: b.address, neededBy: needed, promoCode: code }));
    res.status(201).json({ ok: true, data: out });
  } catch (e) { next(e); }
});

orders.get("/orders", requireAuth, async (req, res, next) => {
  try {
    const biz = req.query.scope === "business";
    if (biz && !req.actor.bakeryId) throw new HttpError(403, "You don't have access to this bakery.");
    const base = db.collection("orders").where(biz ? "bakeryId" : "customerId", "==", biz ? req.actor.bakeryId! : req.actor.uid!);
    const s = await base.orderBy("createdAt", "desc").limit(30).get();
    res.json({ ok: true, data: s.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (e) { next(e); }
});

orders.get("/orders/:id", requireAuth, async (req, res, next) => {
  try {
    const d = await db.collection("orders").doc(String(req.params.id)).get(), o = d.data();
    if (!o || (o.customerId !== req.actor.uid && o.bakeryId !== req.actor.bakeryId)) throw new HttpError(404, "We couldn't find that order.");
    res.json({ ok: true, data: { id: d.id, ...o } });
  } catch (e) { next(e); }
});

const statusBody = z.object({ status: z.enum(["ORDER_RECEIVED", "CONFIRMED", "PREPARING", "BAKING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]) });
orders.patch("/orders/:id/status", requireAuth, requireBakery("BAKER_OWNER", "BAKER_MANAGER", "BAKER_STAFF"), async (req, res, next) => {
  try {
    const { status } = statusBody.parse(req.body);
    if (status === "CANCELLED" && req.actor.role === "BAKER_STAFF") throw new HttpError(403, "Only owners and managers can cancel orders.");
    const ref = db.collection("orders").doc(String(req.params.id));
    const info = await db.runTransaction(async (tx) => {
      const o = (await tx.get(ref)).data();
      if (!o || o.bakeryId !== req.actor.bakeryId) throw new HttpError(404, "We couldn't find that order.");
      if (!canTransition(o.status as OrderStatus, status, o.fulfilment)) throw new HttpError(409, `Can't move an order from ${o.status} to ${status}.`);
      tx.update(ref, { status, statusHistory: FieldValue.arrayUnion({ status, at: new Date(), by: req.actor.uid }) });
      return { customerId: o.customerId as string, fulfilment: o.fulfilment as "PICKUP" | "DELIVERY" };
    });
    await onOrderStatus({ id: ref.id, ...info }, status);
    res.json({ ok: true, data: { id: ref.id, status } });
  } catch (e) { next(e); }
});
