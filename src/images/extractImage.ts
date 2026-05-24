import { SupermarketId } from "../supermarkets/base/types";
import { scopedLogger } from "../core/logger/logger";

const log = scopedLogger("extractImage");

/**
 * Extracts image URL from raw HTML per supermarket DOM rules.
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
// Primary:  img[data-nimg="1"] src attribute
// Fallback: any src containing cdn.mafrservices.com
function extractCarrefourImage(html: string): string | null {
  // data-nimg="1" primary
  const dataNimg = html.match(/<img[^>]+data-nimg="1"[^>]+src="([^"]+)"/i)
    ?? html.match(/<img[^>]+src="([^"]+)"[^>]+data-nimg="1"/i);

  if (dataNimg?.[1]) return dataNimg[1];

  // CDN fallback
  const cdnMatch = html.match(/https:\/\/cdn\.mafrservices\.com\/[^\s"']+/i);
  if (cdnMatch?.[0]) return cdnMatch[0];

  return null;
}

// ── Quickmart ──────────────────────────────────────────────────────────────────
// From .main-img-slider img src
// CDN pattern: https://cfn.quickmart.co.ke/resized/...
function extractQuickmartImage(html: string): string | null {
  // Look for img inside main-img-slider
  const sliderBlock = html.match(/main-img-slider[\s\S]*?<img[^>]+src="([^"]+)"/i);
  if (sliderBlock?.[1]) return sliderBlock[1];

  // Direct CDN URL fallback
  const cdnMatch = html.match(/https:\/\/cfn\.quickmart\.co\.ke\/[^\s"']+/i);
  if (cdnMatch?.[0]) return cdnMatch[0];

  return null;
}

// ── Naivas ─────────────────────────────────────────────────────────────────────
// From img x-ref="mainImage" — check data-zoom first, then src
// CDN pattern: https://d16zmt6hgq1jhj.cloudfront.net/...
function extractNaivasImage(html: string): string | null {
  // x-ref="mainImage" with data-zoom
  const zoomMatch = html.match(/<img[^>]+x-ref="mainImage"[^>]+data-zoom="([^"]+)"/i)
    ?? html.match(/<img[^>]+data-zoom="([^"]+)"[^>]+x-ref="mainImage"/i);

  if (zoomMatch?.[1]) return zoomMatch[1];

  // x-ref="mainImage" src fallback
  const srcMatch = html.match(/<img[^>]+x-ref="mainImage"[^>]+src="([^"]+)"/i)
    ?? html.match(/<img[^>]+src="([^"]+)"[^>]+x-ref="mainImage"/i);

  if (srcMatch?.[1]) return srcMatch[1];

  // CloudFront CDN fallback
  const cdnMatch = html.match(/https:\/\/d16zmt6hgq1jhj\.cloudfront\.net\/[^\s"']+/i);
  if (cdnMatch?.[0]) return cdnMatch[0];

  return null;
}