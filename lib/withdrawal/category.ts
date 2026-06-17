import type { ProductCategory } from "@/lib/withdrawal/types";

/**
 * Map Shopify product tags to a withdrawal category. Pure & configurable: the
 * caller may pass its own tag→category mapping; otherwise a sensible default
 * covering the common exemptions is used. Defaults to 'standard'.
 *
 * Exemption categories take priority over 'standard' so that any exempt tag on
 * an order wins.
 */
export type CategoryMapping = Record<string, ProductCategory>;

export const DEFAULT_CATEGORY_MAPPING: CategoryMapping = {
  custom: "custom",
  "made-to-order": "custom",
  "sur-mesure": "custom",
  personalized: "custom",
  "personnalise": "custom",
  perishable: "perishable",
  perissable: "perishable",
  fresh: "perishable",
  digital: "digital_unsealed",
  "digital-unsealed": "digital_unsealed",
  numerique: "digital_unsealed",
};

const PRIORITY: ProductCategory[] = [
  "custom",
  "perishable",
  "digital_unsealed",
  "standard",
];

function normalize(tag: string): string {
  return tag.trim().toLowerCase();
}

/** Category for a single product's tags. */
export function mapCategoryFromTags(
  tags: string[],
  mapping: CategoryMapping = DEFAULT_CATEGORY_MAPPING,
): ProductCategory {
  const matched = new Set<ProductCategory>();
  for (const tag of tags) {
    const cat = mapping[normalize(tag)];
    if (cat) matched.add(cat);
  }
  for (const cat of PRIORITY) {
    if (matched.has(cat)) return cat;
  }
  return "standard";
}

/**
 * Order-level category from several products' tag lists: the most restrictive
 * (first exemption) wins, else 'standard'.
 */
export function mapOrderCategory(
  productTags: string[][],
  mapping: CategoryMapping = DEFAULT_CATEGORY_MAPPING,
): ProductCategory {
  const cats = productTags.map((tags) => mapCategoryFromTags(tags, mapping));
  for (const cat of PRIORITY) {
    if (cats.includes(cat)) return cat;
  }
  return "standard";
}
