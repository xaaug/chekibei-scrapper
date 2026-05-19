import { Page } from "playwright";
import { ScraperConfig, ScraperInput, ScrapeResult, CandidateProduct } from "./types";
import { runScrollEngine } from "./scrollEngine";
import { waitForProductsToLoad } from "./waitStrategies";
import { withRetry } from "../../core/retries/retry";
import { scopedLogger } from "../../core/logger/logger";

const log = scopedLogger("BaseScraper");

export abstract class BaseScraper {
  protected readonly config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  // ── Abstract interface — each supermarket implements these ─────────────────

  /** Navigate to search results for the given query */
  protected abstract navigateToSearch(page: Page, query: string): Promise<void>;

  /** Extract all candidate products from the current DOM */
  protected abstract extractCandidates(
    page: Page,
    query: string,
  ): Promise<CandidateProduct[]>;

  /** Selector for a single product card — used by scroll engine */
  protected abstract get productCardSelector(): string;

  // ── Orchestration ──────────────────────────────────────────────────────────

  async scrape(page: Page, input: ScraperInput): Promise<ScrapeResult> {
    const { searchQuery, maxScrolls, waitTime = this.config.waitTime } = input;
    const errors: string[] = [];

    log.info(`Starting scrape: "${searchQuery}"`, {
      supermarket: this.config.supermarket,
    });

    // ── Navigate with retry ──────────────────────────────────────────────────
    await withRetry(
      () => this.navigateToSearch(page, searchQuery),
      { maxAttempts: this.config.maxRetries, delayMs: 2_000 },
      `navigateToSearch(${searchQuery})`,
    ).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Navigation failed: ${msg}`);
      log.error(`Navigation failed for query "${searchQuery}"`, { error: msg });
    });

    // ── Wait for initial products ────────────────────────────────────────────
    const loaded = await waitForProductsToLoad(
      page,
      this.productCardSelector,
      1,
      10_000,
    );

    if (!loaded) {
      errors.push("No products loaded after navigation");
      return {
        query: searchQuery,
        supermarket: this.config.supermarket,
        candidates: [],
        totalFound: 0,
        scrollsPerformed: 0,
        errors,
      };
    }

    // ── Scroll if needed ─────────────────────────────────────────────────────
    let scrollsPerformed = 0;

    if (this.config.paginationMode === "scroll" || this.config.paginationMode === "hybrid") {
      const scrollResult = await runScrollEngine(page, {
        maxScrolls,
        waitTime,
        productSelector: this.productCardSelector,
      });
      scrollsPerformed = scrollResult.scrollsPerformed;
    }

    // ── Extract candidates ───────────────────────────────────────────────────
    const candidates = await withRetry(
      () => this.extractCandidates(page, searchQuery),
      { maxAttempts: this.config.maxRetries, delayMs: 1_000 },
      `extractCandidates(${searchQuery})`,
    ).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Extraction failed: ${msg}`);
      log.error(`Extraction failed`, { error: msg });
      return [] as CandidateProduct[];
    });

    log.info(`Scrape complete: ${candidates.length} candidates`, {
      supermarket: this.config.supermarket,
      query: searchQuery,
      scrollsPerformed,
    });

    return {
      query: searchQuery,
      supermarket: this.config.supermarket,
      candidates,
      totalFound: candidates.length,
      scrollsPerformed,
      errors,
    };
  }
}