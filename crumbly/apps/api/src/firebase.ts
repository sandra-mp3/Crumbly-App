import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "./env.js";

if (!getApps().length) {
  if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: env.FIREBASE_PROJECT_ID }); // local dev against the Firebase emulators: no credentials needed
  else {
    if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) throw new Error("Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or run against the Firebase emulators.");
    initializeApp({ credential: cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
  }
}
export const auth = getAuth();
export const db = getFirestore();
