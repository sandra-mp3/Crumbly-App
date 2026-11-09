import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase.js";
import { env } from "../env.js";
import { requireAuth, requireBakery } from "../middleware/auth.js";
import { HttpError } from "../types.js";
import { normalizePhone } from "../payments/utils.js";
import { missingForPublish, type BakeryDraft } from "../readiness.js";

export const onboarding = Router();
const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);

/** Step 1: create a draft bakery and make the signed-in user its owner. One bakery per account for now. */
onboarding.post("/bakeries", requireAuth, async (req, res, next) => {
  try {
    if (req.actor.bakeryId) throw new HttpError(409, "You already have a bakery on Crumbly.");
    const b = z.object({ name: z.string().trim().min(2).max(60), area: z.string().trim().min(2).max(60) }).parse(req.body), uid = req.actor.uid!;
    let id = slugify(b.name) || "bakery"; if ((await db.collection("bakeries").doc(id).get()).exists) id += "-" + Math.random().toString(36).slice(2, 6);
    const batch = db.batch();
    batch.create(db.collection("bakeries").doc(id), { slug: id, name: b.name, area: b.area, status: "draft", rating: 0, deliveryMinutes: 30, offersDelivery: false, offersPickup: true, ownerUid: uid, createdAt: new Date() });
    batch.create(db.collection("bakeryMembers").doc(`${uid}_${id}`), { uid, bakeryId: id, role: "BAKER_OWNER", active: true, createdAt: new Date() });
    await batch.commit();
    res.status(201).json({ ok: true, data: { id } });
  } catch (e) { next(e); }
});

async function load(bakeryId: string) {
  const [snap, prods] = await Promise.all([db.collection("bakeries").doc(bakeryId).get(), db.collection("products").where("bakeryId", "==", bakeryId).where("status", "==", "published").limit(1).get()]);
  if (!snap.exists) throw new HttpError(404, "We couldn't find your bakery.");
  const b = snap.data() as BakeryDraft & { status: string };
  return { id: snap.id, bakery: { id: snap.id, ...b }, missing: missingForPublish(b, prods.size) };
}
onboarding.get("/business/bakery", requireAuth, requireBakery("BAKER_OWNER", "BAKER_MANAGER", "BAKER_STAFF"), async (req, res, next) => {
  try { res.json({ ok: true, data: await load(req.actor.bakeryId!) }); } catch (e) { next(e); }
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), day = z.object({ open: hhmm, close: hhmm }).nullable();
const patchBody = z.object({
  name: z.string().trim().min(2).max(60), about: z.string().trim().max(600), area: z.string().trim().min(2).max(60), phone: z.string().regex(/^[+\d\s()-]{7,20}$/),
  address: z.object({ label: z.string().max(200), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  hours: z.object({ mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day }), offersDelivery: z.boolean(), offersPickup: z.boolean(),
  payoutPhone: z.string().min(9).max(16), logo: z.string().url().max(600), cover: z.string().url().max(600),
}).partial().strict();

onboarding.patch("/business/bakery", requireAuth, requireBakery("BAKER_OWNER"), async (req, res, next) => {
  try {
    const { address, payoutPhone, logo, cover, ...rest } = patchBody.parse(req.body), bakeryId = req.actor.bakeryId!, out: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    if (address) { out.location = { lat: address.lat, lng: address.lng }; out.addressLabel = address.label; }
    if (payoutPhone !== undefined) { const p = normalizePhone(payoutPhone); if (!p) throw new HttpError(400, "Enter a valid Safaricom number for payouts."); out.payoutPhone = p; }
    const prefix = `https://firebasestorage.googleapis.com/`, inPath = encodeURIComponent(`bakeries/${bakeryId}/`);
    for (const [k, u] of [["logo", logo], ["cover", cover]] as const) if (u !== undefined) { if (!u.startsWith(prefix) || !u.includes(inPath)) throw new HttpError(400, "Use a photo uploaded from your bakery account."); out[k] = u; }
    await db.collection("bakeries").doc(bakeryId).update(out);
    res.json({ ok: true, data: await load(bakeryId) });
  } catch (e) { next(e); }
});

/** Final step. With BAKERY_AUTO_APPROVE=false the bakery waits as "pending" for an admin to approve it. */
onboarding.post("/business/bakery/publish", requireAuth, requireBakery("BAKER_OWNER"), async (req, res, next) => {
  try {
    const cur = await load(req.actor.bakeryId!);
    if (cur.bakery.status === "suspended") throw new HttpError(403, "This bakery is suspended. Contact Crumbly support.");
    if (cur.missing.length) throw new HttpError(409, "Almost there. Still needed: " + cur.missing.map((m) => m.label).join("; ") + ".");
    const status = env.BAKERY_AUTO_APPROVE === "true" ? "active" : "pending";
    await db.collection("bakeries").doc(cur.id).update({ status, publishedAt: new Date() });
    res.json({ ok: true, data: { status } });
  } catch (e) { next(e); }
});
