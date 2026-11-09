import { useState } from "react";
/** Shares the preview-friendly /share/... link (it carries Open Graph tags, then redirects people to the page). */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false), url = `${location.origin}/share${path}`;
  async function share() {
    try { if (navigator.share) return await navigator.share({ title, url }); await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* user cancelled */ }
  }
  return <button onClick={share} className="w-fit rounded-full border border-line bg-white px-4 py-2 font-bold">{copied ? "Link copied" : "Share"}</button>;
}
