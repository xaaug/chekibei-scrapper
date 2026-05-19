/**
 * similarity.ts
 *
 * Scoring primitives for two-phase reconciliation matching:
 *
 *   Phase 1 — brandScore(canonical.brand, candidate.name)
 *   Phase 2 — productNameScore(canonical.productName, candidate.name)
 *
 * Final score = BRAND_WEIGHT * brandScore + NAME_WEIGHT * productNameScore
 *
 * Brand is the stronger signal so it carries more weight. Neither phase
 * is a hard reject — a brand mismatch just pulls the combined score down.
 */

// ─── Weights ──────────────────────────────────────────────────────────────────

export const BRAND_WEIGHT = 0.6;
export const NAME_WEIGHT = 0.4;

// ─── 1. Unit normalisation ────────────────────────────────────────────────────

/**
 * Collapse quantity+unit pairs to a canonical form so mismatched casing
 * or unit abbreviations don't penalise otherwise identical products.
 *
 *   "2KG" → "2kg"   |  "2000g"  → "2kg"
 *   "1l"  → "1000ml"|  "500ML"  → "500ml"
 *   "250gm" → "250g"
 */
function normaliseUnit(token: string): string {
  const m = token.match(
    /^(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|gram|grams|l|ltr|litre|litres|liter|liters|ml|millilitre|milliliter)s?$/i,
  );
  if (!m) return token;

  const value = parseFloat(m[1]);
  const unit = m[2].toLowerCase();

  if (unit === "kg") return `${value}kg`;
  if (["g", "gm", "gms", "gram", "grams"].includes(unit))
    return value >= 1000 ? `${value / 1000}kg` : `${value}g`;
  if (["l", "ltr", "litre", "litres", "liter", "liters"].includes(unit))
    return `${Math.round(value * 1000)}ml`;
  if (["ml", "millilitre", "milliliter"].includes(unit)) return `${value}ml`;

  return token;
}

// ─── 2. Synonym groups ────────────────────────────────────────────────────────

/**
 * Words in the same group are collapsed to the first member before scoring,
 * so "maize meal" and "maize flour" share the token "flour" after expansion.
 *
 * Add entries here as you encounter new mismatches in Kenyan supermarket data.
 */
const SYNONYM_GROUPS: readonly string[][] = [
  ["flour", "meal", "unga"],
  ["yoghurt", "yogurt", "yoghourt"],
  ["milk", "maziwa"],
  ["bread", "mkate"],
  ["wheat", "ngano"],
  ["chicken", "kuku"],
  ["beef", "nyama"],
  ["fish", "samaki"],
  ["sachet", "packet", "pack", "pouch"],
  ["bottle", "btl"],
  ["tin", "can", "canned"],
  ["bar", "block", "slab"],
  ["original", "orig"],
  ["natural", "nat"],
  ["fortified", "fort"],
  ["large", "big", "jumbo", "xl"],
  ["small", "mini", "sm"],
  ["medium", "med"],
  ["family", "bulk", "value"],
];

const SYNONYM_MAP = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const canonical = group[0];
  for (const word of group) SYNONYM_MAP.set(word, canonical);
}

function applySynonyms(token: string): string {
  return SYNONYM_MAP.get(token) ?? token;
}

// ─── 3. Tokenisation ──────────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s.]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map(normaliseUnit)
      .map(applySynonyms),
  );
}

// ─── 4. Jaccard on token sets ─────────────────────────────────────────────────

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  const intersection = [...a].filter((t) => b.has(t));
  const union = new Set([...a, ...b]);
  return intersection.length / union.size;
}

// ─── 5. Brand scoring ─────────────────────────────────────────────────────────

/**
 * Score how well `canonicalBrand` appears in `candidateRawName`.
 *
 * Strategy: tokenize the brand, then check what fraction of its tokens
 * appear in the candidate name. This handles:
 *   - "Famila" found inside "Famila Ujimix Sour 1Kg"          → 1.0
 *   - "Famila" found inside "FAMILA FOODS Ujimix Sour 1Kg"    → 1.0 (case normalised)
 *   - "Famila" not found in "Pembe Maize Flour 2Kg"           → 0.0
 *   - "Famila Foods" partially found in "Famila Ujimix 1Kg"   → 0.5 (1 of 2 brand tokens)
 *
 * Returns a value in [0, 1].
 * A score of 0 won't hard-reject — it just drags the combined score down.
 */
export function brandScore(canonicalBrand: string, candidateRawName: string): number {
  const brandTokens = tokenize(canonicalBrand);
  const nameTokens = tokenize(candidateRawName);

  if (brandTokens.size === 0) return 0;

  const matched = [...brandTokens].filter((t) => nameTokens.has(t));
  return matched.length / brandTokens.size;
}

// ─── 6. Product name scoring ──────────────────────────────────────────────────

/**
 * Score how similar `canonicalProductName` is to `candidateRawName`,
 * after stripping the brand tokens from both sides first.
 *
 * Why strip the brand? Because brand is already scored separately.
 * Leaving it in would double-count it and make brand matches look better
 * than they are at the product-name phase.
 *
 * "Ujimix Sour" vs "Ujimix Sour 1Kg"
 *   → high match (size token is in candidate but not canonical — small union penalty)
 *
 * "Ujimix Sour" vs "Ujimix Sweet 1Kg"
 *   → partial match ("ujimix" shared, "sour"/"sweet" differ)
 */
export function productNameScore(
  canonicalProductName: string,
  canonicalBrand: string,
  candidateRawName: string,
): number {
  const brandTokens = tokenize(canonicalBrand);

  // Strip brand tokens from both sides before comparing
  const strip = (tokens: Set<string>) =>
    new Set([...tokens].filter((t) => !brandTokens.has(t)));

  const nameTokens = strip(tokenize(canonicalProductName));
  const candidateTokens = strip(tokenize(candidateRawName));

  return jaccard(nameTokens, candidateTokens);
}

// ─── 7. Combined score (the one reconciliationEngine uses) ────────────────────

export interface ScoreBreakdown {
  /** Weighted final score in [0, 1] */
  combined: number;
  /** How well the brand appears in the candidate name */
  brand: number;
  /** Jaccard on product name tokens (brand-stripped) */
  name: number;
}

/**
 * Full two-phase score for a canonical product against a raw candidate name.
 *
 * @param canonicalBrand       e.g. "Famila"
 * @param canonicalProductName e.g. "Ujimix Sour"
 * @param candidateRawName     e.g. "Famila Ujimix Sour 1Kg"
 */
export function scoreCandidate(
  canonicalBrand: string,
  canonicalProductName: string,
  candidateRawName: string,
): ScoreBreakdown {
  const brand = brandScore(canonicalBrand, candidateRawName);
  const name = productNameScore(canonicalProductName, canonicalBrand, candidateRawName);
  const combined = BRAND_WEIGHT * brand + NAME_WEIGHT * name;

  return { combined, brand, name };
}