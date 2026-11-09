import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

interface B { id: string; name: string; area: string; status: string; featured: boolean; rating: number }
const CHIP: Record<string, string> = { active: "bg-leaf text-white", pending: "bg-sun", suspended: "bg-coral text-white", draft: "bg-line" };
export default function AdminBakeries() {
  const qc = useQueryClient(), q = useQuery({ queryKey: ["admin-bakeries"], queryFn: () => api<B[]>("/admin/bakeries") });
  const act = useMutation({ mutationFn: (v: { id: string; action: string }) => api(`/admin/bakeries/${v.id}`, { method: "PATCH", body: { action: v.action } }), onSettled: () => { qc.invalidateQueries({ queryKey: ["admin-bakeries"] }); qc.invalidateQueries({ queryKey: ["admin-overview"] }); } });
  const go = (b: B, action: string, ask?: string) => (!ask || confirm(ask)) && act.mutate({ id: b.id, action });
  const rows = [...(q.data ?? [])].sort((a, b) => (a.status === "pending" ? -1 : 0) - (b.status === "pending" ? -1 : 0) || a.name.localeCompare(b.name));
  return (
    <div className="grid gap-3"><h1 className="font-display text-4xl font-extrabold">Bakeries</h1>
      {act.isError && <p role="alert" className="rounded-2xl bg-peach p-3 text-sm">{(act.error as Error).message}</p>}
      {q.isLoading ? <div className="h-32 animate-pulse rounded-3xl bg-peach/60" /> : rows.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3"><div className="min-w-40 flex-1"><b>{b.name}{b.featured && " ⭐"}</b><p className="text-sm text-mute">{b.area} · rating {b.rating}</p></div>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${CHIP[b.status] ?? "bg-line"}`}>{b.status}</span>
          {b.status === "pending" && <button disabled={act.isPending} onClick={() => go(b, "approve")} className="rounded-full bg-leaf px-4 py-2 font-bold text-white">Approve</button>}
          {b.status === "active" && <button disabled={act.isPending} onClick={() => go(b, b.featured ? "unfeature" : "feature")} className="rounded-full border border-line px-4 py-2">{b.featured ? "Unfeature" : "Feature"}</button>}
          {["active", "pending"].includes(b.status) && <button disabled={act.isPending} onClick={() => go(b, "suspend", `Suspend ${b.name}? Its products will be hidden and it can't take orders.`)} className="rounded-full border border-coral px-4 py-2 text-coral">Suspend</button>}
          {b.status === "suspended" && <button disabled={act.isPending} onClick={() => go(b, "reinstate")} className="rounded-full bg-ink px-4 py-2 font-bold text-cream">Reinstate</button>}</div>))}
    </div>
  );
}
