import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Metric } from "../business/Dashboard";
import { ksh } from "../types";

interface Overview { bakeries: Record<string, number>; last30Days: { orders: number; gmv: number }; health: { stuckPayments: number; openReports: number; pendingBakeries: number } }
export default function AdminOverview() {
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => api<Overview>("/admin/overview"), refetchInterval: 60_000 });
  if (q.isError) return <p role="alert" className="rounded-3xl bg-white p-6">We couldn't load the overview. <button className="font-bold underline" onClick={() => q.refetch()}>Try again</button></p>;
  const o = q.data; if (!o) return <div className="h-40 animate-pulse rounded-3xl bg-peach/60" />;
  return (
    <div className="grid gap-5"><h1 className="font-display text-4xl font-extrabold">Platform overview</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Paid orders (30 days)" value={String(o.last30Days.orders)} /><Metric label="Order value (30 days)" value={ksh(o.last30Days.gmv)} />
        <Metric label="Active bakeries" value={String(o.bakeries.active ?? 0)} sub={`${o.bakeries.draft ?? 0} drafts · ${o.bakeries.suspended ?? 0} suspended`} /><Metric label="Awaiting approval" value={String(o.health.pendingBakeries)} sub={<Link to="/admin/bakeries" className="underline">Review</Link>} /></div>
      <section className="rounded-3xl bg-white p-5"><h2 className="mb-2 font-display text-2xl font-extrabold">System health</h2>
        <p className={o.health.stuckPayments ? "font-bold text-coral" : "text-leaf"}>{o.health.stuckPayments ? `⚠️ ${o.health.stuckPayments} payment(s) pending for over 10 minutes. Check the reconcile job.` : "✓ No stuck payments"}</p>
        <p className={o.health.openReports ? "font-bold" : "text-leaf"}>{o.health.openReports ? <>🚩 {o.health.openReports} review report(s) <Link to="/admin/reports" className="underline">to review</Link></> : "✓ No open review reports"}</p></section>
    </div>
  );
}
