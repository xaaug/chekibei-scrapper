/**
 * Transforms a raw DiscoveredProduct into a CanonicalProduct.
 *
 * This is the single entry point for the enrichment pipeline.
 * It composes parseBrand → parseSize → normalizeName → generateProductKey.
 *
 * Contract:
 * - rawName is ALWAYS preserved verbatim
 * - enrichment never mutates discovery output
 * - all derived fields are computed fresh each time
 */

import { DiscoveredProduct } from "../types/discovery";
import { CanonicalProduct, SupermarketSource } from "../types/canonical";
import { parseBrand } from "./parseBrand";
import { parseSize } from "./parseSize";
import { normalizeName } from "./normalizeName";
import { generateProductKey } from "./generateProductKey";

export function buildCanonicalProduct(raw: DiscoveredProduct): CanonicalProduct {
  const rawName = raw.name;

  // ── Stage 1: Extract structured fields ──────────────────────────────────────
  const brand = parseBrand(rawName);
  const sizeResult = parseSize(rawName);
  const size = sizeResult?.normalized;

  // ── Stage 2: Derive clean product name ──────────────────────────────────────
  const productName = normalizeName(rawName, brand, sizeResult?.raw);

  // ── Stage 3: Build display name (Brand + ProductName + Size) ────────────────
  const displayParts = [brand, productName, size].filter(Boolean);
  const displayName = displayParts.join(" ");

  // ── Stage 4: Generate stable internal key ───────────────────────────────────
  const productKey = generateProductKey({
    productName,
    brand,
    size,
    category: raw.category,
  });

  // ── Stage 5: Build supermarket mapping ──────────────────────────────────────
  const supermarkets: CanonicalProduct["supermarkets"] = {};

  if (raw.source === "quickmart" && raw.productId) {
    supermarkets.quickmart = {
      externalId: raw.productId,
      url: raw.url,
    };
  } else if (raw.source === "quickmart") {
    // No externalId — still record the URL mapping
    supermarkets.quickmart = {
      externalId: "",
      url: raw.url,
    };
  }

  const now = new Date().toISOString();

  return {
    productKey,
    brand,
    productName,
    size,
    category: raw.category,
    rawName,
    displayName,
    supermarkets,
    firstSeenAt: now,
  };
}

/**
 * Transforms an array of raw discovered products.
 * Deduplicates by productKey — if two raw items resolve to the same
 * canonical product, merges their supermarket mappings.
 */
export function buildCanonicalProducts(
  rawProducts: DiscoveredProduct[],
): CanonicalProduct[] {
  const byKey = new Map<string, CanonicalProduct>();

  for (const raw of rawProducts) {
    const canonical = buildCanonicalProduct(raw);

    const existing = byKey.get(canonical.productKey);
    if (existing) {
      // Merge supermarket mappings — don't overwrite, extend
      for (const [source, mapping] of Object.entries(canonical.supermarkets)) {
        const src = source as SupermarketSource;
        if (!existing.supermarkets[src]) {
          existing.supermarkets[src] = mapping;
        }
      }
    } else {
      byKey.set(canonical.productKey, canonical);
    }
  }

  return Array.from(byKey.values());
}