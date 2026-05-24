/**
 * Centralised selector registry for Quickmart.
 *
 * When Quickmart's DOM changes, update here — not scattered across the codebase.
 */
export const QUICKMART_SELECTORS = {
  // ── Location modal ──────────────────────────────────────────────────────────
  locationModal: "#locationInfoBox.modal",
  locationInput: "#location_fld_popup",
  locationAutocompleteDropdown: ".pac-container, .autocomplete-suggestions",

  // ── Branch confirmation modal ────────────────────────────────────────────────
  branchModalBody: ".modal-body.p-3.shop-layout-3",
  branchTitle: ".products-title",
  // branchContinueBtn: "button.btn.btn-brand.btn-block",
  branchContinueBtn: ".modal-content button.btn.btn-brand",
 
  // ── Product cards ────────────────────────────────────────────────────────────
  productCard: ".products.productInfoJs",
  productTitle: "a.products-title",
  productPrice: ".products-price-new",
  productIdInput: 'input[name="selprod_id"]',

  // ── Pagination ───────────────────────────────────────────────────────────────
  paginationNextBtn: 'button[aria-label="next"]',
  paginationContainer: ".pagination, .page-list",

  // ── General page structure ───────────────────────────────────────────────────
  productGrid: ".product-listing, .category-products, .products-list",
} as const;

export type QuickmartSelector = keyof typeof QUICKMART_SELECTORS;
