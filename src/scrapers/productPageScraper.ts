import { Page } from "playwright";
import { SupermarketId } from "../supermarkets/base/types";
import { extractPricing } from "../pricing/extractPricing";
import { extractImage } from "../images/extractImage";
import { scopedLogger } from "../core/logger/logger";
import { withRetry } from "../core/retries/retry";

const log = scopedLogger("productPageScraper");

export interface LiveScrapedProduct {
  supermarket: SupermarketId;
  externalId: string;
  url: string;
  name: string;
  currentPrice: number | null;
  originalPrice: number | null;
  imageUrl: string | null;
  scrapedAt: string;
}

/**
 * Navigates to a product detail page and extracts:
 * - current price
 * - original/pre-discount price
 * - main product image
 *
 * Returns null if the page fails to load or yields no price.
 */
export async function scrapeProductPage(
  page: Page,
  supermarket: SupermarketId,
  externalId: string,
  url: string,
): Promise<LiveScrapedProduct | null> {
  return withRetry(
    async () => {
      log.debug(`Scraping: ${supermarket} / ${url}`);

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      // Wait for price element to be present per supermarket
      await waitForPriceElement(page, supermarket);

      const html = await page.content();
      const pricing = extractPricing(supermarket, html);
      const imageUrl = extractImage(supermarket, html);

      const name = await extractProductName(page, supermarket);

      if (pricing.currentPrice === null) {
        log.warn(`No price found: ${supermarket} / ${url}`);
        return null;
      }

      return {
        supermarket,
        externalId,
        url,
        name,
        currentPrice: pricing.currentPrice,
        originalPrice: pricing.originalPrice  ?? null,
        imageUrl,
        scrapedAt: new Date().toISOString(),
      };
    },
    { maxAttempts: 2, delayMs: 2_000 },
    `scrapeProductPage(${supermarket}, ${url})`,
  ).catch((err) => {
    log.error(`Failed to scrape product page`, {
      supermarket,
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  });
}

// ── Per-supermarket price element wait ────────────────────────────────────────
async function waitForPriceElement(page: Page, supermarket: SupermarketId): Promise<void> {
  const selectors: Record<SupermarketId, string> = {
    carrefour: ".force-ltr",
    quickmart:  ".products-price-new",
    naivas:     ".product-price",
  };

  await page
    .waitForSelector(selectors[supermarket], { state: "visible", timeout: 20_000 })
    .catch(() => log.warn(`Price selector timeout: ${supermarket}`));
}

// ── Per-supermarket product name extraction ───────────────────────────────────
async function extractProductName(page: Page, supermarket: SupermarketId): Promise<string> {
  const selectors: Record<SupermarketId, string> = {
    carrefour: "h1, [data-testid='product-title']",
    quickmart:  "h1.product-title",
    naivas:     ".text-xl .mb-1",
  };

  return page
    .locator(selectors[supermarket])
    .first()
    .innerText()
    .then((t) => t.trim())
    .catch(() => "");
}