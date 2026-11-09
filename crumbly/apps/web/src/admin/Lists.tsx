import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ksh } from "../types";

const Skel = () => <div className="h-32 animate-pulse rounded-3xl bg-peach/60" />;
export function AdminOrders() {
  const q = useQuery({ queryKey: ["admin-orders"], queryFn: () => api<{ id: string; bakeryId: string; total: number; status: string; paymentStatus: string; fulfilment: string; createdAt: string | null }[]>("/admin/orders") });
  return (<div className="grid gap-2"><h1 className="font-display text-4xl font-extrabold">Recent orders</h1>{q.isLoading ? <Skel /> : !q.data?.length ? <p className="rounded-3xl bg-white p-8 text-center text-mute">No orders yet.</p> : q.data.map((o) => (
    <div key={o.id} className="flex flex-wrap justify-between gap-2 rounded-2xl bg-white p-3"><span><b>{o.bakeryId}</b> · {o.fulfilment.toLowerCase()} · {o.status.replaceAll("_", " ").toLowerCase()}</span><span>{ksh(o.total)} · pay: {o.paymentStatus}{o.createdAt && ` · ${o.createdAt.slice(0, 10)}`}</span></div>))}</div>);
}
export function AdminUsers() {
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => api<{ uid: string; email: string | null; name: string | null; role: string; disabled: boolean }[]>("/admin/users") });
  return (<div className="grid gap-2"><h1 className="font-display text-4xl font-extrabold">Users</h1>{q.isLoading ? <Skel /> : q.data?.map((u) => (
    <div key={u.uid} className="flex flex-wrap justify-between gap-2 rounded-2xl bg-white p-3"><span><b>{u.name ?? u.email ?? u.uid}</b>{u.name && u.email && <span className="text-mute"> · {u.email}</span>}</span><span className="rounded-full bg-peach px-3 py-1 text-sm font-bold">{u.role}{u.disabled && " · disabled"}</span></div>))}</div>);
}
export function AdminReports() {
  const qc = useQueryClient(), q = useQuery({ queryKey: ["admin-reports"], queryFn: () => api<{ id: string; reason: string; review: { rating: number; text: string; author: string } | null }[]>("/admin/reports") });
  const resolve = useMutation({ mutationFn: (v: { id: string; action: string }) => api(`/admin/reports/${v.id}/resolve`, { method: "POST", body: { action: v.action } }), onSettled: () => { qc.invalidateQueries({ queryKey: ["admin-reports"] }); qc.invalidateQueries({ queryKey: ["admin-overview"] }); } });
  return (<div className="grid gap-3"><h1 className="font-display text-4xl font-extrabold">Reported reviews</h1>
    {resolve.isError && <p role="alert" className="rounded-2xl bg-peach p-3 text-sm">{(resolve.error as Error).message}</p>}
    {q.isLoading ? <Skel /> : !q.data?.length ? <p className="rounded-3xl bg-white p-8 text-center text-mute">✓ No open reports.</p> : q.data.map((r) => (
      <article key={r.id} className="grid gap-2 rounded-2xl bg-white p-4"><p className="text-sm text-mute">Reported as: {r.reason.replaceAll("_", " ")}</p>
        {r.review ? <p>{"⭐".repeat(r.review.rating)} <b>{r.review.author}</b>: {r.review.text || <i>(no text)</i>}</p> : <p className="text-mute">The review no longer exists.</p>}
        <div className="flex gap-2"><button disabled={resolve.isPending} onClick={() => confirm("Remove this review?") && resolve.mutate({ id: r.id, action: "remove" })} className="rounded-full bg-coral px-4 py-2 font-bold text-white">Remove review</button><button disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, action: "dismiss" })} className="rounded-full border border-line px-4 py-2">Dismiss</button></div></article>))}</div>);
}
