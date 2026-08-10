import { Page } from "playwright";
import { DiscoveryScraperConfig, DiscoveryScraperInput, BaseDiscoveryScraper } from "../base/BaseDiscoveryScraper";
import { DiscoveredProduct } from "../../types/discovery";
import { NAIVAS_SELECTORS } from "./selectors";
import { NAIVAS_CONFIG } from "./config";
import { scopedLogger } from "../../core/logger/logger";
import { extractImage } from "../../images/extractImage";

const log = scopedLogger("naivas:discoveryScraper");

export class NaivasDiscoveryScraper extends BaseDiscoveryScraper {
  constructor() {
    super({
      supermarket: "naivas",
      baseUrl: NAIVAS_CONFIG.baseUrl,
      searchUrl: `${NAIVAS_CONFIG.baseUrl}/search`,
      paginationMode: "pagination",
      maxRetries: NAIVAS_CONFIG.maxRetries,
      waitTime: NAIVAS_CONFIG.waitTime,
    });
  }

  protected get productCardSelector(): string {
    return NAIVAS_SELECTORS.productCard;
  }

  protected async navigateToCategory(page: Page, categoryUrl: string): Promise<void> {
    // Naivas category/brand pages are standard GET requests
    await page.goto(categoryUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Wait for product cards to appear
    await page.waitForSelector(this.productCardSelector, {
      state: "attached",
      timeout: 15_000,
    }).catch(() => {
      log.warn("Product cards did not appear within timeout");
    });
  }

  protected async extractDiscoveredProducts(
    page: Page,
    category: string,
  ): Promise<DiscoveredProduct[]> {
    return await page.evaluate(
      ({ cardSel, linkSel, nameSel, idSel }) => {
        const cards = Array.from(document.querySelectorAll(cardSel));
        const results: DiscoveredProduct[] = [];

        for (const card of cards) {
          // Product ID from hidden input (Livewire cart form)
          const idInput = card.querySelector(idSel) as HTMLInputElement | null;
          const productId = idInput?.value?.trim() ?? undefined;

          // URL and name from the product anchor
          const anchor = card.querySelector(linkSel) as HTMLAnchorElement | null;
          const url = anchor?.getAttribute("href") ?? "";
          if (!url) continue;

          const nameEl = card.querySelector(nameSel) as HTMLElement | null;
          const name = nameEl?.innerText?.trim() ?? "";
          if (!name) continue;

          // Extract image URL from the card
          let imageUrl: string | undefined;
          try {
            const cardHtml = card.outerHTML;
            const extracted = extractImage("naivas", cardHtml);
            imageUrl = extracted ?? undefined;
          } catch (imgErr) {
            // Ignore image extraction errors
          }

          results.push({
            productId,
            name,
            url: url.startsWith("http") ? url : `${this.config.baseUrl}${url.startsWith("/") ? "" : "/"}${url}`,
            category,
            source: "naivas" as const,
            imageUrl,
          });
        }

        return results;
      },
      {
        cardSel: NAIVAS_SELECTORS.productCard,
        linkSel: NAIVAS_SELECTORS.productLink,
        nameSel: NAIVAS_SELECTORS.productName,
        idSel: NAIVAS_SELECTORS.productId,
      },
    );
  }

  protected async goToNextPage(page: Page, currentPageNum: number): Promise<{
    reachedEnd: boolean;
  }> {
    // Naivas uses pagination with page numbers in URL or next button
    // For simplicity, we'll try to find a next button
    const nextButton = await page.$('a[rel="next"], .pagination .next, button[aria-label="next"]');
    if (nextButton) {
      await nextButton.click();
      await page.waitForTimeout(2000);
      return { reachedEnd: false };
    }
    return { reachedEnd: true };
  }
}