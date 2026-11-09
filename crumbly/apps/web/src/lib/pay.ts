import { api } from "./api";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export type PayResult = "success" | "cancelled" | "timeout" | "failed" | "pending";
export const payMessage: Record<Exclude<PayResult, "success">, string> = {
  cancelled: "You cancelled the M-Pesa request. Tap Pay to try again.",
  timeout: "The M-Pesa request timed out. Tap Pay to try again.",
  failed: "The payment didn't go through. Check your M-Pesa balance and try again.",
  pending: "We're still waiting for M-Pesa. If you paid, your order will update shortly.",
};
/** Sends the STK push and polls until the backend (which verifies Daraja's callback) reports a final state. */
export async function payForOrders(orderIds: string[], phone: string, onWaiting: () => void): Promise<PayResult> {
  const { checkoutRequestId } = await api<{ checkoutRequestId: string }>("/payments/mpesa/stk", { method: "POST", body: { orderIds, phone } });
  onWaiting();
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const s = await api<{ status: PayResult }>(`/payments/status/${checkoutRequestId}`);
    if (s.status !== "pending") return s.status;
  }
  return "pending";
}
