import { Page, Locator } from "playwright";
import { withRetry } from "../retries/retry";
import { scopedLogger } from "../logger/logger";

const log = scopedLogger("safeClick");

export interface SafeClickOptions {
  timeout?: number;
  retries?: number;
  waitAfterMs?: number;
}

/**
 * Waits for a selector to be visible and clicks it.
 * Retries on transient failures (element detached, timeout, etc.)
 */
export async function safeClick(
  page: Page,
  selector: string,
  opts: SafeClickOptions = {},
): Promise<void> {
  const { timeout = 10_000, retries = 3, waitAfterMs = 0 } = opts;

  await withRetry(
    async () => {
      const el = page.locator(selector).first();
      await el.waitFor({ state: "visible", timeout });
      await el.click();
      if (waitAfterMs > 0) {
        await page.waitForTimeout(waitAfterMs);
      }
    },
    { maxAttempts: retries, delayMs: 800 },
    `safeClick(${selector})`,
  );

  log.debug(`Clicked: ${selector}`);
}

/**
 * Clicks a Playwright Locator directly (when selector already resolved).
 */
export async function safeClickLocator(
  locator: Locator,
  label = "locator",
  opts: SafeClickOptions = {},
): Promise<void> {
  const { timeout = 10_000, retries = 3, waitAfterMs = 0 } = opts;

  await withRetry(
    async () => {
      await locator.waitFor({ state: "visible", timeout });
      await locator.click();
      if (waitAfterMs > 0) {
        await locator.page().waitForTimeout(waitAfterMs);
      }
    },
    { maxAttempts: retries, delayMs: 800 },
    `safeClickLocator(${label})`,
  );

  log.debug(`Clicked locator: ${label}`);
}
