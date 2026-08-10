import { Page } from "playwright";
import { DiscoveryScraperConfig, DiscoveryScraperInput, BaseDiscoveryScraper } from "../base/BaseDiscoveryScraper";
import { DiscoveredProduct } from "../../types/discovery";
import { CARREFOUR_SELECTORS } from "./selectors";
import { CARREFOUR_CONFIG } from "./config";
import { scopedLogger } from "../../core/logger/logger";
import { extractImage } from "../../images/extractImage";

const log = scopedLogger("carrefour:discoveryScraper");

export class CarrefourDiscoveryScraper extends BaseDiscoveryScraper {
  constructor() {
    super({
      supermarket: "carrefour",
      baseUrl: CARREFOUR_CONFIG.baseUrl,
      searchUrl: CARREFOUR_CONFIG.searchUrl,
      paginationMode: "pagination",
      maxRetries: CARREFOUR_CONFIG.maxRetries,
      waitTime: CARREFOUR_CONFIG.waitTime,
    });
  }

  protected get productCardSelector(): string {
    return CARREFOUR_SELECTORS.productCard;
  }

  protected async navigateToCategory(page: Page, categoryUrl: string): Promise<void> {
    // Carrefour category/brand pages are standard GET requests
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
      ({ cardSel, baseUrl }) => {
        const cards = Array.from(document.querySelectorAll(cardSel));
        const results: DiscoveredProduct[] = [];

        for (const card of cards) {
          const anchor = card as HTMLAnchorElement;
          const href = anchor.getAttribute("href") ?? "";
          if (!href) continue;

          const url = href.startsWith("http") ? href : `${baseUrl}${href}`;

          // Extract product ID from URL path (last segment after /p/)
          const idMatch = href.match(/\/p\/(\d+)/);
          const productId = idMatch ? idMatch[1] : undefined;

          // Extract name from the card
          let name = "";
          const nameEl = anchor.querySelector('.text-sm.font-medium.line-clamp-2') as HTMLElement | null;
          if (nameEl) {
            name = nameEl.innerText?.trim() ?? "";
          }

          if (!name) continue;

          // Extract image URL from the card
          let imageUrl: string | undefined;
          try {
            const cardHtml = card.outerHTML;
            const extracted = extractImage("carrefour", cardHtml);
            imageUrl = extracted ?? undefined;
          } catch (imgErr) {
            // Ignore image extraction errors
          }

          results.push({
            productId,
            name,
            url,
            category,
            source: "carrefour" as const,
            imageUrl,
          });
        }

        return results;
      },
      {
        cardSel: CARREFOUR_SELECTORS.productCard,
        baseUrl: CARREFOUR_CONFIG.baseUrl,
      },
    );
  }

  protected async goToNextPage(page: Page, currentPageNum: number): Promise<{
    reachedEnd: boolean;
  }> {
    // Carrefour uses pagination with next button
    const nextButton = await page.$('button[aria-label="next"], a[rel="next"], .pagination .next');
    if (nextButton) {
      await nextButton.click();
      await page.waitForTimeout(2000);
      return { reachedEnd: false };
    }
    return { reachedEnd: true };
  }
}