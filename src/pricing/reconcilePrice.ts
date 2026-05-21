import { PriceSnapshot, Discount, DiscountType } from "../types/pricing";
import { ScrapedSupermarketData } from "../types/pricing";
import { CanonicalProduct } from "../types/canonical";

export function reconcilePrice(
  canonical: CanonicalProduct,
  scraped: ScrapedSupermarketData,
  existing: PriceSnapshot | null,
): PriceSnapshot {
  const discount = buildDiscount(
    scraped.currentPrice,
    scraped.originalPrice ?? null,
    (scraped as any).isOnOffer ?? false,
  );

  return {
    productKey: canonical.productKey,
    supermarket: scraped.supermarket,

    // basePrice: locked on first insert, never overwritten
    basePrice: existing?.basePrice ?? scraped.currentPrice ?? 0,
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
  isOnOffer: boolean,
): Discount {
  if (!isOnOffer || !originalPrice || !currentPrice || originalPrice <= currentPrice) {
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