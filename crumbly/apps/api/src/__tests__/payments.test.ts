import { describe, expect, it } from "vitest";
import { mapResult, normalizePhone, parseCallback } from "../payments/utils.js";
import { canTransition } from "../orders-transitions.js";

describe("phone", () => {
  it("normalises Kenyan formats", () => { for (const p of ["0712345678", "+254712345678", "712345678", "0712 345 678"]) expect(normalizePhone(p)).toBe("254712345678"); });
  it("rejects bad numbers", () => { expect(normalizePhone("12345")).toBeNull(); expect(normalizePhone("0612345678")).toBeNull(); });
});
describe("daraja result mapping", () => {
  it("maps codes", () => { expect(mapResult(0)).toBe("success"); expect(mapResult(1032)).toBe("cancelled"); expect(mapResult(1037)).toBe("timeout"); expect(mapResult(2001)).toBe("failed"); });
  it("parses a success callback", () => {
    const cb = parseCallback({ Body: { stkCallback: { MerchantRequestID: "m", CheckoutRequestID: "c", ResultCode: 0, ResultDesc: "ok", CallbackMetadata: { Item: [{ Name: "Amount", Value: 450 }, { Name: "MpesaReceiptNumber", Value: "ABC123" }] } } } });
    expect(cb).toMatchObject({ checkoutRequestId: "c", amount: 450, receipt: "ABC123" });
  });
  it("returns null for junk", () => expect(parseCallback({ hello: 1 })).toBeNull());
});
describe("order transitions", () => {
  it("allows the happy path", () => { expect(canTransition("PAYMENT_CONFIRMED", "ORDER_RECEIVED", "DELIVERY")).toBe(true); expect(canTransition("READY", "OUT_FOR_DELIVERY", "DELIVERY")).toBe(true); });
  it("blocks skipping, reversing and pickup dispatch", () => {
    expect(canTransition("CONFIRMED", "READY", "DELIVERY")).toBe(false);
    expect(canTransition("DELIVERED", "PREPARING", "DELIVERY")).toBe(false);
    expect(canTransition("READY", "OUT_FOR_DELIVERY", "PICKUP")).toBe(false);
  });
});
