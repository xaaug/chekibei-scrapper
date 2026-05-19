import { Page } from "playwright";
import { scopedLogger } from "../logger/logger";

const log = scopedLogger("waitForStableDOM");

export interface StableDOMOptions {
  /** How long DOM must stay unchanged before we declare it stable (ms) */
  stabilityWindowMs?: number;
  /** Maximum time to wait overall before giving up (ms) */
  timeoutMs?: number;
  /** Polling interval between DOM snapshots (ms) */
  pollIntervalMs?: number;
}

/**
 * Waits until the outer HTML of `watchSelector` stops changing for
 * `stabilityWindowMs` milliseconds. Useful after JS-driven pagination
 * where no network request indicates completion.
 */
export async function waitForStableDOM(
  page: Page,
  watchSelector: string,
  opts: StableDOMOptions = {},
): Promise<void> {
  const {
    stabilityWindowMs = 600,
    timeoutMs = 15_000,
    pollIntervalMs = 200,
  } = opts;

  const start = Date.now();
  let lastSnapshot = "";
  let stableSince = Date.now();

  log.debug(`Waiting for stable DOM: ${watchSelector}`);

  while (Date.now() - start < timeoutMs) {
    const snapshot = await page
      .locator(watchSelector)
      .first()
      .evaluate((el) => el.outerHTML)
      .catch(() => "");

    if (snapshot !== lastSnapshot) {
      lastSnapshot = snapshot;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= stabilityWindowMs) {
      log.debug(`DOM stable after ${Date.now() - start}ms`);
      return;
    }

    await page.waitForTimeout(pollIntervalMs);
  }

  log.warn(`waitForStableDOM timed out after ${timeoutMs}ms — proceeding anyway`);
}
