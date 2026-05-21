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
    // ── Is this a product detail page? ───────────────────────────────────────
    // Product pages always have the image container AND the main force-ltr price block
    // force-ltr appears in FBT section too so check for productimage-container
    const isProductPage =
      /data-testid="productimage-container"/i.test(html) ||
      /data-testid="shareicon-cta"/i.test(html);
  
    if (!isProductPage) {
      log.warn("Carrefour: not a product detail page — URL needs fixing in canonical");
      return { currentPrice: null, originalPrice: null, isOnOffer: false, isOutOfStock: false };
    }
  
    // ── OOS detection ─────────────────────────────────────────────────────────
    // The main add-to-cart is data-testid="add-to-cart-button"
    // FBT section has data-testid="add-to-cart-fbt-button" — must NOT count as in-stock signal
    // "Only N left!" text confirms it IS a live product page
    const hasMainAddToCart = /data-testid="add-to-cart-button"/i.test(html);
    const hasOnlyNLeft = /only \d+ left/i.test(html);
    const hasExplicitOOS = /out of stock/i.test(html);
  
    const isOutOfStock = hasExplicitOOS || (!hasMainAddToCart && !hasOnlyNLeft);
  
    // ── Current price ─────────────────────────────────────────────────────────
    // The PRODUCT price block structure (not FBT):
    //
    //   <div class="flex items-baseline force-ltr" style="color: black;">
    //     <div class="text-sm ... mx-2xs ...">KES</div>
    //     <div class="text-xl leading-7 font-bold md:text-2xl">80</div>   ← ONLY text-xl on main price
    //     <div class="text-sm ... ml-2xs">.00</div>
    //   </div>
    //
    // FBT prices use text-sm for the integer, not text-xl — this is the discriminator.
    // We want the FIRST force-ltr block that contains text-xl.
  
    // Extract just the first force-ltr block containing text-xl (main product price)
    const mainPriceBlockMatch = html.match(
      /(<div[^>]*force-ltr[^>]*>(?:(?!force-ltr)[\s\S]){0,400}?text-xl[\s\S]{0,200}?<\/div>\s*<\/div>)/i,
    );
  
    let currentPrice: number | null = null;
  
    if (mainPriceBlockMatch) {
      const block = mainPriceBlockMatch[1];
  
      // Integer: the text-xl div
      const intMatch = block.match(/<div[^>]*text-xl[^>]*>([\d,]+)<\/div>/i);
      // Decimal: the ml-2xs div (contains ".00" or ".<!-- -->00")
      const decMatch = block.match(/<div[^>]*ml-2xs[^>]*>\.(?:<!--.*?-->)*(\d{2})<\/div>/is);
  
      if (intMatch) {
        const integer = intMatch[1].replace(/,/g, "");
        const decimal = decMatch?.[1] ?? "00";
        currentPrice = parseFloat(`${integer}.${decimal}`);
      }
    }
  
    // ── Original price — line-through div (offer only) ────────────────────────
    // Structure: <div class="... line-through">KES<!-- --> <!-- -->990.00</div>
    // This is a div, not a span — and only appears once when on offer.
    // Scope search to before the FBT section to avoid false matches.
    const beforeFbt = html.split(/Frequently bought together/i)[0] ?? html;
  
    const strikethroughMatch = beforeFbt.match(
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
  
    // ─────────────────────────────────────────────
    // Scope ONLY to pricing block
    // ─────────────────────────────────────────────
    const pricingSectionMatch = html.match(
      /<div class="products-price">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="buy-action">/i,
    );
  
    const pricingSection = pricingSectionMatch?.[1] ?? html;
  
    // ─────────────────────────────────────────────
    // Current price (always exists)
    // ─────────────────────────────────────────────
    const currentMatch = pricingSection.match(
      /class="products-price-new"[^>]*>\s*KES\s*([\d,]+(?:\.\d{2})?)/i,
    );
  
    const currentPrice = currentMatch
      ? parseFloat(currentMatch[1].replace(/,/g, ""))
      : null;
  
    // ─────────────────────────────────────────────
    // Original price (ONLY when offer exists)
    // ─────────────────────────────────────────────
    const originalMatch = pricingSection.match(
      /<del[^>]*class="[^"]*products-price-old[^"]*"[^>]*>\s*KES\s*([\d,]+(?:\.\d{2})?)/i,
    );
  
    const originalPrice = originalMatch
      ? parseFloat(originalMatch[1].replace(/,/g, ""))
      : null;
  
    // ─────────────────────────────────────────────
    // Offer logic (strict validation)
    // ─────────────────────────────────────────────
    const isOnOffer =
      typeof originalPrice === "number" &&
      typeof currentPrice === "number" &&
      originalPrice > currentPrice;
  
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

      log.info(`Naivas offer detected — current: ${currentPrice}, original: ${originalPrice}, OOS: ${isOutOfStock}`);

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