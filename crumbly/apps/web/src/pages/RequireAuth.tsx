import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
export default function RequireAuth({ reason, children }: { reason: string; children: ReactNode }) {
  const { user, loading, requireAuth } = useAuth();
  if (loading) return <div className="mx-auto max-w-xl animate-pulse p-10"><div className="h-40 rounded-3xl bg-peach/60" /></div>;
  if (user) return <>{children}</>;
  return <div className="mx-auto max-w-md p-10 text-center"><div className="text-6xl">🔐</div><p className="my-4 text-lg">{reason}</p><button onClick={() => requireAuth(reason)} className="rounded-full bg-ink px-6 py-3 font-bold text-cream">Sign in</button></div>;
}
