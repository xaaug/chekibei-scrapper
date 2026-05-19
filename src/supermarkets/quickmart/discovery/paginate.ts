import { Page } from "playwright";
import { QUICKMART_SELECTORS } from "../selectors";
import {
  snapshotProductFingerprint,
  waitForProductChange,
} from "../../../core/dom/waitForProductChange";
import { waitForStableDOM } from "../../../core/dom/waitForStableDOM";
import { scopedLogger } from "../../../core/logger/logger";

const log = scopedLogger("quickmart:paginate");

export interface PaginationResult {
  success: boolean;
  reachedEnd: boolean;
}

/**
 * Navigates to the next page using Quickmart's JS-driven pagination.
 *
 * Strategy:
 * 1. Snapshot the current product list fingerprint
 * 2. Click the "next" button
 * 3. Wait until product list changes OR timeout
 * 4. Wait for DOM stability
 *
 * Returns { success: false, reachedEnd: true } when no next button exists.
 */
export async function goToNextPage(
  page: Page,
  currentPage: number,
): Promise<PaginationResult> {
  // ── Check if next button exists and is enabled ───────────────────────────────
  const nextBtn = page.locator(QUICKMART_SELECTORS.paginationNextBtn).first();
  const btnExists = await nextBtn.count();

  if (!btnExists) {
    log.info(`No next button found — reached end at page ${currentPage}`);
    return { success: false, reachedEnd: true };
  }

  const isDisabled = await nextBtn
    .evaluate((el) => el.hasAttribute("disabled") || (el as HTMLButtonElement).disabled)
    .catch(() => false);

  if (isDisabled) {
    log.info(`Next button disabled — reached end at page ${currentPage}`);
    return { success: false, reachedEnd: true };
  }

  // ── Snapshot current state before clicking ───────────────────────────────────
  const previousFingerprint = await snapshotProductFingerprint(
    page,
    QUICKMART_SELECTORS.productCard,
  );

  log.debug(`Clicking next (page ${currentPage} → ${currentPage + 1})`);
  await nextBtn.click();

  // ── Wait for product list to change ─────────────────────────────────────────
  await waitForProductChange(page, {
    previousFingerprint,
    containerSelector: QUICKMART_SELECTORS.productCard,
    timeoutMs: 15_000,
    pollIntervalMs: 300,
  });

  // ── Wait for DOM to fully settle ─────────────────────────────────────────────
  await waitForStableDOM(page, QUICKMART_SELECTORS.productCard, {
    stabilityWindowMs: 500,
    timeoutMs: 10_000,
  });

  log.info(`Navigated to page ${currentPage + 1}`);

  return { success: true, reachedEnd: false };
}
