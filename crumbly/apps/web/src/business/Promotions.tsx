import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ksh } from "../types";

interface P { code: string; name: string; type: string; value: number; minSubtotal: number; startsAt: string; endsAt: string; uses: number; maxUses: number | null; status: string }
const CHIP: Record<string, string> = { active: "bg-leaf text-white", scheduled: "bg-sun", expired: "bg-line", paused: "bg-line", used_up: "bg-line" };
const today = () => new Date().toISOString().slice(0, 10);
const describe = (p: P) => (p.type === "PERCENT" ? `${p.value}% off` : p.type === "FIXED" ? `${ksh(p.value)} off` : "Free delivery") + (p.minSubtotal ? ` over ${ksh(p.minSubtotal)}` : "");
const field = "mt-1 w-full rounded-xl border border-line bg-cream p-2";

export default function Promotions() {
  const qc = useQueryClient(), q = useQuery({ queryKey: ["biz-promos"], queryFn: () => api<P[]>("/business/promotions") }), [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", type: "PERCENT", value: "10", code: "", minSubtotal: "", startsAt: today(), endsAt: "", maxUses: "", oncePerCustomer: true });
  const refresh = () => qc.invalidateQueries({ queryKey: ["biz-promos"] });
  const create = useMutation({
    mutationFn: () => api("/business/promotions", { method: "POST", body: { name: f.name, type: f.type, value: f.type === "FREE_DELIVERY" ? 0 : Number(f.value), code: f.code, minSubtotal: Number(f.minSubtotal || 0), startsAt: f.startsAt, endsAt: f.endsAt, maxUses: f.maxUses ? Number(f.maxUses) : null, oncePerCustomer: f.oncePerCustomer } }),
    onSuccess: () => { setOpen(false); setF({ ...f, name: "", code: "" }); refresh(); },
  });
  const toggle = useMutation({ mutationFn: (v: { code: string; active: boolean }) => api(`/business/promotions/${v.code}`, { method: "PATCH", body: { active: v.active } }), onSettled: refresh });
  return (
    <div className="grid gap-4"><div className="flex items-center justify-between"><h1 className="font-display text-4xl font-extrabold">Promotions</h1><button onClick={() => setOpen(!open)} className="rounded-full bg-leaf px-5 py-2 font-bold text-white">{open ? "Close" : "New promotion"}</button></div>
      {open && <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid gap-3 rounded-3xl bg-white p-5 sm:grid-cols-2">
        <label className="text-sm font-medium">Name<input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={field} /></label>
        <label className="text-sm font-medium">Code customers type<input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} pattern="[A-Za-z0-9]{3,20}" placeholder="WEEKEND15" className={field} /></label>
        <label className="text-sm font-medium">Type<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={field}><option value="PERCENT">Percentage off</option><option value="FIXED">Fixed amount off</option><option value="FREE_DELIVERY">Free delivery</option></select></label>
        {f.type !== "FREE_DELIVERY" && <label className="text-sm font-medium">{f.type === "PERCENT" ? "Percent (1 to 90)" : "Amount (KSh)"}<input required type="number" min={1} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} className={field} /></label>}
        <label className="text-sm font-medium">Starts<input required type="date" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} className={field} /></label>
        <label className="text-sm font-medium">Ends<input required type="date" min={f.startsAt} value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} className={field} /></label>
        <label className="text-sm font-medium">Minimum spend (KSh, optional)<input type="number" min={0} value={f.minSubtotal} onChange={(e) => setF({ ...f, minSubtotal: e.target.value })} className={field} /></label>
        <label className="text-sm font-medium">Total uses allowed (optional)<input type="number" min={1} value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} className={field} /></label>
        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={f.oncePerCustomer} onChange={(e) => setF({ ...f, oncePerCustomer: e.target.checked })} />Each customer can use it once</label>
        {create.isError && <p role="alert" className="text-sm text-coral sm:col-span-2">{(create.error as Error).message}</p>}
        <button disabled={create.isPending} className="rounded-full bg-ink py-2.5 font-bold text-cream sm:col-span-2">Create promotion</button></form>}
      {toggle.isError && <p role="alert" className="rounded-2xl bg-peach p-3 text-sm">{(toggle.error as Error).message}</p>}
      {q.isLoading ? <div className="h-32 animate-pulse rounded-3xl bg-peach/60" /> : !q.data?.length ? <p className="rounded-3xl bg-white p-8 text-center text-mute">🏷️ No promotions yet. A weekend code is a good way to start.</p> :
        q.data.map((p) => (
          <article key={p.code} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4"><div className="min-w-48 flex-1"><b>{p.name}</b> <code className="rounded bg-cream px-2 py-0.5">{p.code}</code><p className="text-sm text-mute">{describe(p)} · {p.startsAt} to {p.endsAt} · used {p.uses}{p.maxUses ? ` of ${p.maxUses}` : ""} times</p></div>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${CHIP[p.status] ?? "bg-line"}`}>{p.status.replace("_", " ")}</span>
            {["active", "scheduled", "paused"].includes(p.status) && <button disabled={toggle.isPending} onClick={() => toggle.mutate({ code: p.code, active: p.status === "paused" })} className="rounded-full border border-line px-4 py-2">{p.status === "paused" ? "Resume" : "Pause"}</button>}</article>))}
    </div>
  );
}
