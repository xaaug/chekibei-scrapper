import * as dotenv from "dotenv";
dotenv.config();

const CONVEX_HTTP_URL = process.env.CONVEX_HTTP_URL;
if (!CONVEX_HTTP_URL) {
  console.error("CONVEX_HTTP_URL not set");
  process.exit(1);
}

const QUICKMART_BRANDS = [
  {
    brandSlug: "210",
    brandUrl: "https://www.quickmart.co.ke/210",
    category: "flour",
    maxPages: 5,
  },
  {
    brandSlug: "ketepa",
    brandUrl: "https://www.quickmart.co.ke/ketepa",
    category: "tea",
    maxPages: 5,
  },
  {
    brandSlug: "224",
    brandUrl: "https://www.quickmart.co.ke/224",
    category: "rice",
    maxPages: 5,
  },
  {
    brandSlug: "acacia",
    brandUrl: "https://www.quickmart.co.ke/acacia",
    category: "drinks",
    maxPages: 5,
  },
  {
    brandSlug: "ace",
    brandUrl: "https://www.quickmart.co.ke/ace",
    category: "homecare",
    maxPages: 5,
  },
  {
    brandSlug: "ariel",
    brandUrl: "https://www.quickmart.co.ke/ariel",
    category: "laundry",
    maxPages: 5,
  },
  {
    brandSlug: "aquamist",
    brandUrl: "https://www.quickmart.co.ke/aquamist",
    category: "drinks",
    maxPages: 5,
  },
  {
    brandSlug: "aquafresh",
    brandUrl: "https://www.quickmart.co.ke/aquafresh",
    category: "personal-care",
    maxPages: 5,
  },
  {
    brandSlug: "exe",
    brandUrl: "https://www.quickmart.co.ke/exe",
    category: "flour",
    maxPages: 5,
  },
  {
    brandSlug: "festive",
    brandUrl: "https://www.quickmart.co.ke/festive",
    category: "breakfast",
    maxPages: 5,
  },
  {
    brandSlug: "santa-maria",
    brandUrl: "https://www.quickmart.co.ke/santa-maria",
    category: "foods",
    maxPages: 5,
  },
  {
    brandSlug: "golden-fry",
    brandUrl: "https://www.quickmart.co.ke/golden-fry",
    category: "cooking-oil",
    maxPages: 5,
  },
  {
    brandSlug: "ajab",
    brandUrl: "https://www.quickmart.co.ke/ajab",
    category: "flour",
    maxPages: 5,
  },
  {
    brandSlug: "dove",
    brandUrl: "https://www.quickmart.co.ke/dove",
    category: "personal-care",
    maxPages: 5,
  },
  {
    brandSlug: "downy",
    brandUrl: "https://www.quickmart.co.ke/downy",
    category: "laundry",
    maxPages: 5,
  },
  {
    brandSlug: "pendo",
    brandUrl: "https://www.quickmart.co.ke/pendo",
    category: "flour",
    maxPages: 5,
  },
  {
    brandSlug: "pepsi",
    brandUrl: "https://www.quickmart.co.ke/pepsi",
    category: "drinks",
    maxPages: 5,
  },
  {
    brandSlug: "pembe",
    brandUrl: "https://www.quickmart.co.ke/pembe",
    category: "flour",
    maxPages: 5,
  },
  {
    brandSlug: "persil",
    brandUrl: "https://www.quickmart.co.ke/persil",
    category: "laundry",
    maxPages: 5,
  },
  {
    brandSlug: "pepsodent",
    brandUrl: "https://www.quickmart.co.ke/pepsodent",
    category: "personal-care",
    maxPages: 5,
  },
  {
    brandSlug: "peptang",
    brandUrl: "https://www.quickmart.co.ke/peptang",
    category: "foods",
    maxPages: 5,
  },
  {
    brandSlug: "pick-n-peel",
    brandUrl: "https://www.quickmart.co.ke/pick-n-peel",
    category: "drinks",
    maxPages: 5,
  },
  {
    brandSlug: "santa-lucia",
    brandUrl: "https://www.quickmart.co.ke/santa-lucia",
    category: "foods",
    maxPages: 5,
  },
  {
    brandSlug: "pride",
    brandUrl: "https://www.quickmart.co.ke/pride",
    category: "cleaning",
    maxPages: 5,
  },
  {
    brandSlug: "fresh-fri",
    brandUrl: "https://www.quickmart.co.ke/fresh-fri",
    category: "cooking-oil",
    maxPages: 5,
  },
  {
    brandSlug: "pringles",
    brandUrl: "https://www.quickmart.co.ke/pringles",
    category: "snacks",
    maxPages: 5,
  },
  {
    brandSlug: "nestle",
    brandUrl: "https://www.quickmart.co.ke/nestle",
    category: "breakfast",
    maxPages: 5,
  },
  {
    brandSlug: "avena",
    brandUrl: "https://www.quickmart.co.ke/avena",
    category: "breakfast",
    maxPages: 5,
  },
  {
    brandSlug: "tuzo",
    brandUrl: "https://www.quickmart.co.ke/tuzo",
    category: "dairy",
    maxPages: 5,
  },
  {
    brandSlug: "blueband",
    brandUrl: "https://www.quickmart.co.ke/blueband",
    category: "breakfast",
    maxPages: 5,
  },
  {
    brandSlug: "quick-choice",
    brandUrl: "https://www.quickmart.co.ke/quick-choice",
    category: "foods",
    maxPages: 5,
  },
  {
    brandSlug: "quickchoice",
    brandUrl: "https://www.quickmart.co.ke/quickchoice",
    category: "foods",
    maxPages: 5,
  },
  {
    brandSlug: "lotus",
    brandUrl: "https://www.quickmart.co.ke/lotus",
    category: "snacks",
    maxPages: 5,
  },
  {
    brandSlug: "lucozade",
    brandUrl: "https://www.quickmart.co.ke/lucozade",
    category: "drinks",
    maxPages: 5,
  },
  {
    brandSlug: "kcc",
    brandUrl: "https://www.quickmart.co.ke/kcc",
    category: "dairy",
    maxPages: 5,
  },
  {
    brandSlug: "mt-kenya",
    brandUrl: "https://www.quickmart.co.ke/mt-kenya",
    category: "tea",
    maxPages: 5,
  },
  {
    brandSlug: "brookside",
    brandUrl: "https://www.quickmart.co.ke/brookside",
    category: "dairy",
    maxPages: 5,
  },
  {
    brandSlug: "broadways",
    brandUrl: "https://www.quickmart.co.ke/broadways",
    category: "personal-care",
    maxPages: 5,
  },
  {
    brandSlug: "supaloaf",
    brandUrl: "https://www.quickmart.co.ke/supaloaf",
    category: "breakfast",
    maxPages: 5,
  },
  {
    brandSlug: "supabrite",
    brandUrl: "https://www.quickmart.co.ke/supabrite",
    category: "laundry",
    maxPages: 5,
  },
  {
    brandSlug: "supa-brite",
    brandUrl: "https://www.quickmart.co.ke/supa-brite",
    category: "laundry",
    maxPages: 5,
  },
  {
    brandSlug: "sunlight",
    brandUrl: "https://www.quickmart.co.ke/sunlight",
    category: "laundry",
    maxPages: 5,
  },
  {
    brandSlug: "sunrice",
    brandUrl: "https://www.quickmart.co.ke/sunrice",
    category: "rice",
    maxPages: 5,
  },
  {
    brandSlug: "neptune",
    brandUrl: "https://www.quickmart.co.ke/neptune",
    category: "cooking-oil",
    maxPages: 5,
  },
  {
    brandSlug: "ndume",
    brandUrl: "https://www.quickmart.co.ke/ndume",
    category: "flour",
    maxPages: 5,
  },
  {
    brandSlug: "ndovu",
    brandUrl: "https://www.quickmart.co.ke/ndovu",
    category: "flour",
    maxPages: 5,
  },
  {
    brandSlug: "ndhiwa",
    brandUrl: "https://www.quickmart.co.ke/ndhiwa",
    category: "rice",
    maxPages: 5,
  },
  {
    brandSlug: "natures-own",
    brandUrl: "https://www.quickmart.co.ke/natures-own",
    category: "breakfast",
    maxPages: 5,
  },
  {
    brandSlug: "nice-lovely",
    brandUrl: "https://www.quickmart.co.ke/nice-lovely",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "nice-soft",
    brandUrl: "https://www.quickmart.co.ke/nice-soft",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "nice",
    brandUrl: "https://www.quickmart.co.ke/nice",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "novida",
    brandUrl: "https://www.quickmart.co.ke/novida",
    category: "dairy",
    maxPages: 5,
  },
  {
    brandSlug: "nuteez",
    brandUrl: "https://www.quickmart.co.ke/nuteez",
    category: "snacks",
    maxPages: 5,
  },
  {
    brandSlug: "nut-gold",
    brandUrl: "https://www.quickmart.co.ke/nut-gold",
    category: "breakfast",
    maxPages: 5,
  },
  {
    brandSlug: "nuvita",
    brandUrl: "https://www.quickmart.co.ke/nuvita",
    category: "snacks",
    maxPages: 5,
  },
  {
    brandSlug: "pampers",
    brandUrl: "https://www.quickmart.co.ke/pampers",
    category: "baby-care",
    maxPages: 5,
  },
  {
    brandSlug: "panadol",
    brandUrl: "https://www.quickmart.co.ke/panadol",
    category: "medicine",
    maxPages: 5,
  },
  {
    brandSlug: "dola",
    brandUrl: "https://www.quickmart.co.ke/dola",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "fresha",
    brandUrl: "https://www.quickmart.co.ke/fresha",
    category: "dairy",
    maxPages: 5,
  },
  {
    brandSlug: "quencher",
    brandUrl: "https://www.quickmart.co.ke/quencher",
    category: "drinks",
    maxPages: 5,
  },
  {
    brandSlug: "rinsun",
    brandUrl: "https://www.quickmart.co.ke/rinsun",
    category: "laundry",
    maxPages: 5,
  },
  {
    brandSlug: "kimbo",
    brandUrl: "https://www.quickmart.co.ke/kimbo",
    category: "cooking-oil",
    maxPages: 5,
  },
  {
    brandSlug: "cowboy",
    brandUrl: "https://www.quickmart.co.ke/cowboy",
    category: "cleaning",
    maxPages: 5,
  },
  {
    brandSlug: "sun-gold",
    brandUrl: "https://www.quickmart.co.ke/sun-gold",
    category: "cooking-oil",
    maxPages: 5,
  },
  {
    brandSlug: "kentaste",
    brandUrl: "https://www.quickmart.co.ke/kentaste",
    category: "foods",
    maxPages: 5,
  },
  {
    brandSlug: "chipsy",
    brandUrl: "https://www.quickmart.co.ke/chipsy",
    category: "snacks",
    maxPages: 5,
  },
  {
    brandSlug: "bio",
    brandUrl: "https://www.quickmart.co.ke/bio",
    category: "laundry",
    maxPages: 5,
  },
  {
    brandSlug: "nutrameal",
    brandUrl: "https://www.quickmart.co.ke/nutrameal",
    category: "breakfast",
    maxPages: 5,
  },
  {
    brandSlug: "soko",
    brandUrl: "https://www.quickmart.co.ke/soko",
    category: "flour",
    maxPages: 5,
  },
  {
    brandSlug: "pearl",
    brandUrl: "https://www.quickmart.co.ke/pearl",
    category: "rice",
    maxPages: 5,
  },
  {
    brandSlug: "ranee",
    brandUrl: "https://www.quickmart.co.ke/ranee",
    category: "drinks",
    maxPages: 5,
  },
  {
    brandSlug: "guru",
    brandUrl: "https://www.quickmart.co.ke/guru",
    category: "drinks",
    maxPages: 5,
  },
  {
    brandSlug: "guru-premium",
    brandUrl: "https://www.quickmart.co.ke/guru-premium",
    category: "rice",
    maxPages: 5,
  },
  {
    brandSlug: "kpl",
    brandUrl: "https://www.quickmart.co.ke/kpl",
    category: "foods",
    maxPages: 5,
  },
  {
    brandSlug: "tily",
    brandUrl: "https://www.quickmart.co.ke/tily",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "kasuku",
    brandUrl: "https://www.quickmart.co.ke/kasuku",
    category: "flour",
    maxPages: 5,
  },
  {
    brandSlug: "morning-fresh",
    brandUrl: "https://www.quickmart.co.ke/morning-fresh",
    category: "cleaning",
    maxPages: 5,
  },
  {
    brandSlug: "jogoo",
    brandUrl: "https://www.quickmart.co.ke/jogoo",
    category: "flour",
    maxPages: 5,
  },
  {
    brandSlug: "hostess",
    brandUrl: "https://www.quickmart.co.ke/hostess",
    category: "snacks",
    maxPages: 5,
  },
  {
    brandSlug: "huggies",
    brandUrl: "https://www.quickmart.co.ke/huggies",
    category: "baby-care",
    maxPages: 5,
  },
  {
    brandSlug: "fahari",
    brandUrl: "https://www.quickmart.co.ke/fahari",
    category: "rice",
    maxPages: 5,
  },
  {
    brandSlug: "hanan",
    brandUrl: "https://www.quickmart.co.ke/hanan",
    category: "foods",
    maxPages: 5,
  },
  {
    brandSlug: "jamaa",
    brandUrl: "https://www.quickmart.co.ke/jamaa",
    category: "tea",
    maxPages: 5,
  },
  {
    brandSlug: "rina",
    brandUrl: "https://www.quickmart.co.ke/rina",
    category: "cooking-oil",
    maxPages: 5,
  },
  {
    brandSlug: "indomie",
    brandUrl: "https://www.quickmart.co.ke/indomie",
    category: "foods",
    maxPages: 5,
  },
  {
    brandSlug: "kabras",
    brandUrl: "https://www.quickmart.co.ke/kabras",
    category: "sugar",
    maxPages: 5,
  },
  {
    brandSlug: "kensalt",
    brandUrl: "https://www.quickmart.co.ke/kensalt",
    category: "salt",
    maxPages: 5,
  },
  {
    brandSlug: "mumias",
    brandUrl: "https://www.quickmart.co.ke/mumias",
    category: "sugar",
    maxPages: 5,
  },
  {
    brandSlug: "daima",
    brandUrl: "https://www.quickmart.co.ke/daima",
    category: "dairy",
    maxPages: 5,
  },
  {
    brandSlug: "dairy-land",
    brandUrl: "https://www.quickmart.co.ke/dairy-land",
    category: "dairy",
    maxPages: 5,
  },
  {
    brandSlug: "daawat",
    brandUrl: "https://www.quickmart.co.ke/daawat",
    category: "rice",
    maxPages: 5,
  },
  {
    brandSlug: "dasani",
    brandUrl: "https://www.quickmart.co.ke/dasani",
    category: "drinks",
    maxPages: 5,
  },
  {
    brandSlug: "dettol",
    brandUrl: "https://www.quickmart.co.ke/dettol",
    category: "personal-care",
    maxPages: 5,
  },
  {
    brandSlug: "molo",
    brandUrl: "https://www.quickmart.co.ke/molo",
    category: "milk",
    maxPages: 5,
  },
  {
    brandSlug: "molfix",
    brandUrl: "https://www.quickmart.co.ke/molfix",
    category: "baby-care",
    maxPages: 5,
  },
  {
    brandSlug: "ilara",
    brandUrl: "https://www.quickmart.co.ke/ilara",
    category: "dairy",
    maxPages: 5,
  },
  {
    brandSlug: "delamere",
    brandUrl: "https://www.quickmart.co.ke/delamere",
    category: "dairy",
    maxPages: 5,
  },
  {
    brandSlug: "zesta",
    brandUrl: "https://www.quickmart.co.ke/zesta",
    category: "snacks",
    maxPages: 5,
  },
  {
    brandSlug: "baraka",
    brandUrl: "https://www.quickmart.co.ke/baraka",
    category: "rice",
    maxPages: 5,
  },
  {
    brandSlug: "baraka-chai",
    brandUrl: "https://www.quickmart.co.ke/baraka-chai",
    category: "tea",
    maxPages: 5,
  },
  {
    brandSlug: "top-fry",
    brandUrl: "https://www.quickmart.co.ke/top-fry",
    category: "cooking-oil",
    maxPages: 5,
  },
  {
    brandSlug: "olive-gold",
    brandUrl: "https://www.quickmart.co.ke/olive-gold",
    category: "cooking-oil",
    maxPages: 5,
  },
  {
    brandSlug: "prestige",
    brandUrl: "https://www.quickmart.co.ke/prestige",
    category: "rice",
    maxPages: 5,
  },
  {
    brandSlug: "weetabix",
    brandUrl: "https://www.quickmart.co.ke/weetabix",
    category: "breakfast",
    maxPages: 5,
  },
  {
    brandSlug: "kericho-gold",
    brandUrl: "https://www.quickmart.co.ke/kericho-gold",
    category: "tea",
    maxPages: 5,
  },
  {
    brandSlug: "shiriki-coffee",
    brandUrl: "https://www.quickmart.co.ke/shiriki-coffee",
    category: "coffee",
    maxPages: 5,
  },
  {
    brandSlug: "milo",
    brandUrl: "https://www.quickmart.co.ke/milo",
    category: "breakfast",
    maxPages: 5,
  },
  {
    brandSlug: "maccoffee",
    brandUrl: "https://www.quickmart.co.ke/maccoffee",
    category: "coffee",
    maxPages: 5,
  },
  {
    brandSlug: "faraja",
    brandUrl: "https://www.quickmart.co.ke/faraja",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "softcare",
    brandUrl: "https://www.quickmart.co.ke/softcare",
    category: "baby-care",
    maxPages: 5,
  },
  {
    brandSlug: "kotex",
    brandUrl: "https://www.quickmart.co.ke/kotex",
    category: "sanitary-care",
    maxPages: 5,
  },
  {
    brandSlug: "molped",
    brandUrl: "https://www.quickmart.co.ke/molped",
    category: "sanitary-care",
    maxPages: 5,
  },
  {
    brandSlug: "velvex",
    brandUrl: "https://www.quickmart.co.ke/velvex",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "velvex-extra",
    brandUrl: "https://www.quickmart.co.ke/velvex-extra",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "tena",
    brandUrl: "https://www.quickmart.co.ke/tena",
    category: "sanitary-care",
    maxPages: 5,
  },
  {
    brandSlug: "fay",
    brandUrl: "https://www.quickmart.co.ke/fay",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "toilex",
    brandUrl: "https://www.quickmart.co.ke/toilex",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "flora",
    brandUrl: "https://www.quickmart.co.ke/flora",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "petals",
    brandUrl: "https://www.quickmart.co.ke/petals",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "rosy",
    brandUrl: "https://www.quickmart.co.ke/rosy",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "celine",
    brandUrl: "https://www.quickmart.co.ke/celine",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "sifa",
    brandUrl: "https://www.quickmart.co.ke/sifa",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "comfy",
    brandUrl: "https://www.quickmart.co.ke/comfy",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "cosy",
    brandUrl: "https://www.quickmart.co.ke/cosy",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "msafi",
    brandUrl: "https://www.quickmart.co.ke/msafi",
    category: "cleaning",
    maxPages: 5,
  },
  {
    brandSlug: "omo",
    brandUrl: "https://www.quickmart.co.ke/omo",
    category: "laundry",
    maxPages: 5,
  },
  {
    brandSlug: "persil",
    brandUrl: "https://www.quickmart.co.ke/persil",
    category: "laundry",
    maxPages: 5,
  },
  {
    brandSlug: "toss",
    brandUrl: "https://www.quickmart.co.ke/toss",
    category: "laundry",
    maxPages: 5,
  },
  {
    brandSlug: "unilever",
    brandUrl: "https://www.quickmart.co.ke/unilever",
    category: "homecare",
    maxPages: 5,
  },
  {
    brandSlug: "geisha",
    brandUrl: "https://www.quickmart.co.ke/geisha",
    category: "personal-care",
    maxPages: 5,
  },
  {
    brandSlug: "colgate",
    brandUrl: "https://www.quickmart.co.ke/colgate",
    category: "personal-care",
    maxPages: 5,
  },
  {
    brandSlug: "close-up",
    brandUrl: "https://www.quickmart.co.ke/close-up",
    category: "personal-care",
    maxPages: 5,
  },
  {
    brandSlug: "lifebouy",
    brandUrl: "https://www.quickmart.co.ke/lifebouy",
    category: "personal-care",
    maxPages: 5,
  },
  {
    brandSlug: "vaseline",
    brandUrl: "https://www.quickmart.co.ke/vaseline",
    category: "personal-care",
    maxPages: 5,
  },
  {
    brandSlug: "royco",
    brandUrl: "https://www.quickmart.co.ke/royco",
    category: "foods",
    maxPages: 5,
  },
  {
    brandSlug: "tropical-heat",
    brandUrl: "https://www.quickmart.co.ke/tropical-heat",
    category: "snacks",
    maxPages: 5,
  },
  {
    brandSlug: "menengai",
    brandUrl: "https://www.quickmart.co.ke/menengai",
    category: "oil",
    maxPages: 5,
  },
  {
    brandSlug: "zenta",
    brandUrl: "https://www.quickmart.co.ke/zenta",
    category: "rice",
    maxPages: 5,
  },
  {
    brandSlug: "whitewash",
    brandUrl: "https://www.quickmart.co.ke/whitewash",
    category: "laundry",
    maxPages: 5,
  },
  {
    brandSlug: "usindi",
    brandUrl: "https://www.quickmart.co.ke/usindi",
    category: "flour",
    maxPages: 5,
  },
  {
    brandSlug: "umix",
    brandUrl: "https://www.quickmart.co.ke/umix",
    category: "foods",
    maxPages: 5,
  },
  {
    brandSlug: "spenza",
    brandUrl: "https://www.quickmart.co.ke/spenza",
    category: "snacks",
    maxPages: 5,
  },
  {
    brandSlug: "butterfly",
    brandUrl: "https://www.quickmart.co.ke/butterfly",
    category: "foods",
    maxPages: 5,
  },
  {
    brandSlug: "joymax",
    brandUrl: "https://www.quickmart.co.ke/joymax",
    category: "drinks",
    maxPages: 5,
  },
  {
    brandSlug: "highlands",
    brandUrl: "https://www.quickmart.co.ke/highlands",
    category: "drinks",
    maxPages: 5,
  },
  {
    brandSlug: "amaize",
    brandUrl: "https://www.quickmart.co.ke/amaize",
    category: "flour",
    maxPages: 5,
  },
  {
    brandSlug: "cil",
    brandUrl: "https://www.quickmart.co.ke/cil",
    category: "rice",
    maxPages: 5,
  },
  {
    brandSlug: "nala",
    brandUrl: "https://www.quickmart.co.ke/nala",
    category: "baby-care",
    maxPages: 5,
  },
  {
    brandSlug: "cocacola",
    brandUrl: "https://www.quickmart.co.ke/cocacola",
    category: "drinks",
    maxPages: 5,
  },
  {
    brandSlug: "famila",
    brandUrl: "https://www.quickmart.co.ke/famila",
    category: "tissue",
    maxPages: 5,
  },
  {
    brandSlug: "kenchic",
    brandUrl: "https://www.quickmart.co.ke/kenchic",
    category: "foods",
    maxPages: 5,
  },
  {
    brandSlug: "raha",
    brandUrl: "https://www.quickmart.co.ke/raha",
    category: "sanitary-care",
    maxPages: 5,
  },
  {
    brandSlug: "cadbury",
    brandUrl: "https://www.quickmart.co.ke/cadbury",
    category: "snacks",
    maxPages: 5,
  },
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
