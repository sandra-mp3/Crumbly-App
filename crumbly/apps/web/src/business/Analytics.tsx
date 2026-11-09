import { useState } from "react";
import { BarChart } from "../components/BarChart";
import { Delta, Metric, useSummary } from "./Dashboard";
import { ksh } from "../types";

export default function Analytics() {
  const [days, setDays] = useState(30), q = useSummary(days), s = q.data;
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="font-display text-4xl font-extrabold">Analytics</h1>
        <div className="flex gap-2" role="group" aria-label="Date range">{[7, 30, 90].map((d) => <button key={d} aria-pressed={days === d} onClick={() => setDays(d)} className={`rounded-full px-4 py-2 font-bold ${days === d ? "bg-ink text-cream" : "bg-white"}`}>{d} days</button>)}</div></div>
      {q.isError ? <p role="alert" className="rounded-3xl bg-white p-6">We couldn't load analytics. <button className="font-bold underline" onClick={() => q.refetch()}>Try again</button></p> : !s ? <div className="h-60 animate-pulse rounded-3xl bg-peach/60" /> : <>
        <div className="grid gap-3 sm:grid-cols-3"><Metric label="Revenue" value={ksh(s.totals.revenue)} sub={<Delta a={s.totals.revenue} b={s.previous.revenue} />} /><Metric label="Orders" value={String(s.totals.orders)} sub={<Delta a={s.totals.orders} b={s.previous.orders} />} /><Metric label="Average order value" value={ksh(s.totals.avgOrderValue)} sub={<Delta a={s.totals.avgOrderValue} b={s.previous.avgOrderValue} />} /></div>
        <section className="rounded-3xl bg-white p-5"><h2 className="mb-2 font-display text-2xl font-extrabold">Revenue by day</h2><BarChart label="Revenue by day" data={s.byDay.map((d) => ({ label: d.date.slice(5), value: d.revenue }))} format={ksh} /></section>
        <section className="rounded-3xl bg-white p-5"><h2 className="mb-2 font-display text-2xl font-extrabold">When customers order (Nairobi time)</h2><BarChart label="Orders by hour" data={s.byHour.map((h) => ({ label: `${h.hour}:00`, value: h.orders }))} /></section>
        <div className="grid gap-3 md:grid-cols-2">{([["Best sellers", s.best], ["Slowest sellers", s.worst]] as const).map(([t, l]) => <section key={t} className="rounded-3xl bg-white p-5"><h2 className="mb-2 font-display text-2xl font-extrabold">{t}</h2>{l.length ? l.map((p) => <p key={p.name} className="flex justify-between"><span>{p.name}</span><b>{ksh(p.revenue)}</b></p>) : <p className="text-mute">Not enough data yet.</p>}</section>)}</div></>}
    </div>
  );
}
