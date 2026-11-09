import { db } from "./firebase.js";
import { HttpError } from "./types.js";
import { quoteDelivery } from "./delivery.js";

export interface Place { label: string; lat: number; lng: number }
export interface Line { productId: string; name: string; qty: number; unitPrice: number; lineTotal: number; notes?: string }
export interface Group { bakeryId: string; items: Line[]; subtotal: number; deliveryFee: number; etaMinutes: number | null }

/** Prices a cart from Firestore only. Client-supplied prices don't exist in the input. One group per bakery. */
export async function priceCart(b: { items: { productId: string; qty: number; notes?: string }[]; fulfilment: "PICKUP" | "DELIVERY"; address?: Place }): Promise<Group[]> {
  const ids = [...new Set(b.items.map((i) => i.productId))];
  const snaps = await db.getAll(...ids.map((id) => db.collection("products").doc(id)));
  const prod = new Map<string, Record<string, unknown>>(snaps.filter((s) => s.exists && s.data()!.status === "published").map((s) => [s.id, s.data()!] as const));
  const groups = new Map<string, Line[]>();
  for (const i of b.items) {
    const p = prod.get(i.productId);
    if (!p) throw new HttpError(409, "One of the items is no longer available.");
    const line: Line = { productId: i.productId, name: p.name as string, qty: i.qty, unitPrice: p.price as number, lineTotal: (p.price as number) * i.qty, notes: i.notes };
    groups.set(p.bakeryId as string, [...(groups.get(p.bakeryId as string) ?? []), line]);
  }
  const bks = await db.getAll(...[...groups.keys()].map((id) => db.collection("bakeries").doc(id)));
  if (bks.some((x) => !x.exists || x.data()!.status !== "active")) throw new HttpError(409, "One of the bakeries isn't taking orders right now.");
  return Promise.all([...groups].map(async ([bakeryId, items]) => {
    let deliveryFee = 0, etaMinutes: number | null = null;
    if (b.fulfilment === "DELIVERY") {
      const q = await quoteDelivery(bakeryId, b.address!);
      if (!q.available) throw new HttpError(409, "One of the bakeries doesn't deliver to that address. Try pickup or another address.");
      deliveryFee = q.fee; etaMinutes = q.minutes;
    }
    return { bakeryId, items, subtotal: items.reduce((s, i) => s + i.lineTotal, 0), deliveryFee, etaMinutes };
  }));
}
