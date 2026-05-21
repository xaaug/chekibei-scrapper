import { CandidateProduct, SupermarketId } from "../supermarkets/base/types";
import { CanonicalProduct, SupermarketMapping } from "../types/canonical";
import { scoreCandidate, ScoreBreakdown } from "./similarity";
import { scopedLogger } from "../core/logger/logger";

const log = scopedLogger("reconciliationEngine");

/**
 * Minimum combined score to accept a match.
 *
 * With BRAND_WEIGHT=0.6 + NAME_WEIGHT=0.4:
 *   - Perfect brand + weak name  → 0.6*1.0 + 0.4*0.3 = 0.72  ✓ accepted
 *   - Weak brand  + perfect name → 0.6*0.3 + 0.4*1.0 = 0.58  ✓ accepted (brand present but partial)
 *   - No brand    + perfect name → 0.6*0.0 + 0.4*1.0 = 0.40  ✗ rejected (different brand entirely)
 *   - Perfect brand + no name    → 0.6*1.0 + 0.4*0.0 = 0.60  ✓ accepted (same brand, likely match)
 */
const MATCH_THRESHOLD = 0.55;

export interface ReconciliationMatch {
  supermarket: SupermarketId;
  candidate: CandidateProduct;
  score: ScoreBreakdown;
}

export interface ReconciliationResult {
  productKey: string;
  matches: ReconciliationMatch[];
  updatedSupermarkets: CanonicalProduct["supermarkets"];
}

/**
 * For a single canonical product, score all candidates from each supermarket
 * using two-phase brand → product name scoring, then pick the best match
 * per supermarket above the threshold.
 */
export function reconcileProduct(
  canonical: CanonicalProduct,
  candidatesBySuper: Partial<Record<SupermarketId, CandidateProduct[]>>,
): ReconciliationResult {
  const matches: ReconciliationMatch[] = [];
  const updatedSupermarkets = { ...canonical.supermarkets };

  for (const [supermarket, candidates] of Object.entries(candidatesBySuper)) {
    const sid = supermarket as SupermarketId;
    if (!candidates || candidates.length === 0) continue;

    // Score every candidate with the two-phase scorer
    const scored = candidates
      .map((candidate) => ({
        candidate,
        score: scoreCandidate(
          canonical.brand || "",
          canonical.productName,
          candidate.name,
        ),
      }))
      .filter((s) => s.score.combined >= MATCH_THRESHOLD)
      .sort((a, b) => b.score.combined - a.score.combined);

    if (scored.length === 0) {
      log.debug(
        `No match for "${canonical.displayName}" on ${sid}` +
          ` — top candidate: "${candidates[0]?.name ?? "none"}"`,
      );
      continue;
    }

    const best = scored[0];

    log.debug(
      `Match: "${canonical.displayName}" → "${best.candidate.name}" ` +
        `(${sid}, combined: ${best.score.combined.toFixed(2)}, ` +
        `brand: ${best.score.brand.toFixed(2)}, ` +
        `name: ${best.score.name.toFixed(2)})`,
    );

    matches.push({ supermarket: sid, candidate: best.candidate, score: best.score });

    const mapping: SupermarketMapping = {
      externalId: best.candidate.productId ?? "",
      url: best.candidate.url,
    };

// Validate it's actually a product detail URL, not a search/category URL
const isValidProductUrl = isProductDetailUrl(sid, best.candidate.url);

if (!isValidProductUrl) {
  log.warn(
    `Skipping ${sid} match for "${canonical.displayName}" — URL doesn't look like a product page: ${best.candidate.url}`,
  );
  continue;
}

updatedSupermarkets[sid] = mapping;

    updatedSupermarkets[sid] = mapping;
  }

  return { productKey: canonical.productKey, matches, updatedSupermarkets };
}

function isProductDetailUrl(supermarket: SupermarketId, url: string): boolean {
  switch (supermarket) {
    case "carrefour":
      // Carrefour product URLs always contain /p/ followed by digits
      return /\/p\/\d+/.test(url);
    case "naivas":
      // Naivas product URLs are slugs — no /search or /category in path
      return (
        url.includes("naivas.online/") &&
        !url.includes("/search") &&
        !url.includes("/category") &&
        !url.includes("?")
      );
    case "quickmart":
      // Quickmart product URLs are slugs directly off root
      return (
        url.includes("quickmart.co.ke/") &&
        !url.includes("/search") &&
        !url.includes("?")
      );
    default:
      return true;
  }
}