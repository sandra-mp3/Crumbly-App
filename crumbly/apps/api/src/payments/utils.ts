export type PaymentStatus = "pending" | "success" | "failed" | "cancelled" | "timeout";

/** Accepts 07XX, 01XX, 7XX, +254..., 254... and returns 2547XXXXXXXX / 2541XXXXXXXX, or null. */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  const n = d.startsWith("254") ? d : d.startsWith("0") ? "254" + d.slice(1) : "254" + d;
  return /^254[17]\d{8}$/.test(n) ? n : null;
}

/** Daraja ResultCode -> our payment state. 0 success, 1032 cancelled by user, 1037 timed out. */
export function mapResult(code: number): Exclude<PaymentStatus, "pending"> {
  if (code === 0) return "success";
  if (code === 1032) return "cancelled";
  if (code === 1037) return "timeout";
  return "failed";
}

export interface StkCallback { merchantRequestId: string; checkoutRequestId: string; resultCode: number; resultDesc: string; amount?: number; receipt?: string }
export function parseCallback(body: unknown): StkCallback | null {
  const cb = (body as { Body?: { stkCallback?: Record<string, unknown> } })?.Body?.stkCallback;
  if (!cb || typeof cb.CheckoutRequestID !== "string" || typeof cb.ResultCode !== "number") return null;
  const items = ((cb.CallbackMetadata as { Item?: { Name: string; Value?: unknown }[] } | undefined)?.Item) ?? [];
  const get = (n: string) => items.find((i) => i.Name === n)?.Value;
  return {
    merchantRequestId: String(cb.MerchantRequestID ?? ""), checkoutRequestId: cb.CheckoutRequestID,
    resultCode: cb.ResultCode, resultDesc: String(cb.ResultDesc ?? ""),
    amount: typeof get("Amount") === "number" ? (get("Amount") as number) : undefined,
    receipt: typeof get("MpesaReceiptNumber") === "string" ? (get("MpesaReceiptNumber") as string) : undefined,
  };
}
