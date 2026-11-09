import { db } from "./firebase.js";

export interface PaidOrder { customerId?: string; subtotal?: number; discount?: number; deliveryFee?: number; total: number; createdAt: { toDate(): Date }; items: { productId: string; name: string; qty: number; lineTotal: number }[] }

/** Paid orders for ONE bakery. Callers pass bakeryId from the authenticated actor, never from user input. */
export async function ordersSince(bakeryId: string, days: number): Promise<PaidOrder[]> {
  const since = new Date(Date.now() - days * 864e5);
  const snap = await db.collection("orders").where("bakeryId", "==", bakeryId).where("createdAt", ">=", since).where("paymentStatus", "==", "success").limit(2000).get();
  return snap.docs.map((d) => d.data() as PaidOrder);
}
const TZ = "Africa/Nairobi";
export const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
export const hourOf = (d: Date) => Number(d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).slice(0, 2)) % 24;
export const sum = (rows: PaidOrder[]) => { const revenue = rows.reduce((s, o) => s + o.total, 0); return { revenue, orders: rows.length, avgOrderValue: rows.length ? Math.round(revenue / rows.length) : 0 }; };
