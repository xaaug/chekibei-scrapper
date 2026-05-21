import { PriceSnapshot, Discount, DiscountType } from "../types/pricing";
import { ScrapedSupermarketData } from "../types/pricing";
import { CanonicalProduct } from "../types/canonical";

export function reconcilePrice(
  canonical: CanonicalProduct,
  scraped: ScrapedSupermarketData,
  existing: PriceSnapshot | null,
): PriceSnapshot {
  // basePrice: locked on first insert, never overwritten
  const basePrice = existing?.basePrice ?? scraped.originalPrice ?? scraped.currentPrice ?? 0;

  const discount = buildDiscount(
    scraped.currentPrice,
    scraped.originalPrice ?? null,
    (scraped as any).isOnPromo ?? false,
    basePrice,
  );

  return {
    productKey: canonical.productKey,
    supermarket: scraped.supermarket,
    basePrice,
    currentPrice: scraped.currentPrice,
    currency: "KES",
    discount,
    imageUrl: scraped.imageUrl,
    lastUpdated: scraped.scrapedAt,
  };
}

function buildDiscount(
  currentPrice: number | null,
  originalPrice: number | null,
  isOnPromo: boolean,
  basePrice: number,
): Discount {
  if (!currentPrice) return { active: false, amount: 0, type: "unknown" };

  // Determine the reference price to diff against — prefer explicit originalPrice
  // from the scraper, fall back to the locked basePrice
  const referencePrice = originalPrice ?? (basePrice > currentPrice ? basePrice : null);

  if (!referencePrice || referencePrice <= currentPrice) {
    return { active: false, amount: 0, type: "unknown" };
  }

  return {
    active: true,
    amount: Math.round(referencePrice - currentPrice),
    type: inferDiscountType(currentPrice, referencePrice),
  };
}

function inferDiscountType(current: number, reference: number): DiscountType {
  const pct = ((reference - current) / reference) * 100;
  if (pct >= 30) return "clearance";
  if (pct >= 5)  return "promotion";
  return "unknown";
}