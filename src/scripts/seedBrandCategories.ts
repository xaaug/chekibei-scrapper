import * as dotenv from "dotenv";
dotenv.config();

const CONVEX_HTTP_URL = process.env.CONVEX_HTTP_URL;
if (!CONVEX_HTTP_URL) {
  console.error("CONVEX_HTTP_URL not set");
  process.exit(1);
}

const QUICKMART_BRANDS = [
  {
    brandSlug: "golden-fry",
    brandUrl: "https://www.quickmart.co.ke/golden-fry",
    category: "cooking-oil",
    maxPages: 5,
  }
];

async function seed() {
  console.log("\n── Seeding Quickmart brand categories ───────────────────");

  for (const brand of QUICKMART_BRANDS) {
    const res = await fetch(`${CONVEX_HTTP_URL}/brands/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supermarket: "quickmart", ...brand }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (text.includes("already exists")) {
        console.log(`  skip  "${brand.brandSlug}"`);
        continue;
      }
      throw new Error(`Failed (${res.status}): ${text}`);
    }

    console.log(`  added "${brand.brandSlug}" → ${brand.category}`);
  }

  console.log("\nDone.\n");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
