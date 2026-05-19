/**
 * Generates a deterministic, stable internal product key.
 *
 * Format: ckb_prod_<8-char hex>
 *
 * Key properties:
 * - Deterministic: same inputs always yield the same key
 * - Stable: NOT derived from externalId (survives supermarket site changes)
 * - Collision-resistant: uses FNV-1a 32-bit over normalized inputs
 * - Human-readable prefix: ckb_prod_ for easy identification in logs/DBs
 *
 * Input: normalized (productName + brand + size + category), all lowercased
 * and stripped of punctuation before hashing.
 */

export interface ProductKeyInput {
  productName: string;
  brand?: string;
  size?: string;
  category: string;
}

/**
 * FNV-1a 32-bit hash — fast, minimal, no dependencies.
 * Deterministic across runs and environments.
 */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
    hash >>>= 0; // keep unsigned 32-bit
  }
  return hash;
}

function normalizeForHash(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") // strip spaces, punctuation, units
    .trim();
}

export function generateProductKey(input: ProductKeyInput): string {
  const parts = [
    normalizeForHash(input.productName),
    normalizeForHash(input.brand ?? ""),
    normalizeForHash(input.size ?? ""),
    normalizeForHash(input.category),
  ];

  const seed = parts.join("|");
  const hash = fnv1a32(seed);
  const hex = hash.toString(16).padStart(8, "0");

  return `ckb_prod_${hex}`;
}