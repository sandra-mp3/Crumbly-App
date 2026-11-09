import { env } from "../env.js";
import { HttpError } from "../types.js";
import type { PaymentInit, PaymentProvider, PaymentRequest } from "./provider.js";

const BASE = env.DARAJA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
let cached: { token: string; exp: number } | null = null;

function creds() {
  const { DARAJA_CONSUMER_KEY: k, DARAJA_CONSUMER_SECRET: s, DARAJA_SHORTCODE: sc, DARAJA_PASSKEY: pk } = env;
  if (!k || !s || !sc || !pk) throw new HttpError(503, "M-Pesa is not configured yet.");
  return { k, s, sc, pk };
}
async function token() {
  if (cached && cached.exp > Date.now()) return cached.token;
  const { k, s } = creds();
  const r = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: "Basic " + Buffer.from(`${k}:${s}`).toString("base64") } });
  if (!r.ok) throw new HttpError(502, "Couldn't reach M-Pesa. Please try again.");
  const j = (await r.json()) as { access_token: string; expires_in: string };
  cached = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) - 60) * 1000 };
  return cached.token;
}
const ts = () => new Date().toISOString().replace(/\D/g, "").slice(0, 14);

export const mpesa: PaymentProvider = {
  name: "mpesa",
  async initiate(req: PaymentRequest): Promise<PaymentInit> {
    const { sc, pk } = creds(), t = ts();
    const r = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
      method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: sc, Password: Buffer.from(sc + pk + t).toString("base64"), Timestamp: t,
        TransactionType: "CustomerPayBillOnline", Amount: Math.round(req.amount), PartyA: req.phone, PartyB: sc, PhoneNumber: req.phone,
        CallBackURL: `${env.API_URL}/api/payments/mpesa/callback/${env.MPESA_CALLBACK_SECRET}`,
        AccountReference: req.reference.slice(0, 12), TransactionDesc: req.description.slice(0, 13),
      }),
    });
    const j = (await r.json()) as { ResponseCode?: string; CheckoutRequestID?: string; MerchantRequestID?: string };
    if (!r.ok || j.ResponseCode !== "0" || !j.CheckoutRequestID) throw new HttpError(502, "M-Pesa couldn't start the payment. Check the phone number and try again.");
    return { providerRef: j.CheckoutRequestID, merchantRef: j.MerchantRequestID };
  },
};

/** Asks Safaricom for the outcome of an STK push. Returns null while it is still processing or on any error. */
export async function queryStk(checkoutRequestId: string): Promise<{ resultCode: number; resultDesc: string } | null> {
  const { sc, pk } = creds(), t = ts();
  const r = await fetch(`${BASE}/mpesa/stkpushquery/v1/query`, {
    method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ BusinessShortCode: sc, Password: Buffer.from(sc + pk + t).toString("base64"), Timestamp: t, CheckoutRequestID: checkoutRequestId }),
  });
  const j = (await r.json().catch(() => null)) as { ResponseCode?: string; ResultCode?: string; ResultDesc?: string } | null;
  if (!r.ok || j?.ResponseCode !== "0" || j.ResultCode === undefined) return null;
  return { resultCode: Number(j.ResultCode), resultDesc: String(j.ResultDesc ?? "") };
}
