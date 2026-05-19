# Chekibei — Quickmart Discovery Scraper

Retail intelligence ingestion layer for tracking Kenyan supermarket products.

## Setup

```bash
npm install
npx playwright install chromium
```

## Run Discovery

```bash
# Scrape default categories (flour, oil, rice, beverages)
npm run discovery

# Scrape a specific category
npm run discovery -- --url https://quickmart.co.ke/flour --pages 3

# Run with visible browser (debugging)
npm run discovery -- --headful
```

## Output

Results are saved to `output/`:
- `discovery-<timestamp>.json` — full run results per category
- `products-<timestamp>.json` — flat list of all discovered products

Sessions are persisted to `storage/sessions/quickmart.json` (12-hour TTL).
Logs go to `logs/scraper.log` and `logs/errors.log`.

## Architecture

```
src/
├── core/               # Reusable, supermarket-agnostic utilities
│   ├── browser/        # Browser launch & context management
│   ├── dom/            # Safe DOM interaction & stability helpers
│   ├── logger/         # Structured Winston logger
│   └── retries/        # Generic retry wrapper with backoff
│
├── supermarkets/
│   └── quickmart/
│       ├── session/    # Location setup, session save/load
│       ├── discovery/  # Category scraping, pagination, extraction
│       ├── config.ts   # All Quickmart constants
│       └── selectors.ts # Single source of truth for DOM selectors
│
├── types/              # Shared TypeScript interfaces
├── cli/                # CLI entry points
└── index.ts
```

## Product Schema (Discovery Mode)

```ts
{
  productId?: string;   // Hidden input value (selprod_id)
  name: string;         // Product title
  url: string;          // Full product URL
  category: string;     // Derived from category URL path
  source: "quickmart";
}
```

## Adding a New Supermarket

1. Create `src/supermarkets/<name>/` following the quickmart structure
2. Implement `selectors.ts`, `config.ts`, `session/`, `discovery/`
3. Export from `src/supermarkets/<name>/index.ts`
4. Add a CLI entry in `src/cli/`
