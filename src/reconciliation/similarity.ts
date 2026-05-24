/**
 * Structured similarity scoring for product reconciliation.
 *
 * Scores brand, core product name, and size independently.
 * A size mismatch is a hard disqualifier — "250G" and "5KG" are different products.
 */

export interface SimilarityBreakdown {
  score: number;
  brandMatch: boolean;
  nameScore: number;
  sizeMatch: boolean | null;
  disqualified: boolean;
  disqualifyReason?: string;
}

// ─── Brand synonyms ───────────────────────────────────────────────────────────
//
// First item is canonical — all aliases resolve to it.
// Sorted longest-first so "Blue Band" matches before "Blue".

const BRAND_SYNONYMS: string[][] = [
  ["Blue Band", "Blueband", "Blue-Band"],
  ["Santa Maria", "Santamaria", "Santa-Maria"],
  ["Santa Lucia", "Santalucia", "Santa-Lucia"],
  ["Parle G", "Parle-G", "ParleG", "Parle Glucose", "Parle-Glucose"],
  ["Baraka Chai", "Baraka-Chai", "BarakaChai"],
  ["Tap & Go", "Tap and Go", "Tap&Go"],
  ["Naivas Local", "Naivas"],
  ["Quick Choice", "QuickChoice"],
  ["Mill Bakers", "Millbakers"],
  ["Majid Al Futtaim"],
  // Misspellings
  ["Brookside", "Brook Side"],
  ["Kenchic", "Kenchick"],
];

const BRAND_ALIAS_MAP = new Map<string, string>();
for (const group of BRAND_SYNONYMS) {
  const canonical = group[0];
  for (const alias of group) {
    BRAND_ALIAS_MAP.set(alias.toLowerCase(), canonical);
  }
}

const SORTED_BRAND_STRINGS = [...BRAND_ALIAS_MAP.keys()].sort(
  (a, b) => b.length - a.length,
);

function extractBrand(name: string): string {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  for (const alias of SORTED_BRAND_STRINGS) {
    if (lower.startsWith(alias)) {
      // Return canonical lowercased for internal comparison
      return BRAND_ALIAS_MAP.get(alias)!.toLowerCase();
    }
  }

  // Fallback: first token
  return trimmed.split(/\s+/)[0]?.toLowerCase() ?? "";
}

/** Same logic as extractBrand but returns canonical casing — used externally */
export function parseBrand(rawName: string): string | undefined {
  const trimmed = rawName.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  for (const alias of SORTED_BRAND_STRINGS) {
    if (lower.startsWith(alias)) {
      return BRAND_ALIAS_MAP.get(alias);
    }
  }

  const first = trimmed.split(/\s+/)[0];
  return first?.length > 0 ? first : undefined;
}

// ─── Synonym groups ───────────────────────────────────────────────────────────

const SYNONYM_GROUPS: readonly string[][] = [
  ["flour", "meal", "unga"],
  ["maize flour", "maize meal"],
  ["yoghurt", "yogurt", "yoghourt"],
  ["milk", "maziwa"],
  ["bread", "mkate"],
  ["wheat", "ngano", "homebaking", "home baking", "chapati flour", "all purpose flour"],
  ["extra virgin", "e/virgin"],
  ["spirali", "spirals"],
  ["olive oil", "oliveoil"],
  ["instant coffee", "instantcoffee", "instantcoffe", "instantcofee", "coffee instant", "coffeinstant "],
  ["coffe", "coffee", "cofee"],
  ["chicken", "kuku"],
  ["Astors", "Astro"],
  ["Tea Bag", "t/bag", "Tea Bags", "t/bags", "teabag", "teabags"],
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
  for (const word of group) SYNONYM_MAP.set(word.toLowerCase(), canonical);
}

const MULTI_WORD_SYNONYMS = [...SYNONYM_MAP.keys()]
  .filter((k) => k.includes(" "))
  .sort((a, b) => b.length - a.length);

function applySynonymsToText(text: string): string {
  let s = text;
  for (const phrase of MULTI_WORD_SYNONYMS) {
    if (s.includes(phrase)) s = s.replaceAll(phrase, SYNONYM_MAP.get(phrase)!);
  }
  return s;
}

function applySynonymToToken(token: string): string {
  return SYNONYM_MAP.get(token) ?? token;
}

// ─── Unit normalisation ───────────────────────────────────────────────────────

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

// ─── Tokenisation ─────────────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const synonymsApplied = applySynonymsToText(lower);
  return new Set(
    synonymsApplied
      .split(/\s+/)
      .filter(Boolean)
      .map(normaliseUnit)
      .map(applySynonymToToken),
  );
}

// ─── Size extraction ──────────────────────────────────────────────────────────

const SIZE_REGEX = /\b(\d+(?:\.\d+)?)\s*(g|kg|gm|gms|ml|l|mg|pack)\b/gi;

interface ExtractedSize {
  value: number;
  unit: string;
  normalized: string;
}

function extractSize(name: string): ExtractedSize | null {
  SIZE_REGEX.lastIndex = 0;
  const match = SIZE_REGEX.exec(name);
  if (!match) return null;

  const value = parseFloat(match[1]);
  // Normalise unit: gm/gms → g so size comparison is consistent
  const rawUnit = match[2].toLowerCase();
  const unit = (rawUnit === "gm" || rawUnit === "gms" ? "g" : rawUnit).toUpperCase();

  return {
    value,
    unit,
    normalized: `${value % 1 === 0 ? Math.floor(value) : value}${unit}`,
  };
}

function toBaseUnit(size: ExtractedSize): number {
  switch (size.unit) {
    case "KG":   return size.value * 1000;
    case "G":    return size.value;
    case "L":    return size.value * 1000;
    case "ML":   return size.value;
    case "MG":   return size.value / 1000;
    case "PACK": return size.value;
    default:     return size.value;
  }
}

function sizesMatch(a: ExtractedSize, b: ExtractedSize): boolean {
  const weightUnits = new Set(["G", "KG", "MG"]);
  const volumeUnits = new Set(["ML", "L"]);

  const aIsWeight = weightUnits.has(a.unit);
  const bIsWeight = weightUnits.has(b.unit);
  const aIsVolume = volumeUnits.has(a.unit);
  const bIsVolume = volumeUnits.has(b.unit);

  if ((aIsWeight && bIsVolume) || (aIsVolume && bIsWeight)) return false;
  if (a.unit === "PACK" !== (b.unit === "PACK")) return false;

  const aBase = toBaseUnit(a);
  const bBase = toBaseUnit(b);
  return Math.abs(aBase - bBase) / Math.max(aBase, bBase) < 0.01;
}

// ─── Core name stripping ──────────────────────────────────────────────────────

function stripBrandAndSize(name: string): string {
  let s = name.trim();
  const lower = s.toLowerCase();

  // Strip brand prefix (multi-word aware)
  for (const alias of SORTED_BRAND_STRINGS) {
    if (lower.startsWith(alias)) {
      s = s.slice(alias.length).trim();
      break;
    }
  }
  // Fallback: strip first token if no known brand matched
  if (s.toLowerCase() === name.trim().toLowerCase()) {
    s = s.replace(/^\S+\s*/, "");
  }

  // Strip size tokens
  SIZE_REGEX.lastIndex = 0;
  s = s.replace(SIZE_REGEX, " ");

  // Strip packaging words
  s = s.replace(/\b(carton|packet|pack|jar|tin|bottle|sachet|tray)\b/gi, "");

  // Apply synonyms so "meal" and "flour" share a token
  const clean = s.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  return applySynonymsToText(clean).trim().replace(/\s+/g, " ");
}

// ─── Jaccard ──────────────────────────────────────────────────────────────────

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((t) => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── Main scoring ─────────────────────────────────────────────────────────────

export function scoreSimilarity(
  canonicalName: string,
  candidateName: string,
): SimilarityBreakdown {
  const canonicalBrand = extractBrand(canonicalName);
  const candidateBrand = extractBrand(candidateName);
  const brandMatch = canonicalBrand === candidateBrand;

  if (!brandMatch) {
    return {
      score: 0,
      brandMatch: false,
      nameScore: 0,
      sizeMatch: null,
      disqualified: true,
      disqualifyReason: `brand mismatch: "${canonicalBrand}" vs "${candidateBrand}"`,
    };
  }

  const canonicalSize = extractSize(canonicalName);
  const candidateSize = extractSize(candidateName);
  let sizeMatch: boolean | null = null;

  if (canonicalSize && candidateSize) {
    sizeMatch = sizesMatch(canonicalSize, candidateSize);
    if (!sizeMatch) {
      return {
        score: 0,
        brandMatch: true,
        nameScore: 0,
        sizeMatch: false,
        disqualified: true,
        disqualifyReason: `size mismatch: "${canonicalSize.normalized}" vs "${candidateSize.normalized}"`,
      };
    }
  } else if (canonicalSize || candidateSize) {
    sizeMatch = null;
  }

  const canonicalCore = stripBrandAndSize(canonicalName);
  const candidateCore = stripBrandAndSize(candidateName);
  const nameScore = jaccard(tokenize(canonicalCore), tokenize(candidateCore));

  if (nameScore < 0.3) {
    return {
      score: 0,
      brandMatch: true,
      nameScore,
      sizeMatch,
      disqualified: true,
      disqualifyReason: `core name too dissimilar: "${canonicalCore}" vs "${candidateCore}" (score: ${nameScore.toFixed(2)})`,
    };
  }

  const sizeBonus = sizeMatch === true ? 0.3 : sizeMatch === null ? 0.15 : 0;
  const score = Math.min(1, nameScore * 0.6 + sizeBonus + 0.1);

  return { score, brandMatch: true, nameScore, sizeMatch, disqualified: false };
}

/** Legacy single-number interface — used by reconciliationEngine */
export function similarityScore(a: string, b: string): number {
  return scoreSimilarity(a, b).score;
}