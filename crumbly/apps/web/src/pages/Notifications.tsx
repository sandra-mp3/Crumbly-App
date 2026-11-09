import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useSeo } from "../lib/seo";
import RequireAuth from "./RequireAuth";

interface N { id: string; title: string; body: string; link: string; read: boolean; createdAt: string }
export const useNotifications = (enabled: boolean) => useQuery({ queryKey: ["notifs"], enabled, refetchInterval: 60_000, queryFn: () => api<{ unread: number; items: N[] }>("/notifications") });
const ago = (iso: string) => { const m = Math.floor((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`; };

function Inner() {
  useSeo({ title: "Notifications | Crumbly", noindex: true });
  const nav = useNavigate(), qc = useQueryClient(), q = useNotifications(true);
  const read = useMutation({ mutationFn: (id?: string) => api("/notifications/read", { method: "POST", body: id ? { id } : {} }), onSettled: () => qc.invalidateQueries({ queryKey: ["notifs"] }) });
  return (
    <div className="mx-auto grid max-w-2xl gap-3 px-4 py-8"><div className="flex items-center justify-between"><h1 className="font-display text-4xl font-extrabold">Notifications</h1>{!!q.data?.unread && <button onClick={() => read.mutate(undefined)} className="font-bold underline">Mark all read</button>}</div>
      {q.isLoading ? <div className="h-32 animate-pulse rounded-3xl bg-peach/60" /> : !q.data?.items.length ? <div className="p-10 text-center"><div className="text-6xl">🔔</div><p className="my-3 text-lg">Nothing yet. Order updates will show up here.</p></div> :
        q.data.items.map((n) => <button key={n.id} onClick={() => { if (!n.read) read.mutate(n.id); nav(n.link); }} className={`grid gap-1 rounded-2xl p-4 text-left ${n.read ? "bg-white" : "bg-sun"}`}><b>{n.title}</b><span className="text-sm">{n.body}</span><span className="text-xs text-mute">{ago(n.createdAt)}</span></button>)}
    </div>
  );
}
export default function Notifications() { return <RequireAuth reason="Sign in to see your notifications."><Inner /></RequireAuth>; }
