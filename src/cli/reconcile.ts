/**
 * CLI: npm run reconcile
 *
 * Usage:
 *   npm run reconcile
 *   npm run reconcile -- --input output/canonical-2025-....json
 *   npm run reconcile -- --input <path> --headful
 *   npm run reconcile -- --supermarkets carrefour,naivas
 */

require('dotenv').config()
import path from "path";
import fs from "fs";
import { launchBrowser } from "../core/browser/browser";
import { getScraper } from "../supermarkets/registry";
import { reconcileProduct } from "../reconciliation/reconciliationEngine";
import { CanonicalProduct } from "../types/canonical";
import { CandidateProduct, SupermarketId } from "../supermarkets/base/types";
import { logger } from "../core/logger/logger";
import { similarityEngine } from "../reconciliation/similarity";


const CONVEX_HTTP_URL = process.env.CONVEX_HTTP_URL;

// ── Args ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const headful = args.includes("--headful");

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const inputArg = getArg("--input");
const supersArg = getArg("--supermarkets");

const SUPERMARKETS: SupermarketId[] = supersArg
  ? (supersArg.split(",").map((s) => s.trim()) as SupermarketId[])
  : ["carrefour", "naivas"];

// ── Resolve input file ─────────────────────────────────────────────────────────
function resolveInputFile(): string {
  if (inputArg) return path.resolve(inputArg);

  const outputDir = path.resolve(process.cwd(), "output");
  const files = fs
    .readdirSync(outputDir)
    .filter((f) => f.startsWith("canonical-") && f.endsWith(".json"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(outputDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) throw new Error("No canonical JSON found in output/. Run discovery first.");

  const resolved = path.join(outputDir, files[0].name);
  logger.info(`Auto-selected input: ${files[0].name}`);
  return resolved;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  logger.info("═══════════════════════════════════════════════");
  logger.info("  Chekibei — Reconciliation Engine");
  logger.info("═══════════════════════════════════════════════");

  if (!CONVEX_HTTP_URL) throw new Error("CONVEX_HTTP_URL not set");
  await similarityEngine.init(CONVEX_HTTP_URL);

  const inputFile = resolveInputFile();
  const canonicalProducts: CanonicalProduct[] = JSON.parse(
    fs.readFileSync(inputFile, "utf-8"),
  );

  logger.info(`Loaded ${canonicalProducts.length} canonical products from: ${inputFile}`);
  logger.info(`Target supermarkets: ${SUPERMARKETS.join(", ")}`);

  const browserSession = await launchBrowser({ headless: !headful, blockImages: false });
  const updatedProducts: CanonicalProduct[] = [];
  const stats = { matched: 0, unmatched: 0, errors: 0 };

  try {
    for (const canonical of canonicalProducts) {
      logger.info(`Reconciling: "${canonical.displayName}"`);

      const candidatesBySuper: Partial<Record<SupermarketId, CandidateProduct[]>> = {};

      // ── Scrape each supermarket for this product ───────────────────────────
      for (const supermarket of SUPERMARKETS) {
        const scraper = getScraper(supermarket);
        const page = await browserSession.context.newPage();

        try {
          const result = await scraper.scrape(page, {
            searchQuery: canonical.displayName,
            maxScrolls: 5,          
            waitTime: 5_500,
          });

          candidatesBySuper[supermarket] = result.candidates;

          logger.debug(
            `  ${supermarket}: ${result.candidates.length} candidates` +
              (result.errors.length ? ` (${result.errors.length} errors)` : ""),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`  Scrape failed for ${supermarket}`, { error: msg });
          stats.errors++;
        } finally {
          await page.close().catch(() => {});
        }
      }

      // ── Run reconciliation ─────────────────────────────────────────────────
      const result = reconcileProduct(canonical, candidatesBySuper);

      const hadMatches = result.matches.length > 0;
      hadMatches ? stats.matched++ : stats.unmatched++;

      // ── Produce updated canonical product ─────────────────────────────────
      const updated: CanonicalProduct = {
        ...canonical,
        supermarkets: result.updatedSupermarkets,
        lastSeenAt: new Date().toISOString(),
      };

      updatedProducts.push(updated);

      logger.info(
        `${hadMatches ? "✓" : "✗"} ${result.matches.map((m) => `${m.supermarket}(${m.score.toFixed(2)})`).join(", ") || "no matches"}`
      );
    }
  } finally {
    await browserSession.close();
  }

  // ── Save output ────────────────────────────────────────────────────────────
  printSummary(stats, canonicalProducts.length);
  await saveOutput(updatedProducts);
}

// ── Summary ────────────────────────────────────────────────────────────────────
function printSummary(
  stats: { matched: number; unmatched: number; errors: number },
  total: number,
) {
  logger.info("═══════════════════════════════════════════════");
  logger.info("  RECONCILIATION COMPLETE");
  logger.info("═══════════════════════════════════════════════");
  logger.info(`  Total:     ${total}`);
  logger.info(`  Matched:   ${stats.matched}`);
  logger.info(`  Unmatched: ${stats.unmatched}`);
  logger.info(`  Errors:    ${stats.errors}`);
}

// ── Save ───────────────────────────────────────────────────────────────────────
async function pushToConvex(endpoint: string, payload: CanonicalProduct[]): Promise<void> {
  if (!CONVEX_HTTP_URL) {
    logger.warn("CONVEX_HTTP_URL not set — skipping push");
    return;
  }

  const url = `${CONVEX_HTTP_URL}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex push to ${endpoint} failed (${res.status}): ${text}`);
  }

  const result = await res.json();
  logger.info(`Convex push result: ${JSON.stringify(result)}`);
}

async function saveOutput(products: CanonicalProduct[]) {
  const outputDir = path.resolve(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outputDir, `canonical-reconciled-${timestamp}.json`);

  fs.writeFileSync(outPath, JSON.stringify(products, null, 2));
  logger.info(`Saved: ${outPath} (${products.length} products)`);

  try {
    await pushToConvex("/push/canonical", products);
  } catch (e) {
    logger.error(`Failed to push reconciled products to Convex: ${e}`);
  }
}

// ── Run ────────────────────────────────────────────────────────────────────────
main().catch((err) => {
  logger.error("Fatal error in reconcile CLI", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});