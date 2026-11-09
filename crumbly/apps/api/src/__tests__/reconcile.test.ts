import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./helpers/fakeDb.js";

const fake = new FakeDb();
vi.mock("../firebase.js", () => ({ db: fake, auth: {} }));
const { reconcilePending } = await import("../payments/reconcile.js");

const mins = (n: number) => new Date(Date.now() - n * 60_000);
const pay = (id: string, ageMin: number, orderId: string) => { fake.put(`payments/${id}`, { status: "pending", orderIds: [orderId], amount: 500, createdAt: mins(ageMin) }); fake.put(`orders/${orderId}`, { total: 500, status: "PENDING_PAYMENT", paymentStatus: "pending", statusHistory: [] }); };
beforeEach(() => fake.reset());

describe("payment reconciliation", () => {
  it("confirms an order whose callback was lost when Safaricom says it succeeded", async () => {
    pay("ws1", 10, "o1");
    const r = await reconcilePending(async () => ({ resultCode: 0, resultDesc: "ok" }));
    expect(r).toMatchObject({ checked: 1, applied: 1 });
    expect(fake.raw("payments/ws1")!.status).toBe("success");
    expect(fake.raw("orders/o1")).toMatchObject({ status: "PAYMENT_CONFIRMED", paymentStatus: "success" });
  });
  it("records a cancelled prompt and leaves the order payable", async () => {
    pay("ws2", 10, "o2");
    await reconcilePending(async () => ({ resultCode: 1032, resultDesc: "cancelled" }));
    expect(fake.raw("payments/ws2")!.status).toBe("cancelled");
    expect(fake.raw("orders/o2")!.status).toBe("PENDING_PAYMENT");
  });
  it("does not touch payments younger than 3 minutes", async () => {
    pay("ws3", 1, "o3");
    const r = await reconcilePending(async () => ({ resultCode: 0, resultDesc: "ok" }));
    expect(r.checked).toBe(0);
    expect(fake.raw("payments/ws3")!.status).toBe("pending");
  });
  it("leaves a still-processing payment alone", async () => {
    pay("ws4", 10, "o4");
    const r = await reconcilePending(async () => null);
    expect(r).toMatchObject({ checked: 1, stillPending: 1, applied: 0 });
    expect(fake.raw("payments/ws4")!.status).toBe("pending");
  });
  it("times out a payment with no answer after 24 hours", async () => {
    pay("ws5", 25 * 60, "o5");
    const r = await reconcilePending(async () => null);
    expect(r.expired).toBe(1);
    expect(fake.raw("payments/ws5")!.status).toBe("timeout");
  });
  it("survives Safaricom errors and keeps going", async () => {
    pay("ws6", 10, "o6"); pay("ws7", 10, "o7");
    let n = 0;
    const r = await reconcilePending(async () => { if (n++ === 0) throw new Error("boom"); return { resultCode: 0, resultDesc: "ok" }; });
    expect(r.checked).toBe(2);
    expect(r.applied).toBe(1);
  });
  it("is safe to run twice", async () => {
    pay("ws8", 10, "o8");
    await reconcilePending(async () => ({ resultCode: 0, resultDesc: "ok" }));
    const again = await reconcilePending(async () => ({ resultCode: 0, resultDesc: "ok" }));
    expect(again.checked).toBe(0);
    expect((fake.raw("orders/o8")!.statusHistory as unknown[]).length).toBe(1);
  });
});

describe("reconcile notifications hook", () => {
  it("calls the hook for each payment it settles, and only those", async () => {
    pay("wsA", 10, "oA"); pay("wsB", 10, "oB");
    const called: string[] = [];
    await reconcilePending(async (id) => (id === "wsA" ? { resultCode: 0, resultDesc: "ok" } : null), async (id) => { called.push(id); });
    expect(called).toEqual(["wsA"]);
  });
});
