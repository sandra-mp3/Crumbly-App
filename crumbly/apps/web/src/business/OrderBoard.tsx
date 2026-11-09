import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useMe } from "../lib/useMe";
import { ksh, type Order, type OrderStatus } from "../types";

const NEXT: Partial<Record<OrderStatus, [OrderStatus, string]>> = { PAYMENT_CONFIRMED: ["ORDER_RECEIVED", "Accept order"], ORDER_RECEIVED: ["CONFIRMED", "Confirm"], CONFIRMED: ["PREPARING", "Start preparing"], PREPARING: ["BAKING", "Into the oven"], BAKING: ["READY", "Mark ready"], READY: ["DELIVERED", "Handed over"], OUT_FOR_DELIVERY: ["DELIVERED", "Delivered"] };
const TABS: [string, OrderStatus[]][] = [["New", ["PAYMENT_CONFIRMED", "ORDER_RECEIVED"]], ["In the kitchen", ["CONFIRMED", "PREPARING", "BAKING"]], ["Ready", ["READY", "OUT_FOR_DELIVERY"]], ["Done", ["DELIVERED", "CANCELLED"]]];

export default function OrderBoard() {
  const [tab, setTab] = useState(0), qc = useQueryClient(), me = useMe();
  const q = useQuery({ queryKey: ["biz-orders"], queryFn: () => api<Order[]>("/orders?scope=business"), refetchInterval: 15_000 });
  const move = useMutation({ mutationFn: (v: { id: string; status: OrderStatus }) => api(`/orders/${v.id}/status`, { method: "PATCH", body: { status: v.status } }), onSettled: () => qc.invalidateQueries({ queryKey: ["biz-orders"] }) });
  const list = (q.data ?? []).filter((o) => TABS[tab]![1].includes(o.status));
  const canCancel = me.data?.role !== "BAKER_STAFF";
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-4xl font-extrabold">Orders</h1>
      <div className="flex gap-2 overflow-x-auto" role="tablist">{TABS.map(([t, st], i) => <button key={t} role="tab" aria-selected={tab === i} onClick={() => setTab(i)} className={`shrink-0 rounded-full px-4 py-2 font-bold ${tab === i ? "bg-ink text-cream" : "bg-white"}`}>{t} ({(q.data ?? []).filter((o) => st.includes(o.status)).length})</button>)}</div>
      {move.isError && <p role="alert" className="rounded-2xl bg-peach p-3 text-sm">{(move.error as Error).message}</p>}
      {q.isLoading ? <div className="h-32 animate-pulse rounded-3xl bg-peach/60" /> : !list.length ? <p className="rounded-3xl bg-white p-8 text-center text-mute">🥖 Nothing here right now.</p> :
        list.map((o) => { const n = NEXT[o.status]; return (
          <article key={o.id} className="grid gap-2 rounded-3xl bg-white p-4">
            <div className="flex justify-between"><b>{o.fulfilment === "DELIVERY" ? "🛵 Delivery" : "🛍️ Pickup"}</b><span className="font-display text-xl font-extrabold">{ksh(o.total)}</span></div>
            <ul>{o.items.map((i, k) => <li key={k}>{i.qty}× {i.name}</li>)}</ul>
            {o.address && <p className="text-sm text-mute">To: {o.address.label}</p>}
            <div className="flex flex-wrap gap-2">
              {n && <button disabled={move.isPending} onClick={() => move.mutate({ id: o.id, status: n[0] })} className="rounded-full bg-leaf px-4 py-2 font-bold text-white">{n[1]}</button>}
              {o.status === "READY" && o.fulfilment === "DELIVERY" && <button disabled={move.isPending} onClick={() => move.mutate({ id: o.id, status: "OUT_FOR_DELIVERY" })} className="rounded-full bg-sun px-4 py-2 font-bold">Out for delivery</button>}
              {canCancel && !["BAKING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"].includes(o.status) && <button disabled={move.isPending} onClick={() => confirm("Cancel this order?") && move.mutate({ id: o.id, status: "CANCELLED" })} className="rounded-full border border-line px-4 py-2">Cancel</button>}
            </div>
          </article>); })}
    </div>
  );
}
