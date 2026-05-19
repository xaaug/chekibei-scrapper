import { CandidateProduct, SupermarketId } from "../supermarkets/base/types";
import { CanonicalProduct, SupermarketMapping } from "../types/canonical";
import { similarityScore } from "./similarity";
import { scopedLogger } from "../core/logger/logger";

const log = scopedLogger("reconciliationEngine");

/** Minimum score to consider a candidate a match */
const MATCH_THRESHOLD = 0.5;

export interface ReconciliationMatch {
  supermarket: SupermarketId;
  candidate: CandidateProduct;
  score: number;
}

export interface ReconciliationResult {
  productKey: string;
  matches: ReconciliationMatch[];
  /** Updated supermarkets map — merged with existing */
  updatedSupermarkets: CanonicalProduct["supermarkets"];
}

/**
 * For a single canonical product, score all candidates from each supermarket
 * and pick the best match per supermarket above the threshold.
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

    // Score every candidate against the canonical displayName
    const scored = candidates
      .map((c) => ({
        candidate: c,
        score: similarityScore(canonical.displayName, c.name),
      }))
      .filter((s) => s.score >= MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      log.debug(`No match for "${canonical.displayName}" on ${sid}`);
      continue;
    }

    const best = scored[0];

    log.debug(
      `Match: "${canonical.displayName}" → "${best.candidate.name}" ` +
        `(${sid}, score: ${best.score.toFixed(2)})`,
    );

    matches.push({ supermarket: sid, candidate: best.candidate, score: best.score });

    // Merge into supermarkets map — never overwrite an existing confirmed mapping
    const mapping: SupermarketMapping = {
      externalId: best.candidate.productId ?? "",
      url: best.candidate.url,
    };

    updatedSupermarkets[sid] = mapping;
  }

  return { productKey: canonical.productKey, matches, updatedSupermarkets };
}