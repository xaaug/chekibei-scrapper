import { PriceSnapshot, PriceHistoryEntry } from "../types/pricing";
import { SupermarketId } from "../supermarkets/base/types";
import { scopedLogger } from "../core/logger/logger";

const log = scopedLogger("mockConvex");

/**
 * Mock Convex DB layer.
 *
 * In-memory store for local runs — swap each function body for
 * real Convex mutations/queries when ready.
 *
 * Table design (Convex):
 *   priceSnapshots  — one document per (productKey + supermarket)
 *   priceHistory    — append-only, one document per price change event
 */

// ── In-memory store ────────────────────────────────────────────────────────────
const snapshotStore = new Map<string, PriceSnapshot>();
const historyStore: PriceHistoryEntry[] = [];

function snapshotKey(productKey: string, supermarket: SupermarketId): string {
  return `${productKey}::${supermarket}`;
}

// ── Snapshots ──────────────────────────────────────────────────────────────────

export async function getSnapshot(
  productKey: string,
  supermarket: SupermarketId,
): Promise<PriceSnapshot | null> {
  // await ctx.db
  //   .query("priceSnapshots")
  //   .withIndex("by_product_supermarket", q =>
  //     q.eq("productKey", productKey).eq("supermarket", supermarket)
  //   )
  //   .unique()

  return snapshotStore.get(snapshotKey(productKey, supermarket)) ?? null;
}

export async function upsertSnapshot(snapshot: PriceSnapshot): Promise<void> {
  // const existing = await ctx.db
  //   .query("priceSnapshots")
  //   .withIndex("by_product_supermarket", q =>
  //     q.eq("productKey", snapshot.productKey).eq("supermarket", snapshot.supermarket)
  //   )
  //   .unique()
  //
  // if (existing) {
  //   await ctx.db.patch(existing._id, snapshot)
  // } else {
  //   await ctx.db.insert("priceSnapshots", snapshot)
  // }

  snapshotStore.set(snapshotKey(snapshot.productKey, snapshot.supermarket), snapshot);
  log.debug(`Upserted snapshot: ${snapshot.productKey} / ${snapshot.supermarket}`);
}

// ── History ────────────────────────────────────────────────────────────────────

export async function appendHistory(entry: PriceHistoryEntry): Promise<void> {
  // await ctx.db.insert("priceHistory", entry)

  historyStore.push(entry);
  log.debug(`History appended: ${entry.productKey} / ${entry.supermarket} @ KES ${entry.price}`);
}

export async function getHistory(
  productKey: string,
  supermarket: SupermarketId,
): Promise<PriceHistoryEntry[]> {
  // await ctx.db
  //   .query("priceHistory")
  //   .withIndex("by_product_supermarket", q =>
  //     q.eq("productKey", productKey).eq("supermarket", supermarket)
  //   )
  //   .order("desc")
  //   .collect()

  return historyStore.filter(
    (e) => e.productKey === productKey && e.supermarket === supermarket,
  );
}

// ── Dump (for CLI output) ──────────────────────────────────────────────────────
export function dumpStore(): { snapshots: PriceSnapshot[]; history: PriceHistoryEntry[] } {
  return {
    snapshots: Array.from(snapshotStore.values()),
    history: [...historyStore],
  };
}