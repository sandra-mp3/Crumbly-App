// Usage: node --env-file=../../.env --import tsx scripts/make-admin.ts someone@example.com  (they must sign in again afterwards)
import { auth } from "../src/firebase.js";
const email = process.argv[2];
if (!email) throw new Error("Usage: make-admin <email>");
const u = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(u.uid, { ...(u.customClaims ?? {}), role: "ADMIN" });
console.log(`${email} is now an admin. Ask them to sign out and back in.`);
