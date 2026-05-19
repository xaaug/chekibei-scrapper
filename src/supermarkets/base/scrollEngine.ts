import { Page } from "playwright";
import { scopedLogger } from "../../core/logger/logger";

const log = scopedLogger("scrollEngine");

export interface ScrollEngineOptions {
  maxScrolls: number;
  waitTime: number;
  productSelector: string;
}

export interface ScrollResult {
  scrollsPerformed: number;
  stoppedEarly: boolean;
  stopReason: "max_reached" | "no_new_products" | "no_height_change";
}

/**
 * Scrolls to bottom repeatedly, stopping when:
 * - max scrolls reached
 * - no new product cards appear after a scroll
 * - page height stops growing
 */
export async function runScrollEngine(
  page: Page,
  opts: ScrollEngineOptions,
): Promise<ScrollResult> {
  const { maxScrolls, waitTime, productSelector } = opts;

  let scrollsPerformed = 0;
  let previousHeight = 0;
  let previousProductCount = 0;

  log.debug("Starting scroll engine", { maxScrolls, waitTime });

  while (scrollsPerformed < maxScrolls) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    const currentProductCount = await page.locator(productSelector).count();

    // Stop: nothing changed since last scroll
    if (scrollsPerformed > 0) {
      if (currentHeight === previousHeight) {
        log.info(`Scroll stopped: page height unchanged at ${currentHeight}px`);
        return { scrollsPerformed, stoppedEarly: true, stopReason: "no_height_change" };
      }

      if (currentProductCount === previousProductCount) {
        log.info(`Scroll stopped: product count unchanged at ${currentProductCount}`);
        return { scrollsPerformed, stoppedEarly: true, stopReason: "no_new_products" };
      }
    }

    previousHeight = currentHeight;
    previousProductCount = currentProductCount;

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    scrollsPerformed++;

    log.debug(`Scroll ${scrollsPerformed}/${maxScrolls} — products: ${currentProductCount}`);

    await page.waitForTimeout(waitTime);
  }

  return { scrollsPerformed, stoppedEarly: false, stopReason: "max_reached" };
}