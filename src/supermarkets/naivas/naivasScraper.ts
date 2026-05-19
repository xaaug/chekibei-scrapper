import { Page } from "playwright";
import { BaseScraper } from "../base/BaseScraper";
import { CandidateProduct } from "../base/types";
import { NAIVAS_SELECTORS } from "./selectors";
import { NAIVAS_CONFIG } from "./config";
import { waitForProductsToLoad } from "../base/waitStrategies";
import { scopedLogger } from "../../core/logger/logger";

const log = scopedLogger("naivasScraper");

export class NaivasScraper extends BaseScraper {
  constructor() {
    super(NAIVAS_CONFIG);
  }

  protected get productCardSelector(): string {
    return NAIVAS_SELECTORS.productCard;
  }

  protected async navigateToSearch(page: Page, query: string): Promise<void> {
    // Naivas search is a standard GET form — navigate directly to search URL
    const searchUrl = `${NAIVAS_CONFIG.searchUrl}?term=${encodeURIComponent(query)}`;

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Livewire hydrates after DOM load — wait for the input to be ready
    await page.waitForSelector(NAIVAS_SELECTORS.searchInput, {
      state: "visible",
      timeout: 10_000,
    });

    log.debug(`Navigated to Naivas search: "${query}"`);
  }

  protected async extractCandidates(
    page: Page,
    query: string,
  ): Promise<CandidateProduct[]> {
    return page.evaluate(
      ({ cardSel, linkSel, nameSel, priceSel, idSel, query }) => {
        const cards = Array.from(document.querySelectorAll(cardSel));
        const results: CandidateProduct[] = [];

        for (const card of cards) {
          // Product ID from hidden input (Livewire cart form)
          const idInput = card.querySelector(idSel) as HTMLInputElement | null;
          const productId = idInput?.value?.trim() ?? null;

          // URL and name from the product anchor
          const anchor = card.querySelector(linkSel) as HTMLAnchorElement | null;
          const url = anchor?.getAttribute("href") ?? "";
          if (!url) continue;

          const nameEl = card.querySelector(nameSel) as HTMLElement | null;
          const name = nameEl?.innerText?.trim() ?? "";
          if (!name) continue;

          // Price — "KES 159" → strip non-numeric except dot
          const priceEl = card.querySelector(priceSel) as HTMLElement | null;
          const priceText = priceEl?.innerText?.replace(/[^0-9.]/g, "") ?? "";
          const price = priceText ? parseFloat(priceText) : undefined;

          results.push({ productId, name, url, price, supermarket: "naivas", sourceQuery: query });
        }

        return results;
      },
      {
        cardSel: NAIVAS_SELECTORS.productCard,
        linkSel: NAIVAS_SELECTORS.productLink,
        nameSel: NAIVAS_SELECTORS.productName,
        priceSel: NAIVAS_SELECTORS.productPrice,
        idSel: NAIVAS_SELECTORS.productId,
        query,
      } as any,
    );
  }
}