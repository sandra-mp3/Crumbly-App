export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Hours = Record<(typeof DAYS)[number], { open: string; close: string } | null>;
export interface BakeryDraft { name?: string; about?: string; area?: string; phone?: string; location?: { lat: number; lng: number }; hours?: Partial<Hours>; offersDelivery?: boolean; offersPickup?: boolean; payoutPhone?: string; logo?: string; cover?: string }

/** What a bakery still needs before it can be published. Empty array = ready. */
export function missingForPublish(b: BakeryDraft, publishedProducts: number): { key: string; label: string }[] {
  const checks: [string, string, boolean][] = [
    ["info", "Bakery name, area and phone", !!(b.name && b.area && b.phone)],
    ["about", "A short description", !!b.about && b.about.length >= 20],
    ["location", "Bakery location", !!b.location],
    ["hours", "Opening hours for at least one day", DAYS.some((d) => !!b.hours?.[d])],
    ["fulfilment", "Pickup or delivery enabled", !!(b.offersDelivery || b.offersPickup)],
    ["payout", "M-Pesa number for payouts", !!b.payoutPhone],
    ["images", "Logo and cover photo", !!(b.logo && b.cover)],
    ["products", "At least one published product", publishedProducts > 0],
  ];
  return checks.filter(([, , ok]) => !ok).map(([key, label]) => ({ key, label }));
}
