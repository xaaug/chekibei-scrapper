/**
 * Extracts brand from the first word of the product name.
 * No list matching — first token is always the brand.
 *
 * "Blue Band Porridge 250G" → "Blue"   ← single word only
 *
 * NOTE: If the product naming convention is "Brand Product Size",
 * the first word is the brand. We keep this atomic — no guessing
 * multi-word brands.
 */

export function parseBrand(rawName: string): string | undefined {
  const first = rawName.trim().split(/\s+/)[0];
  return first?.length > 0 ? first : undefined;
}