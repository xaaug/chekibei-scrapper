import { Page } from "playwright";
import { DiscoveredProduct, DiscoveryPageError } from "../../../types/discovery";
import { QUICKMART_CONFIG } from "../config";
import { extractProducts } from "./extractProducts";
import { goToNextPage } from "./paginate";
import { withRetry } from "../../../core/retries/retry";
import { scopedLogger } from "../../../core/logger/logger";

const log = scopedLogger("quickmart:scrapeCategory");

export interface ScrapeCategoryResult {
  products: DiscoveredProduct[];
  pageErrors: DiscoveryPageError[];
  pagesScraped: number;
}

/**
 * Scrapes all pages of a single category URL up to `maxPages`.
 *
 * Resilience contract:
 * - Per-page failures are caught, logged, and recorded in `pageErrors`
 * - A failed page does NOT stop the overall category run
 * - Products are deduplicated by productId (falling back to url)
 */
export async function scrapeCategory(
  page: Page,
  categoryUrl: string,
  maxPages: number,
): Promise<ScrapeCategoryResult> {
  const products: DiscoveredProduct[] = [];
  const pageErrors: DiscoveryPageError[] = [];
  const seen = new Set<string>();
  let pagesScraped = 0;

  // Derive category label from URL path
  const category = deriveCategoryLabel(categoryUrl);

  log.info(`Scraping category: ${category}`, { categoryUrl, maxPages });

  // ── Navigate to category page ────────────────────────────────────────────────
  await page.goto(categoryUrl, {
    waitUntil: "domcontentloaded",
    timeout: QUICKMART_CONFIG.navigation.pageLoadTimeoutMs,
  });

  // ── Page loop ────────────────────────────────────────────────────────────────
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    log.info(`Scraping page ${pageNum}/${maxPages}`);

    let pageProducts: DiscoveredProduct[] = [];
    let retried = false;

    try {
      pageProducts = await withRetry(
        () => extractProducts(page, category),
        QUICKMART_CONFIG.retry,
        `extractProducts(page=${pageNum})`,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log.error(`Page ${pageNum} extraction failed after retries`, { reason });
      pageErrors.push({ page: pageNum, reason, retried: true });
      retried = true;
    }

    // Deduplicate and collect
    for (const product of pageProducts) {
      const key = product.productId ?? product.url;
      if (!seen.has(key)) {
        seen.add(key);
        products.push(product);
      }
    }

    pagesScraped++;
    log.info(`Page ${pageNum}: ${pageProducts.length} products (${products.length} total unique)`);

    // ── Check if there are more pages ────────────────────────────────────────
    if (pageNum < maxPages) {
      let paginationResult;

      try {
        paginationResult = await goToNextPage(page, pageNum);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        log.error(`Pagination failed at page ${pageNum}`, { reason });
        pageErrors.push({ page: pageNum, reason: `Pagination: ${reason}`, retried: false });
        break;
      }

      if (paginationResult.reachedEnd) {
        log.info(`End of category reached at page ${pageNum}`);
        break;
      }
    }
  }

  log.info(`Category "${category}" complete`, {
    pagesScraped,
    uniqueProducts: products.length,
    errors: pageErrors.length,
  });

  return { products, pageErrors, pagesScraped };
}

function deriveCategoryLabel(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    return segments[segments.length - 1]?.replace(/-/g, " ") ?? "unknown";
  } catch {
    return url;
  }
}
