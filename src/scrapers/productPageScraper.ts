import { Page } from "playwright";
import { SupermarketId } from "../supermarkets/base/types";
import { extractPricing, ExtractedPricing } from "../pricing/extractPricing";
import { extractImage } from "../images/extractImage";
import { scopedLogger } from "../core/logger/logger";
import { withRetry, sleep } from "../core/retries/retry";

const log = scopedLogger("productPageScraper");

export interface LiveScrapedProduct {
  supermarket: SupermarketId;
  externalId: string;
  url: string;
  name: string;
  currentPrice: number | null;
  originalPrice: number | null;
  isOnOffer: boolean;
  isOutOfStock: boolean;
  imageUrl: string | null;
  scrapedAt: string;
}

export async function scrapeProductPage(
  page: Page,
  supermarket: SupermarketId,
  externalId: string,
  url: string,
): Promise<LiveScrapedProduct | null> {
  return withRetry(
    async () => {
      log.debug(`Scraping: ${supermarket} / ${url}`);

      const response = await page.goto(url, {
        waitUntil: "load",
        timeout: 45_000,
      });

      // ── Blank page / navigation failure detection ─────────────────────────
      const currentUrl = page.url();
      if (currentUrl === "about:blank" || currentUrl === "" || response === null) {
        throw new Error(`Page failed to load — landed on: ${currentUrl}`);
      }

      if (response && !response.ok() && response.status() !== 304) {
        throw new Error(`HTTP ${response.status()} for ${url}`);
      }

      // ── Quickmart: dismiss location modal before anything else ────────────
      if (supermarket === "quickmart") {
        await dismissQuickmartModal(page);
      }

      // ── Wait for price element ────────────────────────────────────────────
      const priceLoaded = await waitForPriceElement(page, supermarket);
      if (!priceLoaded) {
        log.warn(`Price element not detected for ${supermarket} — waiting extra 3s`);
        await sleep(3_000);
      }

      // ── Get full rendered HTML ────────────────────────────────────────────
      const html = await page.content();

      if (html.length < 500) {
        throw new Error(`Page content too short (${html.length} chars) — likely blank`);
      }

      // ── Extract everything from HTML ──────────────────────────────────────
      const pricing = extractPricing(supermarket, html);
      const imageUrl = extractImage(supermarket, html);
      const name = await extractProductName(page, supermarket);

      log.debug(`Extracted: price=${pricing.currentPrice} offer=${pricing.isOnOffer} oos=${pricing.isOutOfStock} image=${!!imageUrl}`);

      return {
        supermarket,
        externalId,
        url,
        name,
        currentPrice: pricing.currentPrice,
        originalPrice: pricing.originalPrice,
        isOnOffer: pricing.isOnOffer,
        isOutOfStock: pricing.isOutOfStock,
        imageUrl,
        scrapedAt: new Date().toISOString(),
      };
    },
    { maxAttempts: 2, delayMs: 3_000 },
    `scrapeProductPage(${supermarket}, ${url})`,
  ).catch((err) => {
    log.error(`Failed to scrape product page`, {
      supermarket,
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  });
}

// ── Wait for price element per supermarket ────────────────────────────────────

async function waitForPriceElement(
  page: Page,
  supermarket: SupermarketId,
): Promise<boolean> {
  try {
    switch (supermarket) {
      case "carrefour":
        await page.waitForSelector(".force-ltr", { state: "visible", timeout: 15_000 });
        break;

      case "quickmart":
        // Wait for price span — Slick slider must have initialised
        await page.waitForSelector(".products-price-new", {
          state: "visible",
          timeout: 20_000,
        });
        // Wait for slider image to be in DOM (non-fatal)
        await page
          .waitForSelector(".main-img-slider .slick-current", {
            state: "attached",
            timeout: 10_000,
          })
          .catch(() => {});
        break;

      case "naivas":
        // Wait for Livewire hydration first
        await page.waitForSelector("[wire\\:snapshot]", {
          state: "attached",
          timeout: 20_000,
        });
        // Then wait for the price element
        await page.waitForSelector(".text-naivas-green.font-bold", {
          state: "visible",
          timeout: 10_000,
        });
        break;
    }
    return true;
  } catch (err) {
    log.warn(`waitForPriceElement failed: ${supermarket} — ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

// ── Quickmart location modal dismissal ───────────────────────────────────────

async function dismissQuickmartModal(page: Page): Promise<void> {
  const modalVisible = await page
    .locator("#locationInfoBox.modal")
    .isVisible()
    .catch(() => false);

  if (!modalVisible) return;

  log.warn("Quickmart location modal appeared — dismissing");
  await page.keyboard.press("Escape");
  await sleep(500);

  const stillVisible = await page
    .locator("#locationInfoBox.modal")
    .isVisible()
    .catch(() => false);

  if (stillVisible) {
    await page
      .locator("#locationInfoBox .btn-close, #locationInfoBox [data-bs-dismiss='modal']")
      .first()
      .click()
      .catch(() => {});
    await sleep(500);
  }
}

// ── Product name ──────────────────────────────────────────────────────────────

async function extractProductName(
  page: Page,
  supermarket: SupermarketId,
): Promise<string> {
  const selectors: Record<SupermarketId, string> = {
    carrefour: "h1",
    quickmart:  "h1.product-title",
    naivas:     ".details .text-xl",
  };

  return page
    .locator(selectors[supermarket])
    .first()
    .innerText()
    .then((t) => t.trim())
    .catch(() => "");
}