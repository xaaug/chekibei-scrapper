import argparse
import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scrapper_service.scrapling_engine import run_scrapling_job
from scrapper_service.database import save_scraped_products, get_products

def main():
    parser = argparse.ArgumentParser(description="Chekibei Scrapling Store Scraper CLI")
    parser.add_argument("--store", type=str, default="quickmart", choices=["quickmart", "naivas", "carrefour", "all"], help="Supermarket target")
    parser.add_argument("--query", type=str, default="flour", help="Search product keyword")
    parser.add_argument("--pages", type=int, default=1, help="Max pages to scrape")
    parser.add_argument("--output", type=str, default=None, help="JSON file output path")
    
    args = parser.parse_args()
    
    print(f"=== Starting Scrapling Scraper ===")
    print(f"Target Store: {args.store.upper()}")
    print(f"Query: '{args.query}'")
    
    logs = []
    products = run_scrapling_job(args.store, args.query, max_pages=args.pages, logs=logs)
    
    saved_count = save_scraped_products(products, args.store, args.query)
    print(f"\nSuccessfully extracted {len(products)} products ({saved_count} saved to DB).")
    
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(products, f, indent=2)
        print(f"Saved JSON results to {args.output}")
    else:
        print(json.dumps(products[:5], indent=2))
        if len(products) > 5:
            print(f"... and {len(products) - 5} more items.")

if __name__ == "__main__":
    main()
