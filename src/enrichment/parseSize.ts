/**
 * Extracts size from a product name.
 *
 * Handles:
 *   "250G"    "250 G"    "250g"
 *   "2KG"     "2 KG"     "2.5KG"   "2.5 KG"
 *   "500ML"   "500 ML"   "1L"       "1 L"
 *   "200MG"   "200 MG"
 *   "6 Pack"  "6Pack"    "12 PACK"
 *
 * The space between number and unit is optional — both "500G" and "500 G"
 * are matched and normalized to the same canonical form.
 *
 * Returns the raw match (for removal from name) and a normalized string.
 */

const SIZE_UNITS = ["KG", "MG", "ML", "G", "L", "PACK"] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];

// Build pattern dynamically from unit list (longest units first to avoid
// "G" matching before "KG" or "MG").
// Units sorted by length desc so KG/MG/ML match before G/L.
const UNIT_PATTERN = [...SIZE_UNITS]
  .sort((a, b) => b.length - a.length)
  .join("|");

// Matches: optional space between number and unit
// Groups: [1] number, [2] optional space, [3] unit
const SIZE_REGEX = new RegExp(
  `\\b(\\d+(?:\\.\\d+)?)(\\s*)(${UNIT_PATTERN})\\b`,
  "gi",
);

export interface ParsedSize {
  /** Exact string as it appears in rawName, e.g. "500 G" or "2KG" */
  raw: string;
  /** Canonical uppercase form, e.g. "500G", "2KG", "6PACK" */
  normalized: string;
  value: number;
  unit: SizeUnit;
}

export function parseSize(rawName: string): ParsedSize | undefined {
  // Reset lastIndex since we reuse the regex object
  SIZE_REGEX.lastIndex = 0;
  const match = SIZE_REGEX.exec(rawName);

  if (!match) return undefined;

  const value = parseFloat(match[1]);
  const space = match[2]; // captured — used to reconstruct raw accurately
  const unit = match[3].toUpperCase() as SizeUnit;

  // Display value: strip trailing ".0" for whole numbers
  const displayValue = value % 1 === 0 ? String(Math.floor(value)) : String(value);
  const normalized = `${displayValue}${unit}`;

  return {
    raw: match[0],       // e.g. "500 G" or "2KG" — exact original match
    normalized,          // e.g. "500G" or "2KG"
    value,
    unit,
  };
}