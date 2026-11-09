import { auth } from "./firebase";
const BASE = import.meta.env.VITE_API_URL ?? "/api";
interface Opts { method?: string; body?: unknown; headers?: Record<string, string> }

export async function api<T>(path: string, o: Opts = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: o.method ?? "GET",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...o.headers },
      body: o.body ? JSON.stringify(o.body) : undefined,
    });
  } catch { throw new Error("Network error. Check your connection and try again."); }
  const j = (await res.json().catch(() => null)) as { ok: boolean; data: T; error?: string } | null;
  if (!res.ok || !j?.ok) throw new Error(j?.error ?? "Something went wrong. Please try again.");
  return j.data;
}
