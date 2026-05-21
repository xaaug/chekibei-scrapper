import { ScrapedSupermarketData } from "../types/pricing";
import { SupermarketId } from "../supermarkets/base/types";
import { extractImage } from "../images/extractImage";

export interface RawScrapedInput {
  supermarket: SupermarketId;
  externalId: string;
  url: string;
  name: string;
  currentPrice: number;
  originalPrice?: number | null;
  isOnOffer?: boolean;
  isOutOfStock?: boolean;
  imageUrl?: string | null;
  html?: string;
  scrapedAt?: string;
}

export function normalizeScrapedProduct(raw: RawScrapedInput): ScrapedSupermarketData {
  const imageUrl =
    raw.imageUrl !== undefined
      ? raw.imageUrl
      : raw.html
      ? extractImage(raw.supermarket, raw.html)
      : null;

  return {
    supermarket: raw.supermarket,
    externalId: raw.externalId,
    url: raw.url,
    name: raw.name,
    currentPrice: raw.currentPrice,
    originalPrice: raw.originalPrice ?? undefined,
    imageUrl,
    html: raw.html,
    scrapedAt: raw.scrapedAt ?? new Date().toISOString(),
  };
}