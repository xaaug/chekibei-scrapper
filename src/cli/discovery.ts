/**
 * CLI: npm run discovery
 *
 * Usage:
 *   npm run discovery
 *   npm run discovery -- --headful        (visible browser)
 *   npm run discovery -- --url <url> --pages <n>
 *
 * Defaults to a predefined set of Quickmart categories if no --url given.
 */

import path from "path";
import fs from "fs";
import { launchBrowser } from "../core/browser/browser";
import { loadSession } from "../supermarkets/quickmart/session/loadSession";
import { initSession } from "../supermarkets/quickmart/session/initSession";
import { runDiscoveryPipeline } from "../supermarkets/quickmart/discovery/discoveryPipeline";
import { QUICKMART_CONFIG } from "../supermarkets/quickmart/config";
import { DiscoveryCategoryInput, DiscoveryRunResult } from "../types/discovery";
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

// ── Default categories ──────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES: DiscoveryCategoryInput[] = [
  { categoryUrl: "https://quickmart.co.ke/flour", maxPages: 5 },
  { categoryUrl: "https://quickmart.co.ke/sugar", maxPages: 5 },
  { categoryUrl: "https://quickmart.co.ke/rice-cereals", maxPages: 20 },
  { categoryUrl: "https://quickmart.co.ke/cooking-oil-fats", maxPages: 10 },
  { categoryUrl: "https://quickmart.co.ke/dairy-products", maxPages: 50 },
  { categoryUrl: "https://quickmart.co.ke/cakes-bread", maxPages: 50 },
  { categoryUrl: "https://quickmart.co.ke/breakfast", maxPages: 50 },
  { categoryUrl: "https://quickmart.co.ke/beverages", maxPages: 50 },
  { categoryUrl: "https://quickmart.co.ke/juices-carbonates", maxPages: 80 },
  { categoryUrl: "https://quickmart.co.ke/water", maxPages: 50 },
  { categoryUrl: "https://quickmart.co.ke/seasoning-condiments", maxPages: 50 },
  { categoryUrl: "https://quickmart.co.ke/pasta-noodles", maxPages: 50 },
  { categoryUrl: "https://quickmart.co.ke/diapers-wipes", maxPages: 50 },
  { categoryUrl: "https://quickmart.co.ke/oral-care-products", maxPages: 50 },
  { categoryUrl: "https://quickmart.co.ke/sanitary", maxPages: 50 },
  { categoryUrl: "https://quickmart.co.ke/personal-wash", maxPages: 50 },
];

async function main() {
  logger.info("═══════════════════════════════════════════════");
  logger.info("  Chekibei — Quickmart Discovery Scraper");
  logger.info("═══════════════════════════════════════════════");

  // ── Determine categories to scrape ──────────────────────────────────────────
  const categories: DiscoveryCategoryInput[] = customUrl
    ? [{ categoryUrl: customUrl, maxPages: customPages ? parseInt(customPages, 10) : 5 }]
    : DEFAULT_CATEGORIES;

  logger.info(`Categories to scrape: ${categories.length}`, {
    urls: categories.map((c) => c.categoryUrl),
  });

  // ── Check session ────────────────────────────────────────────────────────────
  const session = loadSession();

  // ── Launch browser ───────────────────────────────────────────────────────────
  const browserSession = await launchBrowser({
    headless: !headful,
    storageStatePath: session.exists ? session.path : undefined,
  });

  let results: DiscoveryRunResult[] = [];

  try {
    // ── Init session (location setup if needed) ──────────────────────────────
    const { page: sessionPage, sessionWasNew } = await initSession(browserSession.context);
    await sessionPage.close();

    logger.info(sessionWasNew ? "New session established" : "Session reused");

    // ── Run discovery pipeline ───────────────────────────────────────────────
    results = await runDiscoveryPipeline(browserSession.context, categories);
  } finally {
    await browserSession.close();
  }

  // ── Print summary ────────────────────────────────────────────────────────────
  printSummary(results);

  // ── Save results ─────────────────────────────────────────────────────────────
  await saveResults(results);
}

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

async function saveResults(results: DiscoveryRunResult[]) {
  const outputDir = path.resolve(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `discovery-${timestamp}.json`);

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  logger.info(`Results saved: ${outputPath}`);

  // Also write a flat product list for convenience
  const allProducts = results.flatMap((r) => r.products);
  const flatPath = path.join(outputDir, `products-${timestamp}.json`);
  fs.writeFileSync(flatPath, JSON.stringify(allProducts, null, 2));
  logger.info(`Flat product list saved: ${flatPath} (${allProducts.length} items)`);
}

// ── Run ───────────────────────────────────────────────────────────────────────
main().catch((err) => {
  logger.error("Fatal error in discovery CLI", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
