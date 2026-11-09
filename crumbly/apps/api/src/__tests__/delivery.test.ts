import { describe, expect, it } from "vitest";
import { feeForKm, haversineKm, isDeliverable } from "../delivery-utils.js";
describe("delivery", () => {
  it("measures Westlands to CBD at roughly 4-5 km", () => { const d = haversineKm({ lat: -1.2676, lng: 36.8108 }, { lat: -1.2864, lng: 36.8172 }); expect(d).toBeGreaterThan(1.5); expect(d).toBeLessThan(3); });
  it("prices with a floor and rounds to 10", () => { expect(feeForKm(0.5)).toBe(150); expect(feeForKm(5)).toBe(250); expect(feeForKm(10)).toBe(400); });
  it("limits the delivery radius", () => { expect(isDeliverable(15)).toBe(true); expect(isDeliverable(15.1)).toBe(false); });
});
