import { CandidateProduct, SupermarketId } from "../supermarkets/base/types";
import { CanonicalProduct } from "../types/canonical";
import { scoreSimilarity } from "./similarity";
import { scopedLogger } from "../core/logger/logger";

const log = scopedLogger("reconciliationEngine");

/** Minimum composite score to accept a match */
const MATCH_THRESHOLD = 0.4;

export interface ReconciliationMatch {
  supermarket: SupermarketId;
  candidate: CandidateProduct;
  score: number;
  breakdown: ReturnType<typeof scoreSimilarity>;
}

export interface ReconciliationResult {
  productKey: string;
  matches: ReconciliationMatch[];
  updatedSupermarkets: CanonicalProduct["supermarkets"];
  skipped: { supermarket: SupermarketId; reason: string }[];
}

export function reconcileProduct(
  canonical: CanonicalProduct,
  candidatesBySuper: Partial<Record<SupermarketId, CandidateProduct[]>>,
): ReconciliationResult {
  const matches: ReconciliationMatch[] = [];
  const skipped: ReconciliationResult["skipped"] = [];
  const updatedSupermarkets = { ...canonical.supermarkets };

  for (const [supermarket, candidates] of Object.entries(candidatesBySuper)) {
    const sid = supermarket as SupermarketId;
    if (!candidates || candidates.length === 0) continue;

    // Score every candidate using the structured scorer.
    // scoreSimilarity operates on displayName end-to-end — brand and size
    // are extracted internally, so we don't need to pass them separately.
    const scored = candidates
      .map((c) => {
        const breakdown = scoreSimilarity(canonical.displayName, c.name);
        return { candidate: c, score: breakdown.score, breakdown };
      })
      .filter((s) => !s.breakdown.disqualified && s.score >= MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      // Log why the best candidate was rejected — useful for tuning
      const bestRejected = candidates
        .map((c) => {
          const breakdown = scoreSimilarity(canonical.displayName, c.name);
          return { name: c.name, breakdown };
        })
        .sort((a, b) => b.breakdown.score - a.breakdown.score)[0];

      const reason = bestRejected
        ? `best candidate "${bestRejected.name}" rejected: ${bestRejected.breakdown.disqualifyReason ?? "score too low"}`
        : "no candidates";

      log.debug(`No match for "${canonical.displayName}" on ${sid}: ${reason}`);
      skipped.push({ supermarket: sid, reason });
      continue;
    }

    const best = scored[0];

    // Validate URL is a product detail page before accepting the match
    if (!isProductDetailUrl(sid, best.candidate.url)) {
      const reason = `URL not a product detail page: ${best.candidate.url}`;
      log.warn(`Skipping ${sid} match for "${canonical.displayName}" — ${reason}`);
      skipped.push({ supermarket: sid, reason });
      continue;
    }

    log.info(
      `Match: "${canonical.displayName}" → "${best.candidate.name}" ` +
        `(${sid}, score: ${best.score.toFixed(2)}, ` +
        `nameScore: ${best.breakdown.nameScore.toFixed(2)}, ` +
        `brand: ${best.breakdown.brandConfidence}, ` +   
        `size: ${best.breakdown.sizeMatch ?? "n/a"})`,
    );

    matches.push({
      supermarket: sid,
      candidate: best.candidate,
      score: best.score,
      breakdown: best.breakdown,
    });

    updatedSupermarkets[sid] = {
      externalId: best.candidate.productId ?? "",
      url: best.candidate.url,
    };
  }

  return { productKey: canonical.productKey, matches, updatedSupermarkets, skipped };
}

// ── URL validation ─────────────────────────────────────────────────────────────

function isProductDetailUrl(supermarket: SupermarketId, url: string): boolean {
  switch (supermarket) {
    case "carrefour":
      return /\/p\/\d+/.test(url);
    case "naivas":
      return (
        url.includes("naivas.online/") &&
        !url.includes("/search") &&
        !url.includes("/category") &&
        !url.includes("?term=")
      );
    case "quickmart":
      return (
        url.includes("quickmart.co.ke/") &&
        !url.includes("/search") &&
        !url.includes("?")
      );
    default:
      return true;
  }
}