import { Page } from "playwright";
import { withRetry } from "../retries/retry";
import { scopedLogger } from "../logger/logger";

const log = scopedLogger("safeType");

export interface SafeTypeOptions {
  timeout?: number;
  retries?: number;
  clearFirst?: boolean;
  delayBetweenKeys?: number;
}

/**
 * Focuses an input, optionally clears it, then types text character by character.
 * Retries on detached-element and timeout errors.
 */
export async function safeType(
  page: Page,
  selector: string,
  text: string,
  opts: SafeTypeOptions = {},
): Promise<void> {
  const {
    timeout = 10_000,
    retries = 3,
    clearFirst = true,
    delayBetweenKeys = 80,
  } = opts;

  await withRetry(
    async () => {
      const el = page.locator(selector).first();
      await el.waitFor({ state: "visible", timeout });
      await el.click();

      if (clearFirst) {
        await el.fill("");
      }

      // Type character by character to trigger autocomplete JS listeners
      for (const char of text) {
        await el.type(char, { delay: delayBetweenKeys });
      }
    },
    { maxAttempts: retries, delayMs: 800 },
    `safeType(${selector})`,
  );

  log.debug(`Typed "${text}" into: ${selector}`);
}
