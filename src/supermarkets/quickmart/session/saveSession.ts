import { BrowserContext } from "playwright";
import fs from "fs";
import path from "path";
import { QUICKMART_CONFIG } from "../config";
import { scopedLogger } from "../../../core/logger/logger";

const log = scopedLogger("quickmart:saveSession");

/**
 * Persists the current browser context's storage state (cookies + localStorage)
 * to disk so subsequent runs can skip the location setup flow.
 */
export async function saveSession(context: BrowserContext): Promise<void> {
  const targetPath = QUICKMART_CONFIG.sessionStoragePath;
  const dir = path.dirname(targetPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log.debug(`Created session directory: ${dir}`);
  }

  await context.storageState({ path: targetPath });
  log.info(`Session saved: ${targetPath}`);
}
