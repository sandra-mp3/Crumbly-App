import { createHash, randomBytes } from "node:crypto";
import { auth, db } from "./firebase.js";

export class InviteError extends Error {}
export type StaffRole = "BAKER_MANAGER" | "BAKER_STAFF";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** Returns the one-time token to put in the invite link. Only its hash is stored, so a database leak can't be used to join a bakery. */
export async function createInvite(bakeryId: string, email: string, role: StaffRole, invitedBy: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await db.collection("bakeryInvites").doc(hash(token)).set({ bakeryId, email: email.trim().toLowerCase(), role, status: "pending", invitedBy, createdAt: new Date(), expiresAt: new Date(Date.now() + 7 * 864e5) });
  return token;
}

/** The token alone isn't enough: the signed-in account's email must match the invited email. */
export async function acceptInvite(uid: string, token: string): Promise<{ bakeryId: string }> {
  const ref = db.collection("bakeryInvites").doc(hash(token)), email = ((await auth.getUser(uid)).email ?? "").toLowerCase();
  if (!(await db.collection("bakeryMembers").where("uid", "==", uid).where("active", "==", true).limit(1).get()).empty) throw new InviteError("You already belong to a bakery on Crumbly.");
  return db.runTransaction(async (tx) => {
    const inv = (await tx.get(ref)).data();
    if (!inv || inv.status !== "pending") throw new InviteError("This invitation isn't valid any more.");
    if (inv.expiresAt.toDate().getTime() < Date.now()) throw new InviteError("This invitation has expired. Ask the owner for a new one.");
    if (inv.email !== email) throw new InviteError("This invitation was sent to a different email address.");
    tx.set(db.collection("bakeryMembers").doc(`${uid}_${inv.bakeryId}`), { uid, bakeryId: inv.bakeryId, role: inv.role, active: true, joinedAt: new Date() });
    tx.update(ref, { status: "accepted", acceptedBy: uid, acceptedAt: new Date() });
    return { bakeryId: inv.bakeryId as string };
  });
}

export async function updateMember(bakeryId: string, actorUid: string, targetUid: string, patch: { role?: StaffRole; active?: boolean }) {
  if (targetUid === actorUid) throw new InviteError("You can't change your own access.");
  const ref = db.collection("bakeryMembers").doc(`${targetUid}_${bakeryId}`), cur = (await ref.get()).data();
  if (!cur || cur.bakeryId !== bakeryId) throw new InviteError("We couldn't find that team member.");
  if (cur.role === "BAKER_OWNER") throw new InviteError("The owner's access can't be changed.");
  await ref.update(patch);
}
