import { Router } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";
import { HttpError } from "../types.js";
import { queryStk } from "../payments/mpesa.js";
import { reconcilePending } from "../payments/reconcile.js";
import { onPaymentApplied } from "../notify.js";

export const internal = Router();
const sha = (s: string) => createHash("sha256").update(s).digest();
/** Call from a scheduler (Cloud Scheduler / cron) every few minutes with header `x-reconcile-secret`. */
internal.post("/internal/reconcile-payments", async (req, res, next) => {
  try {
    if (!env.RECONCILE_SECRET) throw new HttpError(404, "Not found.");
    if (!timingSafeEqual(sha(String(req.header("x-reconcile-secret") ?? "")), sha(env.RECONCILE_SECRET))) throw new HttpError(403, "Forbidden.");
    res.json({ ok: true, data: await reconcilePending(queryStk, onPaymentApplied) });
  } catch (e) { next(e); }
});
