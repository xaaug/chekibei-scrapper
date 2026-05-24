import path from "path";

export const QUICKMART_CONFIG = {
  baseUrl: "https://www.quickmart.co.ke",
  source: "quickmart" as const,

  // Session
  sessionStoragePath: path.resolve(process.cwd(), "storage/sessions/quickmart.json"),

  // Location setup
  location: {
    query: "Kakamega",
    expectedBranch: "Quickmart Kakamega",
  },

  // Scraping behaviour
  navigation: {
    pageLoadTimeoutMs: 30_000,
    actionTimeoutMs: 15_000,
    postClickStabilityMs: 600,
  },

  // Retry policy for per-page scraping
  retry: {
    maxAttempts: 3,
    delayMs: 2_000,
    backoffMultiplier: 1.5,
  },

  // Deduplication key for discovery
  dedupKey: "productId" as "productId" | "url",
} as const;
