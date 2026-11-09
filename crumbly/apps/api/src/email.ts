import { env } from "./env.js";
export interface EmailProvider { send(to: string, subject: string, text: string): Promise<void> }

/** Sends through Resend when RESEND_API_KEY and EMAIL_FROM are set; otherwise skips quietly (never logs the address or message). */
export const emailProvider: EmailProvider = {
  async send(to, subject, text) {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) { console.log(JSON.stringify({ level: "info", event: "email_skipped", reason: "not_configured" })); return; }
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text }) });
    if (!r.ok) throw new Error("email_failed");
  },
};
