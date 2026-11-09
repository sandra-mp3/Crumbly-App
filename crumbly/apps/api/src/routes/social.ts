import { Router } from "express";
import { z } from "zod";
import { auth, db } from "../firebase.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../types.js";

export const social = Router();
const fid = (uid: string, pid: string) => `${uid}_${pid}`;

social.get("/favorites", requireAuth, async (req, res, next) => {
  try {
    const s = await db.collection("favorites").where("uid", "==", req.actor.uid!).limit(100).get();
    const ids = s.docs.map((d) => d.data().productId as string);
    const snaps = ids.length ? await db.getAll(...ids.map((id) => db.collection("products").doc(id))) : [];
    res.json({ ok: true, data: snaps.filter((p) => p.exists && p.data()!.status === "published").map((p) => ({ id: p.id, ...p.data() })) });
  } catch (e) { next(e); }
});
social.put("/favorites/:productId", requireAuth, async (req, res, next) => {
  try {
    const pid = String(req.params.productId), p = await db.collection("products").doc(pid).get();
    if (!p.exists || p.data()!.status !== "published") throw new HttpError(404, "That product isn't available right now.");
    await db.collection("favorites").doc(fid(req.actor.uid!, pid)).set({ uid: req.actor.uid, productId: pid, createdAt: new Date() });
    res.json({ ok: true, data: { productId: pid } });
  } catch (e) { next(e); }
});
social.delete("/favorites/:productId", requireAuth, async (req, res, next) => {
  try { await db.collection("favorites").doc(fid(req.actor.uid!, String(req.params.productId))).delete(); res.json({ ok: true, data: null }); } catch (e) { next(e); }
});

social.get("/products/:id/reviews", async (req, res, next) => {
  try {
    const s = await db.collection("reviews").where("productId", "==", String(req.params.id)).orderBy("createdAt", "desc").limit(20).get();
    res.json({ ok: true, data: s.docs.map((d) => { const r = d.data(); return { id: d.id, rating: r.rating, text: r.text, author: r.author, createdAt: r.createdAt }; }) });
  } catch (e) { next(e); }
});
const reviewBody = z.object({ rating: z.number().int().min(1).max(5), text: z.string().trim().max(600).default("") });
/** Only customers who actually received the product can review it. One review per customer per product (editing replaces it). */
social.post("/products/:id/reviews", requireAuth, async (req, res, next) => {
  try {
    const b = reviewBody.parse(req.body), uid = req.actor.uid!, pid = String(req.params.id);
    const delivered = await db.collection("orders").where("customerId", "==", uid).where("status", "==", "DELIVERED").limit(100).get();
    if (!delivered.docs.some((d) => (d.data().items as { productId: string }[]).some((i) => i.productId === pid)))
      throw new HttpError(403, "You can review a pastry after you've received it.");
    const author = ((await auth.getUser(uid)).displayName ?? "").split(" ")[0] || "Crumbly customer";
    const rRef = db.collection("reviews").doc(fid(uid, pid)), pRef = db.collection("products").doc(pid);
    await db.runTransaction(async (tx) => {
      const [r, p] = await Promise.all([tx.get(rRef), tx.get(pRef)]);
      if (!p.exists) throw new HttpError(404, "That product isn't available right now.");
      const pd = p.data()!; let sum = (pd.ratingSum as number | undefined) ?? 0, count = (pd.ratingCount as number | undefined) ?? 0;
      if (r.exists) sum -= r.data()!.rating as number; else count++;
      sum += b.rating;
      tx.set(rRef, { productId: pid, bakeryId: pd.bakeryId, uid, author, rating: b.rating, text: b.text, createdAt: r.exists ? r.data()!.createdAt : new Date(), updatedAt: new Date() });
      tx.update(pRef, { ratingSum: sum, ratingCount: count, rating: Math.round((sum / count) * 10) / 10 });
    });
    res.status(201).json({ ok: true, data: { productId: pid } });
  } catch (e) { next(e); }
});

const reasons = z.object({ reason: z.enum(["spam", "offensive", "not_about_product", "other"]) });
social.post("/reviews/:id/report", requireAuth, async (req, res, next) => {
  try {
    const { reason } = reasons.parse(req.body), id = String(req.params.id), r = (await db.collection("reviews").doc(id).get()).data();
    if (!r) throw new HttpError(404, "That review is no longer there.");
    try { await db.collection("reviewReports").doc(`${req.actor.uid}_${id}`).create({ reviewId: id, productId: r.productId, reporter: req.actor.uid, reason, status: "open", createdAt: new Date() }); }
    catch (e) { if ((e as { code?: number }).code === 6) throw new HttpError(409, "You've already reported this review."); throw e; }
    res.status(201).json({ ok: true, data: null });
  } catch (e) { next(e); }
});
