import { auth, db } from "./firebase.js";
import { emailProvider, type EmailProvider } from "./email.js";
import { env } from "./env.js";
import * as T from "./templates.js";

export interface Note { uid: string; type: string; title: string; body: string; link: string; email?: boolean }
export interface Deps { email: EmailProvider }
const defaults: Deps = { email: emailProvider };

/** Stores an in-app notification and optionally emails it (respecting the user's preference). Never throws: a failed notification must not fail the action that caused it. */
export async function notify(n: Note, deps: Deps = defaults) {
  try { await db.collection("notifications").doc().set({ uid: n.uid, type: n.type, title: n.title, body: n.body, link: n.link, read: false, createdAt: new Date() }); }
  catch { console.error(JSON.stringify({ level: "error", event: "notify_store_failed", type: n.type })); return; }
  if (!n.email) return;
  try {
    if (((await db.collection("users").doc(n.uid).get()).data()?.notifyEmail) === false) return;
    const email = (await auth.getUser(n.uid)).email;
    if (email) await deps.email.send(email, n.title, `${n.body}\n\n${env.WEB_URL}${n.link}`);
  } catch { console.error(JSON.stringify({ level: "error", event: "notify_email_failed", type: n.type })); }
}

async function notifyTeam(bakeryId: string, roles: string[], m: T.Message, type: string, link: string, deps: Deps) {
  const s = await db.collection("bakeryMembers").where("bakeryId", "==", bakeryId).where("active", "==", true).limit(50).get();
  for (const d of s.docs) { const x = d.data(); if (roles.includes(x.role as string)) await notify({ uid: x.uid as string, type, title: m.title, body: m.body, link, email: m.email }, deps); }
}
const guard = async (f: () => Promise<void>) => { try { await f(); } catch { console.error(JSON.stringify({ level: "error", event: "notify_event_failed" })); } };

/** Call after a payment was applied. Tells the customer and the bakery team; safe to call for non-success payments (it does nothing). */
export const onPaymentApplied = (checkoutRequestId: string, deps: Deps = defaults) => guard(async () => {
  const p = (await db.collection("payments").doc(checkoutRequestId).get()).data();
  if (!p || p.status !== "success") return;
  for (const id of p.orderIds as string[]) {
    const o = (await db.collection("orders").doc(id).get()).data();
    if (!o) continue;
    const c = T.paymentReceived(o.total as number);
    await notify({ uid: o.customerId as string, type: "payment", title: c.title, body: c.body, link: `/orders/${id}`, email: c.email }, deps);
    await notifyTeam(o.bakeryId as string, ["BAKER_OWNER", "BAKER_MANAGER", "BAKER_STAFF"], T.newOrderForBakery(o.items as { name: string; qty: number }[], o.total as number), "new_order", "/business/orders", deps);
  }
});
export const onOrderStatus = (o: { id: string; customerId: string; fulfilment: "PICKUP" | "DELIVERY" }, status: string, deps: Deps = defaults) => guard(async () => {
  const m = T.orderStatusMessage(status, o.fulfilment);
  if (m) await notify({ uid: o.customerId, type: "order_status", title: m.title, body: m.body, link: `/orders/${o.id}`, email: m.email }, deps);
});
export const onCustomRequest = (bakeryId: string, what: string, deps: Deps = defaults) => guard(() => notifyTeam(bakeryId, ["BAKER_OWNER", "BAKER_MANAGER"], T.customRequestForBakery(what), "custom_request", "/business/custom-orders", deps));
export const onQuote = (customerId: string, price: number | null, deps: Deps = defaults) => guard(async () => {
  const m = price === null ? T.quoteDeclined() : T.quoteReady(price);
  await notify({ uid: customerId, type: "custom_quote", title: m.title, body: m.body, link: "/custom-cake/requests", email: m.email }, deps);
});
