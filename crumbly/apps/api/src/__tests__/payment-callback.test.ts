import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./helpers/fakeDb.js";

const fake = new FakeDb();
vi.mock("../firebase.js", () => ({ db: fake, auth: {} }));
const { processMpesaCallback } = await import("../payments/process.js");

const cb = (over: Record<string, unknown> = {}) => ({ merchantRequestId: "m1", checkoutRequestId: "ws_CO_1", resultCode: 0, resultDesc: "ok", amount: 1000, receipt: "ABC123", ...over });
const order = (id: string, total: number) => ({ customerId: "u1", bakeryId: "a", total, status: "PENDING_PAYMENT", paymentStatus: "pending", statusHistory: [{ status: "PENDING_PAYMENT" }] });

beforeEach(() => {
  fake.reset();
  fake.put("payments/ws_CO_1", { status: "pending", orderIds: ["o1", "o2"], amount: 1000, customerId: "u1" });
  fake.put("orders/o1", order("o1", 400)); fake.put("orders/o2", order("o2", 600));
});

describe("M-Pesa callback processing", () => {
  it("confirms every order in the payment on success", async () => {
    expect(await processMpesaCallback(cb())).toBe("applied");
    expect(fake.raw("payments/ws_CO_1")).toMatchObject({ status: "success", receipt: "ABC123" });
    for (const id of ["o1", "o2"]) expect(fake.raw(`orders/${id}`)).toMatchObject({ status: "PAYMENT_CONFIRMED", paymentStatus: "success" });
  });
  it("is idempotent: a repeated callback changes nothing", async () => {
    await processMpesaCallback(cb());
    const before = JSON.stringify([fake.raw("orders/o1"), fake.raw("orders/o2"), fake.raw("payments/ws_CO_1")]);
    expect(await processMpesaCallback(cb())).toBe("duplicate");
    expect(JSON.stringify([fake.raw("orders/o1"), fake.raw("orders/o2"), fake.raw("payments/ws_CO_1")])).toBe(before);
    expect((fake.raw("orders/o1")!.statusHistory as unknown[]).length).toBe(2);
  });
  it("does not trust a success with the wrong amount", async () => {
    await processMpesaCallback(cb({ amount: 10 }));
    expect(fake.raw("payments/ws_CO_1")!.status).toBe("failed");
    for (const id of ["o1", "o2"]) expect(fake.raw(`orders/${id}`)).toMatchObject({ status: "PENDING_PAYMENT", paymentStatus: "failed" });
  });
  it("leaves orders payable again after a cancelled prompt", async () => {
    await processMpesaCallback(cb({ resultCode: 1032, amount: undefined, receipt: undefined }));
    expect(fake.raw("payments/ws_CO_1")!.status).toBe("cancelled");
    expect(fake.raw("orders/o1")).toMatchObject({ status: "PENDING_PAYMENT", paymentStatus: "cancelled" });
  });
  it("records a timeout", async () => {
    await processMpesaCallback(cb({ resultCode: 1037 }));
    expect(fake.raw("payments/ws_CO_1")!.status).toBe("timeout");
  });
  it("ignores callbacks for payments we never started", async () => {
    expect(await processMpesaCallback(cb({ checkoutRequestId: "ws_CO_unknown" }))).toBe("unknown");
    expect(fake.raw("orders/o1")!.status).toBe("PENDING_PAYMENT");
  });
  it("does not let a late success overwrite a failed payment", async () => {
    await processMpesaCallback(cb({ resultCode: 2001 }));
    expect(await processMpesaCallback(cb())).toBe("duplicate");
    expect(fake.raw("orders/o1")!.status).toBe("PENDING_PAYMENT");
  });
});
