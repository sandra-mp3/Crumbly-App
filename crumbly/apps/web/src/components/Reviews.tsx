import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../lib/api";

const REASONS = [["spam", "Spam"], ["offensive", "Offensive"], ["not_about_product", "Not about this product"], ["other", "Something else"]] as const;
function Report({ id }: { id: string }) {
  const { requireAuth } = useAuth(), [open, setOpen] = useState(false), [done, setDone] = useState(""), send = useMutation({ mutationFn: (reason: string) => api(`/reviews/${id}/report`, { method: "POST", body: { reason } }), onSuccess: () => setDone("Thanks, we'll take a look."), onError: (e) => setDone((e as Error).message) });
  if (done) return <p className="text-xs text-mute">{done}</p>;
  return open ? <span className="flex flex-wrap gap-1">{REASONS.map(([k, t]) => <button key={k} disabled={send.isPending} onClick={() => send.mutate(k)} className="rounded-full bg-cream px-2 py-1 text-xs">{t}</button>)}</span> : <button onClick={() => requireAuth("Sign in to report a review.", () => setOpen(true))} className="text-xs text-mute underline">Report</button>;
}
interface Review { id: string; rating: number; text: string; author: string }
export function Reviews({ productId }: { productId: string }) {
  const { requireAuth } = useAuth(), qc = useQueryClient(), [open, setOpen] = useState(false), [rating, setRating] = useState(5), [text, setText] = useState("");
  const q = useQuery({ queryKey: ["reviews", productId], queryFn: () => api<Review[]>(`/products/${productId}/reviews`) });
  const post = useMutation({ mutationFn: () => api(`/products/${productId}/reviews`, { method: "POST", body: { rating, text } }), onSuccess: () => { setOpen(false); setText(""); qc.invalidateQueries({ queryKey: ["reviews", productId] }); qc.invalidateQueries({ queryKey: ["product"] }); } });
  return (
    <section className="mx-auto max-w-5xl px-4 pb-16">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-3xl font-extrabold">Reviews</h2><button onClick={() => requireAuth("Sign in to leave a review.", () => setOpen(true))} className="rounded-full bg-ink px-4 py-2 font-bold text-cream">Write a review</button></div>
      {open && <form onSubmit={(e) => { e.preventDefault(); post.mutate(); }} className="mb-4 grid gap-3 rounded-3xl bg-white p-5">
        <fieldset><legend className="text-sm font-medium">Your rating</legend><div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} aria-pressed={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className={`text-3xl ${n <= rating ? "" : "opacity-30"}`}>⭐</button>)}</div></fieldset>
        <label className="text-sm font-medium">Tell others what you thought<textarea value={text} maxLength={600} onChange={(e) => setText(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-line bg-cream p-3" /></label>
        {post.isError && <p role="alert" className="rounded-xl bg-peach p-3 text-sm">{(post.error as Error).message}</p>}
        <button disabled={post.isPending} className="rounded-full bg-leaf py-2.5 font-bold text-white">Post review</button></form>}
      {q.isLoading ? <div className="h-24 animate-pulse rounded-3xl bg-peach/60" /> : !q.data?.length ? <p className="rounded-3xl bg-white p-6 text-center text-mute">⭐ No reviews yet. Be the first once you've tried it.</p>
        : <ul className="grid gap-3">{q.data.map((r) => <li key={r.id} className="rounded-2xl bg-white p-4"><p>{"⭐".repeat(r.rating)} <b className="ml-1">{r.author}</b></p>{r.text && <p className="mt-1">{r.text}</p>}<Report id={r.id} /></li>)}</ul>}
    </section>
  );
}
