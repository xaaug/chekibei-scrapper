import { SupermarketId } from "../supermarkets/base/types";

export type Currency = "KES";
export type DiscountType = "promotion" | "clearance" | "member" | "unknown";

export interface Discount {
  active: boolean;
  amount: number;
  type: DiscountType;
}

export interface PriceSnapshot {
  productKey: string;
  supermarket: SupermarketId;

  basePrice: number;       // first ever recorded price — never overwritten
  currentPrice: number;    // latest scraped price

  currency: Currency;

  discount: Discount;

  imageUrl: string | null;

  lastUpdated: string;     // ISO 8601
}

export interface PriceHistoryEntry {
  productKey: string;
  supermarket: SupermarketId;
  price: number;
  timestamp: string;
}

export interface ScrapedSupermarketData {
  supermarket: SupermarketId;
  externalId: string;
  url: string;
  name: string;
  currentPrice: number;
  originalPrice?: number;   // pre-discount price if shown
  imageUrl: string | null;
  html?: string;            // raw HTML for image extraction fallback
  scrapedAt: string;
}