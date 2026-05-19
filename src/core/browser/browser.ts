import { Browser, BrowserContext, chromium, Page } from "playwright";
import path from "path";
import fs from "fs";
import { scopedLogger } from "../logger/logger";

const log = scopedLogger("browser");

export interface BrowserConfig {
  headless?: boolean;
  slowMo?: number;
  storageStatePath?: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
  locale?: string;
  timezoneId?: string;
}

const DEFAULT_CONFIG: Required<Omit<BrowserConfig, "storageStatePath">> = {
  headless: true,
  slowMo: 0,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 900 },
  locale: "en-KE",
  timezoneId: "Africa/Nairobi",
};

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  newPage: () => Promise<Page>;
  close: () => Promise<void>;
}

/**
 * Launches Chromium with optional saved storage state (cookies + localStorage).
 * Returns a thin wrapper with a `newPage()` factory and `close()`.
 */
export async function launchBrowser(config: BrowserConfig = {}): Promise<BrowserSession> {
  const { headless, slowMo, storageStatePath, userAgent, viewport, locale, timezoneId } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  log.info("Launching browser", { headless });

  const browser = await chromium.launch({ headless, slowMo });

  const contextOpts: Parameters<Browser["newContext"]>[0] = {
    userAgent,
    viewport,
    locale,
    timezoneId,
    javaScriptEnabled: true,
    ignoreHTTPSErrors: false,
  };

  if (storageStatePath && fs.existsSync(storageStatePath)) {
    log.info(`Restoring session from: ${storageStatePath}`);
    contextOpts.storageState = storageStatePath;
  } else {
    log.info("No saved session found — starting fresh");
  }

  const context = await browser.newContext(contextOpts);

  // Intercept and block unnecessary resources to speed up scraping
  await context.route("**/*", (route) => {
    const resourceType = route.request().resourceType();
    if (["image", "media", "font"].includes(resourceType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  return {
    browser,
    context,
    newPage: () => context.newPage(),
    close: async () => {
      await context.close();
      await browser.close();
      log.info("Browser closed");
    },
  };
}
