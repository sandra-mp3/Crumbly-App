import { Router } from "express";
import { z } from "zod";
import { auth, db } from "../firebase.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { HttpError } from "../types.js";
import { afterRemoval, nextBakeryStatus } from "../admin-utils.js";
import { audit } from "../audit.js";

export const admin = Router();
admin.use("/admin", requireAuth, requireAdmin);
const iso = (t: unknown) => (t && typeof (t as { toDate?: () => Date }).toDate === "function" ? (t as { toDate: () => Date }).toDate().toISOString() : null);

admin.get("/admin/overview", async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 864e5), stuckBefore = new Date(Date.now() - 10 * 60_000);
    const [bk, ord, stuck, reports] = await Promise.all([
      db.collection("bakeries").limit(500).get(),
      db.collection("orders").where("paymentStatus", "==", "success").where("createdAt", ">=", since).limit(2000).get(),
      db.collection("payments").where("status", "==", "pending").where("createdAt", "<=", stuckBefore).limit(50).get(),
      db.collection("reviewReports").where("status", "==", "open").limit(50).get(),
    ]);
    const byStatus: Record<string, number> = {};
    for (const d of bk.docs) { const st = (d.data().status as string) ?? "unknown"; byStatus[st] = (byStatus[st] ?? 0) + 1; }
    res.json({ ok: true, data: { bakeries: byStatus, last30Days: { orders: ord.size, gmv: ord.docs.reduce((s, d) => s + (d.data().total as number), 0) }, health: { stuckPayments: stuck.size, openReports: reports.size, pendingBakeries: byStatus.pending ?? 0 } } });
  } catch (e) { next(e); }
});

admin.get("/admin/bakeries", async (_req, res, next) => {
  try { const s = await db.collection("bakeries").limit(200).get(); res.json({ ok: true, data: s.docs.map((d) => { const b = d.data(); return { id: d.id, name: b.name, area: b.area, status: b.status, featured: !!b.featured, rating: b.rating ?? 0 }; }) }); } catch (e) { next(e); }
});

/** Suspending hides a bakery's published products (and reinstating restores them) so nothing can be ordered from it. */
async function setProductsHidden(bakeryId: string, hide: boolean) {
  const s = await db.collection("products").where("bakeryId", "==", bakeryId).where("status", "==", hide ? "published" : "suspended").limit(400).get();
  const batch = db.batch(); for (const d of s.docs) batch.update(d.ref, { status: hide ? "suspended" : "published" }); await batch.commit();
}
admin.patch("/admin/bakeries/:id", async (req, res, next) => {
  try {
    const { action } = z.object({ action: z.enum(["approve", "suspend", "reinstate", "feature", "unfeature"]) }).parse(req.body);
    const ref = db.collection("bakeries").doc(String(req.params.id)), cur = (await ref.get()).data();
    if (!cur) throw new HttpError(404, "We couldn't find that bakery.");
    if (action === "feature" || action === "unfeature") {
      if (cur.status !== "active") throw new HttpError(409, "Only active bakeries can be featured.");
      await ref.update({ featured: action === "feature" });
    } else {
      const next = nextBakeryStatus(cur.status as string, action);
      if (!next) throw new HttpError(409, `Can't ${action} a bakery that is ${cur.status}.`);
      await ref.update({ status: next, ...(action === "approve" ? { approvedAt: new Date() } : {}) });
      if (action === "suspend") await setProductsHidden(ref.id, true); else if (action === "reinstate") await setProductsHidden(ref.id, false);
    }
    await audit(req.actor.uid, `bakery.${action}`, ref.id, { from: cur.status });
    res.json({ ok: true, data: { id: ref.id } });
  } catch (e) { next(e); }
});

admin.get("/admin/orders", async (_req, res, next) => {
  try { const s = await db.collection("orders").orderBy("createdAt", "desc").limit(50).get(); res.json({ ok: true, data: s.docs.map((d) => { const o = d.data(); return { id: d.id, bakeryId: o.bakeryId, total: o.total, status: o.status, paymentStatus: o.paymentStatus, fulfilment: o.fulfilment, createdAt: iso(o.createdAt) }; }) }); } catch (e) { next(e); }
});

admin.get("/admin/users", async (_req, res, next) => {
  try { const r = await auth.listUsers(100); res.json({ ok: true, data: r.users.map((u) => ({ uid: u.uid, email: u.email ?? null, name: u.displayName ?? null, role: (u.customClaims?.role as string) ?? "CUSTOMER", disabled: u.disabled, created: u.metadata.creationTime })) }); } catch (e) { next(e); }
});

admin.get("/admin/reports", async (_req, res, next) => {
  try {
    const s = await db.collection("reviewReports").where("status", "==", "open").orderBy("createdAt", "desc").limit(50).get();
    const rows = await Promise.all(s.docs.map(async (d) => { const r = d.data(), rev = (await db.collection("reviews").doc(r.reviewId as string).get()).data(); return { id: d.id, reason: r.reason, review: rev ? { rating: rev.rating, text: rev.text, author: rev.author } : null }; }));
    res.json({ ok: true, data: rows });
  } catch (e) { next(e); }
});
admin.post("/admin/reports/:id/resolve", async (req, res, next) => {
  try {
    const { action } = z.object({ action: z.enum(["remove", "dismiss"]) }).parse(req.body), rRef = db.collection("reviewReports").doc(String(req.params.id));
    await db.runTransaction(async (tx) => {
      const rep = (await tx.get(rRef)).data();
      if (!rep || rep.status !== "open") throw new HttpError(404, "That report was already handled.");
      if (action === "remove") {
        const revRef = db.collection("reviews").doc(rep.reviewId as string), pRef = db.collection("products").doc(rep.productId as string);
        const [rev, p] = await Promise.all([tx.get(revRef), tx.get(pRef)]);
        if (rev.exists && p.exists) { const pd = p.data()!; tx.update(pRef, afterRemoval((pd.ratingSum as number) ?? 0, (pd.ratingCount as number) ?? 0, rev.data()!.rating as number)); tx.delete(revRef); }
      }
      tx.update(rRef, { status: action === "remove" ? "removed" : "dismissed", resolvedBy: req.actor.uid, resolvedAt: new Date() });
    });
    await audit(req.actor.uid, `report.${action}`, rRef.id);
    res.json({ ok: true, data: null });
  } catch (e) { next(e); }
});
