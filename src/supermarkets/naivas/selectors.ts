export const NAIVAS_SELECTORS = {
    // Search — from the actual wire:model Livewire input
    searchInput: "input#autocomplete-input",
    searchForm: "form[action='https://www.naivas.online/search']",
  
    // Product card root — the outermost container div
    productCard: "div.border.border-naivas-bg.rounded-xl",
  
    // Inside each card
    productLink: "a[href*='naivas.online']",
    productName: "span.line-clamp-2.text-ellipsis",
    productPrice: "span.font-bold.text-naivas-green",
    productId: "input[name='product_id']",
  } as const;