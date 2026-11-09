import { describe, expect, it } from "vitest";
import { afterRemoval, nextBakeryStatus } from "../admin-utils.js";

describe("bakery status changes", () => {
  it("approves only pending bakeries", () => { expect(nextBakeryStatus("pending", "approve")).toBe("active"); expect(nextBakeryStatus("draft", "approve")).toBe(null); expect(nextBakeryStatus("active", "approve")).toBe(null); expect(nextBakeryStatus("suspended", "approve")).toBe(null); });
  it("suspends live or pending bakeries, not drafts", () => { expect(nextBakeryStatus("active", "suspend")).toBe("suspended"); expect(nextBakeryStatus("pending", "suspend")).toBe("suspended"); expect(nextBakeryStatus("draft", "suspend")).toBe(null); });
  it("only a suspended bakery can be reinstated", () => { expect(nextBakeryStatus("suspended", "reinstate")).toBe("active"); expect(nextBakeryStatus("pending", "reinstate")).toBe(null); });
});
describe("rating after removing a review", () => {
  it("recomputes the average", () => expect(afterRemoval(14, 3, 5)).toEqual({ ratingSum: 9, ratingCount: 2, rating: 4.5 }));
  it("returns to zero when the last review goes", () => expect(afterRemoval(5, 1, 5)).toEqual({ ratingSum: 0, ratingCount: 0, rating: 0 }));
});
