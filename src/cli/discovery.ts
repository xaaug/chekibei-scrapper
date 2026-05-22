/**
 * CLI: npm run discovery
 *
 * Usage:
 *   npm run discovery
 *   npm run discovery -- --headful        (visible browser)
 *   npm run discovery -- --url <url> --pages <n>
 */

import path from "path";
import fs from "fs";
import { launchBrowser } from "../core/browser/browser";
import { loadSession } from "../supermarkets/quickmart/session/loadSession";
import { initSession } from "../supermarkets/quickmart/session/initSession";
import { runDiscoveryPipeline } from "../supermarkets/quickmart/discovery/discoveryPipeline";
import { DiscoveryCategoryInput, DiscoveryRunResult } from "../types/discovery";
import { CanonicalProduct } from "../types/canonical";
import { buildCanonicalProducts } from "../enrichment";
import { logger } from "../core/logger/logger";

// ── CLI arg parsing ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const headful = args.includes("--headful");

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const customUrl = getArg("--url");
const customPages = getArg("--pages");

// ── Default categories ─────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES: DiscoveryCategoryInput[] = [
  
  // { categoryUrl: "https://quickmart.co.ke/foods", maxPages: 1 },
  { categoryUrl: "https://quickmart.co.ke/flour", maxPages: 1 },
  // { categoryUrl: "https://quickmart.co.ke/sugar", maxPages: 1 },
  // { categoryUrl: "https://quickmart.co.ke/rice-cereals", maxPages: 20 },
  // { categoryUrl: "https://quickmart.co.ke/cooking-oils-fats", maxPages: 1},
  // { categoryUrl: "https://quickmart.co.ke/dairy-products", maxPages: 50 },
  // { categoryUrl: "https://quickmart.co.ke/cakes-bread", maxPages: 50 },
  // { categoryUrl: "https://quickmart.co.ke/breakfast", maxPages: 50 },
  // { categoryUrl: "https://quickmart.co.ke/beverages", maxPages: 50 },
  // { categoryUrl: "https://quickmart.co.ke/juices-carbonates", maxPages: 80 },
  // { categoryUrl: "https://quickmart.co.ke/water", maxPages: 50 },
  // { categoryUrl: "https://quickmart.co.ke/seasoning-condiments", maxPages: 50 },
  // { categoryUrl: "https://quickmart.co.ke/pasta-noodles", maxPages: 50 },
  // { categoryUrl: "https://quickmart.co.ke/diapers-wipes", maxPages: 50 },
  // { categoryUrl: "https://quickmart.co.ke/oral-care-products", maxPages: 50 },
  // { categoryUrl: "https://quickmart.co.ke/sanitary", maxPages: 50 },
  // { categoryUrl: "https://quickmart.co.ke/personal-wash", maxPages: 50 },
];

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  logger.info("═══════════════════════════════════════════════");
  logger.info("  Chekibei — Quickmart Discovery Scraper");
  logger.info("═══════════════════════════════════════════════");

  const categories: DiscoveryCategoryInput[] = customUrl
    ? [{ categoryUrl: customUrl, maxPages: customPages ? parseInt(customPages, 10) : 5 }]
    : DEFAULT_CATEGORIES;

  logger.info(`Categories to scrape: ${categories.length}`, {
    urls: categories.map((c) => c.categoryUrl),
  });

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
async function saveResults(
  results: DiscoveryRunResult[],
  canonical: CanonicalProduct[],
) {
  const outputDir = path.resolve(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  // Raw discovery — full run results per category
  const discoveryPath = path.join(outputDir, `discovery-${timestamp}.json`);
  fs.writeFileSync(discoveryPath, JSON.stringify(results, null, 2));
  logger.info(`Raw discovery saved: ${discoveryPath}`);

  // Canonical products — enriched, deduplicated
  const canonicalPath = path.join(outputDir, `canonical-${timestamp}.json`);
  fs.writeFileSync(canonicalPath, JSON.stringify(canonical, null, 2));
  logger.info(`Canonical products saved: ${canonicalPath} (${canonical.length} items)`);
}

// ── Run ────────────────────────────────────────────────────────────────────────
main().catch((err) => {
  logger.error("Fatal error in discovery CLI", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});