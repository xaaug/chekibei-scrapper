import { PriceSnapshot, PriceHistoryEntry } from "../types/pricing";
import { ScrapedSupermarketData } from "../types/pricing";
import { CanonicalProduct } from "../types/canonical";
import { reconcilePrice } from "./reconcilePrice";
import { detectPriceChange } from "./detectPriceChange";
import { scopedLogger } from "../core/logger/logger";

const log = scopedLogger("updatePriceSnapshot");

export interface SnapshotUpdateResult {
  snapshot: PriceSnapshot;
  historyEntry: PriceHistoryEntry | null;  // null = price did not change
  wasNew: boolean;
}

/**
 * Core update function.
 *
 * - Upserts the latest PriceSnapshot (always)
 * - Appends a PriceHistoryEntry ONLY when price changed
 *
 * Caller is responsible for persistence (see db/mockConvex.ts).
 */
export function updatePriceSnapshot(
  canonical: CanonicalProduct,
  scraped: ScrapedSupermarketData,
  existing: PriceSnapshot | null,
): SnapshotUpdateResult {
  const snapshot = reconcilePrice(canonical, scraped, existing);
  const wasNew = existing === null;

  let historyEntry: PriceHistoryEntry | null = null;

  if (wasNew) {
    // First time seeing this product — record initial price in history
    historyEntry = {
      productKey: canonical.productKey,
      supermarket: scraped.supermarket,
      price: scraped.currentPrice,
      timestamp: scraped.scrapedAt,
    };

    log.info(`New snapshot: ${canonical.productKey} / ${scraped.supermarket} @ KES ${scraped.currentPrice}`);
  } else {
    const { changed, delta, percentChange } = detectPriceChange(
      existing!.currentPrice,
      scraped.currentPrice,
    );

    if (changed) {
      historyEntry = {
        productKey: canonical.productKey,
        supermarket: scraped.supermarket,
        price: scraped.currentPrice,
        timestamp: scraped.scrapedAt,
      };

      log.info(
        `Price change: ${canonical.productKey} / ${scraped.supermarket} ` +
          `KES ${existing!.currentPrice} → ${scraped.currentPrice} ` +
          `(${delta > 0 ? "+" : ""}${delta}, ${percentChange}%)`,
      );
    }
  }

  return { snapshot, historyEntry, wasNew };
}