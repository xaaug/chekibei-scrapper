import { Page } from "playwright";
import { DiscoveredProduct } from "../../../types/discovery";
import { QUICKMART_SELECTORS } from "../selectors";
import { extractProductCard } from "./extractProductCard";
import { scopedLogger } from "../../../core/logger/logger";

const log = scopedLogger("quickmart:extractProducts");

/**
 * Finds all `.products.productInfoJs` elements on the current page
 * and extracts discovery data from each.
 *
 * Failures on individual cards are logged and skipped — they do NOT
 * abort the page extraction.
 */
export async function extractProducts(
  page: Page,
  category: string,
): Promise<DiscoveredProduct[]> {
  const cards = await page.$$(QUICKMART_SELECTORS.productCard);

  if (cards.length === 0) {
    log.warn(`No product cards found on page (category: ${category})`);
    return [];
  }

  log.debug(`Found ${cards.length} product cards`);

  const results: DiscoveredProduct[] = [];

  for (const card of cards) {
    const product = await extractProductCard(card, category);
    if (product) results.push(product);
  }

  log.debug(`Extracted ${results.length}/${cards.length} valid products`);

  return results;
}
