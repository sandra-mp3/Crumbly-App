import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

interface Data { members: { uid: string; role: string; active: boolean; name: string | null; email: string | null }[]; invites: { id: string; email: string; role: string; expiresAt: string }[] }
const ROLE: Record<string, string> = { BAKER_OWNER: "Owner", BAKER_MANAGER: "Manager", BAKER_STAFF: "Staff" };

export default function Staff() {
  const qc = useQueryClient(), q = useQuery({ queryKey: ["biz-staff"], queryFn: () => api<Data>("/business/staff") }), [email, setEmail] = useState(""), [role, setRole] = useState("BAKER_STAFF"), [link, setLink] = useState(""), [copied, setCopied] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["biz-staff"] });
  const invite = useMutation({ mutationFn: () => api<{ link: string }>("/business/staff/invites", { method: "POST", body: { email, role } }), onSuccess: (d) => { setLink(d.link); setEmail(""); setCopied(false); refresh(); } });
  const edit = useMutation({ mutationFn: (v: { uid: string; body: object }) => api(`/business/staff/${v.uid}`, { method: "PATCH", body: v.body }), onSettled: refresh });
  const revoke = useMutation({ mutationFn: (id: string) => api(`/business/staff/invites/${id}`, { method: "DELETE" }), onSettled: refresh });
  const err = [invite, edit, revoke].find((m) => m.isError)?.error as Error | undefined;
  return (
    <div className="grid gap-4"><h1 className="font-display text-4xl font-extrabold">Team</h1>
      <form onSubmit={(e) => { e.preventDefault(); invite.mutate(); }} className="grid gap-2 rounded-3xl bg-white p-4 sm:grid-cols-[1fr_auto_auto]">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email to invite" placeholder="Their email address" className="rounded-xl border border-line bg-cream p-3" />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" className="rounded-xl border border-line bg-cream p-3"><option value="BAKER_STAFF">Staff (orders, bake list, inventory)</option><option value="BAKER_MANAGER">Manager (plus products, sales, customers)</option></select>
        <button disabled={invite.isPending} className="rounded-full bg-leaf px-5 py-2 font-bold text-white">Create invite</button></form>
      {link && <div className="grid gap-2 rounded-3xl bg-sun p-4"><p className="font-bold">Send this link to them (valid for 7 days). They must sign in with the email you invited.</p>
        <div className="flex flex-wrap gap-2"><input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-xl bg-white p-3 text-sm" /><button onClick={async () => { await navigator.clipboard?.writeText(link); setCopied(true); }} className="rounded-full bg-ink px-4 py-2 font-bold text-cream">{copied ? "Copied" : "Copy"}</button></div></div>}
      {err && <p role="alert" className="rounded-2xl bg-peach p-3 text-sm">{err.message}</p>}
      {q.isLoading ? <div className="h-32 animate-pulse rounded-3xl bg-peach/60" /> : <>
        {q.data?.members.map((m) => (
          <div key={m.uid} className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 ${m.active ? "" : "opacity-50"}`}><div className="min-w-40 flex-1"><b>{m.name ?? m.email ?? m.uid}</b>{m.name && m.email && <p className="text-sm text-mute">{m.email}</p>}</div>
            {m.role === "BAKER_OWNER" ? <span className="rounded-full bg-peach px-3 py-1 text-sm font-bold">Owner</span> : <>
              <select value={m.role} aria-label={`Role for ${m.name ?? m.email}`} onChange={(e) => edit.mutate({ uid: m.uid, body: { role: e.target.value } })} className="rounded-xl border border-line bg-cream p-2">{["BAKER_MANAGER", "BAKER_STAFF"].map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}</select>
              <button onClick={() => (m.active ? confirm("Remove this person's access?") : true) && edit.mutate({ uid: m.uid, body: { active: !m.active } })} className="rounded-full border border-line px-4 py-2">{m.active ? "Remove access" : "Restore access"}</button></>}</div>))}
        {!!q.data?.invites.length && <><h2 className="font-display text-2xl font-extrabold">Pending invitations</h2>{q.data.invites.map((i) => <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-3"><span>{i.email} · {ROLE[i.role]}</span><button onClick={() => revoke.mutate(i.id)} className="rounded-full border border-line px-4 py-2">Revoke</button></div>)}</>}</>}
    </div>
  );
}
