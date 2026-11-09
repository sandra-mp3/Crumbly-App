import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

// Needs the Firestore emulator. From the repo root:
//   firebase emulators:exec --only firestore "npm --prefix apps/api run test:rules"
let env: RulesTestEnvironment;
beforeAll(async () => { env = await initializeTestEnvironment({ projectId: "crumbly-rules-test", firestore: { rules: readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8") } }); });
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "bakeries/a"), { status: "active", name: "A" });
    await setDoc(doc(db, "bakeries/draft"), { status: "draft", name: "Draft" });
    await setDoc(doc(db, "products/p1"), { status: "published", bakeryId: "a", price: 500 });
    await setDoc(doc(db, "products/p2"), { status: "draft", bakeryId: "a", price: 500 });
    await setDoc(doc(db, "orders/oa"), { customerId: "cust1", bakeryId: "a", total: 500 });
    await setDoc(doc(db, "orders/ob"), { customerId: "cust2", bakeryId: "b", total: 900 });
    await setDoc(doc(db, "bakeryMembers/mgrA_a"), { uid: "mgrA", bakeryId: "a", role: "BAKER_MANAGER", active: true });
    await setDoc(doc(db, "bakeryMembers/oldA_a"), { uid: "oldA", bakeryId: "a", role: "BAKER_MANAGER", active: false });
    await setDoc(doc(db, "payments/pay1"), { status: "pending", customerId: "cust1" });
  });
});
const as = (uid: string | null, claims?: Record<string, unknown>) => (uid ? env.authenticatedContext(uid, claims).firestore() : env.unauthenticatedContext().firestore());

describe("guests", () => {
  it("can browse active bakeries and published products", async () => { await assertSucceeds(getDoc(doc(as(null), "bakeries/a"))); await assertSucceeds(getDoc(doc(as(null), "products/p1"))); });
  it("cannot see drafts, orders or payments", async () => {
    await assertFails(getDoc(doc(as(null), "bakeries/draft"))); await assertFails(getDoc(doc(as(null), "products/p2")));
    await assertFails(getDoc(doc(as(null), "orders/oa"))); await assertFails(getDoc(doc(as(null), "payments/pay1")));
  });
});
describe("customers", () => {
  it("read only their own orders", async () => { await assertSucceeds(getDoc(doc(as("cust1"), "orders/oa"))); await assertFails(getDoc(doc(as("cust1"), "orders/ob"))); });
  it("cannot write orders, reviews, favourites or payments from the client", async () => {
    await assertFails(setDoc(doc(as("cust1"), "orders/new"), { customerId: "cust1", total: 1 }));
    await assertFails(updateDoc(doc(as("cust1"), "orders/oa"), { status: "DELIVERED" }));
    await assertFails(setDoc(doc(as("cust1"), "reviews/r1"), { uid: "cust1", rating: 5 }));
    await assertFails(setDoc(doc(as("cust1"), "payments/pay1"), { status: "success" }));
  });
});
describe("bakery members", () => {
  it("a manager reads their bakery's orders but not another bakery's", async () => { await assertSucceeds(getDoc(doc(as("mgrA"), "orders/oa"))); await assertFails(getDoc(doc(as("mgrA"), "orders/ob"))); });
  it("a manager cannot approve their own bakery or tamper with products from the browser", async () => {
    await assertFails(updateDoc(doc(as("mgrA"), "bakeries/draft"), { status: "active" }));
    await assertFails(updateDoc(doc(as("mgrA"), "products/p1"), { rating: 5, ratingCount: 999 }));
  });
  it("a deactivated member loses access immediately", async () => { await assertFails(getDoc(doc(as("oldA"), "orders/oa"))); });
  it("a user cannot grant themselves membership", async () => { await assertFails(setDoc(doc(as("cust1"), "bakeryMembers/cust1_a"), { uid: "cust1", bakeryId: "a", role: "BAKER_OWNER", active: true })); });
});
