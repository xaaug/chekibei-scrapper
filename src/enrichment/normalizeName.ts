/**
 * Produces a clean productName from rawName by removing:
 * - The brand prefix (if known)
 * - The size suffix/infix
 *
 * IMPORTANT: rawName is NEVER modified. This function only produces
 * a derived value used in CanonicalProduct.productName.
 */

import { parseBrand } from "./parseBrand";
import { parseSize } from "./parseSize";

/**
 * Strips brand + size from rawName to yield a clean product name.
 *
 * E.g. "Blue Band Porridge 250G" → "Porridge"
 *      "Kimbo Cooking Fat 500G"  → "Cooking Fat"
 *      "Pembe Maize Flour 2KG"   → "Maize Flour"
 *      "Fresh Milk 1L"           → "Fresh Milk"   (no known brand)
 */
export function normalizeName(rawName: string, brand?: string, sizeRaw?: string): string {
  let name = rawName.trim();

  // Remove brand prefix (case-insensitive)
  if (brand) {
    const brandRegex = new RegExp(`^${escapeRegex(brand)}\\s*`, "i");
    name = name.replace(brandRegex, "");
  }

  // Remove size token (e.g. "250G", "500 G", "2KG")
  if (sizeRaw) {
    const sizeRegex = new RegExp(`\\s*${escapeRegex(sizeRaw)}\\s*`, "i");
    name = name.replace(sizeRegex, " ");
  }

  return name.trim().replace(/\s+/g, " "); // collapse extra spaces
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}