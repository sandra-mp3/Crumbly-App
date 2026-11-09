import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./helpers/fakeDb.js";

const fake = new FakeDb();
vi.mock("../firebase.js", () => ({ db: fake, auth: { getUser: async (uid: string) => ({ email: `${uid}@example.com` }) } }));
vi.mock("../env.js", () => ({ env: { WEB_URL: "https://crumbly.test" } }));
const { notify, onPaymentApplied, onOrderStatus, onCustomRequest } = await import("../notify.js");
const { orderStatusMessage } = await import("../templates.js");

const sent: { to: string; subject: string; text: string }[] = [];
const deps = { email: { send: async (to: string, subject: string, text: string) => { sent.push({ to, subject, text }); } } };
const inbox = (uid: string) => [...fake.store].filter(([k, v]) => k.startsWith("notifications/") && v.uid === uid).map(([, v]) => v);
beforeEach(() => {
  fake.reset(); sent.length = 0;
  fake.put("bakeryMembers/own_a", { uid: "own", bakeryId: "a", role: "BAKER_OWNER", active: true }); fake.put("bakeryMembers/mgr_a", { uid: "mgr", bakeryId: "a", role: "BAKER_MANAGER", active: true });
  fake.put("bakeryMembers/stf_a", { uid: "stf", bakeryId: "a", role: "BAKER_STAFF", active: true }); fake.put("bakeryMembers/old_a", { uid: "old", bakeryId: "a", role: "BAKER_OWNER", active: false }); fake.put("bakeryMembers/oth_b", { uid: "oth", bakeryId: "b", role: "BAKER_OWNER", active: true });
});

describe("notify", () => {
  it("stores an unread in-app notification and emails when asked", async () => {
    await notify({ uid: "u1", type: "t", title: "Hi", body: "Body", link: "/orders/1", email: true }, deps);
    expect(inbox("u1")[0]).toMatchObject({ title: "Hi", read: false, link: "/orders/1" });
    expect(sent).toEqual([{ to: "u1@example.com", subject: "Hi", text: "Body\n\nhttps://crumbly.test/orders/1" }]);
  });
  it("doesn't email when the message is in-app only", async () => { await notify({ uid: "u1", type: "t", title: "Hi", body: "B", link: "/", email: false }, deps); expect(sent.length).toBe(0); expect(inbox("u1").length).toBe(1); });
  it("respects a customer who turned email off", async () => {
    fake.put("users/u1", { notifyEmail: false });
    await notify({ uid: "u1", type: "t", title: "Hi", body: "B", link: "/", email: true }, deps);
    expect(sent.length).toBe(0); expect(inbox("u1").length).toBe(1);
  });
  it("never throws when the email provider fails, and keeps the in-app copy", async () => {
    await notify({ uid: "u1", type: "t", title: "Hi", body: "B", link: "/", email: true }, { email: { send: async () => { throw new Error("down"); } } });
    expect(inbox("u1").length).toBe(1);
  });
});
describe("events", () => {
  beforeEach(() => { fake.put("payments/ws1", { status: "success", orderIds: ["o1"] }); fake.put("orders/o1", { customerId: "cust", bakeryId: "a", total: 2650, items: [{ name: "Cake", qty: 1 }] }); });
  it("tells the customer and the whole bakery team about a paid order, and nobody else", async () => {
    await onPaymentApplied("ws1", deps);
    expect(inbox("cust")[0]).toMatchObject({ title: "Payment received" });
    for (const u of ["own", "mgr", "stf"]) expect(inbox(u)[0]).toMatchObject({ title: "New paid order" });
    expect(inbox("old").length + inbox("oth").length).toBe(0);
    expect(sent.map((s) => s.to)).toEqual(["cust@example.com"]);
  });
  it("does nothing for a payment that didn't succeed", async () => { fake.put("payments/ws1", { status: "failed", orderIds: ["o1"] }); await onPaymentApplied("ws1", deps); expect(inbox("cust").length).toBe(0); });
  it("keeps going if the payment doesn't exist", async () => { await onPaymentApplied("missing", deps); expect(inbox("cust").length).toBe(0); });
  it("sends order progress to the customer", async () => {
    await onOrderStatus({ id: "o1", customerId: "cust", fulfilment: "PICKUP" }, "READY", deps);
    expect(inbox("cust")[0]).toMatchObject({ title: "Ready for pickup", link: "/orders/o1" }); expect(sent.length).toBe(1);
    await onOrderStatus({ id: "o1", customerId: "cust", fulfilment: "PICKUP" }, "PREPARING", deps);
    expect(inbox("cust").length).toBe(1);
  });
  it("sends custom cake requests to owners and managers only", async () => {
    await onCustomRequest("a", "Strawberry Garden", deps);
    expect(inbox("own").length + inbox("mgr").length).toBe(2); expect(inbox("stf").length + inbox("oth").length).toBe(0);
  });
});
describe("templates", () => {
  it("covers the order journey differently for pickup and delivery", () => {
    expect(orderStatusMessage("READY", "PICKUP")!.email).toBe(true); expect(orderStatusMessage("READY", "DELIVERY")!.email).toBe(false);
    expect(orderStatusMessage("OUT_FOR_DELIVERY", "DELIVERY")!.title).toBe("On its way"); expect(orderStatusMessage("ORDER_RECEIVED", "PICKUP")).toBe(null);
  });
});
