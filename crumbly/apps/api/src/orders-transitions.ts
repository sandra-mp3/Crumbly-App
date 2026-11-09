export type OrderStatus = "PENDING_PAYMENT" | "PAYMENT_CONFIRMED" | "ORDER_RECEIVED" | "CONFIRMED" | "PREPARING" | "BAKING" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAYMENT_CONFIRMED: ["ORDER_RECEIVED", "CANCELLED"],
  ORDER_RECEIVED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["BAKING", "CANCELLED"],
  BAKING: ["READY"],
  READY: ["OUT_FOR_DELIVERY", "DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [], CANCELLED: [],
};
export function canTransition(from: OrderStatus, to: OrderStatus, fulfilment: "PICKUP" | "DELIVERY"): boolean {
  if (to === "OUT_FOR_DELIVERY" && fulfilment === "PICKUP") return false;
  return NEXT[from]?.includes(to) ?? false;
}
