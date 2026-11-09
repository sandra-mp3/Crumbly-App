import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { STATUS_LABEL, type CustomReq } from "../pages/CustomRequests";
import { ksh } from "../types";

function Card({ r, canQuote }: { r: CustomReq; canQuote: boolean }) {
  const qc = useQueryClient(), [price, setPrice] = useState(r.quote ? String(r.quote) : ""), [note, setNote] = useState(r.bakerNote ?? "");
  const send = useMutation({ mutationFn: (body: object) => api(`/custom-orders/${r.id}/quote`, { method: "POST", body }), onSuccess: () => qc.invalidateQueries({ queryKey: ["biz-custom"] }) });
  const s = r.spec, open = ["REQUESTED", "QUOTED"].includes(r.status);
  return (
    <article className="grid gap-2 rounded-3xl bg-white p-4">
      <div className="flex justify-between"><b>{s.theme || s.cakeType}</b><span className="rounded-full bg-peach px-3 py-1 text-sm font-bold">{STATUS_LABEL[r.status] ?? r.status}</span></div>
      <p className="text-sm">{s.cakeType} · {s.servings} guests · {s.flavour}{s.filling && ` · ${s.filling}`} · {s.frosting}{s.colours && ` · ${s.colours}`}</p>
      {s.event && <p className="text-sm text-mute">Event: {s.event}</p>}{s.message && <p className="text-sm">Message on cake: “{s.message}”</p>}{s.description && <p className="text-sm text-mute">{s.description}</p>}
      <p className="text-sm text-mute">Needed by {r.neededBy} · {r.fulfilment.toLowerCase()}</p>
      {r.images.length > 0 && <div className="flex gap-2">{r.images.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Customer inspiration" className="h-16 w-16 rounded-xl object-cover" /></a>)}</div>}
      {send.isError && <p role="alert" className="rounded-xl bg-peach p-2 text-sm">{(send.error as Error).message}</p>}
      {open && canQuote && <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Price (KSh)<input type="number" min={500} value={price} onChange={(e) => setPrice(e.target.value)} className="ml-2 w-28 rounded-xl border border-line bg-cream p-2" /></label>
        <label className="min-w-40 flex-1 text-sm">Note<input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ready by 2pm, 2-tier…" className="ml-2 w-full rounded-xl border border-line bg-cream p-2" /></label>
        <button disabled={send.isPending || Number(price) < 500} onClick={() => send.mutate({ action: "quote", price: Number(price), note })} className="rounded-full bg-leaf px-4 py-2 font-bold text-white disabled:opacity-50">{r.status === "QUOTED" ? `Update quote (${ksh(r.quote!)})` : "Send quote"}</button>
        <button disabled={send.isPending} onClick={() => confirm("Decline this request?") && send.mutate({ action: "decline", note })} className="rounded-full border border-line px-4 py-2">Decline</button></div>}
    </article>
  );
}
export default function CustomOrders() {
  const q = useQuery({ queryKey: ["biz-custom"], queryFn: () => api<CustomReq[]>("/custom-orders?scope=business"), refetchInterval: 30_000 });
  const me = useQuery({ queryKey: ["me-role"], queryFn: () => api<{ role: string }>("/me") });
  return (
    <div className="grid gap-4"><h1 className="font-display text-4xl font-extrabold">Custom orders</h1>
      {q.isLoading ? <div className="h-32 animate-pulse rounded-3xl bg-peach/60" /> : !q.data?.length ? <p className="rounded-3xl bg-white p-8 text-center text-mute">🎂 No custom requests yet.</p> : q.data.map((r) => <Card key={r.id} r={r} canQuote={me.data?.role !== "BAKER_STAFF"} />)}</div>
  );
}
