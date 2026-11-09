import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase.js";
import { requireAuth, requireBakery } from "../middleware/auth.js";
import { HttpError } from "../types.js";
import { dayKey, ordersSince } from "../analytics.js";
import { CODE_RE, normaliseCode, promoFromData, promoStatus } from "../promotions.js";
import { priceCart } from "../pricing.js";
import { evaluatePromo } from "../place-order.js";
import { EXPENSE_CATEGORIES, financeSummary } from "../finance.js";

export const money = Router();
const MGR = requireBakery("BAKER_OWNER", "BAKER_MANAGER");

// ---- Promotions (bakery side). The document id is `${bakeryId}_${CODE}`, so a bakery can only ever touch its own codes.
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const promoBody = z.object({
  name: z.string().trim().min(2).max(60), type: z.enum(["PERCENT", "FIXED", "FREE_DELIVERY"]), value: z.number().int().min(0).max(50000), code: z.string().trim().transform((c) => c.toUpperCase()).pipe(z.string().regex(CODE_RE, "Use 3 to 20 letters or numbers.")),
  minSubtotal: z.number().int().min(0).max(1_000_000).default(0), startsAt: day, endsAt: day, maxUses: z.number().int().min(1).max(100000).nullable().default(null), oncePerCustomer: z.boolean().default(true), productIds: z.array(z.string()).max(20).default([]),
}).superRefine((b, c) => {
  if (b.type === "PERCENT" && (b.value < 1 || b.value > 90)) c.addIssue({ code: "custom", message: "A percentage discount must be between 1 and 90." });
  if (b.type === "FIXED" && b.value < 10) c.addIssue({ code: "custom", message: "A fixed discount must be at least KSh 10." });
  if (b.endsAt < b.startsAt) c.addIssue({ code: "custom", message: "The end date can't be before the start date." });
});
money.get("/business/promotions", requireAuth, MGR, async (req, res, next) => {
  try {
    const s = await db.collection("promotions").where("bakeryId", "==", req.actor.bakeryId!).limit(100).get(), now = new Date();
    res.json({ ok: true, data: s.docs.map((d) => { const x = d.data(), p = promoFromData(x); return { code: x.code, name: x.name, type: x.type, value: x.value, minSubtotal: p.minSubtotal, startsAt: p.startsAt.toISOString().slice(0, 10), endsAt: p.endsAt.toISOString().slice(0, 10), uses: x.uses ?? 0, maxUses: p.maxUses, status: promoStatus(p, x.uses ?? 0, now) }; }) });
  } catch (e) { next(e); }
});
money.post("/business/promotions", requireAuth, MGR, async (req, res, next) => {
  try {
    const b = promoBody.parse(req.body), bakeryId = req.actor.bakeryId!;
    if (b.productIds.length) {
      const own = await db.getAll(...b.productIds.map((id) => db.collection("products").doc(id)));
      if (own.some((p) => !p.exists || p.data()!.bakeryId !== bakeryId)) throw new HttpError(400, "You can only discount your own products.");
    }
    const { code, startsAt, endsAt, ...rest } = b;
    try { await db.collection("promotions").doc(`${bakeryId}_${code}`).create({ ...rest, code, bakeryId, startsAt: new Date(`${startsAt}T00:00:00+03:00`), endsAt: new Date(`${endsAt}T23:59:59+03:00`), uses: 0, active: true, createdAt: new Date() }); }
    catch (e) { if ((e as { code?: number }).code === 6) throw new HttpError(409, "You already have a code with that name."); throw e; }
    res.status(201).json({ ok: true, data: { code } });
  } catch (e) { next(e); }
});
money.patch("/business/promotions/:code", requireAuth, MGR, async (req, res, next) => {
  try {
    const { active } = z.object({ active: z.boolean() }).parse(req.body), ref = db.collection("promotions").doc(`${req.actor.bakeryId}_${normaliseCode(String(req.params.code))}`);
    if (!(await ref.get()).exists) throw new HttpError(404, "We couldn't find that promotion.");
    await ref.update({ active }); res.json({ ok: true, data: null });
  } catch (e) { next(e); }
});

// ---- Promo preview (customer side): shows the discount before paying. The real discount is recalculated when the order is placed.
const previewBody = z.object({ code: z.string().trim().min(3).max(20), items: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().min(1).max(50) })).min(1).max(30), fulfilment: z.enum(["PICKUP", "DELIVERY"]), address: z.object({ label: z.string().max(200), lat: z.number(), lng: z.number() }).optional() });
money.post("/promotions/preview", requireAuth, async (req, res, next) => {
  try {
    const b = previewBody.parse(req.body);
    if (b.fulfilment === "DELIVERY" && !b.address) throw new HttpError(400, "Choose a delivery address first.");
    const ev = await evaluatePromo(normaliseCode(b.code), req.actor.uid!, await priceCart(b)), good = ev.filter((e) => e.ok);
    if (!good.length) { const bad = ev.find((e) => !e.ok); throw new HttpError(400, bad && !bad.ok ? bad.reason : "That code isn't valid."); }
    res.json({ ok: true, data: { name: good[0]!.name, totalSaving: good.reduce((s, e) => s + (e.ok ? e.discount + e.deliveryDiscount : 0), 0) } });
  } catch (e) { next(e); }
});

// ---- Finances
const PERIODS = { week: [7, "day"], month: [30, "day"], year: [365, "month"] } as const;
money.get("/business/finances", requireAuth, MGR, async (req, res, next) => {
  try {
    const period = z.enum(["week", "month", "year"]).default("month").parse(req.query.period), [days, bucket] = PERIODS[period], bakeryId = req.actor.bakeryId!;
    const from = dayKey(new Date(Date.now() - (days - 1) * 864e5));
    const [orders, ex] = await Promise.all([ordersSince(bakeryId, days + 1), db.collection("bakeries").doc(bakeryId).collection("expenses").where("date", ">=", from).limit(1000).get()]);
    const expenses = ex.docs.map((d) => ({ id: d.id, ...(d.data() as { date: string; category: string; amount: number; note?: string }) }));
    res.json({ ok: true, data: { period, ...financeSummary(orders.map((o) => ({ ...o, createdAt: o.createdAt.toDate() })), expenses, from, days, bucket), recentExpenses: expenses.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 50) } });
  } catch (e) { next(e); }
});
money.post("/business/expenses", requireAuth, MGR, async (req, res, next) => {
  try {
    const b = z.object({ date: day, category: z.enum(EXPENSE_CATEGORIES), amount: z.number().int().min(1).max(10_000_000), note: z.string().trim().max(120).default("") }).parse(req.body);
    if (b.date > dayKey(new Date())) throw new HttpError(400, "Expenses can't be dated in the future.");
    const ref = db.collection("bakeries").doc(req.actor.bakeryId!).collection("expenses").doc();
    await ref.set({ ...b, createdBy: req.actor.uid, createdAt: new Date() }); res.status(201).json({ ok: true, data: { id: ref.id } });
  } catch (e) { next(e); }
});
money.delete("/business/expenses/:id", requireAuth, MGR, async (req, res, next) => {
  try {
    const ref = db.collection("bakeries").doc(req.actor.bakeryId!).collection("expenses").doc(String(req.params.id));
    if (!(await ref.get()).exists) throw new HttpError(404, "We couldn't find that expense.");
    await ref.delete(); res.json({ ok: true, data: null });
  } catch (e) { next(e); }
});
