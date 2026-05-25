import { BrowserContext } from "playwright";
import fs from "fs";
import path from "path";
import { QUICKMART_CONFIG } from "../config";
import { scopedLogger } from "../../../core/logger/logger";

const log = scopedLogger("quickmart:saveSession");

export async function saveSession(context: BrowserContext): Promise<void> {
  const targetPath = QUICKMART_CONFIG.sessionStoragePath;
  const dir = path.dirname(targetPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log.debug(`Created session directory: ${dir}`);
  }

  await context.storageState({ path: targetPath });

  // ── Patch: normalize domains to www ──────────────────────────────────────
  // Quickmart sets cookies on quickmart.co.ke but serves on www.quickmart.co.ke.
  // Playwright saves whatever the browser has — we normalize both so the
  // session works regardless of which subdomain the page loads on.
  const raw = JSON.parse(fs.readFileSync(targetPath, "utf-8"));

  // Patch cookies — add www-scoped duplicates for any non-www cookies
  const patched = raw.cookies.flatMap((c: any) => {
    if (c.domain === "quickmart.co.ke") {
      return [
        c,
        { ...c, domain: "www.quickmart.co.ke" },
      ];
    }
    return [c];
  });
  raw.cookies = patched;

  // Patch localStorage — duplicate non-www origin to www origin
  const nonWwwOrigin = raw.origins?.find(
    (o: any) => o.origin === "https://quickmart.co.ke",
  );
  const wwwOriginExists = raw.origins?.some(
    (o: any) => o.origin === "https://www.quickmart.co.ke",
  );
  if (nonWwwOrigin && !wwwOriginExists) {
    raw.origins.push({
      origin: "https://www.quickmart.co.ke",
      localStorage: nonWwwOrigin.localStorage,
    });
  }

  fs.writeFileSync(targetPath, JSON.stringify(raw, null, 2));
  log.info(`Session saved and normalized: ${targetPath}`);
}