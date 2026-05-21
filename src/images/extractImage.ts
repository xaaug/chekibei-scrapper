import { SupermarketId } from "../supermarkets/base/types";
import { scopedLogger } from "../core/logger/logger";

const log = scopedLogger("extractImage");

export function extractImage(supermarket: SupermarketId, html: string): string | null {
  switch (supermarket) {
    case "carrefour": return extractCarrefourImage(html);
    case "quickmart": return extractQuickmartImage(html);
    case "naivas":    return extractNaivasImage(html);
    default:
      log.warn(`No image extractor for: ${supermarket}`);
      return null;
  }
}

// ── Carrefour ──────────────────────────────────────────────────────────────────
// Target: <img ... fetchpriority="high" data-nimg="1" ... src="https://cdn.mafrservices.com/...">
// The high-res main image always has fetchpriority="high" — thumbnails do not.
function extractCarrefourImage(html: string): string | null {
  // Primary: fetchpriority="high" + data-nimg="1" — the main product image
  const highPriority =
    html.match(/<img[^>]+fetchpriority="high"[^>]+data-nimg="1"[^>]+src="([^"]+)"/i) ??
    html.match(/<img[^>]+data-nimg="1"[^>]+fetchpriority="high"[^>]+src="([^"]+)"/i) ??
    html.match(/<img[^>]+src="([^"]+)"[^>]+fetchpriority="high"[^>]+data-nimg="1"/i);

  if (highPriority?.[1]) return decodeHtmlEntities(highPriority[1]);

  // Fallback: any data-nimg="1" src
  const anyNimg = html.match(/<img[^>]+data-nimg="1"[^>]+src="([^"]+)"/i) ??
                  html.match(/<img[^>]+src="([^"]+)"[^>]+data-nimg="1"/i);

  if (anyNimg?.[1]) return decodeHtmlEntities(anyNimg[1]);

  // CDN fallback
  const cdn = html.match(/(https:\/\/cdn\.mafrservices\.com\/[^\s"'?]+(?:\?[^\s"']*)?)/i);
  return cdn?.[1] ?? null;
}

// ── Quickmart ──────────────────────────────────────────────────────────────────
// Target: inside .main-img-slider, the slick-current <a> contains <img src="...">
// The href on the <a> is the full-res URL — prefer that over the img src (same in practice)
function extractQuickmartImage(html: string): string | null {
  // slick-current anchor href — full resolution
  const slickHref = html.match(/slick-current[^>]*href="([^"]+cfn\.quickmart\.co\.ke[^"]+)"/i) ??
                    html.match(/href="(https:\/\/cfn\.quickmart\.co\.ke\/[^"]+)"[^>]*slick-current/i);

  if (slickHref?.[1]) return decodeHtmlEntities(slickHref[1]);

  // img src inside main-img-slider
  const sliderImg = html.match(/main-img-slider[\s\S]{0,500}?<img[^>]+src="(https:\/\/cfn\.quickmart\.co\.ke\/[^"]+)"/i);
  if (sliderImg?.[1]) return decodeHtmlEntities(sliderImg[1]);

  // Any cfn.quickmart.co.ke URL
  const cdn = html.match(/(https:\/\/cfn\.quickmart\.co\.ke\/[^\s"']+)/i);
  return cdn?.[1] ?? null;
}

// ── Naivas ─────────────────────────────────────────────────────────────────────
// Target: <img x-ref="mainImage" data-zoom="https://d16zmt6hgq1jhj..." src="...">
// data-zoom is full resolution — always prefer it over src
function extractNaivasImage(html: string): string | null {
  // data-zoom on x-ref="mainImage" — highest resolution
  const zoom =
    html.match(/<img[^>]+x-ref="mainImage"[^>]+data-zoom="([^"]+)"/i) ??
    html.match(/<img[^>]+data-zoom="([^"]+)"[^>]+x-ref="mainImage"/i);

  if (zoom?.[1]) return decodeHtmlEntities(zoom[1]);

  // src on x-ref="mainImage"
  const src =
    html.match(/<img[^>]+x-ref="mainImage"[^>]+src="([^"]+)"/i) ??
    html.match(/<img[^>]+src="([^"]+)"[^>]+x-ref="mainImage"/i);

  if (src?.[1] && !src[1].includes("placeholder")) return decodeHtmlEntities(src[1]);

  // CloudFront CDN fallback
  const cdn = html.match(/(https:\/\/d16zmt6hgq1jhj\.cloudfront\.net\/[^\s"']+)/i);
  return cdn?.[1] ?? null;
}

function decodeHtmlEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}