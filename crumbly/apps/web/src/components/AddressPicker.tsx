import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Place } from "../types";

interface Suggestion { placeId: string; label: string }
/** Address search backed by our API (Google Places). The Maps key stays on the server. */
export function AddressPicker({ value, onPick }: { value: Place | null; onPick: (p: Place | null) => void }) {
  const [text, setText] = useState(value?.label ?? ""), [list, setList] = useState<Suggestion[]>([]), [err, setErr] = useState("");
  useEffect(() => {
    if (text.trim().length < 3 || text === value?.label) return setList([]);
    const t = setTimeout(async () => {
      try { setList(await api<Suggestion[]>(`/maps/autocomplete?input=${encodeURIComponent(text)}`)); setErr(""); } catch (e) { setErr((e as Error).message); }
    }, 300);
    return () => clearTimeout(t);
  }, [text, value?.label]);
  async function choose(s: Suggestion) {
    try { const p = await api<Place>(`/maps/place/${s.placeId}`); setText(p.label); setList([]); onPick(p); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="relative">
      <label className="text-sm font-medium">Delivery address
        <input value={text} onChange={(e) => { setText(e.target.value); if (value) onPick(null); }} role="combobox" aria-expanded={list.length > 0} aria-autocomplete="list" autoComplete="street-address" placeholder="Start typing your street or building" className="mt-1 w-full rounded-xl border border-line bg-white p-3" />
      </label>
      {err && <p role="alert" className="mt-1 text-sm text-coral">{err}</p>}
      {list.length > 0 && <ul role="listbox" className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl border border-line bg-white shadow-lg">{list.map((s) => <li key={s.placeId}><button type="button" role="option" aria-selected={false} onClick={() => choose(s)} className="block w-full px-4 py-3 text-left hover:bg-cream">{s.label}</button></li>)}</ul>}
      {value && <p className="mt-1 text-sm text-leaf">✓ Address confirmed</p>}
    </div>
  );
}
