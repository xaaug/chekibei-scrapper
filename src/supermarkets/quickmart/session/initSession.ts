import { BrowserContext, Page } from "playwright";
import { loadSession } from "./loadSession";
import { saveSession } from "./saveSession";
import { setupLocation } from "./setupLocation";
import { QUICKMART_CONFIG } from "../config";
import { QUICKMART_SELECTORS } from "../selectors";
import { safeClick } from "../../../core/dom/safeClick";
import { waitForStableDOM } from "../../../core/dom/waitForStableDOM";
import { scopedLogger } from "../../../core/logger/logger";

const log = scopedLogger("quickmart:initSession");

export interface InitSessionResult {
  page: Page;
  sessionWasNew: boolean;
}

export async function initSession(context: BrowserContext): Promise<InitSessionResult> {
  const sessionInfo = loadSession();
  const page = await context.newPage();

  if (sessionInfo.exists) {
    log.info("Reusing existing session — skipping location setup");

    await page.goto(QUICKMART_CONFIG.baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: QUICKMART_CONFIG.navigation.pageLoadTimeoutMs,
    });

    // Wait for page to fully settle — their JS router runs after domcontentloaded
    await page.waitForTimeout(2_000);

    const locationModalVisible = await page
      .locator(QUICKMART_SELECTORS.locationModal)
      .isVisible()
      .catch(() => false);

    if (locationModalVisible) {
      // Full re-setup needed — session cookies didn't carry location state
      log.warn("Location modal appeared on session restore — re-running full setup");
      await setupLocation(page);
      await saveSession(context);
      return { page, sessionWasNew: true };
    }

    // ── Check for branch confirmation modal ──────────────────────────────────
    // Their router shows this on homepage load even with a valid session.
    // Brand pages won't load until this is clicked through.
    const branchModalVisible = await page
      .locator(QUICKMART_SELECTORS.branchModalBody)
      .isVisible()
      .catch(() => false);

    if (branchModalVisible) {
      log.info("Branch confirmation modal present — clicking through");

      const branchText = await page
        .locator(`${QUICKMART_SELECTORS.branchModalBody} h3`)
        .innerText()
        .catch(() => "");

      log.info(`Branch: ${branchText || "unknown"}`);

      await safeClick(page, QUICKMART_SELECTORS.branchContinueBtn, {
        timeout: QUICKMART_CONFIG.navigation.actionTimeoutMs,
        waitAfterMs: 800,
      });

      await waitForStableDOM(page, "body", {
        stabilityWindowMs: QUICKMART_CONFIG.navigation.postClickStabilityMs,
        timeoutMs: 8_000,
      });

      log.info("Branch confirmation clicked — session ready");
    } else {
      log.info("No modals — session fully ready");
    }

    return { page, sessionWasNew: false };
  }

  // ── Fresh session ────────────────────────────────────────────────────────────
  log.info("Creating new session");

  await page.goto(QUICKMART_CONFIG.baseUrl, {
    waitUntil: "domcontentloaded",
    timeout: QUICKMART_CONFIG.navigation.pageLoadTimeoutMs,
  });

  await setupLocation(page);
  await saveSession(context);

  log.info("New session initialised and saved");

  return { page, sessionWasNew: true };
}