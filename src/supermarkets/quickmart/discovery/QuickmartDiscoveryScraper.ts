import { Page } from "playwright";
import { DiscoveryScraperConfig, DiscoveryScraperInput, BaseDiscoveryScraper } from "../../base/BaseDiscoveryScraper";
import { DiscoveredProduct } from "../../../types/discovery";
import { QUICKMART_SELECTORS } from "../selectors";
import { QUICKMART_CONFIG } from "../config";
import { extractProducts } from "./extractProducts";
import { goToNextPage } from "./paginate";
import { ScrapeCategoryResult } from "./scrapeCategory";
import { withRetry } from "../../../core/retries/retry";
import { scopedLogger } from "../../../core/logger/logger";

const log = scopedLogger("quickmart:discoveryScraper");

export class QuickmartDiscoveryScraper extends BaseDiscoveryScraper {
  constructor() {
    super({
      supermarket: "quickmart",
      baseUrl: QUICKMART_CONFIG.baseUrl,
      searchUrl: `${QUICKMART_CONFIG.baseUrl}/products/search`, // Not used directly but kept for consistency
      paginationMode: "pagination",
      maxRetries: QUICKMART_CONFIG.retry.maxAttempts,
      waitTime: QUICKMART_CONFIG.navigation.postClickStabilityMs,
    });
  }

  protected get productCardSelector(): string {
    return QUICKMART_SELECTORS.productCard;
  }

  protected async navigateToCategory(page: Page, categoryUrl: string): Promise<void> {
    // Quickmart's frontend bounces cold brand/non-standard page navigations to
    // /home. Navigating from the homepage first gives us a valid referrer and
    // lets their JS initialise before we go to the target URL.
    await page.goto(this.config.baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: QUICKMART_CONFIG.navigation.pageLoadTimeoutMs,
    });

    await page.goto(categoryUrl, {
      waitUntil: "domcontentloaded",
      timeout: QUICKMART_CONFIG.navigation.pageLoadTimeoutMs,
      referer: this.config.baseUrl,
    });

    // Wait for URL to stabilise
    await page.waitForTimeout(3_500);
  }

  protected async extractDiscoveredProducts(
    page: Page,
    category: string,
  ): Promise<DiscoveredProduct[]> {
    return await withRetry(
      () => extractProducts(page, category),
      {
        maxAttempts: this.config.maxRetries,
        delayMs: QUICKMART_CONFIG.retry.delayMs,
      },
      `extractProducts`,
    );
  }

  protected async goToNextPage(page: Page, currentPageNum: number): Promise<{
    reachedEnd: boolean;
  }> {
    try {
      const paginationResult = await goToNextPage(page, currentPageNum);
      return { reachedEnd: paginationResult.reachedEnd };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log.error(`Pagination failed at page ${currentPageNum}`, { reason });
      // If pagination fails, assume we've reached the end to avoid infinite loop
      return { reachedEnd: true };
    }
  }
}