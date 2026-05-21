import { SupermarketId } from "../supermarkets/base/types";
import { RawScrapedInput } from "../pricing/normalizeScrapedProduct";
import { scopedLogger } from "../core/logger/logger";

const log = scopedLogger("mockScraper");

/**
 * Mock scraped data — real scrapers plug in here later.
 * Returns realistic KES prices and CDN image URLs per supermarket.
 */
const MOCK_DATA: Record<SupermarketId, (externalId: string) => Omit<RawScrapedInput, "supermarket" | "externalId" | "url">> = {
  quickmart: (id) => ({
    name: `Product ${id}`,
    currentPrice: 150 + Math.floor(Math.random() * 200),
    originalPrice: undefined,
    imageUrl: `https://cfn.quickmart.co.ke/resized/600_600/product_images_${id}.png?t=${Date.now()}`,
    scrapedAt: new Date().toISOString(),
  }),

  carrefour: (id) => ({
    name: `Product ${id}`,
    currentPrice: 160 + Math.floor(Math.random() * 200),
    originalPrice: 200 + Math.floor(Math.random() * 100),
    imageUrl: `https://cdn.mafrservices.com/sys-master-root/${id}/product.jpg`,
    scrapedAt: new Date().toISOString(),
  }),

  naivas: (id) => ({
    name: `Product ${id}`,
    currentPrice: 145 + Math.floor(Math.random() * 200),
    originalPrice: undefined,
    imageUrl: `https://d16zmt6hgq1jhj.cloudfront.net/product/${id}/image.jpg`,
    scrapedAt: new Date().toISOString(),
  }),
};

export function getScrapedData(
  productKey: string,
  supermarket: SupermarketId,
  externalId: string,
  url: string,
): RawScrapedInput {
  log.debug(`Mock scrape: ${productKey} / ${supermarket}`);

  const factory = MOCK_DATA[supermarket];
  const data = factory(externalId);

  return { supermarket, externalId, url, ...data };
}