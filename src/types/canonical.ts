/**
 * Canonical product model — Chekibei's internal product identity layer.
 *
 * Raw discovery data (DiscoveredProduct) feeds INTO this via the enrichment
 * pipeline. The two models are intentionally separate.
 */

export type SupermarketSource = "quickmart";

export interface SupermarketMapping {
  externalId: string;
  url: string;
}

export interface CanonicalProduct {
  productKey: string;           // ckb_prod_<hash> — stable internal ID

  brand?: string;               // extracted from name
  productName: string;          // name with size/brand removed
  size?: string;                // e.g. "250G", "1L"

  category: string;

  rawName: string;              // original scraped name — NEVER modified

  displayName: string;          // brand + productName + size (UI-ready)

  supermarkets: Partial<Record<SupermarketSource, SupermarketMapping>>;

  firstSeenAt: string;          // ISO 8601
  lastSeenAt?: string;          // ISO 8601
}