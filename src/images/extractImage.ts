import { SupermarketId } from "../supermarkets/base/types";
import { scopedLogger } from "../core/logger/logger";

const log = scopedLogger("extractImage");

/**
 * Extracts image URL from raw HTML per supermarket DOM rules.
 * Tries multiple selectors/patterns and returns the first match.
 * All selectors are evaluated against the HTML string — no live page needed.
 */
export function extractImage(
  supermarket: SupermarketId,
  html: string,
): string | null {
  switch (supermarket) {
    case "carrefour":   return extractCarrefourImage(html);
    case "quickmart":   return extractQuickmartImage(html);
    case "naivas":      return extractNaivasImage(html);
    default:
      log.warn(`No image extractor for supermarket: ${supermarket}`);
      return null;
  }
}

// ── Carrefour ──────────────────────────────────────────────────────────────────
// Try multiple selectors/patterns in order of preference
function extractCarrefourImage(html: string): string | null {
  const selectors = [
    // Primary:  img[data-nimg="1"] src attribute
    /<img[^>]+data-nimg="1"[^>]+src="([^"]+)"/i,
    /<img[^>]+src="([^"]+)"[^>]+data-nimg="1"/i,
    // Fallbacks
    /<img[^>]+(?:data-src|data-lazy|src)=["']([^"'\s]+)["'][^>]*\b(?:class*=.*?cdn\.mafrservices\.com|src*=.*?cdn\.mafrservices\.com)[^>]*>/i,
    /https:\/\/cdn\.mafrservices\.com\/[^\s"']+/i,
    // General image with CDN hint
    /<img[^>]+src=["']([^"'\s]*cdn\.mafrservices\.com[^"'\s]*)["']/i,
  ];

  for (const pattern of selectors) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    } else if (match?.[0] && !match[1]) {
      // Handle patterns that return the full match
      return match[0];
    }
  }

  return null;
}

// ── Quickmart ──────────────────────────────────────────────────────────────────
function extractQuickmartImage(html: string): string | null {
  const selectors = [
    // Look for img inside main-img-slider
    /main-img-slider[\s\S]*?<img[^>]+src="([^"]+)"/i,
    // Direct CDN URL fallback
    /https:\/\/cfn\.quickmart\.co\.ke\/[^\s"']+/i,
    // General image patterns
    /<img[^>]+(?:data-src|data-lazy|src)=["']([^"'\s]+)["'][^>]*\b(?:class*=.*?cfn\.quickmart\.co\.ke|src*=.*?cfn\.quickmart\.co\.ke)[^>]*>/i,
    /<img[^>]+src=["']([^"'\s]*\.quickmart\.co\.ke[^"'\s]*)["']/i,
  ];

  for (const pattern of selectors) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    } else if (match?.[0] && !match[1]) {
      return match[0];
    }
  }

  return null;
}

// ── Naivas ─────────────────────────────────────────────────────────────────────
function extractNaivasImage(html: string): string | null {
  const selectors = [
    // x-ref="mainImage" with data-zoom
    /<img[^>]+x-ref="mainImage"[^>]+data-zoom="([^"]+)"/i,
    /<img[^>]+data-zoom="([^"]+)"[^>]+x-ref="mainImage"/i,
    // x-ref="mainImage" src fallback
    /<img[^>]+x-ref="mainImage"[^>]+src="([^"]+)"/i,
    /<img[^>]+src="([^"]+)"[^>]+x-ref="mainImage"/i,
    // CloudFront CDN fallback
    /https:\/\/d16zmt6hgq1jhj\.cloudfront\.net\/[^\s"']+/i,
    // General image patterns
    /<img[^>]+(?:data-src|data-lazy|src)=["']([^"'\s]+)["'][^>]*\b(?:class*=.*?cloudfront\.net|src*=.*?cloudfront\.net)[^>]*>/i,
    /<img[^>]+src=["']([^"'\s]*cloudfront\.net[^"'\s]*)["']/i,
  ];

  for (const pattern of selectors) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    } else if (match?.[0] && !match[1]) {
      return match[0];
    }
  }

  return null;
}