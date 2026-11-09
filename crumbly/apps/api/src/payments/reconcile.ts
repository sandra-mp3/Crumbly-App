import { db } from "../firebase.js";
import { processMpesaCallback } from "./process.js";

export type StkQuery = (checkoutRequestId: string) => Promise<{ resultCode: number; resultDesc: string } | null>;

/**
 * Safety net for lost callbacks. Asks Safaricom directly about payments still pending after 3 minutes and applies the answer
 * through the same idempotent path as a normal callback. Pending for over 24h with no answer => timeout.
 * The query response carries no amount or receipt, so we apply the stored amount (the result itself comes from our authenticated call to Safaricom).
 */
export async function reconcilePending(query: StkQuery, after?: (checkoutRequestId: string) => Promise<void>, now = Date.now()) {
  const s = await db.collection("payments").where("status", "==", "pending").where("createdAt", "<=", new Date(now - 3 * 60_000)).limit(50).get();
  const out = { checked: 0, applied: 0, stillPending: 0, expired: 0, errors: 0 };
  for (const d of s.docs) {
    out.checked++;
    try {
      const p = d.data()!, base = { merchantRequestId: (p.merchantRequestId as string | null) ?? "", checkoutRequestId: d.id, amount: p.amount as number };
      const r = await query(d.id).catch(() => null);
      if (r) { await processMpesaCallback({ ...base, resultCode: r.resultCode, resultDesc: r.resultDesc }); out.applied++; await after?.(d.id); }
      else if (p.createdAt.toDate().getTime() < now - 24 * 3600_000) { await processMpesaCallback({ ...base, resultCode: 1037, resultDesc: "No result after 24 hours" }); out.expired++; }
      else out.stillPending++;
    } catch { out.errors++; }
  }
  return out;
}
