import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

interface Item { id: string; name: string; unit: string; quantity: number; minQuantity: number }
const status = (i: Item) => (i.quantity <= 0 ? ["Out of stock", "bg-coral text-white"] : i.quantity <= i.minQuantity ? ["Low stock", "bg-sun"] : ["Healthy", "bg-leaf text-white"]) as [string, string];

export default function Inventory() {
  const qc = useQueryClient(), q = useQuery({ queryKey: ["biz-inv"], queryFn: () => api<Item[]>("/business/inventory") });
  const save = useMutation({ mutationFn: (v: { id: string; quantity: number }) => api(`/business/inventory/${v.id}`, { method: "PATCH", body: { quantity: v.quantity } }), onSettled: () => qc.invalidateQueries({ queryKey: ["biz-inv"] }) });
  const [f, setF] = useState({ name: "", unit: "kg", quantity: "", minQuantity: "" });
  const add = useMutation({ mutationFn: () => api("/business/inventory", { method: "POST", body: { name: f.name, unit: f.unit, quantity: Number(f.quantity), minQuantity: Number(f.minQuantity) } }), onSuccess: () => { setF({ ...f, name: "", quantity: "", minQuantity: "" }); qc.invalidateQueries({ queryKey: ["biz-inv"] }); } });
  return (
    <div className="grid gap-4"><h1 className="font-display text-4xl font-extrabold">Inventory</h1>
      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid gap-2 rounded-3xl bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Ingredient name" placeholder="Ingredient (e.g. Flour)" className="rounded-xl border border-line bg-cream p-2" />
        <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} aria-label="Unit" className="rounded-xl border border-line bg-cream p-2">{["kg", "g", "l", "ml", "pcs", "tray", "box"].map((u) => <option key={u}>{u}</option>)}</select>
        <input required type="number" min={0} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} aria-label="In stock" placeholder="In stock" className="w-24 rounded-xl border border-line bg-cream p-2" />
        <input required type="number" min={0} value={f.minQuantity} onChange={(e) => setF({ ...f, minQuantity: e.target.value })} aria-label="Reorder level" placeholder="Reorder at" className="w-28 rounded-xl border border-line bg-cream p-2" />
        <button disabled={add.isPending} className="rounded-full bg-leaf px-4 py-2 font-bold text-white">Add</button>
        {add.isError && <p role="alert" className="text-sm text-coral sm:col-span-5">{(add.error as Error).message}</p>}</form>
      {save.isError && <p role="alert" className="rounded-2xl bg-peach p-3 text-sm">{(save.error as Error).message}</p>}
      {q.isLoading ? <div className="h-32 animate-pulse rounded-3xl bg-peach/60" /> : !q.data?.length ? <p className="rounded-3xl bg-white p-8 text-center text-mute">📦 No ingredients tracked yet.</p> :
        q.data.map((i) => { const [t, c] = status(i); return (
          <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3"><div className="min-w-32 flex-1"><b>{i.name}</b><p className="text-sm text-mute">Reorder at {i.minQuantity} {i.unit}</p></div>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${c}`}>{t}</span>
            <label className="text-sm">In stock ({i.unit})<input type="number" min={0} defaultValue={i.quantity} key={i.quantity} onBlur={(e) => Number(e.target.value) !== i.quantity && Number(e.target.value) >= 0 && save.mutate({ id: i.id, quantity: Number(e.target.value) })} className="ml-2 w-24 rounded-xl border border-line bg-cream p-2" /></label></div>); })}
    </div>
  );
}
