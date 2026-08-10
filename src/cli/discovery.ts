/**
 * CLI: npm run discovery
 *
 * Usage:
 *   npm run discovery
 *   npm run discovery -- --headful        (visible browser)
 *   npm run discovery -- --url <url> --pages <n> --supermarkets quickmart,naivas,carrefour
 */

require('dotenv').config()
import path from "path";
import fs from "fs";
import { launchBrowser } from "../core/browser/browser";
import { loadSession } from "../supermarkets/quickmart/session/loadSession";
import { initSession } from "../supermarkets/quickmart/session/initSession";
import { getAllDiscoveryScrapers, getDiscoveryScraper } from "../supermarkets/registry";
import { DiscoveryCategoryInput, DiscoveryRunResult, DiscoveredProduct } from "../types/discovery";
import { CanonicalProduct } from "../types/canonical";
import { buildCanonicalProducts } from "../enrichment";
import { logger, scopedLogger } from "../core/logger/logger";;
import { algolia, ALGOLIA_INDEX } from "../lib/algolia";
import { similarityEngine } from "../reconciliation/similarity";
import { SupermarketId } from "../supermarkets/base/types";

const CONVEX_HTTP_URL = process.env.CONVEX_HTTP_URL;

// ── CLI arg parsing ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const headful = args.includes("--headful");

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const customUrl = getArg("--url");
const customPages = getArg("--pages");
const supersArg = getArg("--supermarkets");

// Default to all supermarkets if none specified
const TARGET_SUPERMARKETS: SupermarketId[] = supersArg
  ? (supersArg.split(",").map((s) => s.trim().toLowerCase()) as SupermarketId[])
  : ["quickmart", "naivas", "carrefour"];

async function fetchBrandCategories(supermarket: SupermarketId): Promise<DiscoveryCategoryInput[]> {
  // Different supermarkets may have different endpoints
  // For now, only Quickmart has brand categories in Convex
  // In the future, each supermarket could have its own endpoint
  if (supermarket === "quickmart") {
    const url = `${CONVEX_HTTP_URL}/brands/quickmart`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch brand categories for ${supermarket} (${res.status}): ${await res.text()}`);
    }

    const brands: Array<{ brandUrl: string; category: string; maxPages: number }> = await res.json();

    if (brands.length === 0) {
      throw new Error(`No active brand categories found for ${supermarket} in Convex — seed first`);
    }

    logger.info(`Fetched ${brands.length} brand categories for ${supermarket} from Convex`);

    return brands.map((b) => ({
      categoryUrl: b.brandUrl,
      category: b.category,
      maxPages: b.maxPages,
    }));
  } else {
    // For other supermarkets, we fall back to custom URL or empty
    logger.warn(`No brand category endpoint configured for ${supermarket}; using custom URL if provided`);
    return [];
  }
}

function deriveCategoryFromUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1]?.replace(/-/g, " ") ?? "unknown";
  } catch {
    return "unknown";
  }
}

// Run discovery pipeline using a scraper instance
async function runDiscoveryPipelineForScraper(
  context: any, // BrowserContext
  scraper: any, // BaseDiscoveryScraper
  categories: DiscoveryCategoryInput[],
  supermarket: string
): Promise<DiscoveryRunResult[]> {
  const log = scopedLogger(`${supermarket}:discoveryPipeline`);
  log.info(`Starting discovery pipeline`, { categoryCount: categories.length });

  const results: DiscoveryRunResult[] = [];

  for (const input of categories) {
    const start = Date.now();
    let page = await context.newPage();

    log.info(`Processing category: ${input.categoryUrl}`);

    try {
      const scrapeResult = await scraper.scrapeCategory(page, {
        categoryUrl: input.categoryUrl,
        category: input.category,
        maxPages: input.maxPages,
      });

      results.push({
        categoryUrl: input.categoryUrl,
        totalPages: scrapeResult.totalPages,
        totalProducts: scrapeResult.totalProducts,
        products: scrapeResult.products,
        errors: scrapeResult.errors,
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

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  logger.info("==============================================");
  logger.info("  Chekibei — Multi-Supermarket Discovery Scraper");
  logger.info("==============================================");
  logger.info(`Convex URL: ${CONVEX_HTTP_URL ? CONVEX_HTTP_URL : "not set, skipping push"}`);
  logger.info(`Target supermarkets: ${TARGET_SUPERMARKETS.join(", ")}`);

  if (!CONVEX_HTTP_URL) {
    logger.warn("CONVEX_HTTP_URL not set — some features may be limited");
  } else {
    await similarityEngine.init(CONVEX_HTTP_URL);
  }

  let allResults: DiscoveryRunResult[] = [];
  let allCanonical: CanonicalProduct[] = [];

  // Process each target supermarket
  for (const supermarket of TARGET_SUPERMARKETS) {
    logger.info(`\n------------- Processing ${supermarket} -------------`);

    try {
      const scraper = getDiscoveryScraper(supermarket);

      // Get categories for this supermarket
      const categories: DiscoveryCategoryInput[] = customUrl
        ? [{
            categoryUrl: customUrl,
            category: getArg("--category") ?? deriveCategoryFromUrl(customUrl),
            maxPages: customPages ? parseInt(customPages, 10) : 5,
          }]
        : await fetchBrandCategories(supermarket);

      if (categories.length === 0 && !customUrl) {
        logger.warn(`No categories found for ${supermarket}, skipping`);
        continue;
      }

      // Launch browser session for this supermarket
      const session = loadSession(); // Quickmart-specific session for now
      const browserSession = await launchBrowser({
        headless: !headful,
        storageStatePath: supermarket === "quickmart" && session.exists ? session.path : undefined,
      });

      let supermarketResults: DiscoveryRunResult[] = [];

      try {
        // Initialize session if needed (currently Quickmart-only)
        if (supermarket === "quickmart") {
          const { page: sessionPage, sessionWasNew } = await initSession(browserSession.context);
          await sessionPage.close();
          logger.info(sessionWasNew ? "New session established" : "Session reused");
        }

        // Run discovery pipeline for this supermarket's categories
        supermarketResults = await runDiscoveryPipelineForScraper(
          browserSession.context,
          scraper,
          categories,
          supermarket
        );

        allResults.push(...supermarketResults);
      } finally {
        await browserSession.close();
      }
    } catch (err) {
      logger.error(`Failed to process supermarket ${supermarket}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Enrichment stage ─────────────────────────────────────────────────────
  const allRaw = allResults.flatMap((r) => r.products ?? []);
  allCanonical = buildCanonicalProducts(allRaw);

  logger.info(
    `Enrichment complete: ${allCanonical.length} canonical products from ${allRaw.length} raw`,
  );

  printSummary(allResults);
  await saveResults(allResults, allCanonical);
}

// ── Summary ────────────────────────────────────────────────────────────────────
function printSummary(results: DiscoveryRunResult[]) {
  const totalProducts = results.reduce((s, r) => s + r.totalProducts, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
  const totalMs = results.reduce((s, r) => s + r.durationMs, 0);

  logger.info("==============================================");
  logger.info("  DISCOVERY RUN COMPLETE");
  logger.info("==============================================");

  for (const result of results) {
    const status = result.errors.length > 0 ? "��⚠" : "��✓";
    logger.info(
      `${status} ${result.categoryUrl} → ${result.totalProducts} products, ` +
        `${result.totalPages} pages, ${result.errors.length} errors (${result.durationMs}ms)`,
    );
  }

  logger.info("-------------------------------------------------");
  logger.info(
    `Total: ${totalProducts} products | ${totalErrors} errors | ${(totalMs / 1000).toFixed(1)}s`,
  );
}

// ── Save ───────────────────────────────────────────────────────────────────────

async function pushToConvex(endpoint: string, payload: unknown[]) {
  if (!CONVEX_HTTP_URL) {
    logger.warn("CONVEX_HTTP_URL not set — skipping push");
    return;
  }

  const url = `${CONVEX_HTTP_URL}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex push to ${endpoint} failed (${res.status}): ${text}`);
  }

  return res.json();
}


async function saveResults(
  results: DiscoveryRunResult[],
  canonical: CanonicalProduct[],
) {
  const outputDir = path.resolve(process.cwd(), "output");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  // ── Local saves ─────────────────────────────────────────────

  const discoveryPath = path.join(
    outputDir,
    `discovery-${timestamp}.json`,
  );

  fs.writeFileSync(discoveryPath, JSON.stringify(results, null, 2));

  logger.info(`Raw discovery saved: ${discoveryPath}`);

  const canonicalPath = path.join(
    outputDir,
    `canonical-${timestamp}.json`,
  );

  fs.writeFileSync(canonicalPath, JSON.stringify(canonical, null, 2));

  logger.info(
    `Canonical products saved: ${canonicalPath} (${canonical.length} items)`,
  );

  // ── Convex pushes ───────────────────────────────────────────

  const allDiscovered = results.flatMap((r) => r.products ?? []);

  try {
    const dResult = await pushToConvex(
      "/push/discovered",
      allDiscovered,
    );

    logger.info(`Pushed discovered: ${JSON.stringify(dResult)}`);
  } catch (e) {
    logger.error(`Failed to push discovered products: ${e}`);
  }

  try {
    const cResult = await pushToConvex(
      "/push/canonical",
      canonical,
    );

    logger.info(`Pushed canonical: ${JSON.stringify(cResult)}`);
  } catch (e) {
    logger.error(`Failed to push canonical products: ${e}`);
  }

  // ── Algolia indexing ────────────────────────────────────────

  try {
    const records = canonical.map((product) => ({
      objectID: product.productKey,
      ...product,
    }));

    const algoliaResult = await algolia.saveObjects({
      indexName: ALGOLIA_INDEX,
      objects: records,
    });

    logger.info(
      `Indexed ${records.length} canonical products to Algolia`,
    );

    logger.info(JSON.stringify(algoliaResult));
  } catch (e) {
    logger.error(`Failed to index Algolia products: ${e}`);
  }
}

// ── Run ────────────────────────────────────────────────────────────────────────
main().catch((err) => {
  logger.error("Fatal error in discovery CLI", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});