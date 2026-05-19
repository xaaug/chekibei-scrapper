/**
 * Name similarity scoring for reconciliation matching.
 * Uses token overlap — no heavy NLP, no dependencies.
 *
 * Strategy: tokenize both names, compute Jaccard similarity on the token sets.
 * Jaccard = |intersection| / |union|
 *
 * Works well for FMCG names where word order varies but keywords are shared:
 *   "Jogoo Maize Meal 2KG" vs "Jogoo Maize Flour 2Kg" → partial match
 *   "Pembe Maize Flour 2KG" vs "Pembe Maize Flour 2Kg" → high match
 */

function tokenize(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean),
  );
}

export function similarityScore(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);

  const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}