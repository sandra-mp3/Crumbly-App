export type BakeryAction = "approve" | "suspend" | "reinstate";
/** Allowed bakery status changes. Returns the new status, or null when the move isn't allowed. */
export function nextBakeryStatus(status: string, action: BakeryAction): string | null {
  if (action === "approve") return status === "pending" ? "active" : null;
  if (action === "suspend") return status === "active" || status === "pending" ? "suspended" : null;
  return status === "suspended" ? "active" : null; // reinstate
}
/** Recompute a product's rating after one review is removed. */
export function afterRemoval(sum: number, count: number, removed: number) {
  const ratingSum = sum - removed, ratingCount = Math.max(count - 1, 0);
  return { ratingSum, ratingCount, rating: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0 };
}
