import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ksh } from "../types";
import RequireAuth from "./RequireAuth";

export interface CustomReq { id: string; bakeryName: string; status: string; quote?: number; bakerNote?: string; neededBy: string; fulfilment: string; images: string[]; orderId?: string;
  spec: { cakeType: string; servings: number; flavour: string; filling: string; frosting: string; colours: string; theme: string; event: string; message: string; description: string } }
export const STATUS_LABEL: Record<string, string> = { REQUESTED: "Waiting for the bakery", QUOTED: "Quote ready", ACCEPTED: "Accepted", DECLINED: "Bakery declined", DECLINED_BY_CUSTOMER: "You declined" };

function Inner() {
  const qc = useQueryClient(), nav = useNavigate(), q = useQuery({ queryKey: ["custom-reqs"], queryFn: () => api<CustomReq[]>("/custom-orders"), refetchInterval: 20_000 });
  const respond = useMutation({ mutationFn: (v: { id: string; accept: boolean }) => api<{ orderId: string | null }>(`/custom-orders/${v.id}/respond`, { method: "POST", body: { accept: v.accept } }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["custom-reqs"] }); if (d.orderId) nav(`/orders/${d.orderId}`); } });
  return (
    <div className="mx-auto grid max-w-2xl gap-3 px-4 py-8"><div className="flex items-center justify-between"><h1 className="font-display text-4xl font-extrabold">Cake requests</h1><Link to="/custom-cake" className="rounded-full bg-leaf px-4 py-2 font-bold text-white">New request</Link></div>
      {respond.isError && <p role="alert" className="rounded-2xl bg-peach p-3 text-sm">{(respond.error as Error).message}</p>}
      {q.isLoading ? <div className="h-32 animate-pulse rounded-3xl bg-peach/60" /> : !q.data?.length ? <div className="p-10 text-center"><div className="text-6xl">🎂</div><p className="my-3 text-lg">No cake requests yet. Describe your dream cake to get started.</p></div> :
        q.data.map((r) => (
          <article key={r.id} className="grid gap-2 rounded-3xl bg-white p-4"><div className="flex justify-between"><b>{r.spec.theme || r.spec.cakeType} · {r.spec.servings} guests</b><span className="rounded-full bg-peach px-3 py-1 text-sm font-bold">{STATUS_LABEL[r.status] ?? r.status}</span></div>
            <p className="text-sm text-mute">{r.bakeryName} · needed by {r.neededBy} · {r.fulfilment.toLowerCase()}</p>
            {r.bakerNote && <p className="rounded-xl bg-cream p-3 text-sm">{r.bakerNote}</p>}
            {r.status === "QUOTED" && <div className="flex flex-wrap items-center gap-2"><span className="font-display text-2xl font-extrabold">{ksh(r.quote!)}</span>
              <button disabled={respond.isPending} onClick={() => respond.mutate({ id: r.id, accept: true })} className="rounded-full bg-leaf px-4 py-2 font-bold text-white">Accept and pay</button>
              <button disabled={respond.isPending} onClick={() => respond.mutate({ id: r.id, accept: false })} className="rounded-full border border-line px-4 py-2">Decline</button></div>}
            {r.orderId && <Link to={`/orders/${r.orderId}`} className="font-bold underline">View order</Link>}
          </article>))}
    </div>
  );
}
export default function CustomRequests() { return <RequireAuth reason="Sign in to see your cake requests."><Inner /></RequireAuth>; }
