/**
 * CLI: npm run track-prices
 *
 * Reads the latest canonical-reconciled JSON.
 * For each product × supermarket mapping, visits the product page,
 * extracts real price + image, writes price-snapshots JSON.
 *
 * Usage:
 *   npm run track-prices
 *   npm run track-prices -- --input output/canonical-reconciled-xxx.json
 *   npm run track-prices -- --headful
 *   npm run track-prices -- --supermarkets quickmart,naivas
 */

import path from "path";
import fs from "fs";
import { CanonicalProduct } from "../types/canonical";
import { SupermarketId } from "../supermarkets/base/types";
import { PriceSnapshot, PriceHistoryEntry } from "../types/pricing";
import { scrapeProductPage } from "../scrapers/productPageScraper";
import { updatePriceSnapshot } from "../pricing/updatePriceSnapshot";
import { normalizeScrapedProduct } from "../pricing/normalizeScrapedProduct";
import { getSnapshot, upsertSnapshot, appendHistory, dumpStore } from "../db/mockConvex";
import { launchBrowser } from "../core/browser/browser";
import { logger } from "../core/logger/logger";

// ── Args ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const headful = args.includes("--headful");

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const inputArg = getArg("--input");
const supersArg = getArg("--supermarkets");

const TARGET_SUPERMARKETS: SupermarketId[] = supersArg
  ? (supersArg.split(",").map((s) => s.trim()) as SupermarketId[])
  : ["quickmart", "carrefour", "naivas"];

// ── Resolve latest reconciled canonical file ───────────────────────────────────
function resolveInput(): string {
  if (inputArg) return path.resolve(inputArg);

  const outputDir = path.resolve(process.cwd(), "output");
  const files = fs
    .readdirSync(outputDir)
    .filter((f) => f.startsWith("canonical-reconciled-") && f.endsWith(".json"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(outputDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    throw new Error("No canonical-reconciled JSON found in output/. Run `npm run reconcile` first.");
  }

  logger.info(`Auto-selected: ${files[0].name}`);
  return path.join(outputDir, files[0].name);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  logger.info("═══════════════════════════════════════════════");
  logger.info("  Chekibei — Live Price Tracker");
  logger.info("═══════════════════════════════════════════════");

  const inputFile = resolveInput();
  const products: CanonicalProduct[] = JSON.parse(fs.readFileSync(inputFile, "utf-8"));

  logger.info(`Products: ${products.length} | Supermarkets: ${TARGET_SUPERMARKETS.join(", ")}`);

  // Images blocked for discovery/reconciliation — but we need them here
  const browser = await launchBrowser({
    headless: !headful,
    blockImages: false,
  });

  const stats = { total: 0, success: 0, noPrice: 0, errors: 0, priceChanges: 0 };

  try {
    for (const canonical of products) {
      // Only process supermarkets this product is mapped to AND we're targeting
      const mappings = Object.entries(canonical.supermarkets).filter(
        ([s]) => TARGET_SUPERMARKETS.includes(s as SupermarketId),
      ) as [SupermarketId, { externalId: string; url: string }][];

      if (mappings.length === 0) continue;

      logger.info(`\n▶ ${canonical.displayName} (${canonical.productKey})`);

      for (const [supermarket, mapping] of mappings) {
        stats.total++;
        const page = await browser.context.newPage();

        try {
          // ── Live scrape ──────────────────────────────────────────────────
          const live = await scrapeProductPage(
            page,
            supermarket,
            mapping.externalId,
            mapping.url,
          );

          if (!live || live.currentPrice === null) {
            logger.warn(`  ✗ ${supermarket}: no price`);
            stats.noPrice++;
            continue;
          }

          logger.info(
            `  ✓ ${supermarket}: KES ${live.currentPrice}` +
              (live.originalPrice ? ` (was KES ${live.originalPrice})` : "") +
              (live.imageUrl ? " + image" : " [no image]"),
          );

          // ── Normalize ────────────────────────────────────────────────────
          const scraped = normalizeScrapedProduct({
            supermarket,
            externalId: mapping.externalId,
            url: mapping.url,
            name: live.name || canonical.displayName,
            currentPrice: live.currentPrice,
            originalPrice: live.originalPrice ?? undefined,
            imageUrl: live.imageUrl,
            scrapedAt: live.scrapedAt,
          });

          // ── Load existing snapshot ───────────────────────────────────────
          const existing = await getSnapshot(canonical.productKey, supermarket);

          // ── Compute update ───────────────────────────────────────────────
          const { snapshot, historyEntry, wasNew } = updatePriceSnapshot(
            canonical,
            scraped,
            existing,
          );

          // ── Persist ──────────────────────────────────────────────────────
          await upsertSnapshot(snapshot);

          if (historyEntry) {
            await appendHistory(historyEntry);
            if (!wasNew) stats.priceChanges++;
          }

          stats.success++;
        } catch (err) {
          logger.error(`  ✗ ${supermarket}: ${err instanceof Error ? err.message : err}`);
          stats.errors++;
        } finally {
          await page.close().catch(() => {});
        }
      }
    }
  } finally {
    await browser.close();
  }

  printSummary(stats);
  await saveOutput();
}

// ── Summary ────────────────────────────────────────────────────────────────────
function printSummary(stats: {
  total: number; success: number; noPrice: number; errors: number; priceChanges: number;
}) {
  logger.info("\n═══════════════════════════════════════════════");
  logger.info("  PRICE TRACKING COMPLETE");
  logger.info("═══════════════════════════════════════════════");
  logger.info(`  Total scraped:  ${stats.total}`);
  logger.info(`  Successful:     ${stats.success}`);
  logger.info(`  No price found: ${stats.noPrice}`);
  logger.info(`  Errors:         ${stats.errors}`);
  logger.info(`  Price changes:  ${stats.priceChanges}`);
}

// ── Save ───────────────────────────────────────────────────────────────────────
async function saveOutput() {
  const outputDir = path.resolve(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const { snapshots, history } = dumpStore();

  const snapshotsPath = path.join(outputDir, `price-snapshots-${timestamp}.json`);
  const historyPath   = path.join(outputDir, `price-history-${timestamp}.json`);

  fs.writeFileSync(snapshotsPath, JSON.stringify(snapshots, null, 2));
  fs.writeFileSync(historyPath,   JSON.stringify(history,   null, 2));

  logger.info(`\nSnapshots → ${snapshotsPath} (${snapshots.length} records)`);
  logger.info(`History   → ${historyPath} (${history.length} entries)`);
}

// ── Run ────────────────────────────────────────────────────────────────────────
main().catch((err) => {
  logger.error("Fatal error in price tracker", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});