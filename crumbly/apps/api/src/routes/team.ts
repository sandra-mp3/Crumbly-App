import { Router } from "express";
import { z } from "zod";
import type { UserRecord } from "firebase-admin/auth";
import { auth, db } from "../firebase.js";
import { env } from "../env.js";
import { requireAuth, requireBakery } from "../middleware/auth.js";
import { HttpError } from "../types.js";
import { dayKey, ordersSince } from "../analytics.js";
import { buildCalendar, type CalOrder } from "../calendar.js";
import { customerStats } from "../customers.js";
import { acceptInvite, createInvite, InviteError, updateMember } from "../staff.js";

export const team = Router();
const ALL = requireBakery("BAKER_OWNER", "BAKER_MANAGER", "BAKER_STAFF"), MGR = requireBakery("BAKER_OWNER", "BAKER_MANAGER"), OWNER = requireBakery("BAKER_OWNER");
const wrap = (e: unknown) => (e instanceof InviteError ? new HttpError(400, e.message) : e);

// Production calendar: everyone who bakes needs it, so staff can read it.
team.get("/business/calendar", requireAuth, ALL, async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 14), from = dayKey(new Date());
    const s = await db.collection("orders").where("bakeryId", "==", req.actor.bakeryId!).where("status", "in", ["PAYMENT_CONFIRMED", "ORDER_RECEIVED", "CONFIRMED", "PREPARING", "BAKING", "READY", "OUT_FOR_DELIVERY"]).limit(300).get();
    const orders: CalOrder[] = s.docs.map((d) => { const o = d.data(); return { id: d.id, status: o.status, fulfilment: o.fulfilment, neededBy: o.neededBy, createdDay: dayKey(o.createdAt.toDate()), items: o.items }; });
    res.json({ ok: true, data: buildCalendar(orders, from, days) });
  } catch (e) { next(e); }
});

// Customer list for owners/managers. Names only: no emails or phone numbers are exposed here.
team.get("/business/customers", requireAuth, MGR, async (req, res, next) => {
  try {
    const stats = customerStats((await ordersSince(req.actor.bakeryId!, 365)).map((o) => ({ ...o, createdAt: o.createdAt.toDate() })) as never).slice(0, 100);
    const names = new Map((await auth.getUsers(stats.map((c) => ({ uid: c.customerId })))).users.map((u) => [u.uid, (u.displayName ?? "").split(" ").slice(0, 2).map((p, i) => (i ? p[0] + "." : p)).join(" ")] as const));
    res.json({ ok: true, data: stats.map((c) => ({ ...c, name: names.get(c.customerId) || "Customer" })) });
  } catch (e) { next(e); }
});

// Team management: owner only.
team.get("/business/staff", requireAuth, OWNER, async (req, res, next) => {
  try {
    const bakeryId = req.actor.bakeryId!;
    const [m, inv] = await Promise.all([db.collection("bakeryMembers").where("bakeryId", "==", bakeryId).limit(100).get(), db.collection("bakeryInvites").where("bakeryId", "==", bakeryId).where("status", "==", "pending").limit(50).get()]);
    const users = new Map<string, UserRecord>((await auth.getUsers(m.docs.map((d) => ({ uid: d.data().uid as string })))).users.map((u) => [u.uid, u] as const));
    res.json({ ok: true, data: {
      members: m.docs.map((d) => { const x = d.data(), u = users.get(x.uid as string); return { uid: x.uid, role: x.role, active: x.active, name: u?.displayName ?? null, email: u?.email ?? null }; }),
      invites: inv.docs.map((d) => ({ id: d.id, email: d.data().email, role: d.data().role, expiresAt: d.data().expiresAt.toDate().toISOString() })),
    } });
  } catch (e) { next(e); }
});
team.post("/business/staff/invites", requireAuth, OWNER, async (req, res, next) => {
  try {
    const b = z.object({ email: z.string().email().max(120), role: z.enum(["BAKER_MANAGER", "BAKER_STAFF"]) }).parse(req.body);
    const token = await createInvite(req.actor.bakeryId!, b.email, b.role, req.actor.uid!);
    res.status(201).json({ ok: true, data: { link: `${env.WEB_URL}/join/${token}` } });
  } catch (e) { next(e); }
});
team.delete("/business/staff/invites/:id", requireAuth, OWNER, async (req, res, next) => {
  try {
    const ref = db.collection("bakeryInvites").doc(String(req.params.id)), cur = (await ref.get()).data();
    if (!cur || cur.bakeryId !== req.actor.bakeryId) throw new HttpError(404, "We couldn't find that invitation.");
    await ref.update({ status: "revoked" }); res.json({ ok: true, data: null });
  } catch (e) { next(e); }
});
team.patch("/business/staff/:uid", requireAuth, OWNER, async (req, res, next) => {
  try {
    const patch = z.object({ role: z.enum(["BAKER_MANAGER", "BAKER_STAFF"]), active: z.boolean() }).partial().strict().parse(req.body);
    await updateMember(req.actor.bakeryId!, req.actor.uid!, String(req.params.uid), patch); res.json({ ok: true, data: null });
  } catch (e) { next(wrap(e)); }
});
team.post("/invites/accept", requireAuth, async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(20).max(80) }).parse(req.body);
    res.json({ ok: true, data: await acceptInvite(req.actor.uid!, token) });
  } catch (e) { next(wrap(e)); }
});
