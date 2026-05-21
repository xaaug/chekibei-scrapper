/**
 * Extracts brand from a raw product name by checking against a known-brands
 * list first, then falling back to the first token.
 *
 * "Blue Band Porridge 250G" → "Blue Band"  (known multi-word match)
 * "Jogoo Maize Flour 2KG"   → "Jogoo"      (known single-word match)
 * "Unknown Thing 500ml"     → "Unknown"    (first-token fallback)
 */

const KNOWN_BRANDS: string[] = [
  // Multi-word — must be here, fallback only gets first token
  "Blue Band",
  "Quick Choice"
];

// Longest first so "Blue Band" matches before "Blue"
const SORTED_BRANDS = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);

export function parseBrand(rawName: string): string | undefined {
  const trimmed = rawName.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();

  for (const brand of SORTED_BRANDS) {
    if (lower.startsWith(brand.toLowerCase())) {
      return trimmed.slice(0, brand.length); // preserve original casing
    }
  }

  // Fallback: first token
  const first = trimmed.split(/\s+/)[0];
  return first?.length > 0 ? first : undefined;
}