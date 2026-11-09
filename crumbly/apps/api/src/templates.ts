export interface Message { title: string; body: string; email: boolean }
const kes = (n: number) => `KSh ${n.toLocaleString("en-US")}`;

/** What to tell the customer when a bakery moves their order along. Returns null for steps customers don't need to hear about. */
export function orderStatusMessage(status: string, fulfilment: "PICKUP" | "DELIVERY"): Message | null {
  switch (status) {
    case "CONFIRMED": return { title: "Your order is confirmed", body: "The bakery has confirmed your order and will start baking soon.", email: true };
    case "BAKING": return { title: "Your order is in the oven", body: "Fresh from the oven soon.", email: false };
    case "READY": return fulfilment === "PICKUP" ? { title: "Ready for pickup", body: "Your order is ready. Come and get it while it's warm.", email: true } : { title: "Your order is ready", body: "It's packed and waiting for the rider.", email: false };
    case "OUT_FOR_DELIVERY": return { title: "On its way", body: "Your order is out for delivery.", email: true };
    case "DELIVERED": return { title: fulfilment === "PICKUP" ? "Enjoy your order" : "Delivered", body: "We hope you love it. Leave a review to help other customers.", email: true };
    case "CANCELLED": return { title: "Your order was cancelled", body: "The bakery cancelled your order. If you've paid, contact the bakery about a refund.", email: true };
    default: return null;
  }
}
export const paymentReceived = (total: number): Message => ({ title: "Payment received", body: `We received your ${kes(total)}. The bakery will start on your order soon.`, email: true });
export const newOrderForBakery = (items: { name: string; qty: number }[], total: number): Message => ({ title: "New paid order", body: `${items.slice(0, 3).map((i) => `${i.qty}× ${i.name}`).join(", ")}${items.length > 3 ? ` and ${items.length - 3} more` : ""} · ${kes(total)}`, email: false });
export const customRequestForBakery = (what: string): Message => ({ title: "New custom cake request", body: `A customer asked for: ${what}. Send them a quote.`, email: true });
export const quoteReady = (price: number): Message => ({ title: "Your cake quote is ready", body: `The bakery quoted ${kes(price)}. Open the request to accept or decline.`, email: true });
export const quoteDeclined = (): Message => ({ title: "The bakery can't take this cake", body: "They declined your custom cake request. You can send it to another bakery.", email: false });
