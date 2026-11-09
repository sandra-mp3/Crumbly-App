import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ksh } from "../types";

interface C { customerId: string; name: string; orders: number; spend: number; avgOrder: number; lastOrderAt: string; favourite: string | null; tags: string[] }
const SEGMENTS = ["All", "New", "Returning", "VIP", "High value", "Inactive"];
const ago = (iso: string) => { const d = Math.floor((Date.now() - Date.parse(iso)) / 864e5); return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };

export default function Customers() {
  const [seg, setSeg] = useState("All"), q = useQuery({ queryKey: ["biz-customers"], queryFn: () => api<C[]>("/business/customers") });
  const list = (q.data ?? []).filter((c) => seg === "All" || c.tags.includes(seg));
  return (
    <div className="grid gap-4"><h1 className="font-display text-4xl font-extrabold">Customers</h1>
      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Segments">{SEGMENTS.map((s) => <button key={s} aria-pressed={seg === s} onClick={() => setSeg(s)} className={`shrink-0 rounded-full px-4 py-2 font-bold ${seg === s ? "bg-ink text-cream" : "bg-white"}`}>{s}{s !== "All" && ` (${(q.data ?? []).filter((c) => c.tags.includes(s)).length})`}</button>)}</div>
      {q.isError ? <p role="alert" className="rounded-3xl bg-white p-6">We couldn't load your customers. <button className="font-bold underline" onClick={() => q.refetch()}>Try again</button></p> : q.isLoading ? <div className="h-32 animate-pulse rounded-3xl bg-peach/60" /> : !list.length ? <p className="rounded-3xl bg-white p-8 text-center text-mute">👥 {seg === "All" ? "No customers yet. They'll appear after their first paid order." : `No ${seg} customers right now.`}</p> :
        list.map((c) => (
          <article key={c.customerId} className="grid gap-1 rounded-2xl bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><b>{c.name}</b><span className="font-display text-xl font-extrabold">{ksh(c.spend)}</span></div>
            <p className="text-sm text-mute">{c.orders} order{c.orders > 1 ? "s" : ""} · average {ksh(c.avgOrder)} · last order {ago(c.lastOrderAt)}{c.favourite && ` · loves ${c.favourite}`}</p>
            <div className="flex flex-wrap gap-1">{c.tags.map((t) => <span key={t} className="rounded-full bg-peach px-2 py-0.5 text-xs font-bold">{t}</span>)}</div></article>))}
    </div>
  );
}
