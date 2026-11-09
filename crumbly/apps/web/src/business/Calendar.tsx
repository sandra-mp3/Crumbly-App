import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface Day { date: string; bakeList: { name: string; qty: number }[]; orders: { id: string; status: string; fulfilment: string; overdue: boolean; items: { name: string; qty: number; notes?: string }[] }[] }
const label = (d: string, i: number) => (i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(d + "T00:00:00").toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "short" }));

export default function Calendar() {
  const q = useQuery({ queryKey: ["biz-calendar"], queryFn: () => api<Day[]>("/business/calendar?days=7"), refetchInterval: 30_000 }), [done, setDone] = useState<Set<string>>(new Set());
  if (q.isError) return <p role="alert" className="rounded-3xl bg-white p-6">We couldn't load the calendar. <button className="font-bold underline" onClick={() => q.refetch()}>Try again</button></p>;
  if (!q.data) return <div className="h-60 animate-pulse rounded-3xl bg-peach/60" />;
  const [today, ...rest] = q.data;
  return (
    <div className="grid gap-5"><h1 className="font-display text-4xl font-extrabold">What to bake today</h1>
      <section className="rounded-3xl bg-sun p-5"><h2 className="mb-2 font-display text-2xl font-extrabold">Bake list</h2>
        {today!.bakeList.length ? <ul className="grid gap-1">{today!.bakeList.map((b) => { const k = b.name, on = done.has(k); return (
          <li key={k}><label className={`flex items-center gap-3 rounded-2xl bg-white/70 p-3 text-lg ${on ? "line-through opacity-50" : ""}`}><input type="checkbox" checked={on} onChange={() => setDone((s) => { const n = new Set(s); on ? n.delete(k) : n.add(k); return n; })} className="h-5 w-5" /><b className="w-10">{b.qty}×</b>{b.name}</label></li>); })}</ul>
          : <p>🥖 Nothing waiting to be baked. Enjoy the calm.</p>}</section>
      {q.data.map((d, i) => d.orders.length > 0 && (
        <section key={d.date} className="rounded-3xl bg-white p-5"><h2 className="mb-2 font-display text-2xl font-extrabold">{label(d.date, i)} <span className="text-base font-normal text-mute">· {d.orders.length} order{d.orders.length > 1 ? "s" : ""}</span></h2>
          <ul className="grid gap-2">{d.orders.map((o) => <li key={o.id} className="rounded-2xl bg-cream p-3"><div className="flex flex-wrap justify-between gap-2"><span>{o.items.map((x) => `${x.qty}× ${x.name}`).join(", ")}</span><span className="text-sm font-bold">{o.overdue && <span className="mr-2 rounded-full bg-coral px-2 py-0.5 text-white">Late</span>}{o.fulfilment === "DELIVERY" ? "🛵" : "🛍️"} {o.status.replaceAll("_", " ").toLowerCase()}</span></div>
            {o.items.filter((x) => x.notes).map((x, k) => <p key={k} className="mt-1 text-sm text-mute">Note: {x.notes}</p>)}</li>)}</ul></section>))}
      {rest.every((d) => !d.orders.length) && !today!.orders.length && <p className="rounded-3xl bg-white p-8 text-center text-mute">📅 No open orders this week. <Link to="/business/products" className="font-bold underline">Check your menu</Link></p>}
    </div>
  );
}
