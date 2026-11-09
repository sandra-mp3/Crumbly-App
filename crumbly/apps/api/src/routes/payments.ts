import { Router } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "../firebase.js";
import { env } from "../env.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../types.js";
import { mpesa } from "../payments/mpesa.js";
import { normalizePhone, parseCallback } from "../payments/utils.js";
import { processMpesaCallback } from "../payments/process.js";
import { onPaymentApplied } from "../notify.js";

export const payments = Router();
const sha = (s: string) => createHash("sha256").update(s).digest();

const stkBody = z.object({ orderIds: z.array(z.string()).min(1).max(10), phone: z.string().min(9).max(16) });
payments.post("/payments/mpesa/stk", requireAuth, async (req, res, next) => {
  try {
    const b = stkBody.parse(req.body), phone = normalizePhone(b.phone);
    if (!phone) throw new HttpError(400, "Enter a valid Safaricom number, like 0712 345 678.");
    const snaps = await db.getAll(...b.orderIds.map((id) => db.collection("orders").doc(id)));
    let amount = 0;
    for (const s of snaps) {
      const o = s.data();
      if (!o || o.customerId !== req.actor.uid) throw new HttpError(404, "We couldn't find one of those orders.");
      if (o.status !== "PENDING_PAYMENT" || o.paymentStatus === "success") throw new HttpError(409, "One of these orders is already paid or cancelled.");
      amount += o.total as number;
    }
    const init = await mpesa.initiate({ amount, phone, reference: b.orderIds[0]!.slice(0, 12), description: "Crumbly" });
    // Doc id = CheckoutRequestID so the callback is a direct lookup.
    await db.collection("payments").doc(init.providerRef).set({
      provider: "mpesa", customerId: req.actor.uid, orderIds: b.orderIds, amount, phone, merchantRequestId: init.merchantRef ?? null,
      checkoutRequestId: init.providerRef, status: "pending", createdAt: new Date(),
    });
    res.status(202).json({ ok: true, data: { checkoutRequestId: init.providerRef } });
  } catch (e) { next(e); }
});

/** Daraja doesn't sign callbacks, so: secret path segment + amount check + idempotent transaction. Always ACK 200. */
payments.post("/payments/mpesa/callback/:secret", async (req, res) => {
  const ack = () => res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  if (!timingSafeEqual(sha(String(req.params.secret)), sha(env.MPESA_CALLBACK_SECRET))) return void res.status(403).end();
  const cb = parseCallback(req.body);
  if (!cb) return void ack();
  try {
    const outcome = await processMpesaCallback(cb);
    if (outcome === "applied") await onPaymentApplied(cb.checkoutRequestId);
    console.log(JSON.stringify({ level: "info", event: "mpesa_callback", outcome, checkoutRequestId: cb.checkoutRequestId, result: cb.resultCode }));
  } catch { console.error(JSON.stringify({ level: "error", event: "mpesa_callback_failed", checkoutRequestId: cb.checkoutRequestId })); }
  ack();
});

payments.get("/payments/status/:id", requireAuth, async (req, res, next) => {
  try {
    const d = (await db.collection("payments").doc(String(req.params.id)).get()).data();
    if (!d || d.customerId !== req.actor.uid) throw new HttpError(404, "We couldn't find that payment.");
    res.json({ ok: true, data: { status: d.status, receipt: d.receipt ?? null } });
  } catch (e) { next(e); }
});
