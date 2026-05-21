import { SupermarketId } from "../supermarkets/base/types";
import { scopedLogger } from "../core/logger/logger";

const log = scopedLogger("extractPricing");

export interface ExtractedPricing {
  currentPrice: number | null;
  originalPrice: number | null;
  isOnOffer: boolean;
  isOutOfStock: boolean;
}

export function extractPricing(supermarket: SupermarketId, html: string): ExtractedPricing {
  switch (supermarket) {
    case "carrefour": return extractCarrefour(html);
    case "quickmart":  return extractQuickmart(html);
    case "naivas":     return extractNaivas(html);
    default:
      log.warn(`No pricing extractor for: ${supermarket}`);
      return empty();
  }
}

function parseKes(raw: string): number | null {
  const cleaned = raw
    .replace(/KES/gi, "")
    .replace(/&nbsp;/gi, "")
    .replace(/<!--.*?-->/gs, "")
    .replace(/,/g, "")
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function empty(): ExtractedPricing {
  return { currentPrice: null, originalPrice: null, isOnOffer: false, isOutOfStock: false };
}

// ── Carrefour ─────────────────────────────────────────────────────────────────
//
// Detail page has .force-ltr with split KES / integer / .00 divs
// If .force-ltr not found at all → not a product page → treat as no data, not OOS
// OOS only when page IS a product page but explicitly says out of stock
//
function extractCarrefour(html: string): ExtractedPricing {
  // First check: is this actually a product detail page?
  // Product pages always have force-ltr AND data-testid="productimage-container"
  const isProductPage =
    /force-ltr/i.test(html) ||
    /data-testid="productimage-container"/i.test(html) ||
    /data-testid="add-to-cart/i.test(html);

  if (!isProductPage) {
    // Not a product page at all — reconciler gave us a bad URL
    // Return null prices but NOT isOutOfStock — this is a data quality issue
    log.warn("Carrefour: not a product detail page — skipping");
    return { currentPrice: null, originalPrice: null, isOnOffer: false, isOutOfStock: false };
  }

  // Genuine OOS on a real product page
  const isOutOfStock =
    /out of stock/i.test(html) ||
    /data-testid="out-of-stock"/i.test(html) ||
    (!/data-testid="add-to-cart/i.test(html) && !/data-testid="add-to-cart-button"/i.test(html));

  // ── Current price from force-ltr block ────────────────────────────────────
  // Structure: KES div → integer div (text-xl or text-2xl) → decimal div (.ml-2xs)
  const integerMatch = html.match(
    /force-ltr[^>]*>[\s\S]{0,150}?<div[^>]*(?:text-xl|text-2xl)[^>]*>([\d,]+)<\/div>/i,
  );
  const decimalMatch = html.match(
    /force-ltr[^>]*>[\s\S]{0,300}?<div[^>]*ml-2xs[^>]*>\.(?:<!--.*?-->)*(\d{2})<\/div>/i,
  );

  let currentPrice: number | null = null;
  if (integerMatch) {
    const integer = integerMatch[1].replace(/,/g, "");
    const decimal = decimalMatch?.[1] ?? "00";
    currentPrice = parseFloat(`${integer}.${decimal}`);
  }

  // ── Original price — line-through div (only present on offer) ────────────
  // From real HTML: <div class="... line-through">KES<!-- --> <!-- -->990.00</div>
  // Must be a div-level element, not a span — prevents false matches
  const strikethroughMatch = html.match(
    /<div[^>]*class="[^"]*line-through[^"]*"[^>]*>\s*KES(?:<!--.*?-->|\s|&nbsp;)*([\d,]+(?:\.\d{2})?)\s*<\/div>/is,
  );
  const originalPrice = strikethroughMatch
    ? parseFloat(strikethroughMatch[1].replace(/,/g, ""))
    : null;

  const isOnOffer =
    originalPrice !== null && currentPrice !== null && originalPrice > currentPrice;

  return {
    currentPrice,
    originalPrice: isOnOffer ? originalPrice : null,
    isOnOffer,
    isOutOfStock,
  };
}

// ── Quickmart ─────────────────────────────────────────────────────────────────
//
// No offer:   <span class="products-price-new">KES 410.00</span>
// With offer: above + <del class="products-price-old">KES 80.00</del>
//
function extractQuickmart(html: string): ExtractedPricing {
  const isOutOfStock =
    /out of stock/i.test(html) ||
    /data-stock="0"/i.test(html) ||
    !/add-to-cart--js/i.test(html);

  const currentMatch = html.match(
    /class="products-price-new"[^>]*>\s*KES\s*([\d,]+(?:\.\d{2})?)/i,
  );
  const currentPrice = currentMatch
    ? parseFloat(currentMatch[1].replace(/,/g, ""))
    : null;

  const originalMatch = html.match(
    /<del[^>]*class="[^"]*products-price-old[^"]*"[^>]*>\s*KES\s*([\d,]+(?:\.\d{2})?)/i,
  );
  const originalPrice = originalMatch
    ? parseFloat(originalMatch[1].replace(/,/g, ""))
    : null;

  const isOnOffer =
    originalPrice !== null && currentPrice !== null && originalPrice > currentPrice;

  return {
    currentPrice,
    originalPrice: isOnOffer ? originalPrice : null,
    isOnOffer,
    isOutOfStock,
  };
}

// ── Naivas ────────────────────────────────────────────────────────────────────
//
// CRITICAL STRUCTURE DISTINCTION:
//
// No offer — price lives inside .product-price:
//   <div class="product-price">
//     <p ...><span class="font-bold text-naivas-green ...">KES&nbsp;305</span></p>
//   </div>
//
// With offer — price lives inside the red offer banner:
//   <div class="rounded-lg border border-naivas-red ...">
//     ...
//     <span class="font-bold text-naivas-green ...">KES&nbsp;1,189</span>
//     <span class="text-red-600 ... line-through ..."> KES&nbsp;1,825 </span>
//   </div>
//
// Strategy:
// 1. Check for offer banner first (border-naivas-red block)
// 2. If offer banner exists → extract both current and original from within it
// 3. If no offer banner → extract from .product-price only
// This prevents any cross-contamination between price contexts
//
function extractNaivas(html: string): ExtractedPricing {
  const isOutOfStock =
    /out of stock/i.test(html) ||
    !/in stock/i.test(html);

  // ── Check for offer banner ────────────────────────────────────────────────
  // The red banner has a very specific structure: border-naivas-red + "On Offer" text
  const offerBannerMatch = html.match(
    /border-naivas-red[\s\S]{0,2000}?On Offer[\s\S]{0,2000}?(?=<\/div>\s*<div[^>]*text-xs[^>]*font-semibold)/i,
  );

  if (offerBannerMatch) {
    const bannerHtml = offerBannerMatch[0];

    // Current price — green bold span inside banner
    const currentMatch = bannerHtml.match(
      /class="[^"]*font-bold[^"]*text-naivas-green[^"]*"[^>]*>KES(?:&nbsp;|\s)*([\d,]+)/i,
    ) ?? bannerHtml.match(
      /class="[^"]*text-naivas-green[^"]*font-bold[^"]*"[^>]*>KES(?:&nbsp;|\s)*([\d,]+)/i,
    );

    // Original price — red line-through span inside banner
    const originalMatch = bannerHtml.match(
      /class="[^"]*text-red-600[^"]*line-through[^"]*"[^>]*>\s*KES(?:&nbsp;|\s)*([\d,]+)/i,
    ) ?? bannerHtml.match(
      /class="[^"]*line-through[^"]*text-red-600[^"]*"[^>]*>\s*KES(?:&nbsp;|\s)*([\d,]+)/i,
    );

    const currentPrice = currentMatch
      ? parseFloat(currentMatch[1].replace(/,/g, ""))
      : null;
    const originalPrice = originalMatch
      ? parseFloat(originalMatch[1].replace(/,/g, ""))
      : null;

    const isOnOffer =
      currentPrice !== null && originalPrice !== null && originalPrice > currentPrice;

    return {
      currentPrice,
      originalPrice: isOnOffer ? originalPrice : null,
      isOnOffer,
      isOutOfStock,
    };
  }

  // ── No offer — extract from .product-price div only ───────────────────────
  // Scope extraction to inside the product-price container
  const productPriceBlock = html.match(
    /class="product-price"[^>]*>([\s\S]{0,500}?)<\/div>/i,
  );

  const searchScope = productPriceBlock?.[1] ?? html;

  const currentMatch = searchScope.match(
    /class="[^"]*font-bold[^"]*text-naivas-green[^"]*"[^>]*>KES(?:&nbsp;|\s)*([\d,]+)/i,
  ) ?? searchScope.match(
    /class="[^"]*text-naivas-green[^"]*font-bold[^"]*"[^>]*>KES(?:&nbsp;|\s)*([\d,]+)/i,
  );

  const currentPrice = currentMatch
    ? parseFloat(currentMatch[1].replace(/,/g, ""))
    : null;

  return {
    currentPrice,
    originalPrice: null,
    isOnOffer: false,
    isOutOfStock,
  };
}