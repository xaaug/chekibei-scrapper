/**
 * CLI: npm run track-prices
 *
 * Reads canonical-reconciled products from Convex (not local file).
 * Visits each product page per supermarket.
 * Extracts real price + image + offer/OOS state.
 * Upserts price snapshots to Convex, appends history on change.
 *
 * Usage:
 *   npm run track-prices
 *   npm run track-prices -- --headful
 *   npm run track-prices -- --supermarkets quickmart,naivas
 */

require("dotenv").config();

import path from "path";
import fs from "fs";
import { CanonicalProduct } from "../types/canonical";
import { SupermarketId } from "../supermarkets/base/types";
import { scrapeProductPage } from "../scrapers/productPageScraper";
import { updatePriceSnapshot } from "../pricing/updatePriceSnapshot";
import { normalizeScrapedProduct } from "../pricing/normalizeScrapedProduct";
import {
  getAllCanonicalProducts,
  getSnapshot,
  upsertSnapshot,
} from "../db/convexClient";
import { launchBrowser } from "../core/browser/browser";
import { logger } from "../core/logger/logger";
import { PriceSnapshot, PriceHistoryEntry } from "../types/pricing";

// ── Args ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const headful = args.includes("--headful");

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const supersArg = getArg("--supermarkets");

const TARGET_SUPERMARKETS: SupermarketId[] = supersArg
  ? (supersArg.split(",").map((s) => s.trim()) as SupermarketId[])
  : ["quickmart", "carrefour", "naivas"];

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  logger.info("═══════════════════════════════════════════════");
  logger.info("  Chekibei — Live Price Tracker");
  logger.info("═══════════════════════════════════════════════");
  logger.info(`Convex URL: ${process.env.CONVEX_HTTP_URL ?? "not set"}`);
  logger.info(`Target supermarkets: ${TARGET_SUPERMARKETS.join(", ")}`);

  // ── Pull canonical products from Convex ────────────────────────────────────
  let products: CanonicalProduct[];
  try {
    products = await getAllCanonicalProducts();
    logger.info(`Loaded ${products.length} products from Convex`);
  } catch (e) {
    logger.error(`Failed to fetch canonical products from Convex: ${e}`);
    process.exit(1);
  }

  const browser = await launchBrowser({ headless: !headful, blockImages: false });

  const stats = {
    total: 0,
    success: 0,
    outOfStock: 0,
    onOffer: 0,
    noPrice: 0,
    errors: 0,
    priceChanges: 0,
    newSnapshots: 0,
  };

  // Collect snapshots + history locally so we can write a backup JSON at the end
  const localSnapshots: PriceSnapshot[] = [];
  const localHistory: PriceHistoryEntry[] = [];

  try {
    for (const canonical of products) {
      const mappings = Object.entries(canonical.supermarkets).filter(
        ([s]) => TARGET_SUPERMARKETS.includes(s as SupermarketId),
      ) as [SupermarketId, { externalId: string; url: string }][];

      if (mappings.length === 0) continue;

      logger.info(`\n▶ ${canonical.displayName} (${canonical.productKey})`);

      for (const [supermarket, mapping] of mappings) {
        stats.total++;
        const page = await browser.context.newPage();

        try {
          const live = await scrapeProductPage(
            page,
            supermarket,
            mapping.externalId,
            mapping.url,
          );

          // ── Failed entirely ──────────────────────────────────────────────
          if (!live) {
            logger.warn(`  ✗ ${supermarket}: scrape returned null`);
            stats.errors++;
            continue;
          }

          // ── Out of stock ─────────────────────────────────────────────────
          if (live.isOutOfStock) {
            logger.info(`  ⊘ ${supermarket}: OUT OF STOCK`);
            stats.outOfStock++;
            continue; // skip snapshot upsert until OOS fields are typed
          }

          // ── No price found ───────────────────────────────────────────────
          if (live.currentPrice === null) {
            logger.warn(`  ✗ ${supermarket}: no price extracted`);
            stats.noPrice++;
            continue;
          }

          // ── Log what we found ─────────────────────────────────────────────
          if ( live.originalPrice) {
            logger.info(
              `  ✓ ${supermarket}: KES ${live.currentPrice} (was KES ${live.originalPrice}) ON OFFER` +
                (live.imageUrl ? " + image" : ""),
            );
            stats.onOffer++;
          } else {
            logger.info(
              `  ✓ ${supermarket}: KES ${live.currentPrice}` +
                (live.imageUrl ? " + image" : " [no image]"),
            );
          }

          // ── Normalize ────────────────────────────────────────────────────
          const scraped = normalizeScrapedProduct({
            supermarket,
            externalId: mapping.externalId,
            url: mapping.url,
            name: live.name || canonical.displayName,
            currentPrice: live.currentPrice,
            originalPrice: live.originalPrice ?? undefined,
            isOutOfStock: false,
            imageUrl: live.imageUrl,
            scrapedAt: live.scrapedAt,
          });

          // ── Load existing snapshot from Convex + update ───────────────────
          const existing = await getSnapshot(canonical.productKey, supermarket);
          const { snapshot, historyEntry, wasNew } = updatePriceSnapshot(
            canonical, scraped, existing,
          );

          // Push to Convex
          await upsertSnapshot(snapshot);
          localSnapshots.push(snapshot);

        //   if (historyEntry) {
        //     await appendHistory(historyEntry);
        //     localHistory.push(historyEntry);
        //     wasNew ? stats.newSnapshots++ : stats.priceChanges++;
        //   }

          stats.success++;
        } catch (err) {
          logger.error(
            `  ✗ ${supermarket}: ${err instanceof Error ? err.message : err}`,
          );
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
  await saveOutput(localSnapshots, localHistory);
}

// ── Summary ────────────────────────────────────────────────────────────────────
function printSummary(stats: Record<string, number>) {
  logger.info("\n═══════════════════════════════════════════════");
  logger.info("  PRICE TRACKING COMPLETE");
  logger.info("═══════════════════════════════════════════════");
  logger.info(`  Total processed: ${stats.total}`);
  logger.info(`  Successful:      ${stats.success}`);
  logger.info(`  On offer:        ${stats.onOffer}`);
  logger.info(`  Out of stock:    ${stats.outOfStock}`);
  logger.info(`  No price:        ${stats.noPrice}`);
  logger.info(`  New snapshots:   ${stats.newSnapshots}`);
  logger.info(`  Price changes:   ${stats.priceChanges}`);
  logger.info(`  Errors:          ${stats.errors}`);
}

// ── Save ───────────────────────────────────────────────────────────────────────
async function saveOutput(
  snapshots: PriceSnapshot[],
  history: PriceHistoryEntry[],
): Promise<void> {
  const outputDir = path.resolve(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const snapshotsPath = path.join(outputDir, `price-snapshots-${timestamp}.json`);
  const historyPath   = path.join(outputDir, `price-history-${timestamp}.json`);

  fs.writeFileSync(snapshotsPath, JSON.stringify(snapshots, null, 2));
  fs.writeFileSync(historyPath,   JSON.stringify(history,   null, 2));

  logger.info(`\nSnapshots → ${snapshotsPath} (${snapshots.length} records)`);
  logger.info(`History   → ${historyPath}   (${history.length} entries)`);
  logger.info("(Data already pushed to Convex during run)");
}

// ── Run ────────────────────────────────────────────────────────────────────────
main().catch((err) => {
  logger.error("Fatal error in price tracker", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});