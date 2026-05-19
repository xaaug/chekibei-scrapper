import { Page } from "playwright";
import { scopedLogger } from "../logger/logger";

const log = scopedLogger("waitForProductChange");

export interface ProductChangeOptions {
  /** Fingerprint of current product list before navigation */
  previousFingerprint: string;
  /** How long to wait for a change before timing out (ms) */
  timeoutMs?: number;
  /** Polling interval (ms) */
  pollIntervalMs?: number;
  /** Selector for product container list */
  containerSelector?: string;
}

/**
 * Produces a lightweight fingerprint of the current product list.
 * Based on the first 3 product IDs/titles — fast and deterministic.
 */
export async function snapshotProductFingerprint(
  page: Page,
  containerSelector = ".products.productInfoJs",
): Promise<string> {
  return page.evaluate((sel) => {
    const cards = Array.from(document.querySelectorAll(sel)).slice(0, 3);
    return cards
      .map((card) => {
        const id =
          (card.querySelector('input[name="selprod_id"]') as HTMLInputElement)
            ?.value ?? "";
        const name =
          (card.querySelector(".products-title") as HTMLElement)?.innerText?.trim() ?? "";
        return `${id}::${name}`;
      })
      .join("|");
  }, containerSelector);
}

/**
 * Waits until product list changes from the `previousFingerprint`.
 * Used after triggering JS pagination — avoids fixed sleeps.
 */
export async function waitForProductChange(
  page: Page,
  opts: ProductChangeOptions,
): Promise<void> {
  const {
    previousFingerprint,
    timeoutMs = 15_000,
    pollIntervalMs = 300,
    containerSelector = ".products.productInfoJs",
  } = opts;

  const start = Date.now();
  log.debug("Waiting for product list change...");

  while (Date.now() - start < timeoutMs) {
    const current = await snapshotProductFingerprint(page, containerSelector);

    if (current !== previousFingerprint && current.length > 0) {
      log.debug(`Product list changed after ${Date.now() - start}ms`);
      return;
    }

    await page.waitForTimeout(pollIntervalMs);
  }

  log.warn(`waitForProductChange timed out after ${timeoutMs}ms — products may not have changed`);
}
