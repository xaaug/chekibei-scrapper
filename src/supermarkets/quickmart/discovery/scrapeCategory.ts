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
 * Scrapes all pages of a single category/brand URL up to `maxPages`.
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

  const category = deriveCategoryLabel(categoryUrl);
  const expectedPath = new URL(categoryUrl).pathname.replace(/\/$/, "");

  log.info(`Scraping category: ${category}`, { categoryUrl, maxPages });

  // ── Navigate with referrer ────────────────────────────────────────────────
  // Quickmart's frontend bounces cold brand/non-standard page navigations to
  // /home. Navigating from the homepage first gives us a valid referrer and
  // lets their JS initialise before we go to the target URL.
  await page.goto(QUICKMART_CONFIG.baseUrl, {
    waitUntil: "domcontentloaded",
    timeout: QUICKMART_CONFIG.navigation.pageLoadTimeoutMs,
  });

  await page.goto(categoryUrl, {
    waitUntil: "domcontentloaded",
    timeout: QUICKMART_CONFIG.navigation.pageLoadTimeoutMs,
    referer: QUICKMART_CONFIG.baseUrl,
  });

  // ── Verify we landed on the right page ───────────────────────────────────
  // Wait for the URL to stabilise — their router may redirect after load
  await page.waitForTimeout(30_500);

  const landedUrl = page.url();
  const landedPath = new URL(landedUrl).pathname.replace(/\/$/, "");

  if (landedPath !== expectedPath) {
    const reason = `Navigation redirected — expected "${expectedPath}", landed on "${landedPath}". Page may require different URL structure or session state.`;
    log.error(reason, { categoryUrl, landedUrl });
    return {
      products: [],
      pageErrors: [{ page: 0, reason, retried: false }],
      pagesScraped: 0,
    };
  }

  // ── Wait for product grid to appear ──────────────────────────────────────
  // domcontentloaded fires before their JS renders the product grid.
  // Wait for at least one product card before proceeding.
  try {
    await page.waitForSelector(".products.productInfoJs", {
      timeout: 10_000,
      state: "attached",
    });
  } catch {
    log.warn(`Product grid did not appear within 10s (category: ${category})`, {
      landedUrl,
    });
    // Don't bail — extractProducts will log the empty result and return []
  }

  // ── Page loop ─────────────────────────────────────────────────────────────
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    log.info(`Scraping page ${pageNum}/${maxPages}`);

    let pageProducts: DiscoveredProduct[] = [];

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
    log.info(
      `Page ${pageNum}: ${pageProducts.length} products (${products.length} total unique)`,
    );

    // ── Pagination ────────────────────────────────────────────────────────
    if (pageNum < maxPages) {
      let paginationResult;

      try {
        paginationResult = await goToNextPage(page, pageNum);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        log.error(`Pagination failed at page ${pageNum}`, { reason });
        pageErrors.push({
          page: pageNum,
          reason: `Pagination: ${reason}`,
          retried: false,
        });
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
    const { pathname, searchParams } = new URL(url);
    // Handle ?brand=golden-fry style URLs
    const brandParam = searchParams.get("brand");
    if (brandParam) return brandParam.replace(/-/g, " ");

    const segments = pathname.split("/").filter(Boolean);
    return segments[segments.length - 1]?.replace(/-/g, " ") ?? "unknown";
  } catch {
    return url;
  }
}