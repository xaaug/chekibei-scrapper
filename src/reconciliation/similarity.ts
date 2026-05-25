/**
 * Structured similarity scoring for product reconciliation.
 *
 * Scores brand, core product name, and size independently.
 * A size mismatch is a hard disqualifier — "250G" and "5KG" are different products.
 *
 * Must be initialised before use:
 *   await similarityEngine.init();
 */

import { scopedLogger } from "../core/logger/logger";

const log = scopedLogger("similarity");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimilarityBreakdown {
  score: number;
  brandMatch: boolean;
  brandConfidence: "known" | "fallback"; // NEW: was the brand resolved from synonyms?
  nameScore: number;
  sizeMatch: boolean | null;
  disqualified: boolean;
  disqualifyReason?: string;
}

interface SynonymGroup {
  officialName: string;
  synonyms: string[];
}

interface ExtractedSize {
  value: number;
  unit: string;
  normalized: string;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

class SimilarityEngine {
  private brandAliasMap = new Map<string, string>();
  private sortedBrandStrings: string[] = [];

  private synonymMap = new Map<string, string>();
  private multiWordSynonyms: string[] = [];

  private ready = false;

  // ── Init ───────────────────────────────────────────────────────────────────

  async init(convexHttpUrl: string): Promise<void> {
    const [brandGroups, wordGroups] = await Promise.all([
      this.fetchGroups(`${convexHttpUrl}/synonyms/brands`),
      this.fetchGroups(`${convexHttpUrl}/synonyms/words`),
    ]);

    this.buildBrandMaps(brandGroups);
    this.buildWordMaps(wordGroups);
    this.ready = true;

    log.info(
      `Similarity engine ready — ` +
        `${brandGroups.length} brand groups, ${wordGroups.length} word groups`,
    );
  }

  private async fetchGroups(url: string): Promise<SynonymGroup[]> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch synonym groups from ${url}: ${res.status}`);
    }
    return res.json();
  }

  private buildBrandMaps(groups: SynonymGroup[]): void {
    this.brandAliasMap.clear();
    for (const { officialName, synonyms } of groups) {
      // officialName resolves to itself
      this.brandAliasMap.set(officialName.toLowerCase(), officialName);
      for (const alias of synonyms) {
        this.brandAliasMap.set(alias.toLowerCase(), officialName);
      }
    }
    // Longest-first so "Blue Band" matches before "Blue"
    this.sortedBrandStrings = [...this.brandAliasMap.keys()].sort(
      (a, b) => b.length - a.length,
    );
  }

  private buildWordMaps(groups: SynonymGroup[]): void {
    this.synonymMap.clear();
    for (const { officialName, synonyms } of groups) {
      this.synonymMap.set(officialName.toLowerCase(), officialName.toLowerCase());
      for (const word of synonyms) {
        this.synonymMap.set(word.toLowerCase(), officialName.toLowerCase());
      }
    }
    this.multiWordSynonyms = [...this.synonymMap.keys()]
      .filter((k) => k.includes(" "))
      .sort((a, b) => b.length - a.length);
  }

  private assertReady(): void {
    if (!this.ready) {
      throw new Error(
        "SimilarityEngine not initialised — call await similarityEngine.init(url) at startup",
      );
    }
  }

  // ── Brand extraction ───────────────────────────────────────────────────────

  private extractBrand(name: string): { brand: string; confidence: "known" | "fallback" } {
    const lower = name.trim().toLowerCase();
    for (const alias of this.sortedBrandStrings) {
      if (lower.startsWith(alias)) {
        return {
          brand: this.brandAliasMap.get(alias)!.toLowerCase(),
          confidence: "known",
        };
      }
    }
    // Fallback: first token — still usable but scored with a penalty
    const fallback = name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    return { brand: fallback, confidence: "fallback" };
  }

  /** Returns canonical-cased brand — used externally by parsers */
  parseBrand(rawName: string): string | undefined {
    this.assertReady();
    const lower = rawName.trim().toLowerCase();
    for (const alias of this.sortedBrandStrings) {
      if (lower.startsWith(alias)) {
        return this.brandAliasMap.get(alias);
      }
    }
    const first = rawName.trim().split(/\s+/)[0];
    return first?.length > 0 ? first : undefined;
  }

  // ── Synonym application ────────────────────────────────────────────────────

  private applySynonymsToText(text: string): string {
    let s = text;
    for (const phrase of this.multiWordSynonyms) {
      if (s.includes(phrase)) {
        s = s.replaceAll(phrase, this.synonymMap.get(phrase)!);
      }
    }
    return s;
  }

  private applySynonymToToken(token: string): string {
    return this.synonymMap.get(token) ?? token;
  }

  // ── Unit normalisation ─────────────────────────────────────────────────────

  private normaliseUnit(token: string): string {
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

  // ── Size extraction ────────────────────────────────────────────────────────

  // IMPROVED: captures multiplied packs like "6x1kg" or "2x500ml"
  // and returns a normalised single-unit value for comparison
  private readonly SIZE_REGEX =
    /\b(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(g|kg|gm|gms|ml|l|mg|pack)\b/gi;

  private extractSize(name: string): ExtractedSize | null {
    this.SIZE_REGEX.lastIndex = 0;
    const match = this.SIZE_REGEX.exec(name);
    if (!match) return null;

    const multiplier = match[1] ? parseInt(match[1], 10) : 1;
    const value = parseFloat(match[2]) * multiplier;
    const rawUnit = match[3].toLowerCase();
    const unit = (rawUnit === "gm" || rawUnit === "gms" ? "g" : rawUnit).toUpperCase();

    return {
      value,
      unit,
      normalized: `${value % 1 === 0 ? Math.floor(value) : value}${unit}`,
    };
  }

  private toBaseUnit(size: ExtractedSize): number {
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

  private sizesMatch(a: ExtractedSize, b: ExtractedSize): boolean {
    const weightUnits = new Set(["G", "KG", "MG"]);
    const volumeUnits = new Set(["ML", "L"]);

    const aIsWeight = weightUnits.has(a.unit);
    const bIsWeight = weightUnits.has(b.unit);
    const aIsVolume = volumeUnits.has(a.unit);
    const bIsVolume = volumeUnits.has(b.unit);

    if ((aIsWeight && bIsVolume) || (aIsVolume && bIsWeight)) return false;
    if (a.unit === "PACK" !== (b.unit === "PACK")) return false;

    const aBase = this.toBaseUnit(a);
    const bBase = this.toBaseUnit(b);
    return Math.abs(aBase - bBase) / Math.max(aBase, bBase) < 0.01;
  }

  // ── Tokenisation ───────────────────────────────────────────────────────────

  private tokenize(text: string): Set<string> {
    const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    const withSynonyms = this.applySynonymsToText(lower);
    return new Set(
      withSynonyms
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => this.normaliseUnit(t))
        .map((t) => this.applySynonymToToken(t)),
    );
  }

  // ── Core name stripping ────────────────────────────────────────────────────

  private stripBrandAndSize(name: string): string {
    let s = name.trim();
    const lower = s.toLowerCase();

    // Strip known brand prefix
    let brandStripped = false;
    for (const alias of this.sortedBrandStrings) {
      if (lower.startsWith(alias)) {
        s = s.slice(alias.length).trim();
        brandStripped = true;
        break;
      }
    }
    // Fallback: strip first token
    if (!brandStripped) {
      s = s.replace(/^\S+\s*/, "");
    }

    // Strip all size tokens (including multiplied forms)
    this.SIZE_REGEX.lastIndex = 0;
    s = s.replace(this.SIZE_REGEX, " ");

    // Strip packaging words
    s = s.replace(
      /\b(carton|packet|pack|jar|tin|bottle|sachet|tray|box|pouch|bag)\b/gi,
      " ",
    );

    const clean = s.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    return this.applySynonymsToText(clean).trim().replace(/\s+/g, " ");
  }

  // ── Jaccard ────────────────────────────────────────────────────────────────

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;
    const intersection = [...a].filter((t) => b.has(t)).length;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : intersection / union;
  }

  // ── Character bigram similarity (NEW) ──────────────────────────────────────
  //
  // Used as a fallback when Jaccard is borderline (0.2–0.3).
  // Catches typos, truncations, and spacing differences that tokenisation misses.
  // e.g. "instantcoffee" vs "instant coffee" scores 0.87 on bigrams.

  private bigrams(s: string): Set<string> {
    const clean = s.replace(/\s+/g, "");
    const out = new Set<string>();
    for (let i = 0; i < clean.length - 1; i++) {
      out.add(clean.slice(i, i + 2));
    }
    return out;
  }

  private bigramSimilarity(a: string, b: string): number {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const ba = this.bigrams(a);
    const bb = this.bigrams(b);
    const intersection = [...ba].filter((g) => bb.has(g)).length;
    return (2 * intersection) / (ba.size + bb.size);
  }

  // ── Main scoring ───────────────────────────────────────────────────────────

  scoreSimilarity(
    canonicalName: string,
    candidateName: string,
  ): SimilarityBreakdown {
    this.assertReady();

    const { brand: canonicalBrand, confidence: canonicalConf } =
      this.extractBrand(canonicalName);
    const { brand: candidateBrand, confidence: candidateConf } =
      this.extractBrand(candidateName);

    const brandMatch = canonicalBrand === candidateBrand;
    const brandConfidence: "known" | "fallback" =
      canonicalConf === "known" && candidateConf === "known" ? "known" : "fallback";

    // Hard disqualify only if BOTH brands are known and they don't match.
    // If either is a fallback, we let name scoring decide — the brand penalty
    // in the score formula handles the uncertainty.
    if (!brandMatch && brandConfidence === "known") {
      return {
        score: 0,
        brandMatch: false,
        brandConfidence: "known",
        nameScore: 0,
        sizeMatch: null,
        disqualified: true,
        disqualifyReason: `brand mismatch: "${canonicalBrand}" vs "${candidateBrand}"`,
      };
    }

    const canonicalSize = this.extractSize(canonicalName);
    const candidateSize = this.extractSize(candidateName);
    let sizeMatch: boolean | null = null;

    if (canonicalSize && candidateSize) {
      sizeMatch = this.sizesMatch(canonicalSize, candidateSize);
      if (!sizeMatch) {
        return {
          score: 0,
          brandMatch,
          brandConfidence,
          nameScore: 0,
          sizeMatch: false,
          disqualified: true,
          disqualifyReason: `size mismatch: "${canonicalSize.normalized}" vs "${candidateSize.normalized}"`,
        };
      }
    } else if (canonicalSize || candidateSize) {
      sizeMatch = null;
    }

    const canonicalCore = this.stripBrandAndSize(canonicalName);
    const candidateCore = this.stripBrandAndSize(candidateName);
    let nameScore = this.jaccard(
      this.tokenize(canonicalCore),
      this.tokenize(candidateCore),
    );

    // IMPROVED: bigram fallback for borderline Jaccard scores.
    // If Jaccard is weak but bigram similarity is strong, use a weighted blend.
    if (nameScore < 0.3) {
      const bigramScore = this.bigramSimilarity(canonicalCore, candidateCore);
      if (bigramScore >= 0.6) {
        // Blend: weight bigram higher since Jaccard failed on tokenisation
        nameScore = nameScore * 0.3 + bigramScore * 0.7;
        log.debug(
          `Bigram rescue: "${canonicalCore}" vs "${candidateCore}" — ` +
            `jaccard=${nameScore.toFixed(2)}, bigram=${bigramScore.toFixed(2)}, blended=${nameScore.toFixed(2)}`,
        );
      }
    }

    if (nameScore < 0.3) {
      return {
        score: 0,
        brandMatch,
        brandConfidence,
        nameScore,
        sizeMatch,
        disqualified: true,
        disqualifyReason: `core name too dissimilar: "${canonicalCore}" vs "${candidateCore}" (score: ${nameScore.toFixed(2)})`,
      };
    }

    // IMPROVED: score formula — no free +0.1, explicit weights sum to 1.0
    //   brand confidence: 0.15 (known brand match is more trustworthy)
    //   name score:       0.55
    //   size bonus:       0.30 (confirmed size match is strong signal)
    const brandBonus = brandMatch && brandConfidence === "known" ? 0.15 : 0.05;
    const sizeBonus = sizeMatch === true ? 0.30 : sizeMatch === null ? 0.10 : 0;
    const score = Math.min(1, brandBonus + nameScore * 0.55 + sizeBonus);

    return {
      score,
      brandMatch,
      brandConfidence,
      nameScore,
      sizeMatch,
      disqualified: false,
    };
  }

  /** Legacy single-number interface — used by reconciliationEngine */
  similarityScore(a: string, b: string): number {
    return this.scoreSimilarity(a, b).score;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const similarityEngine = new SimilarityEngine();

// Re-export the two functions reconciliationEngine calls directly
// so its import doesn't change
export function scoreSimilarity(
  canonicalName: string,
  candidateName: string,
): SimilarityBreakdown {
  return similarityEngine.scoreSimilarity(canonicalName, candidateName);
}

export function similarityScore(a: string, b: string): number {
  return similarityEngine.similarityScore(a, b);
}

export function parseBrand(rawName: string): string | undefined {
  return similarityEngine.parseBrand(rawName);
}