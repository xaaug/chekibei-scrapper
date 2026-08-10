import { BaseScraper } from "./base/BaseScraper";
import { BaseDiscoveryScraper, DiscoveryScraperConfig } from "./base/BaseDiscoveryScraper";
import { SupermarketId } from "./base/types";
import { CarrefourScraper } from "./carrefour/carrefourScraper";
import { NaivasScraper } from "./naivas/naivasScraper";
import { CarrefourDiscoveryScraper } from "./carrefour/CarrefourDiscoveryScraper";
import { NaivasDiscoveryScraper } from "./naivas/NaivasDiscoveryScraper";
import { QuickmartDiscoveryScraper } from "./quickmart/discovery/QuickmartDiscoveryScraper";
import { QUICKMART_CONFIG } from "./quickmart/config";

// Product scrapers registry (existing)
const PRODUCT_SCRAPER_REGISTRY: Partial<Record<SupermarketId, () => BaseScraper>> = {
  carrefour: () => new CarrefourScraper(),
  naivas: () => new NaivasScraper(),
  // Quickmart product scraper would go here if it existed
};

// Discovery scrapers registry
const DISCOVERY_SCRAPER_REGISTRY: Partial<Record<SupermarketId, () => BaseDiscoveryScraper>> = {
  carrefour: () => new CarrefourDiscoveryScraper(),
  naivas: () => new NaivasDiscoveryScraper(),
  quickmart: () => new QuickmartDiscoveryScraper(),
};

export function getScraper(supermarket: SupermarketId): BaseScraper {
  const factory = PRODUCT_SCRAPER_REGISTRY[supermarket];
  if (!factory) throw new Error(`No product scraper registered for: ${supermarket}`);
  return factory();
}

export function getDiscoveryScraper(supermarket: SupermarketId): BaseDiscoveryScraper {
  const factory = DISCOVERY_SCRAPER_REGISTRY[supermarket];
  if (!factory) throw new Error(`No discovery scraper registered for: ${supermarket}`);
  return factory();
}

export function getAllProductScrapers(): BaseScraper[] {
  return Object.values(PRODUCT_SCRAPER_REGISTRY).map((factory) => factory());
}

export function getAllDiscoveryScrapers(): BaseDiscoveryScraper[] {
  return Object.values(DISCOVERY_SCRAPER_REGISTRY).map((factory) => factory());
}