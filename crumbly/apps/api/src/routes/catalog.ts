import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase.js";
import { HttpError } from "../types.js";

export const catalog = Router();
const page = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) });

catalog.get("/bakeries", async (req, res, next) => {
  try {
    const { limit } = page.parse(req.query);
    const s = await db.collection("bakeries").where("status", "==", "active").orderBy("rating", "desc").limit(limit).get();
    res.json({ ok: true, data: s.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (e) { next(e); }
});
catalog.get("/bakeries/:slug", async (req, res, next) => {
  try {
    const s = await db.collection("bakeries").where("slug", "==", req.params.slug).where("status", "==", "active").limit(1).get();
    const b = s.docs[0];
    if (!b) throw new HttpError(404, "We couldn't find that bakery.");
    res.json({ ok: true, data: { id: b.id, ...b.data() } });
  } catch (e) { next(e); }
});
const pq = page.extend({ bakeryId: z.string().optional(), category: z.string().optional(), maxPrice: z.coerce.number().positive().optional(), diet: z.string().optional() });
catalog.get("/products", async (req, res, next) => {
  try {
    const f = pq.parse(req.query);
    let q: FirebaseFirestore.Query = db.collection("products").where("status", "==", "published");
    if (f.bakeryId) q = q.where("bakeryId", "==", f.bakeryId);
    if (f.category) q = q.where("category", "==", f.category);
    if (f.diet) q = q.where("dietary", "array-contains", f.diet);
    if (f.maxPrice) q = q.where("price", "<=", f.maxPrice);
    const s = await q.orderBy("price").limit(f.limit).get();
    res.json({ ok: true, data: s.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (e) { next(e); }
});
catalog.get("/products/:slug", async (req, res, next) => {
  try {
    const s = await db.collection("products").where("slug", "==", req.params.slug).where("status", "==", "published").limit(1).get();
    const p = s.docs[0];
    if (!p) throw new HttpError(404, "That product isn't available right now.");
    res.json({ ok: true, data: { id: p.id, ...p.data() } });
  } catch (e) { next(e); }
});
