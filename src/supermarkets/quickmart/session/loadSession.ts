import fs from "fs";
import { QUICKMART_CONFIG } from "../config";
import { scopedLogger } from "../../../core/logger/logger";

const log = scopedLogger("quickmart:loadSession");

export interface SessionLoadResult {
  exists: boolean;
  path: string;
  ageMs?: number;
}

const MAX_SESSION_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Checks whether a valid, non-stale session file exists.
 * Returns path for use in browser context options.
 */
export function loadSession(): SessionLoadResult {
  const p = QUICKMART_CONFIG.sessionStoragePath;

  if (!fs.existsSync(p)) {
    log.info("No session file found");
    return { exists: false, path: p };
  }

  const stat = fs.statSync(p);
  const ageMs = Date.now() - stat.mtimeMs;

  if (ageMs > MAX_SESSION_AGE_MS) {
    log.warn(`Session expired (age: ${Math.round(ageMs / 60_000)}min) — will re-authenticate`);
    fs.unlinkSync(p);
    return { exists: false, path: p };
  }

  log.info(`Valid session found (age: ${Math.round(ageMs / 60_000)}min)`);
  return { exists: true, path: p, ageMs };
}
