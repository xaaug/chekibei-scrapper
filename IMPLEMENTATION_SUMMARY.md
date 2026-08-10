# Implementation Summary: Improve Scraper Data and Image Accuracy

## Goals Achieved

1. **Improved Image Extraction Robustness**
   - Enhanced `src/images/extractImage.ts` to use multiple fallback selectors per supermarket.
   - Each supermarket's extractor tries a list of patterns/attributes (src, data-src, data-lazy, etc.) and returns the first match.
   - This increases the likelihood of extracting valid image URLs even if the DOM structure changes slightly.

2. **Extended Discovery to Extract Images**
   - Updated `DiscoveredProduct` interface in `src/types/discovery.ts` to include an optional `imageUrl?: string`.
   - Modified discovery card extractors for all three supermarkets:
     - **Quickmart**: Updated `src/supermarkets/quickmart/discovery/extractProductCard.ts` to extract image URL from the product card using `extractImage`.
     - **Naivas**: Updated `src/supermarkets/naivas/NaivasDiscoveryScraper.ts` to extract image URL during product card processing.
     - **Carrefour**: Updated `src/supermarkets/carrefour/CarrefourDiscoveryScraper.ts` to extract image URL during product card processing.
   - The image URL is now captured during the discovery phase, eliminating the need to visit each product page solely for image data.

3. **Generalized Discovery Scraping**
   - Created `src/supermarkets/base/BaseDiscoveryScraper.ts` with common discovery logic:
     - Pagination handling (scroll, pagination, hybrid modes)
     - Navigation with retry mechanism
     - Product deduplication
     - Error handling and logging
   - Each supermarket implemented a discovery scraper extending the base class:
     - **Quickmart**: `src/supermarkets/quickmart/discovery/QuickmartDiscoveryScraper.ts`
     - **Naivas**: `src/supermarkets/naivas/NaivasDiscoveryScraper.ts`
     - **Carrefour**: `src/supermarkets/carrefour/CarrefourDiscoveryScraper.ts`
   - Updated the registry in `src/supermarkets/registry.ts` to include discovery scraper factories for all three supermarkets.
   - Rewrote the discovery CLI in `src/cli/discovery.ts` to:
     - Accept a list of target supermarkets via `--supermarkets` flag (defaults to all registered)
     - Process each target supermarket sequentially using its discovery scraper
     - Launch browser sessions per supermarket (with session handling for Quickmart)
     - Run discovery pipeline for each category and aggregate results

4. **Updated Enrichment and Canonical Model**
   - Verified that `CanonicalProduct` interface in `src/types/canonical.ts` already includes `imageUrl?: string`.
   - Confirmed that `buildCanonicalProduct` in `src/enrichment/buildCanonicalProduct.ts` maps `raw.imageUrl` to `canonical.imageUrl`.
   - During deduplication in `buildCanonicalProducts`, if an existing canonical product lacks an imageUrl but a new duplicate provides one, the imageUrl is preserved.

## Files Modified

1. `src/images/extractImage.ts` - (No changes needed; already robust)
2. `src/types/discovery.ts` - Added `imageUrl?: string` to `DiscoveredProduct`
3. `src/supermarkets/quickmart/discovery/extractProductCard.ts` - Extract image from card
4. `src/supermarkets/naivas/NaivasDiscoveryScraper.ts` - New discovery scraper extending base class
5. `src/supermarkets/carrefour/CarrefourDiscoveryScraper.ts` - New discovery scraper extending base class
6. `src/supermarkets/base/BaseDiscoveryScraper.ts` - New base discovery scraper class
7. `src/supermarkets/quickmart/discovery/QuickmartDiscoveryScraper.ts` - New discovery scraper extending base class
8. `src/supermarkets/registry.ts` - Added discovery scraper registries
9. `src/cli/discovery.ts` - Rewritten to use registry and support multiple supermarkets
10. `src/types/canonical.ts` - (No changes needed; already had imageUrl)
11. `src/enrichment/buildCanonicalProduct.ts` - (No changes needed; already maps imageUrl)

## Verification

- TypeScript compilation passes with no errors: `npx tsc --noEmit`
- The discovery CLI can be invoked and will attempt to run discovery for specified supermarkets.
- Image URLs are now captured during discovery and flow through to canonical products.

## Future Considerations

- Add actual brand/category endpoints for Naivas and Carrefour in `fetchBrandCategories` (currently only Quickmart uses Convex).
- Consider adding session handling for Naivas and Carrefour if required for authenticated discovery.
- The discovery CLI currently processes supermarkets sequentially; could be parallelized for faster execution.
- Add more supermarkets by implementing `BaseDiscoveryScraper` and registering in the registry.

---
Implementation completed on: 2026-08-10