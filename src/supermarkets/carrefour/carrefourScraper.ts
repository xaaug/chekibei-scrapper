import { Page } from "playwright";
import { BaseScraper } from "../base/BaseScraper";
import { CandidateProduct } from "../base/types";
import { CARREFOUR_SELECTORS } from "./selectors";
import { CARREFOUR_CONFIG } from "./config";
import { scopedLogger } from "../../core/logger/logger";

const log = scopedLogger("carrefourScraper");

export class CarrefourScraper extends BaseScraper {
  constructor() {
    super(CARREFOUR_CONFIG);
  }

  protected get productCardSelector(): string {
    return CARREFOUR_SELECTORS.productCard;
  }

  protected async navigateToSearch(page: Page, query: string): Promise<void> {
    // Build the search URL directly — no homepage load, no search box interaction.
    // This avoids the networkidle timeout since we skip the heavy landing page.
    const searchUrl = `${CARREFOUR_CONFIG.searchUrl}${encodeURIComponent(query)}`;

    log.debug(`Navigating to: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded", // networkidle never settles on Carrefour
      timeout: 30_000,
    });

    // Wait for at least one product card to confirm results loaded
    await page.waitForSelector(CARREFOUR_SELECTORS.productCard, {
      state: "visible",
      timeout: 15_000,
    }).catch(() => {
      log.warn(`No product cards visible for "${query}" — page may be empty or slow`);
    });

    // add temporarily in navigateToSearch, after the waitForSelector catch
const bodyText = await page.evaluate(() => document.body.innerText.trim().slice(0, 500));
const title = await page.title();
log.debug(`Page title: "${title}"`);
log.debug(`Body preview: "${bodyText}"`);
    log.debug(`Navigated to search results for: "${query}"`);
  }

  protected async extractCandidates(
    page: Page,
    query: string,
  ): Promise<CandidateProduct[]> {
    return page.evaluate(
      ({ cardSel, nameSel, priceSel, baseUrl, query }) => {
        const cards = Array.from(document.querySelectorAll(cardSel));
        const results: CandidateProduct[] = [];

        for (const card of cards) {
          const anchor = card as HTMLAnchorElement;
          const href = anchor.getAttribute("href") ?? "";
          if (!href) continue;

          const url = href.startsWith("http") ? href : `${baseUrl}${href}`;

          // Extract product ID from URL path (last segment after /p/)
          const idMatch = href.match(/\/p\/(\d+)/);
          const productId = idMatch ? idMatch[1] : null;

          // Name is inside the container sibling
          const container = anchor.closest("div.relative");
          const nameEl = container?.querySelector(nameSel) as HTMLElement | null;
          const name = nameEl?.innerText?.trim() ?? "";

          if (!name) continue;

          // Price — strip "KES" and parse
          const priceEl = container?.querySelector(priceSel) as HTMLElement | null;
          const priceText = priceEl?.innerText?.replace(/[^0-9.]/g, "") ?? "";
          const price = priceText ? parseFloat(priceText) : undefined;

          results.push({ productId, name, url, price, supermarket: "carrefour", sourceQuery: query });
        }

        return results;
      },
      {
        cardSel: CARREFOUR_SELECTORS.productCard,
        nameSel: CARREFOUR_SELECTORS.productName,
        priceSel: CARREFOUR_SELECTORS.productPrice,
        baseUrl: CARREFOUR_CONFIG.baseUrl,
        query,
      } as any,
    );
  }
}