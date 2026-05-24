import { algoliasearch } from "algoliasearch";

export const algolia = algoliasearch(
  process.env.ALGOLIA_APP_ID!,
  process.env.ALGOLIA_ADMIN_KEY!,
);

export const ALGOLIA_INDEX = "canonical_products";