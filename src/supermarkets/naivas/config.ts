import { ScraperConfig } from "../base/types";

export const NAIVAS_CONFIG: ScraperConfig = {
  supermarket: "naivas",
  baseUrl: "https://www.naivas.online",
  searchUrl: "https://www.naivas.online/search",
  paginationMode: "scroll",
  maxRetries: 2,
  waitTime: 3_000, // Livewire debounce is 250ms but rendering takes longer
};