import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const app = initializeApp({ apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "demo-key", authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET });
export const auth = getAuth(app);
export const storage = getStorage(app);
if (import.meta.env.VITE_USE_EMULATORS === "true") { // local dev: talk to the Firebase emulators instead of production
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
