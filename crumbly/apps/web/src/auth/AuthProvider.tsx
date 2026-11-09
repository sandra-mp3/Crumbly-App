import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut as fbSignOut, type User } from "firebase/auth";
import { auth } from "../lib/firebase";

interface Ctx { user: User | null; loading: boolean; /** Runs `run` now if signed in; otherwise opens the sign-in modal and runs it right after sign-in. */ requireAuth: (reason: string, run?: () => void) => void; signOut: () => void }
const C = createContext<Ctx>(null!);
export const useAuth = () => useContext(C);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState<string | null>(null);
  const pending = useRef<(() => void) | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u); setLoading(false);
    if (u) { setPrompt(null); const run = pending.current; pending.current = undefined; run?.(); } // continue what the guest was doing
  }), []);

  const requireAuth = useCallback((reason: string, run?: () => void) => {
    if (auth.currentUser) return run?.();
    pending.current = run; setPrompt(reason);
  }, []);
  const close = () => { pending.current = undefined; setPrompt(null); };

  return <C.Provider value={{ user, loading, requireAuth, signOut: () => void fbSignOut(auth) }}>{children}{prompt && <AuthModal reason={prompt} onClose={close} />}</C.Provider>;
}

const friendly = (e: unknown) => {
  const c = (e as { code?: string }).code ?? "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "That email and password don't match.";
  if (c.includes("email-already-in-use")) return "That email already has an account. Try signing in.";
  if (c.includes("weak-password")) return "Use a password with at least 6 characters.";
  if (c.includes("popup-closed")) return "";
  return "We couldn't sign you in. Please try again.";
};

function AuthModal({ reason, onClose }: { reason: string; onClose: () => void }) {
  const [signup, setSignup] = useState(false), [email, setEmail] = useState(""), [pw, setPw] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const go = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(friendly(e)); } setBusy(false); };
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="auth-t" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-6">
        <h2 id="auth-t" className="font-display text-3xl font-extrabold">{signup ? "Create your account" : "Sign in to continue"}</h2>
        <p className="mt-1 text-mute">{reason}</p>
        <button disabled={busy} onClick={() => go(() => signInWithPopup(auth, new GoogleAuthProvider()))} className="mt-4 w-full rounded-full border-2 border-ink py-2.5 font-bold">Continue with Google</button>
        <form className="mt-3 grid gap-2" onSubmit={(e) => { e.preventDefault(); go(() => (signup ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(auth, email, pw)); }}>
          <label className="text-sm font-medium">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-cream p-3" /></label>
          <label className="text-sm font-medium">Password<input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-cream p-3" /></label>
          {err && <p role="alert" className="text-sm text-coral">{err}</p>}
          <button disabled={busy} className="mt-1 rounded-full bg-leaf py-2.5 font-bold text-white">{signup ? "Sign up" : "Sign in"}</button>
        </form>
        <div className="mt-3 flex justify-between text-sm"><button onClick={() => setSignup(!signup)} className="underline">{signup ? "I already have an account" : "Create an account"}</button><button onClick={onClose}>Keep browsing</button></div>
      </div>
    </div>
  );
}
