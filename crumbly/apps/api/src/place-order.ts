import { createHash } from "node:crypto";
import { db } from "./firebase.js";
import { HttpError } from "./types.js";
import { applyPromo, promoFromData, type PromoCart } from "./promotions.js";
import type { Group, Place } from "./pricing.js";

const cartOf = (g: Group): PromoCart => ({ lines: g.items.map((i) => ({ productId: i.productId, lineTotal: i.lineTotal })), subtotal: g.subtotal, deliveryFee: g.deliveryFee });

/** Read-only check used before any order exists: which bakeries in this cart would accept the code, and why not. */
export async function evaluatePromo(code: string, uid: string, groups: Group[]) {
  const out: ({ bakeryId: string; name: string } & ReturnType<typeof applyPromo>)[] = [];
  for (const g of groups) {
    const id = `${g.bakeryId}_${code}`, [p, red] = await Promise.all([db.collection("promotions").doc(id).get(), db.collection("promoRedemptions").doc(`${id}_${uid}`).get()]);
    if (!p.exists) continue;
    const d = p.data()!;
    out.push({ bakeryId: g.bakeryId, name: d.name as string, ...applyPromo(promoFromData(d), cartOf(g), { now: new Date(), uses: (d.uses as number) ?? 0, redeemedByUser: red.exists }) });
  }
  return out;
}

export interface PlaceArgs { uid: string; key: string; group: Group; fulfilment: "PICKUP" | "DELIVERY"; address?: Place; neededBy: string; promoCode?: string }
/**
 * Creates one bakery's order in a single transaction. Replaying the same idempotency key returns the same order and never
 * counts a promo twice; promo limits are re-checked against fresh data inside the transaction.
 */
export function placeOrderGroup(a: PlaceArgs) {
  const g = a.group, ref = db.collection("orders").doc(createHash("sha256").update(`${a.uid}|${a.key}|${g.bakeryId}`).digest("hex").slice(0, 28));
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) return { id: ref.id, ...existing.data() };
    let discount = 0, deliveryDiscount = 0, promoId: string | null = null, uses = 0, once = false;
    const pRef = a.promoCode ? db.collection("promotions").doc(`${g.bakeryId}_${a.promoCode}`) : null, rRef = pRef ? db.collection("promoRedemptions").doc(`${pRef.id}_${a.uid}`) : null;
    if (pRef && rRef) {
      const [p, red] = await Promise.all([tx.get(pRef), tx.get(rRef)]);
      if (p.exists) {
        const d = p.data()!, promo = promoFromData(d), r = applyPromo(promo, cartOf(g), { now: new Date(), uses: (d.uses as number) ?? 0, redeemedByUser: red.exists });
        if (!r.ok) throw new HttpError(409, r.reason);
        discount = r.discount; deliveryDiscount = r.deliveryDiscount; promoId = pRef.id; uses = (d.uses as number) ?? 0; once = promo.oncePerCustomer;
      }
    }
    const doc = { customerId: a.uid, bakeryId: g.bakeryId, items: g.items, fulfilment: a.fulfilment, address: a.address ?? null, subtotal: g.subtotal, discount, deliveryFee: g.deliveryFee, deliveryDiscount, promoCode: promoId ? a.promoCode : null,
      etaMinutes: g.etaMinutes, neededBy: a.neededBy, total: Math.max(0, g.subtotal - discount + g.deliveryFee - deliveryDiscount), status: "PENDING_PAYMENT", paymentStatus: "pending", statusHistory: [{ status: "PENDING_PAYMENT", at: new Date() }], createdAt: new Date() };
    tx.create(ref, doc);
    if (promoId && pRef && rRef) { tx.update(pRef, { uses: uses + 1 }); if (once) tx.create(rRef, { uid: a.uid, promoId, orderId: ref.id, at: new Date() }); }
    return { id: ref.id, ...doc };
  });
}
