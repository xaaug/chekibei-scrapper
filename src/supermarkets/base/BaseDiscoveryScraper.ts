import { Page } from "playwright";
import { DiscoveryCategoryInput, DiscoveryRunResult, DiscoveredProduct } from "../../types/discovery";
import { runScrollEngine } from "./scrollEngine";
import { waitForProductsToLoad } from "./waitStrategies";
import { withRetry } from "../../core/retries/retry";
import { scopedLogger } from "../../core/logger/logger";

export type DiscoverySupermarketId = "quickmart" | "carrefour" | "naivas";

export interface DiscoveryScraperConfig {
  supermarket: DiscoverySupermarketId;
  baseUrl: string;
  searchUrl: string;
  paginationMode: "scroll" | "pagination" | "hybrid";
  maxRetries: number;
  waitTime: number;
}

export interface DiscoveryScraperInput {
  categoryUrl: string;
  category: string;
  maxPages: number;
}

export interface DiscoveryScrapeResult {
  categoryUrl: string;
  totalPages: number;
  totalProducts: number;
  products: DiscoveredProduct[];
  errors: { page: number; reason: string; retried: boolean }[];
  durationMs: number;
}

export abstract class BaseDiscoveryScraper {
  protected readonly config: DiscoveryScraperConfig;

  constructor(config: DiscoveryScraperConfig) {
    this.config = config;
  }

  protected abstract get productCardSelector(): string;

  /** Navigate to category/search results for the given categoryUrl */
  protected abstract navigateToCategory(page: Page, categoryUrl: string): Promise<void>;

  /** Extract all discovered products from the current DOM */
  protected abstract extractDiscoveredProducts(
    page: Page,
    category: string,
  ): Promise<DiscoveredProduct[]>;

  // ── Orchestration ──────────────────────────────────────────────────────────

  async scrapeCategory(page: Page, input: DiscoveryScraperInput): Promise<DiscoveryScrapeResult> {
    const startTime = Date.now();
    const { categoryUrl, category, maxPages } = input;
    const errors: { page: number; reason: string; retried: boolean }[] = [];
    const products: DiscoveredProduct[] = [];
    let pagesScraped = 0;
    const seen = new Set<string>();

    const log = scopedLogger(`${this.config.supermarket}:discovery`);

    log.info(`Starting discovery scrape for category: ${category}`, { categoryUrl, maxPages });

    // ── Navigate with retry ──────────────────────────────────────────────────
    await withRetry(
      () => this.navigateToCategory(page, categoryUrl),
      { maxAttempts: this.config.maxRetries, delayMs: 2_000 },
      `navigateToCategory(${categoryUrl})`,
    ).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ page: 0, reason: `Navigation failed: ${msg}`, retried: true });
      log.error(`Navigation failed for category "${category}"`, { error: msg, categoryUrl });
    });

    // ── Wait for initial products ────────────────────────────────────────────
    const loaded = await waitForProductsToLoad(
      page,
      this.productCardSelector,
      1,
      10_000,
    );

    if (!loaded) {
      errors.push({ page: 0, reason: "No products loaded after navigation", retried: false });
      return {
        categoryUrl,
        totalPages: 0,
        totalProducts: 0,
        products: [],
        errors,
        durationMs: Date.now() - startTime,
      };
    }

    // ── Page loop ─────────────────────────────────────────────────────────────
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      log.info(`Scraping page ${pageNum}/${maxPages}`);

      let pageProducts: DiscoveredProduct[] = [];

      try {
        pageProducts = await withRetry(
          () => this.extractDiscoveredProducts(page, category),
          { maxAttempts: this.config.maxRetries, delayMs: 1_000 },
          `extractDiscoveredProducts(page=${pageNum})`,
        ).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ page: pageNum, reason: `Extraction failed: ${msg}`, retried: true });
          log.error(`Extraction failed at page ${pageNum}`, { error: msg });
          return [] as DiscoveredProduct[];
        });
      } catch (err) {
        // This shouldn't happen due to withRetry catch, but just in case
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ page: pageNum, reason: `Extraction failed: ${msg}`, retried: true });
        log.error(`Extraction failed at page ${pageNum}`, { error: msg });
        break;
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
        let paginationSuccess = false;

        try {
          // Check if we've reached the end by trying to go to next page
          const paginationResult = await this.goToNextPage(page, pageNum);
          if (paginationResult.reachedEnd) {
            log.info(`End of category reached at page ${pageNum}`);
            break;
          }
          paginationSuccess = true;
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          errors.push({
            page: pageNum,
            reason: `Pagination: ${reason}`,
            retried: false,
          });
          log.error(`Pagination failed at page ${pageNum}`, { reason });
          break;
        }

        // If pagination failed but we didn't break above, continue anyway
        if (!paginationSuccess) {
          log.warn(`Pagination attempt failed but continuing to next page`);
        }
      }
    }

    log.info(`Discovery scrape complete for category "${category}"`, {
      pagesScraped,
      uniqueProducts: products.length,
      errors: errors.length,
    });

    return {
      categoryUrl,
      totalPages: pagesScraped,
      totalProducts: products.length,
      products,
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  /** Try to go to the next page, return whether we reached the end */
  protected async goToNextPage(page: Page, currentPageNum: number): Promise<{
    reachedEnd: boolean;
  }> {
    // Default implementation - subclasses can override
    if (this.config.paginationMode === "pagination" || this.config.paginationMode === "hybrid") {
      // Try to click next button
      const nextButton = await page.$('.pagination button[aria-label="next"], .page-list button[aria-label="next"], a[rel="next"]');
      if (nextButton) {
        await nextButton.click();
        await page.waitForTimeout(2000); // Wait for page to load
        return { reachedEnd: false };
      }
    }

    // For scroll mode or if no next button found, we assume we need to scroll
    // This is a simplified implementation - subclasses should override for specific logic
    return { reachedEnd: true };
  }
}