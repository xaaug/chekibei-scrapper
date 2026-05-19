import { ScraperConfig } from "../base/types";

export const CARREFOUR_CONFIG: ScraperConfig = {
  supermarket: "carrefour",
  baseUrl: "http://carrefour.ke/mafken/en?srsltid=AfmBOoo70RcO7kM3Az4tyrhCpBVWDBrn0-QI5TNLkS0aFhP7ftYKOoDj",
  searchUrl: "https://www.carrefour.ke/mafken/en/c/FKEN",
  paginationMode: "scroll",
  maxRetries: 2,
  waitTime: 2_500,
};