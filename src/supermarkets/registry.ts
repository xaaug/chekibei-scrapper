import { BaseScraper } from "./base/BaseScraper";
import { SupermarketId } from "./base/types";
// import { CarrefourScraper } from "./carrefour/carrefourScraper";
import { NaivasScraper } from "./naivas/naivasScraper";

const REGISTRY: Partial<Record<SupermarketId, () => BaseScraper>>  = {
//   carrefour: () => new CarrefourScraper(),
  naivas: () => new NaivasScraper(),
};

export function getScraper(supermarket: SupermarketId): BaseScraper {
  const factory = REGISTRY[supermarket];
  if (!factory) throw new Error(`No scraper registered for: ${supermarket}`);
  return factory();
}

export function getAllScrapers(): BaseScraper[] {
  return Object.values(REGISTRY).map((factory) => factory());
}