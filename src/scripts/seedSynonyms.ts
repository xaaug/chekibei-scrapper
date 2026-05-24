import * as dotenv from "dotenv";
dotenv.config();

const CONVEX_HTTP_URL = process.env.CONVEX_HTTP_URL;

if (!CONVEX_HTTP_URL) {
    
  console.error("CONVEX_HTTP_URL not set");
  process.exit(1);
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const BRAND_GROUPS: { officialName: string; synonyms: string[] }[] = [
  { officialName: "Blue Band",    synonyms: ["Blueband", "Blue-Band"] },
  { officialName: "Santa Maria",  synonyms: ["Santamaria", "Santa-Maria"] },
  { officialName: "Santa Lucia",  synonyms: ["Santalucia", "Santa-Lucia"] },
  { officialName: "Parle G",      synonyms: ["Parle-G", "ParleG", "Parle Glucose", "Parle-Glucose"] },
  { officialName: "Baraka Chai",  synonyms: ["Baraka-Chai", "BarakaChai"] },
  { officialName: "Tap & Go",     synonyms: ["Tap and Go", "Tap&Go"] },
  { officialName: "Naivas Local", synonyms: ["Naivas"] },
  { officialName: "Quick Choice", synonyms: ["QuickChoice"] },
  { officialName: "Mill Bakers",  synonyms: ["Millbakers"] },
  { officialName: "Majid Al Futtaim", synonyms: [] },
  { officialName: "Brookside",    synonyms: ["Brook Side"] },
  { officialName: "Kenchic",      synonyms: ["Kenchick"] },
];

const WORD_GROUPS: { officialName: string; synonyms: string[] }[] = [
  { officialName: "flour",        synonyms: ["meal", "unga"] },
  { officialName: "maize flour",  synonyms: ["maize meal"] },
  { officialName: "yoghurt",      synonyms: ["yogurt", "yoghourt"] },
  { officialName: "milk",         synonyms: ["maziwa"] },
  { officialName: "bread",        synonyms: ["mkate"] },
  { officialName: "wheat",        synonyms: ["ngano", "homebaking", "home baking", "chapati flour", "all purpose flour"] },
  { officialName: "extra virgin", synonyms: ["e/virgin"] },
  { officialName: "spirali",      synonyms: ["spirals"] },
  { officialName: "olive oil",    synonyms: ["oliveoil"] },
  { officialName: "instant coffee", synonyms: ["instantcoffee", "instantcoffe", "instantcofee", "coffee instant", "coffeinstant"] },
  { officialName: "coffee",       synonyms: ["coffe", "cofee"] },
  { officialName: "chicken",      synonyms: ["kuku"] },
  { officialName: "Astors",       synonyms: ["Astro"] },
  { officialName: "Tea Bag",      synonyms: ["t/bag", "Tea Bags", "t/bags", "teabag", "teabags"] },
  { officialName: "beef",         synonyms: ["nyama"] },
  { officialName: "fish",         synonyms: ["samaki"] },
  { officialName: "sachet",       synonyms: ["packet", "pack", "pouch"] },
  { officialName: "bottle",       synonyms: ["btl"] },
  { officialName: "tin",          synonyms: ["can", "canned"] },
  { officialName: "bar",          synonyms: ["block", "slab"] },
  { officialName: "original",     synonyms: ["orig"] },
  { officialName: "natural",      synonyms: ["nat"] },
  { officialName: "fortified",    synonyms: ["fort"] },
  { officialName: "large",        synonyms: ["big", "jumbo", "xl"] },
  { officialName: "small",        synonyms: ["mini", "sm"] },
  { officialName: "medium",       synonyms: ["med"] },
  { officialName: "family",       synonyms: ["bulk", "value"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function addGroup(
  endpoint: string,
  group: { officialName: string; synonyms: string[] },
): Promise<void> {
  const url = `${CONVEX_HTTP_URL}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(group),
  });

  if (!res.ok) {
    const text = await res.text();
    // Already exists — skip silently
    if (res.status === 500 && text.includes("already exists")) {
      console.log(`  skip  "${group.officialName}" (already exists)`);
      return;
    }
    throw new Error(`POST ${endpoint} failed (${res.status}): ${text}`);
  }

  console.log(`  added "${group.officialName}"`);
}

async function seedAll(): Promise<void> {
  console.log("\n── Seeding brand synonyms ───────────────────────────────────");
  for (const group of BRAND_GROUPS) {
    await addGroup("/synonyms/brands/add", group);
  }

  console.log("\n── Seeding word synonyms ────────────────────────────────────");
  for (const group of WORD_GROUPS) {
    await addGroup("/synonyms/words/add", group);
  }

  console.log("\nDone.\n");
}

seedAll().catch((err) => {
  console.error(err);
  process.exit(1);
});