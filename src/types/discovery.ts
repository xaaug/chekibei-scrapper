/**
 * Core discovery types for Chekibei scraper.
 * Discovery mode collects product identity data — not prices.
 */


export type DiscoverySource = "quickmart";
export interface DiscoveredProduct {
  productId?: string;
  name: string;
  url: string;
  category: string;
  source: DiscoverySource;
}

export interface DiscoveryCategoryInput {
  categoryUrl: string;
  maxPages: number;
  category: string
}

export interface DiscoveryRunResult {
  categoryUrl: string;
  totalPages: number;
  totalProducts: number;
  products: DiscoveredProduct[];
  errors: DiscoveryPageError[];
  durationMs: number;
}

export interface DiscoveryPageError {
  page: number;
  reason: string;
  retried: boolean;
}

export interface SessionState {
  storageStatePath: string;
  locationConfirmed: boolean;
  branch: string;
}
