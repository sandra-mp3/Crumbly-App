import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { isBaker, useMe } from "../lib/useMe";
import { EMOJI, ksh } from "../types";

interface Rec { id: string; slug: string; name: string; bakeryName: string; price: number; rating: number; prepMinutes: number; category?: string }
interface Msg { role: "user" | "model"; text: string; products?: Rec[] }
const CUSTOMER_PROMPTS = ["Help me find a birthday cake", "Something under KSh 1,000", "Vegan options"], BAKER_PROMPTS = ["How are my sales doing?", "Show me my best sellers", "Which ingredients are running low?"];

export function CrumblyBot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "model", text: "Hi! I'm Crumbly Bot. Tell me what you're craving, your budget or the occasion." }]);
  const PROMPTS = isBaker(useMe().data) ? BAKER_PROMPTS : CUSTOMER_PROMPTS;
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);
  async function send(m: string) {
    if (!m.trim() || busy) return;
    const history = msgs.slice(1).map(({ role, text }) => ({ role, text }));
    setMsgs((x) => [...x, { role: "user", text: m }]); setText(""); setBusy(true);
    try {
      const r = await api<{ reply: string; products: Rec[] }>("/crumbly-bot/chat", { method: "POST", body: { message: m, history } });
      setMsgs((x) => [...x, { role: "model", text: r.reply, products: r.products.slice(0, 3) }]);
    } catch { setMsgs((x) => [...x, { role: "model", text: "Crumbly Bot is unavailable right now. Please try again in a moment." }]); }
    setBusy(false);
  }
  if (!open) return null;
  return (
    <aside role="dialog" aria-label="Crumbly Bot" className="fixed inset-0 z-40 flex flex-col bg-white md:inset-y-0 md:left-auto md:w-[400px] md:border-l md:border-line" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center justify-between border-b border-line p-4"><h2 className="font-display text-2xl font-extrabold">🧁 Crumbly Bot</h2><button onClick={onClose} className="rounded-full border border-line px-3 py-1">Close</button></div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-sun p-3" : "max-w-[90%] rounded-2xl bg-cream p-3"}>
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.products?.map((p) => (
              <Link key={p.id} to={`/products/${p.slug}`} onClick={onClose} className="mt-2 flex items-center gap-3 rounded-xl border border-line bg-white p-2">
                <span className="text-3xl">{EMOJI[p.category ?? ""] ?? "🥐"}</span><span className="flex-1 text-sm"><b>{p.name}</b><br />{p.bakeryName} · {ksh(p.price)} · ⭐ {p.rating.toFixed(1)}</span><span className="text-sm font-bold text-leaf">View</span>
              </Link>))}
          </div>))}
        {busy && <div className="w-16 animate-pulse rounded-2xl bg-cream p-3 text-center" aria-label="Crumbly Bot is typing">•••</div>}
        <div ref={end} />
      </div>
      {msgs.length === 1 && <div className="flex flex-wrap gap-2 px-4">{PROMPTS.map((p) => <button key={p} onClick={() => send(p)} className="rounded-full bg-peach px-3 py-1.5 text-sm">{p}</button>)}</div>}
      <form className="flex gap-2 p-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }} onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Message Crumbly Bot" placeholder="Ask about cakes, prices, bakeries…" maxLength={1000} className="flex-1 rounded-full border border-line bg-cream px-4 py-3" />
        <button disabled={busy} className="rounded-full bg-leaf px-5 font-bold text-white">Send</button>
      </form>
    </aside>
  );
}
