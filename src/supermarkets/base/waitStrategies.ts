import { Page } from "playwright";
import { scopedLogger } from "../../core/logger/logger";
import { sleep } from "../../core/retries/retry";

const log = scopedLogger("waitStrategies");

/**
 * Waits for at least `minCount` product cards to appear.
 * Falls back to a fixed timeout if they never appear.
 */
export async function waitForProductsToLoad(
  page: Page,
  productSelector: string,
  minCount = 1,
  timeoutMs = 10_000,
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const count = await page.locator(productSelector).count();
    if (count >= minCount) {
      log.debug(`Products loaded: ${count} cards found`);
      return true;
    }
    await sleep(300);
  }

  log.warn(`waitForProductsToLoad timed out after ${timeoutMs}ms`);
  return false;
}

/**
 * Waits for DOM mutations on a container — useful after search submit
 * when the results container re-renders.
 */
export async function waitForDOMMutation(
  page: Page,
  containerSelector: string,
  timeoutMs = 15_000,
): Promise<void> {
  await page
    .waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.children.length > 0;
      },
      containerSelector,
      { timeout: timeoutMs },
    )
    .catch(() => {
      log.warn(`waitForDOMMutation timed out for: ${containerSelector}`);
    });
}