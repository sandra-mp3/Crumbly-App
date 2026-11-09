import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../types.js";

export const account = Router();
const addrs = (uid: string) => db.collection("users").doc(uid).collection("addresses");
account.get("/account", requireAuth, async (req, res, next) => {
  try {
    const uid = req.actor.uid!, [a, u] = await Promise.all([addrs(uid).limit(10).get(), db.collection("users").doc(uid).get()]), x = u.data() ?? {};
    res.json({ ok: true, data: { addresses: a.docs.map((d) => ({ id: d.id, ...d.data() })), prefs: { dietary: (x.dietary as string[]) ?? [], notifyEmail: x.notifyEmail !== false } } });
  } catch (e) { next(e); }
});
account.post("/account/addresses", requireAuth, async (req, res, next) => {
  try {
    const b = z.object({ name: z.string().trim().min(1).max(40), label: z.string().max(200), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(req.body), uid = req.actor.uid!;
    if ((await addrs(uid).limit(10).get()).size >= 10) throw new HttpError(409, "You can save up to 10 addresses. Remove one first.");
    const ref = addrs(uid).doc(); await ref.set({ ...b, createdAt: new Date() }); res.status(201).json({ ok: true, data: { id: ref.id } });
  } catch (e) { next(e); }
});
account.delete("/account/addresses/:id", requireAuth, async (req, res, next) => {
  try { await addrs(req.actor.uid!).doc(String(req.params.id)).delete(); res.json({ ok: true, data: null }); } catch (e) { next(e); }
});
account.patch("/account/prefs", requireAuth, async (req, res, next) => {
  try {
    const p = z.object({ dietary: z.array(z.enum(["vegan", "vegetarian", "gluten-free", "halal"])).max(4), notifyEmail: z.boolean() }).partial().strict().parse(req.body);
    await db.collection("users").doc(req.actor.uid!).set(p, { merge: true }); res.json({ ok: true, data: null });
  } catch (e) { next(e); }
});
