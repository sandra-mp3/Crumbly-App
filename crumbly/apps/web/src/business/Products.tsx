import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { api } from "../lib/api";
import { storage } from "../lib/firebase";
import { useMe } from "../lib/useMe";
import { ksh, type Product } from "../types";

type P = Product & { status: string };
const STATUSES = ["draft", "published", "paused", "out_of_stock", "archived"], CATS = ["Cakes", "Cupcakes", "Cookies", "Bread", "Croissants", "Doughnuts", "Pastries", "Tarts", "Desserts", "Breakfast", "Custom Cakes"];

export default function Products() {
  const me = useMe(), [upErr, setUpErr] = useState(""), qc = useQueryClient(), q = useQuery({ queryKey: ["biz-products"], queryFn: () => api<P[]>("/business/products") });
  const [f, setF] = useState({ name: "", category: "Cakes", price: "", prepMinutes: "60" }), [open, setOpen] = useState(false);
  const done = () => qc.invalidateQueries({ queryKey: ["biz-products"] });
  const create = useMutation({ mutationFn: () => api("/business/products", { method: "POST", body: { name: f.name, category: f.category, price: Number(f.price), prepMinutes: Number(f.prepMinutes) } }), onSuccess: () => { setF({ ...f, name: "", price: "" }); setOpen(false); done(); } });
  const patch = useMutation({ mutationFn: (v: { id: string; body: object }) => api(`/business/products/${v.id}`, { method: "PATCH", body: v.body }), onSettled: done });
  async function upload(file: File | undefined, id: string) {
    setUpErr(""); if (!file || !me.data?.bakeryId) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) return setUpErr("Choose a JPG, PNG or WebP photo under 5 MB.");
    try {
      const r = ref(storage, `products/${me.data.bakeryId}/${id}-${Date.now()}`);
      await uploadBytes(r, file, { contentType: file.type });
      patch.mutate({ id, body: { image: await getDownloadURL(r) } });
    } catch { setUpErr("The photo didn't upload. Please try again."); }
  }
  return (
    <div className="grid gap-4">
      {upErr && <p role="alert" className="rounded-2xl bg-peach p-3 text-sm">{upErr}</p>}
      <div className="flex items-center justify-between"><h1 className="font-display text-4xl font-extrabold">Products</h1><button onClick={() => setOpen(!open)} className="rounded-full bg-leaf px-5 py-2 font-bold text-white">{open ? "Close" : "Add product"}</button></div>
      {open && <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid gap-3 rounded-3xl bg-white p-5 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">Name<input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-cream p-3" /></label>
        <label className="text-sm font-medium">Category<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-cream p-3">{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="text-sm font-medium">Price (KSh)<input required type="number" min={1} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-cream p-3" /></label>
        <label className="text-sm font-medium">Preparation time (minutes)<input required type="number" min={5} value={f.prepMinutes} onChange={(e) => setF({ ...f, prepMinutes: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-cream p-3" /></label>
        {create.isError && <p role="alert" className="text-sm text-coral sm:col-span-2">{(create.error as Error).message}</p>}
        <button disabled={create.isPending} className="rounded-full bg-ink py-2.5 font-bold text-cream sm:col-span-2">Save as draft</button></form>}
      {patch.isError && <p role="alert" className="rounded-2xl bg-peach p-3 text-sm">{(patch.error as Error).message}</p>}
      {q.isLoading ? <div className="h-32 animate-pulse rounded-3xl bg-peach/60" /> : !q.data?.length ? <p className="rounded-3xl bg-white p-8 text-center text-mute">🥐 No products yet. Add your first one.</p> :
        q.data.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3">
            <div className="min-w-40 flex-1"><b>{p.name}</b><p className="text-sm text-mute">{p.category}</p></div>
            <label className="cursor-pointer rounded-full border border-line px-3 py-1 text-sm">{p.image ? "Change photo" : "Add photo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0], p.id)} /></label>
            <label className="text-sm">Price<input defaultValue={p.price} type="number" min={1} aria-label={`Price for ${p.name}`} onBlur={(e) => Number(e.target.value) !== p.price && Number(e.target.value) > 0 && patch.mutate({ id: p.id, body: { price: Number(e.target.value) } })} className="ml-2 w-24 rounded-xl border border-line bg-cream p-2" /></label>
            <select aria-label={`Status for ${p.name}`} value={p.status} onChange={(e) => patch.mutate({ id: p.id, body: { status: e.target.value } })} className="rounded-xl border border-line bg-cream p-2">{STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
            <span className="w-24 text-right font-bold">{ksh(p.price)}</span>
          </div>))}
    </div>
  );
}
