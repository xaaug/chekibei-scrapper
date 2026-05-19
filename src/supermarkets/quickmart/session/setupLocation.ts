import { Page } from "playwright";
import { QUICKMART_SELECTORS } from "../selectors";
import { QUICKMART_CONFIG } from "../config";
import { safeClick } from "../../../core/dom/safeClick";
import { safeType } from "../../../core/dom/safeType";
import { waitForStableDOM } from "../../../core/dom/waitForStableDOM";
import { scopedLogger } from "../../../core/logger/logger";

const log = scopedLogger("quickmart:setupLocation");

/**
 * Handles the Quickmart location selection flow:
 *
 * 1. Wait for location modal
 * 2. Type "Kakamega" into the geo input
 * 3. Wait for autocomplete, then select first suggestion via ArrowDown + Enter
 * 4. Wait for branch confirmation modal
 * 5. Verify branch name matches expected
 * 6. Click Continue
 */
export async function setupLocation(page: Page): Promise<void> {
  const { location, navigation } = QUICKMART_CONFIG;
  const timeout = navigation.actionTimeoutMs;

  log.info("Starting location setup flow");

  // ── Step 1: Wait for the location modal ─────────────────────────────────────
  try {
    await page.waitForSelector(QUICKMART_SELECTORS.locationModal, {
      state: "visible",
      timeout,
    });
    log.debug("Location modal visible");
  } catch {
    // Modal may not appear if cookies already set — check for branch modal next
    log.warn("Location modal did not appear — checking if already located");
    const alreadyLocated = await page
      .locator(QUICKMART_SELECTORS.branchModalBody)
      .isVisible()
      .catch(() => false);

    if (!alreadyLocated) {
      log.warn("Neither modal appeared — proceeding without location setup");
      return;
    }
  }

  // ── Step 2: Type location into input ────────────────────────────────────────
  await safeType(page, QUICKMART_SELECTORS.locationInput, location.query, {
    clearFirst: true,
    delayBetweenKeys: 100,
  });

  log.debug(`Typed location: ${location.query}`);

  // ── Step 3: Wait for autocomplete and select first result ───────────────────
  // Wait for suggestions to appear (Google Places or custom autocomplete)
  await page
    .waitForSelector(QUICKMART_SELECTORS.locationAutocompleteDropdown, {
      state: "visible",
      timeout: 8_000,
    })
    .catch(() => {
      log.warn("Autocomplete dropdown not detected — attempting keyboard navigation anyway");
    });

  await page.waitForTimeout(500); // brief pause for suggestions to populate
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");

  log.debug("Selected first autocomplete suggestion");

  // ── Step 4: Wait for branch confirmation modal ───────────────────────────────
  await page
    .waitForSelector(QUICKMART_SELECTORS.branchModalBody, {
      state: "visible",
      timeout: 10_000,
    })
    .catch(() => {
      log.warn("Branch confirmation modal not visible — may have already been confirmed");
    });

  // ── Step 5: Verify branch ────────────────────────────────────────────────────
  const branchText = await page
    .locator(`${QUICKMART_SELECTORS.branchModalBody} h3`)
    .innerText()
    .catch(() => "");

  if (branchText && !branchText.includes(location.expectedBranch.split(" ")[1])) {
    log.warn(`Unexpected branch: "${branchText}" — expected to contain "${location.expectedBranch}"`);
  } else {
    log.info(`Branch confirmed: ${branchText || location.expectedBranch}`);
  }

  // ── Step 6: Click Continue ───────────────────────────────────────────────────
  await safeClick(page, QUICKMART_SELECTORS.branchContinueBtn, {
    timeout,
    waitAfterMs: 800,
  });

  log.debug("Clicked Continue on branch confirmation");

  // ── Step 7: Wait for DOM to stabilise after confirmation ────────────────────
  await waitForStableDOM(page, "body", {
    stabilityWindowMs: navigation.postClickStabilityMs,
    timeoutMs: 8_000,
  });

  log.info("Location setup complete");
}
