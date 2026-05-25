/**
 * CLI: npm run discovery
 *
 * Usage:
 *   npm run discovery
 *   npm run discovery -- --headful        (visible browser)
 *   npm run discovery -- --url <url> --pages <n>
 */

require('dotenv').config()
import path from "path";
import fs from "fs";
import { launchBrowser } from "../core/browser/browser";
import { loadSession } from "../supermarkets/quickmart/session/loadSession";
import { initSession } from "../supermarkets/quickmart/session/initSession";
import { runDiscoveryPipeline } from "../supermarkets/quickmart/discovery/discoveryPipeline";
import { DiscoveryCategoryInput, DiscoveryRunResult } from "../types/discovery";
import { CanonicalProduct } from "../types/canonical";
import { buildCanonicalProducts } from "../enrichment";
import { logger } from "../core/logger/logger";;
import { algolia, ALGOLIA_INDEX } from "../lib/algolia";
import { similarityEngine } from "../reconciliation/similarity";

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

async function fetchBrandCategories(): Promise<DiscoveryCategoryInput[]> {
  const url = `${CONVEX_HTTP_URL}/brands/quickmart`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch brand categories (${res.status}): ${await res.text()}`);
  }

  const brands: Array<{ brandUrl: string; category: string; maxPages: number }> = await res.json();

  if (brands.length === 0) {
    throw new Error("No active brand categories found in Convex — seed first with npm run seed:brands");
  }

  logger.info(`Fetched ${brands.length} brand categories from Convex`);

  return brands.map((b) => ({
    categoryUrl: b.brandUrl,
    category: b.category,
    maxPages: b.maxPages,
  }));
}

function deriveCategoryFromUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1]?.replace(/-/g, " ") ?? "unknown";
  } catch {
    return "unknown";
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  logger.info("═══════════════════════════════════════════════");
  logger.info("  Chekibei — Quickmart Discovery Scraper");
  logger.info("═══════════════════════════════════════════════");
  logger.info(`Convex URL: ${CONVEX_HTTP_URL ? CONVEX_HTTP_URL : "not set, skipping push"}`);

  if (!CONVEX_HTTP_URL) throw new Error("CONVEX_HTTP_URL not set");
  await similarityEngine.init(CONVEX_HTTP_URL);

  const categories: DiscoveryCategoryInput[] = customUrl
  ? [{
      categoryUrl: customUrl,
      category: getArg("--category") ?? deriveCategoryFromUrl(customUrl),
      maxPages: customPages ? parseInt(customPages, 10) : 5,
    }]
  : await fetchBrandCategories();
  
  const session = loadSession();

  const browserSession = await launchBrowser({
    headless: !headful,
    storageStatePath: session.exists ? session.path : undefined,
  });

  let results: DiscoveryRunResult[] = [];
  let canonical: CanonicalProduct[] = [];

  try {
    const { page: sessionPage, sessionWasNew } = await initSession(browserSession.context);
    await sessionPage.close();

    logger.info(sessionWasNew ? "New session established" : "Session reused");

    results = await runDiscoveryPipeline(browserSession.context, categories);

    // ── Enrichment stage ─────────────────────────────────────────────────────
    const allRaw = results.flatMap((r) => r.products);
    canonical = buildCanonicalProducts(allRaw);

    logger.info(
      `Enrichment complete: ${canonical.length} canonical products from ${allRaw.length} raw`,
    );
  } finally {
    await browserSession.close();
  }

  printSummary(results);
  await saveResults(results, canonical);
}

// ── Summary ────────────────────────────────────────────────────────────────────
function printSummary(results: DiscoveryRunResult[]) {
  const totalProducts = results.reduce((s, r) => s + r.totalProducts, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
  const totalMs = results.reduce((s, r) => s + r.durationMs, 0);

  logger.info("═══════════════════════════════════════════════");
  logger.info("  DISCOVERY RUN COMPLETE");
  logger.info("═══════════════════════════════════════════════");

  for (const result of results) {
    const status = result.errors.length > 0 ? "⚠" : "✓";
    logger.info(
      `${status} ${result.categoryUrl} → ${result.totalProducts} products, ` +
        `${result.totalPages} pages, ${result.errors.length} errors (${result.durationMs}ms)`,
    );
  }

  logger.info("───────────────────────────────────────────────");
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