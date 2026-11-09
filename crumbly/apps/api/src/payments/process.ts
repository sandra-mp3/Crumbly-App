import { db } from "../firebase.js";
import { mapResult, type StkCallback } from "./utils.js";

export type CallbackOutcome = "applied" | "duplicate" | "unknown";

/**
 * Applies a Daraja STK callback exactly once. Runs in one Firestore transaction keyed by CheckoutRequestID:
 * repeats are no-ops, unknown ids are ignored, and a success whose amount doesn't match the stored amount is treated as failed.
 */
export function processMpesaCallback(cb: StkCallback): Promise<CallbackOutcome> {
  return db.runTransaction(async (tx) => {
    const pRef = db.collection("payments").doc(cb.checkoutRequestId), pd = (await tx.get(pRef)).data();
    if (!pd) return "unknown" as const;
    if (pd.status !== "pending") return "duplicate" as const;
    const orderSnaps = await Promise.all((pd.orderIds as string[]).map((id) => tx.get(db.collection("orders").doc(id))));
    let status = mapResult(cb.resultCode);
    if (status === "success" && cb.amount !== pd.amount) status = "failed";
    tx.update(pRef, { status, resultCode: cb.resultCode, resultDesc: cb.resultDesc.slice(0, 200), receipt: cb.receipt ?? null, updatedAt: new Date() });
    for (const s of orderSnaps) {
      const o = s.data();
      if (!o) continue;
      if (status === "success" && o.status === "PENDING_PAYMENT")
        tx.update(s.ref, { paymentStatus: "success", status: "PAYMENT_CONFIRMED", paidAt: new Date(), statusHistory: [...((o.statusHistory as unknown[]) ?? []), { status: "PAYMENT_CONFIRMED", at: new Date() }] });
      else if (status !== "success") tx.update(s.ref, { paymentStatus: status }); // stays PENDING_PAYMENT so the customer can retry
    }
    return "applied" as const;
  });
}
