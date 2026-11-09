import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase.js";
import { requireAuth, requireBakery } from "../middleware/auth.js";
import { HttpError } from "../types.js";
import { dayKey, hourOf, ordersSince, sum } from "../analytics.js";

export const business = Router();
const ALL = requireBakery("BAKER_OWNER", "BAKER_MANAGER", "BAKER_STAFF"), MGR = requireBakery("BAKER_OWNER", "BAKER_MANAGER");
business.use("/business", requireAuth);
business.get("/me", requireAuth, (req, res) => void res.json({ ok: true, data: req.actor }));

business.get("/business/summary", MGR, async (req, res, next) => {
  try {
    const bakeryId = req.actor.bakeryId!, days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const rows = await ordersSince(bakeryId, days * 2), cutoff = Date.now() - days * 864e5;
    const cur = rows.filter((o) => o.createdAt.toDate().getTime() >= cutoff), prev = rows.filter((o) => o.createdAt.toDate().getTime() < cutoff);
    const byDay = new Map<string, { revenue: number; orders: number }>();
    for (let i = days - 1; i >= 0; i--) byDay.set(dayKey(new Date(Date.now() - i * 864e5)), { revenue: 0, orders: 0 });
    const byHour = Array.from({ length: 24 }, () => ({ revenue: 0, orders: 0 })), prod = new Map<string, { name: string; units: number; revenue: number }>();
    for (const o of cur) {
      const d = o.createdAt.toDate(), day = byDay.get(dayKey(d)), h = byHour[hourOf(d)]!;
      if (day) { day.revenue += o.total; day.orders++; } h.revenue += o.total; h.orders++;
      for (const i of o.items) { const x = prod.get(i.productId) ?? { name: i.name, units: 0, revenue: 0 }; x.units += i.qty; x.revenue += i.lineTotal; prod.set(i.productId, x); }
    }
    const list = [...prod.values()].sort((a, b) => b.revenue - a.revenue), today = byDay.get(dayKey(new Date())) ?? { revenue: 0, orders: 0 };
    const [inv, open] = await Promise.all([
      db.collection("bakeries").doc(bakeryId).collection("inventory").limit(300).get(),
      db.collection("orders").where("bakeryId", "==", bakeryId).where("status", "in", ["PAYMENT_CONFIRMED", "ORDER_RECEIVED", "CONFIRMED", "PREPARING", "BAKING"]).limit(100).get(),
    ]);
    res.json({ ok: true, data: { days, totals: sum(cur), previous: sum(prev), today, pendingOrders: open.size,
      lowStock: inv.docs.map((d) => d.data()).filter((i) => i.quantity <= i.minQuantity).length,
      byDay: [...byDay].map(([date, v]) => ({ date, ...v })), byHour: byHour.map((v, hour) => ({ hour, ...v })), best: list.slice(0, 5), worst: list.slice(-5).reverse() } });
  } catch (e) { next(e); }
});

const CATS = ["Cakes", "Cupcakes", "Cookies", "Bread", "Croissants", "Doughnuts", "Pastries", "Tarts", "Desserts", "Breakfast", "Custom Cakes"] as const;
const fields = { name: z.string().trim().min(2).max(80), category: z.enum(CATS), price: z.number().int().min(1).max(200000), prepMinutes: z.number().int().min(5).max(2880),
  dietary: z.array(z.enum(["vegan", "vegetarian", "gluten-free", "halal"])).max(4), description: z.string().max(600), status: z.enum(["draft", "published", "paused", "out_of_stock", "archived"]) };
const createP = z.object({ ...fields, prepMinutes: fields.prepMinutes.default(60), dietary: fields.dietary.default([]), description: fields.description.default(""), status: fields.status.default("draft") });
const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

business.get("/business/products", ALL, async (req, res, next) => {
  try { const s = await db.collection("products").where("bakeryId", "==", req.actor.bakeryId!).limit(200).get(); res.json({ ok: true, data: s.docs.map((d) => ({ id: d.id, ...d.data() })) }); } catch (e) { next(e); }
});
business.post("/business/products", MGR, async (req, res, next) => {
  try {
    const b = createP.parse(req.body), bakeryId = req.actor.bakeryId!;
    const bk = (await db.collection("bakeries").doc(bakeryId).get()).data();
    let id = slugify(b.name); if ((await db.collection("products").doc(id).get()).exists) id += "-" + Math.random().toString(36).slice(2, 6);
    await db.collection("products").doc(id).create({ ...b, slug: id, bakeryId, bakeryName: bk?.name ?? "", rating: 0, keywords: "", createdAt: new Date() });
    res.status(201).json({ ok: true, data: { id } });
  } catch (e) { next(e); }
});
business.patch("/business/products/:id", MGR, async (req, res, next) => {
  try {
    const image = z.string().url().max(600).refine((u) => /^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com)\//.test(u), "Use an uploaded photo.");
    const patch = z.object({ ...fields, image }).partial().strict().parse(req.body), ref = db.collection("products").doc(String(req.params.id));
    const cur = (await ref.get()).data();
    if (!cur || cur.bakeryId !== req.actor.bakeryId) throw new HttpError(404, "We couldn't find that product."); // other bakeries' products look nonexistent
    await ref.update({ ...patch, updatedAt: new Date() });
    res.json({ ok: true, data: { id: ref.id } });
  } catch (e) { next(e); }
});

business.get("/business/inventory", ALL, async (req, res, next) => {
  try { const s = await db.collection("bakeries").doc(req.actor.bakeryId!).collection("inventory").limit(300).get(); res.json({ ok: true, data: s.docs.map((d) => ({ id: d.id, ...d.data() })) }); } catch (e) { next(e); }
});
business.patch("/business/inventory/:id", ALL, async (req, res, next) => {
  try {
    const { quantity } = z.object({ quantity: z.number().min(0).max(1e6) }).parse(req.body);
    const ref = db.collection("bakeries").doc(req.actor.bakeryId!).collection("inventory").doc(String(req.params.id));
    if (!(await ref.get()).exists) throw new HttpError(404, "We couldn't find that ingredient.");
    await ref.update({ quantity, updatedAt: new Date() });
    res.json({ ok: true, data: { id: ref.id, quantity } });
  } catch (e) { next(e); }
});

business.post("/business/inventory", MGR, async (req, res, next) => {
  try {
    const b = z.object({ name: z.string().trim().min(1).max(60), unit: z.enum(["kg", "g", "l", "ml", "pcs", "tray", "box"]), quantity: z.number().min(0).max(1e6), minQuantity: z.number().min(0).max(1e6) }).parse(req.body);
    const ref = db.collection("bakeries").doc(req.actor.bakeryId!).collection("inventory").doc(slugify(b.name) || "item");
    await ref.create({ ...b, createdAt: new Date() });
    res.status(201).json({ ok: true, data: { id: ref.id } });
  } catch (e) { next((e as { code?: number }).code === 6 ? new HttpError(409, "You already track an ingredient with that name.") : e); }
});
