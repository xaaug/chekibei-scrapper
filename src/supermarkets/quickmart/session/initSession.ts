import { BrowserContext, Page } from "playwright";
import { loadSession } from "./loadSession";
import { saveSession } from "./saveSession";
import { setupLocation } from "./setupLocation";
import { QUICKMART_CONFIG } from "../config";
import { scopedLogger } from "../../../core/logger/logger";

const log = scopedLogger("quickmart:initSession");

export interface InitSessionResult {
  page: Page;
  sessionWasNew: boolean;
}

/**
 * Initialises a Quickmart session:
 *
 * - If a valid session exists on disk, the browser context was already
 *   loaded with it (via `launchBrowser`), so we just open a page.
 * - If no valid session exists, we navigate to the homepage and run
 *   the full location setup flow, then persist the session.
 *
 * `context` must have been created with `storageState` if a session existed.
 */
export async function initSession(context: BrowserContext): Promise<InitSessionResult> {
  const sessionInfo = loadSession();
  const page = await context.newPage();

  if (sessionInfo.exists) {
    log.info("Reusing existing session — skipping location setup");

    // Verify session is functional by loading homepage
    await page.goto(QUICKMART_CONFIG.baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: QUICKMART_CONFIG.navigation.pageLoadTimeoutMs,
    });

    const needsSetup = await page
      .locator(`#locationInfoBox.modal`)
      .isVisible()
      .catch(() => false);

    if (needsSetup) {
      log.warn("Session exists but location modal appeared — re-running setup");
      await setupLocation(page);
      await saveSession(context);
    }

    return { page, sessionWasNew: false };
  }

  // ── Fresh session: navigate and run location flow ────────────────────────────
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
