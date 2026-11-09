export type PromoType = "PERCENT" | "FIXED" | "FREE_DELIVERY";
export interface Promo { type: PromoType; value: number; active: boolean; startsAt: Date; endsAt: Date; minSubtotal: number; productIds: string[]; maxUses: number | null; oncePerCustomer: boolean }
export type PromoStatus = "active" | "scheduled" | "expired" | "paused" | "used_up";
export const CODE_RE = /^[A-Z0-9]{3,20}$/;
export const normaliseCode = (c: string) => c.trim().toUpperCase();

const date = (v: unknown): Date => (v instanceof Date ? v : (v as { toDate(): Date }).toDate());
/** Builds a Promo from a Firestore document (Timestamps or Dates). */
export function promoFromData(d: Record<string, unknown>): Promo {
  return { type: d.type as PromoType, value: d.value as number, active: d.active !== false, startsAt: date(d.startsAt), endsAt: date(d.endsAt), minSubtotal: (d.minSubtotal as number) ?? 0, productIds: (d.productIds as string[]) ?? [], maxUses: (d.maxUses as number | null) ?? null, oncePerCustomer: !!d.oncePerCustomer };
}
export function promoStatus(p: Promo, uses: number, now: Date): PromoStatus {
  if (!p.active) return "paused";
  if (p.maxUses !== null && uses >= p.maxUses) return "used_up";
  if (now > p.endsAt) return "expired";
  if (now < p.startsAt) return "scheduled";
  return "active";
}
export interface PromoCart { lines: { productId: string; lineTotal: number }[]; subtotal: number; deliveryFee: number }
export type PromoResult = { ok: true; discount: number; deliveryDiscount: number } | { ok: false; reason: string };

/** The only place discounts are calculated. Never returns a discount larger than what it applies to. */
export function applyPromo(p: Promo, cart: PromoCart, ctx: { now: Date; uses: number; redeemedByUser: boolean }): PromoResult {
  const st = promoStatus(p, ctx.uses, ctx.now);
  if (st === "paused") return { ok: false, reason: "This code isn't active." };
  if (st === "scheduled") return { ok: false, reason: "This code isn't active yet." };
  if (st === "expired") return { ok: false, reason: "This code has expired." };
  if (st === "used_up") return { ok: false, reason: "This code has been fully used." };
  if (p.oncePerCustomer && ctx.redeemedByUser) return { ok: false, reason: "You've already used this code." };
  if (cart.subtotal < p.minSubtotal) return { ok: false, reason: `Spend at least KSh ${p.minSubtotal.toLocaleString()} to use this code.` };
  const eligible = p.productIds.length ? cart.lines.filter((l) => p.productIds.includes(l.productId)).reduce((s, l) => s + l.lineTotal, 0) : cart.subtotal;
  if (p.type === "FREE_DELIVERY") return cart.deliveryFee > 0 ? { ok: true, discount: 0, deliveryDiscount: cart.deliveryFee } : { ok: false, reason: "This code is for delivery orders." };
  if (eligible <= 0) return { ok: false, reason: "This code doesn't apply to those items." };
  const discount = p.type === "PERCENT" ? Math.floor((eligible * p.value) / 100) : Math.min(p.value, eligible);
  return { ok: true, discount: Math.min(discount, eligible), deliveryDiscount: 0 };
}
