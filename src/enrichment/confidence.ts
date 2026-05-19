/**
 * Computes parser confidence for a canonical product.
 *
 * Confidence reflects how well the enrichment pipeline understood
 * the raw name — not data quality from the source.
 *
 * Scoring weights:
 *   brand       → 30%
 *   size        → 30%
 *   productName → 40%
 *
 * Score thresholds:
 *   high   → 0.8 – 1.0
 *   medium → 0.5 – 0.79
 *   low    → 0.0 – 0.49
 */

import {
  ConfidenceLevel,
  FieldConfidence,
  ParserConfidence,
} from "../types/canonical";

// ── Field-level confidence ─────────────────────────────────────────────────────

function brandConfidence(
  brand: string | undefined,
  rawName: string,
): ConfidenceLevel {
  if (!brand) return "low";

  // High: brand is a clean single alpha word
  if (/^[A-Za-z]+$/.test(brand)) return "high";

  // Medium: brand contains numbers or punctuation (e.g. "7UP", "B&G")
  return "medium";
}

function sizeConfidence(
  size: string | undefined,
  rawName: string,
): ConfidenceLevel {
  if (!size) {
    // Not all products have sizes — check if one was plausibly expected
    // Flag low only if the raw name contains digits (missed extraction)
    if (/\d/.test(rawName)) return "low";
    // No digits at all — absence of size is likely correct
    return "medium";
  }

  // High: standard unit with clean integer value (e.g. "500G", "2KG", "1L")
  if (/^\d+(G|KG|ML|L|MG)$/.test(size)) return "high";

  // Medium: decimal value or PACK unit
  if (/^\d+\.\d+(G|KG|ML|L|MG)$/.test(size) || /^\d+PACK$/.test(size)) return "medium";

  return "low";
}

function productNameConfidence(
  productName: string,
  rawName: string,
  brand: string | undefined,
  sizeRaw: string | undefined,
): ConfidenceLevel {
  if (!productName || productName.trim().length === 0) return "low";

  // Low: productName is identical to rawName — nothing was stripped
  if (productName.trim() === rawName.trim()) return "low";

  // Low: productName is a single character (over-stripped)
  if (productName.trim().length <= 2) return "low";

  // Medium: productName still contains digits (size may not have been fully removed)
  if (/\d/.test(productName)) return "medium";

  // High: clean alpha/space string
  return "high";
}

// ── Score ──────────────────────────────────────────────────────────────────────

const LEVEL_VALUE: Record<ConfidenceLevel, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.2,
};

const WEIGHTS = {
  brand: 0.3,
  size: 0.3,
  productName: 0.4,
};

function computeScore(fields: FieldConfidence): number {
  const score =
    LEVEL_VALUE[fields.brand] * WEIGHTS.brand +
    LEVEL_VALUE[fields.size] * WEIGHTS.size +
    LEVEL_VALUE[fields.productName] * WEIGHTS.productName;

  return Math.round(score * 100) / 100;
}

// ── Flags ──────────────────────────────────────────────────────────────────────

function computeFlags(
  fields: FieldConfidence,
  brand: string | undefined,
  productName: string,
  size: string | undefined,
  rawName: string,
): string[] {
  const flags: string[] = [];

  if (fields.brand === "low") flags.push("brand_not_extracted");
  if (fields.size === "low" && /\d/.test(rawName)) flags.push("size_extraction_failed");
  if (!size && !/\d/.test(rawName)) flags.push("no_size_expected");
  if (fields.productName === "low" && productName.trim() === rawName.trim())
    flags.push("name_not_normalized");
  if (fields.productName === "low" && productName.trim().length <= 2)
    flags.push("name_over_stripped");
  if (/\d/.test(productName)) flags.push("digits_remaining_in_name");

  return flags;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface ConfidenceInput {
  brand: string | undefined;
  size: string | undefined;         // normalized size e.g. "500G"
  sizeRaw: string | undefined;      // original match e.g. "500 G"
  productName: string;
  rawName: string;
}

export function computeConfidence(input: ConfidenceInput): ParserConfidence {
  const fields: FieldConfidence = {
    brand: brandConfidence(input.brand, input.rawName),
    size: sizeConfidence(input.size, input.rawName),
    productName: productNameConfidence(
      input.productName,
      input.rawName,
      input.brand,
      input.sizeRaw,
    ),
  };

  const score = computeScore(fields);

  const flags = computeFlags(
    fields,
    input.brand,
    input.productName,
    input.size,
    input.rawName,
  );

  return { fields, score, flags };
}