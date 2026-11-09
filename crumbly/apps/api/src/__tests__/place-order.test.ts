import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./helpers/fakeDb.js";

const fake = new FakeDb();
vi.mock("../firebase.js", () => ({ db: fake, auth: {} }));
vi.mock("../delivery.js", () => ({ quoteDelivery: async (id: string) => (id === "far" ? { distanceKm: 30, minutes: 80, fee: 1000, available: false } : { distanceKm: 3, minutes: 30, fee: 250, available: true }) }));
const { priceCart } = await import("../pricing.js");
const { placeOrderGroup, evaluatePromo } = await import("../place-order.js");

const day = (n: number) => new Date(Date.now() + n * 864e5);
beforeEach(() => {
  fake.reset();
  fake.put("bakeries/a", { status: "active" }); fake.put("bakeries/b", { status: "active" }); fake.put("bakeries/far", { status: "active" }); fake.put("bakeries/off", { status: "suspended" });
  fake.put("products/cake", { name: "Cake", price: 3000, bakeryId: "a", status: "published" }); fake.put("products/draft", { name: "Draft", price: 100, bakeryId: "a", status: "draft" });
  fake.put("products/roll", { name: "Roll", price: 500, bakeryId: "b", status: "published" }); fake.put("products/farcake", { name: "Far", price: 900, bakeryId: "far", status: "published" }); fake.put("products/offcake", { name: "Off", price: 900, bakeryId: "off", status: "published" });
  fake.put("promotions/a_SAVE20", { bakeryId: "a", name: "Save 20", code: "SAVE20", type: "PERCENT", value: 20, active: true, startsAt: day(-1), endsAt: day(10), minSubtotal: 0, productIds: [], maxUses: 2, oncePerCustomer: true, uses: 0 });
});
const price = (items: { productId: string; qty: number }[], fulfilment: "PICKUP" | "DELIVERY" = "PICKUP") => priceCart({ items, fulfilment, address: { label: "x", lat: 0, lng: 0 } });
const place = async (uid: string, key: string, promoCode?: string) => { const [group] = await price([{ productId: "cake", qty: 1 }]); return placeOrderGroup({ uid, key, group: group!, fulfilment: "PICKUP", neededBy: "2026-10-08", promoCode }); };

describe("pricing", () => {
  it("prices from the database and splits by bakery", async () => {
    const g = await price([{ productId: "cake", qty: 2 }, { productId: "roll", qty: 1 }]);
    expect(g.map((x) => [x.bakeryId, x.subtotal]).sort()).toEqual([["a", 6000], ["b", 500]]);
  });
  it("rejects unpublished products, suspended bakeries and out-of-range delivery", async () => {
    await expect(price([{ productId: "draft", qty: 1 }])).rejects.toThrow("no longer available");
    await expect(price([{ productId: "offcake", qty: 1 }])).rejects.toThrow("isn't taking orders");
    await expect(price([{ productId: "farcake", qty: 1 }], "DELIVERY")).rejects.toThrow("doesn't deliver");
  });
  it("adds the delivery fee for delivery orders", async () => expect((await price([{ productId: "cake", qty: 1 }], "DELIVERY"))[0]!.deliveryFee).toBe(250));
});
describe("placing an order", () => {
  it("applies a code and totals correctly", async () => {
    const o = await place("u1", "key-00001", "SAVE20");
    expect(o).toMatchObject({ subtotal: 3000, discount: 600, total: 2400, promoCode: "SAVE20", status: "PENDING_PAYMENT" });
    expect(fake.raw("promotions/a_SAVE20")!.uses).toBe(1);
  });
  it("replaying the same request returns the same order and counts the code once", async () => {
    const a = await place("u1", "key-00002", "SAVE20"), b = await place("u1", "key-00002", "SAVE20");
    expect(b.id).toBe(a.id); expect(fake.raw("promotions/a_SAVE20")!.uses).toBe(1);
  });
  it("lets each customer use a once-per-customer code only once", async () => {
    await place("u1", "key-00003", "SAVE20");
    await expect(place("u1", "key-00004", "SAVE20")).rejects.toThrow("already used");
    expect((await place("u2", "key-00005", "SAVE20")).total).toBe(2400);
  });
  it("stops at the usage limit", async () => {
    await place("u1", "key-00006", "SAVE20"); await place("u2", "key-00007", "SAVE20");
    await expect(place("u3", "key-00008", "SAVE20")).rejects.toThrow("fully used");
    expect(fake.raw("promotions/a_SAVE20")!.uses).toBe(2);
  });
  it("never discounts below zero and ignores another bakery's code", async () => {
    const [g] = await price([{ productId: "roll", qty: 1 }]);
    const o = await placeOrderGroup({ uid: "u1", key: "key-00009", group: g!, fulfilment: "PICKUP", neededBy: "2026-10-08", promoCode: "SAVE20" });
    expect(o).toMatchObject({ discount: 0, total: 500, promoCode: null });
  });
  it("reports why a code fails before any order exists", async () => {
    const groups = await price([{ productId: "cake", qty: 1 }]);
    expect(await evaluatePromo("NOPE", "u1", groups)).toEqual([]);
    fake.put("promotions/a_SAVE20", { ...fake.raw("promotions/a_SAVE20")!, active: false });
    const ev = await evaluatePromo("SAVE20", "u1", groups);
    expect(ev[0]).toMatchObject({ ok: false });
  });
});
