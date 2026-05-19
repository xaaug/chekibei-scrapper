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
    await page.goto(CARREFOUR_CONFIG.baseUrl, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });

    await page.waitForSelector(CARREFOUR_SELECTORS.searchInput, {
      state: "visible",
      timeout: 30_000,
    });

    await page.focus(CARREFOUR_SELECTORS.searchInput);
    await page.fill(CARREFOUR_SELECTORS.searchInput, query);
await page.keyboard.press("Enter");

    await page.waitForURL(/.*search.*/, { timeout: 10_000 }).catch(() => {
      log.warn("URL did not change to search results — proceeding anyway");
    });

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