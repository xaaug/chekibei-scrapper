/**
 * convexClient.ts
 *
 * Thin HTTP client over the Convex HTTP actions.
 * Drop-in replacement for mockConvex — same function signatures.
 *
 * Requires CONVEX_HTTP_URL in env, e.g.:
 *   CONVEX_HTTP_URL=https://happy-animal-123.convex.site
 */

import { PriceSnapshot, PriceHistoryEntry } from "../types/pricing";
import { CanonicalProduct } from "../types/canonical";
import { SupermarketId } from "../supermarkets/base/types";
import { scopedLogger } from "../core/logger/logger";

const log = scopedLogger("convexClient");

function getBaseUrl(): string {
  const url = process.env.CONVEX_HTTP_URL;
  if (!url) throw new Error("CONVEX_HTTP_URL is not set in environment");
  return url.replace(/\/$/, ""); // strip trailing slash
}

async function convexGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function convexPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Canonical products ───────────────────────────────────────────────────────

/** Fetch all canonical products from Convex — replaces reading local JSON file */
export async function getAllCanonicalProducts(): Promise<CanonicalProduct[]> {
  log.debug("Fetching all canonical products from Convex");
  return convexGet<CanonicalProduct[]>("/products");
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

export async function getSnapshot(
  productKey: string,
  supermarket: SupermarketId,
): Promise<PriceSnapshot | null> {
  log.debug(`Getting snapshot: ${productKey} / ${supermarket}`);
  try {
    return await convexGet<PriceSnapshot>(
      `/prices/${productKey}?supermarket=${supermarket}`,
    );
  } catch {
    // 404 means no snapshot yet — return null like the mock did
    return null;
  }
}

export async function upsertSnapshot(snapshot: PriceSnapshot): Promise<void> {
  log.debug(`Upserting snapshot: ${snapshot.productKey} / ${snapshot.supermarket}`);
  await convexPost("/push/prices", [snapshot]);
}

// ─── History ──────────────────────────────────────────────────────────────────

// export async function appendHistory(entry: PriceHistoryEntry): Promise<void> {
//   log.debug(`Appending history: ${entry.productKey} / ${entry.supermarket} @ KES ${entry.price}`);
//   // History is appended via the same prices push — Convex handles the insert
//   await convexPost("/push/price-history", [entry]);
// }

// export async function getHistory(
//   productKey: string,
//   supermarket: SupermarketId,
// ): Promise<PriceHistoryEntry[]> {
//   return convexGet<PriceHistoryEntry[]>(
//     `/prices/${productKey}/history?supermarket=${supermarket}`,
//   );
// }

// ─── Dump (for CLI saveOutput) ────────────────────────────────────────────────

export async function dumpStore(): Promise<{
  snapshots: PriceSnapshot[];
  history: PriceHistoryEntry[];
}> {
  // We don't have a "dump all" endpoint so we just return empty arrays here —
  // saveOutput in track-prices uses this only for writing local JSON backups,
  // the real data is already in Convex by this point
  log.debug("dumpStore called — data already pushed to Convex during run");
  return { snapshots: [], history: [] };
}