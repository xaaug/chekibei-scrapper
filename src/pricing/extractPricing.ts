import { SupermarketId } from "../supermarkets/base/types";

export interface ExtractedPricing {
  currentPrice: number | null;
  originalPrice: number | null;  // pre-discount price if shown
}

export function extractPricing(supermarket: SupermarketId, html: string): ExtractedPricing {
  switch (supermarket) {
    case "carrefour": return extractCarrefourPricing(html);
    case "quickmart": return extractQuickmartPricing(html);
    case "naivas":    return extractNaivasPricing(html);
    default:          return { currentPrice: null, originalPrice: null };
  }
}

// ── Carrefour ──────────────────────────────────────────────────────────────────
// Price split across: <div>KES</div><div>80</div><div>.00</div>
// Grab the integer + decimal parts from the price container
function extractCarrefourPricing(html: string): ExtractedPricing {
  // The price block has force-ltr class — extract integer and decimal parts
  const priceBlock = html.match(/force-ltr[\s\S]{0,300}?<div[^>]*>(\d[\d,]*)<\/div>[\s\S]{0,100}?<div[^>]*>\.(\d{2})<\/div>/i);

  if (priceBlock) {
    const integer = priceBlock[1].replace(/,/g, "");
    const decimal = priceBlock[2];
    const currentPrice = parseFloat(`${integer}.${decimal}`);
    return { currentPrice, originalPrice: null };
  }

  // Fallback: grab any number after "KES" 
  const fallback = html.match(/KES[\s\u00a0]*(\d[\d,]*(?:\.\d{2})?)/i);
  if (fallback) {
    return { currentPrice: parseFloat(fallback[1].replace(/,/g, "")), originalPrice: null };
  }

  return { currentPrice: null, originalPrice: null };
}

// ── Quickmart ──────────────────────────────────────────────────────────────────
// Current: <span class="products-price-new">KES 40.00</span>
// Original: <del class="products-price-old">KES 80.00</del>
function extractQuickmartPricing(html: string): ExtractedPricing {
  const currentMatch = html.match(/products-price-new[^>]*>[\s]*KES[\s\u00a0]*([\d,]+(?:\.\d{2})?)/i);
  const originalMatch = html.match(/products-price-old[^>]*>[\s]*KES[\s\u00a0]*([\d,]+(?:\.\d{2})?)/i);

  return {
    currentPrice: currentMatch ? parseFloat(currentMatch[1].replace(/,/g, "")) : null,
    originalPrice: originalMatch ? parseFloat(originalMatch[1].replace(/,/g, "")) : null,
  };
}

// ── Naivas ─────────────────────────────────────────────────────────────────────
// Current: <span class="font-bold text-naivas-green ...">KES&nbsp;305</span>
// Original: <span class="text-red-600 ... line-through ...">KES&nbsp;1,825</span>
function extractNaivasPricing(html: string): ExtractedPricing {
  const currentMatch = html.match(/font-bold text-naivas-green[^>]*>[\s]*KES[\s\u00a0]*([\d,]+)/i) ??
                       html.match(/text-naivas-green[^>]*font-bold[^>]*>[\s]*KES[\s\u00a0]*([\d,]+)/i);

  const originalMatch = html.match(/text-red-600[^>]*line-through[^>]*>[\s]*KES[\s\u00a0]*([\d,]+)/i) ??
                        html.match(/line-through[^>]*text-red-600[^>]*>[\s]*KES[\s\u00a0]*([\d,]+)/i);

  return {
    currentPrice: currentMatch ? parseFloat(currentMatch[1].replace(/,/g, "")) : null,
    originalPrice: originalMatch ? parseFloat(originalMatch[1].replace(/,/g, "")) : null,
  };
}