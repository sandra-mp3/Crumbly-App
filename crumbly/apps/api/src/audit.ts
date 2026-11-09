import { db } from "./firebase.js";
/** Append-only record of privileged actions (admin approvals, suspensions, review removals). Never log secrets or PII here. */
export async function audit(actorUid: string | null, action: string, target: string, meta: Record<string, unknown> = {}) {
  await db.collection("auditLogs").doc().set({ actorUid, action, target, meta, at: new Date() });
}
