import { ScrapedSupermarketData } from "../types/pricing";
import { SupermarketId } from "../supermarkets/base/types";
import { extractImage } from "../images/extractImage";
import { DiscountType } from "../types/pricing";

export interface RawScrapedInput {
  supermarket: SupermarketId;
  externalId: string;
  url: string;
  name: string;
  currentPrice: number;
  originalPrice?: number;
  imageUrl?: string | null;
  html?: string;
  scrapedAt?: string;
}

/**
 * Normalizes raw scraped input into a consistent ScrapedSupermarketData shape.
 *
 * Image resolution order:
 * 1. Explicit imageUrl passed in
 * 2. Extracted from HTML if provided
 * 3. null
 */
export function normalizeScrapedProduct(raw: RawScrapedInput): ScrapedSupermarketData {
  const imageUrl =
    raw.imageUrl ??
    (raw.html ? extractImage(raw.supermarket, raw.html) : null);

  return {
    supermarket: raw.supermarket,
    externalId: raw.externalId,
    url: raw.url,
    name: raw.name,
    currentPrice: raw.currentPrice,
    originalPrice: raw.originalPrice,
    imageUrl,
    html: raw.html,
    scrapedAt: raw.scrapedAt ?? new Date().toISOString(),
  };
}