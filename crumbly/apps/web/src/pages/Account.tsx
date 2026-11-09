import { useState } from "react";
import { Link } from "react-router-dom";
import { updateProfile } from "firebase/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AddressPicker } from "../components/AddressPicker";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../lib/api";
import { useSeo } from "../lib/seo";
import RequireAuth from "./RequireAuth";
import type { Place } from "../types";

export interface Account { addresses: { id: string; name: string; label: string; lat: number; lng: number }[]; prefs: { dietary: string[]; notifyEmail: boolean } }
const DIETS = ["vegan", "vegetarian", "gluten-free", "halal"], field = "mt-1 w-full rounded-xl border border-line bg-cream p-3";

function Inner() {
  useSeo({ title: "Your account | Crumbly", noindex: true });
  const { user, signOut } = useAuth(), qc = useQueryClient(), q = useQuery({ queryKey: ["account"], queryFn: () => api<Account>("/account") });
  const [name, setName] = useState(user?.displayName ?? ""), [saved, setSaved] = useState(""), [label, setLabel] = useState("Home"), [place, setPlace] = useState<Place | null>(null), [pickerKey, setPickerKey] = useState(0);
  const refresh = () => qc.invalidateQueries({ queryKey: ["account"] });
  const addAddr = useMutation({ mutationFn: () => api("/account/addresses", { method: "POST", body: { name: label, ...place } }), onSuccess: () => { setPlace(null); setPickerKey((k) => k + 1); refresh(); } });
  const delAddr = useMutation({ mutationFn: (id: string) => api(`/account/addresses/${id}`, { method: "DELETE" }), onSettled: refresh });
  const prefs = useMutation({ mutationFn: (p: object) => api("/account/prefs", { method: "PATCH", body: p }), onSettled: refresh });
  const rename = useMutation({ mutationFn: () => updateProfile(user!, { displayName: name.trim() }), onSuccess: () => setSaved("Saved") });
  const a = q.data, err = [addAddr, delAddr, prefs, rename].find((m) => m.isError)?.error as Error | undefined;
  return (
    <div className="mx-auto grid max-w-2xl gap-5 px-4 py-8"><h1 className="font-display text-4xl font-extrabold">Your account</h1>
      {err && <p role="alert" className="rounded-2xl bg-peach p-3 text-sm">{err.message}</p>}
      <section className="grid gap-2 rounded-3xl bg-white p-5"><h2 className="font-display text-2xl font-extrabold">Profile</h2><p className="text-mute">{user?.email}</p>
        <form onSubmit={(e) => { e.preventDefault(); setSaved(""); rename.mutate(); }} className="flex gap-2"><label className="flex-1 text-sm font-medium">Name<input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={field} /></label><button disabled={rename.isPending || name.trim().length < 2} className="self-end rounded-full bg-ink px-5 py-3 font-bold text-cream disabled:opacity-50">{saved || "Save"}</button></form></section>
      <section className="grid gap-3 rounded-3xl bg-white p-5"><h2 className="font-display text-2xl font-extrabold">Saved addresses</h2>
        {q.isLoading ? <div className="h-16 animate-pulse rounded-2xl bg-peach/60" /> : !a?.addresses.length ? <p className="text-mute">📍 No saved addresses yet.</p> : a.addresses.map((x) => <div key={x.id} className="flex items-center justify-between gap-2 rounded-2xl bg-cream p-3"><span><b>{x.name}</b><br /><span className="text-sm text-mute">{x.label}</span></span><button onClick={() => confirm("Remove this address?") && delAddr.mutate(x.id)} className="rounded-full border border-line px-3 py-1">Remove</button></div>)}
        <label className="text-sm font-medium">Name this address<input value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} className={field} /></label>
        <AddressPicker key={pickerKey} value={place} onPick={setPlace} />
        <button disabled={!place || !label.trim() || addAddr.isPending} onClick={() => addAddr.mutate()} className="rounded-full bg-leaf py-3 font-bold text-white disabled:opacity-50">Save address</button></section>
      <section className="grid gap-2 rounded-3xl bg-white p-5"><h2 className="font-display text-2xl font-extrabold">Preferences</h2>
        <fieldset><legend className="text-sm font-medium">Dietary needs</legend><div className="mt-1 flex flex-wrap gap-2">{DIETS.map((d) => { const on = !!a?.prefs.dietary.includes(d); return <button key={d} disabled={!a} aria-pressed={on} onClick={() => prefs.mutate({ dietary: on ? a!.prefs.dietary.filter((x) => x !== d) : [...a!.prefs.dietary, d] })} className={`rounded-full px-4 py-2 font-bold ${on ? "bg-ink text-cream" : "bg-cream"}`}>{d}</button>; })}</div></fieldset>
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" disabled={!a} checked={a?.prefs.notifyEmail ?? true} onChange={(e) => prefs.mutate({ notifyEmail: e.target.checked })} />Email me about my orders</label></section>
      <div className="flex flex-wrap gap-3"><Link to="/orders" className="font-bold underline">Your orders</Link><Link to="/favorites" className="font-bold underline">Favourites</Link><button onClick={signOut} className="ml-auto rounded-full border-2 border-ink px-5 py-2 font-bold">Sign out</button></div>
    </div>
  );
}
export default function AccountPage() { return <RequireAuth reason="Sign in to manage your account."><Inner /></RequireAuth>; }
