/**
 * CLI: npm run track-prices
 *
 * Reads latest canonical-reconciled JSON.
 * Visits each product page per supermarket.
 * Extracts real price + image + offer/OOS state.
 * Upserts price snapshots, appends history on change.
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

// ── Resolve input ──────────────────────────────────────────────────────────────
function resolveInput(): string {
  if (inputArg) return path.resolve(inputArg);

  const outputDir = path.resolve(process.cwd(), "output");
  const files = fs
    .readdirSync(outputDir)
    .filter((f) => f.startsWith("canonical-reconciled-") && f.endsWith(".json"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(outputDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    throw new Error("No canonical-reconciled JSON found. Run `npm run reconcile` first.");
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

  // blockImages: false — we need images to load for extraction
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

            // Still upsert the snapshot so we track OOS state
            // currentPrice = null when OOS
            const scraped = normalizeScrapedProduct({
              supermarket,
              externalId: mapping.externalId,
              url: mapping.url,
              name: live.name || canonical.displayName,
              currentPrice: null as any,  // OOS — no active price
              originalPrice: null,
              isOnOffer: false,
              isOutOfStock: true,
              imageUrl: live.imageUrl,    // still capture image even if OOS
              scrapedAt: live.scrapedAt,
            });

            const existing = await getSnapshot(canonical.productKey, supermarket);
            const { snapshot, historyEntry, wasNew } = updatePriceSnapshot(
              canonical, scraped, existing,
            );

            await upsertSnapshot({ ...snapshot, currentPrice: null as any });
            if (historyEntry) await appendHistory(historyEntry);
            continue;
          }

          // ── No price found ───────────────────────────────────────────────
          if (live.currentPrice === null) {
            logger.warn(`  ✗ ${supermarket}: no price extracted`);
            stats.noPrice++;
            continue;
          }

          // ── Log what we found ─────────────────────────────────────────────
          if (live.isOnOffer && live.originalPrice) {
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
            isOnOffer: live.isOnOffer,
            isOutOfStock: false,
            imageUrl: live.imageUrl,
            scrapedAt: live.scrapedAt,
          });

          // ── Load existing + update ────────────────────────────────────────
          const existing = await getSnapshot(canonical.productKey, supermarket);
          const { snapshot, historyEntry, wasNew } = updatePriceSnapshot(
            canonical, scraped, existing,
          );

          await upsertSnapshot(snapshot);

          if (historyEntry) {
            await appendHistory(historyEntry);
            wasNew ? stats.newSnapshots++ : stats.priceChanges++;
          }

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
  await saveOutput();
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
  logger.info(`History   → ${historyPath}   (${history.length} entries)`);
}

// ── Run ────────────────────────────────────────────────────────────────────────
main().catch((err) => {
  logger.error("Fatal error in price tracker", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});