import { describe, expect, it } from "vitest";
import { applyPromo, promoStatus, type Promo } from "../promotions.js";

const NOW = new Date("2026-10-07T09:00:00Z");
const promo = (o: Partial<Promo> = {}): Promo => ({ type: "PERCENT", value: 20, active: true, startsAt: new Date("2026-10-01T00:00:00Z"), endsAt: new Date("2026-10-31T00:00:00Z"), minSubtotal: 0, productIds: [], maxUses: null, oncePerCustomer: false, ...o });
const cart = { lines: [{ productId: "cake", lineTotal: 3000 }, { productId: "roll", lineTotal: 500 }], subtotal: 3500, deliveryFee: 250 };
const ctx = { now: NOW, uses: 0, redeemedByUser: false };

describe("promo status", () => {
  it("covers every state", () => {
    expect(promoStatus(promo(), 0, NOW)).toBe("active"); expect(promoStatus(promo({ active: false }), 0, NOW)).toBe("paused");
    expect(promoStatus(promo({ startsAt: new Date("2026-11-01T00:00:00Z"), endsAt: new Date("2026-11-30T00:00:00Z") }), 0, NOW)).toBe("scheduled");
    expect(promoStatus(promo({ endsAt: new Date("2026-10-02T00:00:00Z") }), 0, NOW)).toBe("expired"); expect(promoStatus(promo({ maxUses: 5 }), 5, NOW)).toBe("used_up");
  });
});
describe("discount maths", () => {
  it("percent applies to the whole subtotal, rounded down", () => expect(applyPromo(promo(), cart, ctx)).toEqual({ ok: true, discount: 700, deliveryDiscount: 0 }));
  it("percent only applies to chosen products", () => expect(applyPromo(promo({ productIds: ["roll"] }), cart, ctx)).toEqual({ ok: true, discount: 100, deliveryDiscount: 0 }));
  it("fixed discounts can't exceed what they apply to", () => { expect(applyPromo(promo({ type: "FIXED", value: 5000 }), cart, ctx)).toEqual({ ok: true, discount: 3500, deliveryDiscount: 0 }); expect(applyPromo(promo({ type: "FIXED", value: 5000, productIds: ["roll"] }), cart, ctx)).toEqual({ ok: true, discount: 500, deliveryDiscount: 0 }); });
  it("free delivery waives the delivery fee only, and needs a delivery order", () => { expect(applyPromo(promo({ type: "FREE_DELIVERY", value: 0 }), cart, ctx)).toEqual({ ok: true, discount: 0, deliveryDiscount: 250 }); expect(applyPromo(promo({ type: "FREE_DELIVERY", value: 0 }), { ...cart, deliveryFee: 0 }, ctx).ok).toBe(false); });
});
describe("promo rules", () => {
  const reason = (r: ReturnType<typeof applyPromo>) => (r.ok ? "" : r.reason);
  it("enforces the minimum spend", () => expect(reason(applyPromo(promo({ minSubtotal: 5000 }), cart, ctx))).toContain("5,000"));
  it("blocks reuse by the same customer when once-per-customer", () => expect(reason(applyPromo(promo({ oncePerCustomer: true }), cart, { ...ctx, redeemedByUser: true }))).toContain("already used"));
  it("blocks used-up, expired and paused codes", () => { expect(reason(applyPromo(promo({ maxUses: 3 }), cart, { ...ctx, uses: 3 }))).toContain("fully used"); expect(reason(applyPromo(promo({ endsAt: new Date("2026-10-02T00:00:00Z") }), cart, ctx))).toContain("expired"); expect(reason(applyPromo(promo({ active: false }), cart, ctx))).toContain("isn't active"); });
  it("rejects a code whose products aren't in the cart", () => expect(reason(applyPromo(promo({ productIds: ["other"] }), cart, ctx))).toContain("doesn't apply"));
});
