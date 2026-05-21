/**
 * Extracts brand from a raw product name by checking against a known-brands
 * list first, then falling back to the first token.
 *
 * "Blue Band Porridge 250G" → "Blue Band"  (known multi-word match)
 * "Santamaria Juice 1L"     → "Santa Maria" (synonym resolved to canonical)
 * "Unknown Thing 500ml"     → "Unknown"    (first-token fallback)
 *
 * Synonym groups: first item is canonical, rest are aliases.
 * All aliases resolve to the canonical form.
 */

const BRAND_SYNONYMS: string[][] = [
  ["Blue Band", "Blueband", "Blue-Band"],
  ["Santa Maria", "Santamaria", "Santa-Maria"],
  ["Tap & Go", "Tap and Go", "Tap&Go"],
  ["Naivas Local", "Naivas"],
  ["Quick Choice", "Quick Choice", "QuickChoice"],
  // Misspeled
  ["Brookside", "Brook Side"],
];

// Flatten into a lookup: alias (lowercased) → canonical
const BRAND_ALIAS_MAP = new Map<string, string>();
for (const group of BRAND_SYNONYMS) {
  const canonical = group[0];
  for (const alias of group) {
    BRAND_ALIAS_MAP.set(alias.toLowerCase(), canonical);
  }
}

// All known strings (canonical + aliases), sorted longest first
const SORTED_BRAND_STRINGS = [...BRAND_ALIAS_MAP.keys()].sort(
  (a, b) => b.length - a.length,
);

export function parseBrand(rawName: string): string | undefined {
  const trimmed = rawName.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();

  for (const alias of SORTED_BRAND_STRINGS) {
    if (lower.startsWith(alias)) {
      return BRAND_ALIAS_MAP.get(alias); // always returns canonical
    }
  }

  // Fallback: first token as-is
  const first = trimmed.split(/\s+/)[0];
  return first?.length > 0 ? first : undefined;
}