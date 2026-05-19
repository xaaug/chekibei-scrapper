export const CARREFOUR_SELECTORS = {
    searchInput: "input#search-bar",
    productCard: "a[href*='/p/']",
    productCardContainer: "div.relative.flex.gap-2xs",
    productName: "div.text-sm.font-medium.line-clamp-2",
    productPrice: "span.text-lg.font-bold",
  } as const;