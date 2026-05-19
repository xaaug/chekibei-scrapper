import { ScraperConfig } from "../base/types";

export const CARREFOUR_CONFIG: ScraperConfig = {
  supermarket: "carrefour",
  baseUrl: "https://www.carrefour.ke",
  searchUrl: "https://www.carrefour.ke/mafken/en/search?keyword=",
  paginationMode: "scroll",
  maxRetries: 5,
  waitTime: 10_500,
};