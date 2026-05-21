import { PriceSnapshot, Discount, DiscountType } from "../types/pricing";
import { ScrapedSupermarketData } from "../types/pricing";
import { CanonicalProduct } from "../types/canonical";

/**
 * Builds a new PriceSnapshot by merging:
 * - existing snapshot (if any) — preserves basePrice
 * - freshly scraped data
 *
 * basePrice is only set on first ever snapshot and never overwritten.
 */
export function reconcilePrice(
  canonical: CanonicalProduct,
  scraped: ScrapedSupermarketData,
  existing: PriceSnapshot | null,
): PriceSnapshot {
  const discount = buildDiscount(scraped.currentPrice, scraped.originalPrice);

  return {
    productKey: canonical.productKey,
    supermarket: scraped.supermarket,

    // basePrice: lock in the first ever price, never touch it again
    basePrice: existing?.basePrice ?? scraped.currentPrice,
    currentPrice: scraped.currentPrice,

    currency: "KES",
    discount,
    imageUrl: scraped.imageUrl,
    lastUpdated: scraped.scrapedAt,
  };
}

function buildDiscount(
  currentPrice: number,
  originalPrice: number | undefined,
): Discount {
  if (!originalPrice || originalPrice <= currentPrice) {
    return { active: false, amount: 0, type: "unknown" };
  }

  return {
    active: true,
    amount: Math.round(originalPrice - currentPrice),
    type: inferDiscountType(currentPrice, originalPrice),
  };
}

function inferDiscountType(current: number, original: number): DiscountType {
  const pct = ((original - current) / original) * 100;
  if (pct >= 30) return "clearance";
  if (pct >= 5)  return "promotion";
  return "unknown";
}