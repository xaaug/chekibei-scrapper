export type SupermarketId = "carrefour" | "quickmart" | "naivas";
export type PaginationMode = "scroll" | "pagination" | "hybrid";

export interface ScraperConfig {
  supermarket: SupermarketId;
  baseUrl: string;
  searchUrl: string;
  paginationMode: PaginationMode;
  maxRetries: number;
  waitTime: number;
}

export interface ScraperInput {
  searchQuery: string;
  maxScrolls: number;
  waitTime?: number;
}

export interface CandidateProduct {
  productId: string | null;
  name: string;
  url: string;
  price?: number;
  supermarket: SupermarketId;
  sourceQuery: string;
}

export interface ScrapeResult {
  query: string;
  supermarket: SupermarketId;
  candidates: CandidateProduct[];
  totalFound: number;
  scrollsPerformed: number;
  errors: string[];
}