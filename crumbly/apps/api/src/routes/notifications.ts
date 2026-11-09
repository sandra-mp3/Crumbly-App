import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../types.js";

export const notifications = Router();
notifications.get("/notifications", requireAuth, async (req, res, next) => {
  try {
    const uid = req.actor.uid!, [list, unread] = await Promise.all([db.collection("notifications").where("uid", "==", uid).orderBy("createdAt", "desc").limit(30).get(), db.collection("notifications").where("uid", "==", uid).where("read", "==", false).limit(100).get()]);
    res.json({ ok: true, data: { unread: unread.size, items: list.docs.map((d) => { const n = d.data(); return { id: d.id, type: n.type, title: n.title, body: n.body, link: n.link, read: n.read, createdAt: n.createdAt.toDate().toISOString() }; }) } });
  } catch (e) { next(e); }
});
/** With an id: marks that one read (must be yours). Without: marks all your unread notifications read. */
notifications.post("/notifications/read", requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().optional() }).parse(req.body ?? {}), uid = req.actor.uid!;
    if (id) { const ref = db.collection("notifications").doc(id); if ((await ref.get()).data()?.uid !== uid) throw new HttpError(404, "We couldn't find that notification."); await ref.update({ read: true }); }
    else { const s = await db.collection("notifications").where("uid", "==", uid).where("read", "==", false).limit(100).get(), b = db.batch(); s.docs.forEach((d) => b.update(d.ref, { read: true })); await b.commit(); }
    res.json({ ok: true, data: null });
  } catch (e) { next(e); }
});
