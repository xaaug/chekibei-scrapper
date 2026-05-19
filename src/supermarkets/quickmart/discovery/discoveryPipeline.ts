import { BrowserContext } from "playwright";
import { DiscoveryCategoryInput, DiscoveryRunResult } from "../../../types/discovery";
import { scrapeCategory } from "./scrapeCategory";
import { scopedLogger } from "../../../core/logger/logger";

const log = scopedLogger("quickmart:discoveryPipeline");

/**
 * Orchestrates discovery scraping across one or more category inputs.
 *
 * Each category gets its own page for isolation — a crash in one
 * category does not affect others.
 *
 * Returns an array of DiscoveryRunResult, one per category.
 */
export async function runDiscoveryPipeline(
  context: BrowserContext,
  categories: DiscoveryCategoryInput[],
): Promise<DiscoveryRunResult[]> {
  log.info(`Starting discovery pipeline`, { categoryCount: categories.length });

  const results: DiscoveryRunResult[] = [];

  for (const input of categories) {
    const start = Date.now();
    let page = await context.newPage();

    log.info(`Processing category: ${input.categoryUrl}`);

    try {
      const { products, pageErrors, pagesScraped } = await scrapeCategory(
        page,
        input.categoryUrl,
        input.maxPages,
      );

      results.push({
        categoryUrl: input.categoryUrl,
        totalPages: pagesScraped,
        totalProducts: products.length,
        products,
        errors: pageErrors,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log.error(`Category pipeline failed: ${input.categoryUrl}`, { reason });

      results.push({
        categoryUrl: input.categoryUrl,
        totalPages: 0,
        totalProducts: 0,
        products: [],
        errors: [{ page: 0, reason, retried: false }],
        durationMs: Date.now() - start,
      });
    } finally {
      await page.close().catch(() => {});
    }
  }

  const totalProducts = results.reduce((sum, r) => sum + r.totalProducts, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  log.info(`Pipeline complete`, {
    categories: results.length,
    totalProducts,
    totalErrors,
  });

  return results;
}
