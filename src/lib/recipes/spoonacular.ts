import "server-only";
import type { Recipe, RecipeIngredient, RecipeStep } from "@/types/recipe";

/**
 * Spoonacular — a database of real recipes.
 *
 * Two calls per search:
 *  1. findByIngredients  -> which recipes best match what the user actually has
 *                           (this is what gives us used/missing counts)
 *  2. informationBulk    -> the full details (steps, time, servings) for those hits
 *
 * Results are mapped onto our own `Recipe` type so the rest of the app doesn't
 * know or care where a recipe came from.
 */

const BASE = "https://api.spoonacular.com";

type FindByIngredientsHit = {
  id: number;
  title: string;
  image: string;
  usedIngredientCount: number;
  missedIngredientCount: number;
  missedIngredients: { name: string }[];
};

type BulkIngredient = {
  name: string;
  amount: number;
  unit: string;
  original: string;
};

type BulkInfo = {
  id: number;
  title: string;
  image: string;
  readyInMinutes: number;
  servings: number;
  summary?: string;
  dishTypes?: string[];
  diets?: string[];
  spoonacularScore?: number;
  extendedIngredients?: BulkIngredient[];
  analyzedInstructions?: { steps: { number: number; step: string }[] }[];
};

export function isSpoonacularConfigured(): boolean {
  return Boolean(process.env.SPOONACULAR_API_KEY);
}

function apiKey(): string {
  const key = process.env.SPOONACULAR_API_KEY;
  if (!key) {
    throw new Error(
      "SPOONACULAR_API_KEY is not set. Add it to .env.local (see .env.template).",
    );
  }
  return key;
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("apiKey", apiKey());

  const response = await fetch(url, { cache: "no-store" });

  if (response.status === 402) {
    throw new Error(
      "Spoonacular daily quota reached. Try again tomorrow or upgrade the plan.",
    );
  }

  if (!response.ok) {
    throw new Error(`Spoonacular request failed (${response.status}).`);
  }

  return (await response.json()) as T;
}

/** "<b>Rich</b> and creamy." -> "Rich and creamy." (their summaries are HTML) */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Spoonacular summaries lead with nutrition boilerplate ("This main course has
 * 1449 calories, 75g of protein..."), which reads terribly as a description.
 * Keep only the appetising sentences.
 */
function describe(summary: string, fallback: string): string {
  // Nutrition stats AND their stock filler ("This recipe serves 9.", "might be
  // a good recipe to expand your recipe box") — none of it sells a dish.
  const BOILERPLATE =
    /calorie|protein|\bfat\b|carbs|gram|\bg of\b|per serving|price|cost|score|spoonacular|users who liked|this recipe serves|can be made in around|expand your|recipe box|watching your figure|head to the store|foodista/i;

  const sentences = stripHtml(summary)
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20 && !BOILERPLATE.test(sentence));

  const description = sentences.slice(0, 2).join(" ");
  return description || fallback;
}

/**
 * Spoonacular's "missing ingredients" sometimes contain instruction fragments
 * ("In a soup pot over heat", "Stir in a amount of green onions"). Keep only
 * things that actually read like an ingredient name.
 */
function isRealIngredientName(name: string): boolean {
  const clean = name.trim();
  if (clean.length === 0 || clean.length > 30) return false;
  if (/[.;:]/.test(clean)) return false; // sentence punctuation
  if (clean.split(/\s+/).length > 4) return false; // too wordy to be a name
  // Cooking verbs / instruction words that leak in from the steps.
  if (
    /\b(stir|add|heat|cook|pot|pan|sprinkle|serve|mix|pour|bring|season|simmer|bake|until|over|into)\b/i.test(
      clean,
    )
  ) {
    return false;
  }
  return true;
}

/** Rough difficulty from time + number of steps — Spoonacular doesn't provide one. */
function difficultyOf(minutes: number, steps: number): Recipe["difficulty"] {
  if (minutes <= 30 && steps <= 6) return "Easy";
  if (minutes <= 60 && steps <= 12) return "Medium";
  return "Hard";
}

function toRecipe(
  hit: FindByIngredientsHit,
  info: BulkInfo | undefined,
  have: Set<string>,
): Recipe {
  const missingNames = hit.missedIngredients
    .map((item) => item.name)
    .filter(isRealIngredientName);
  const missingLower = new Set(missingNames.map((name) => name.toLowerCase()));

  const steps: RecipeStep[] =
    info?.analyzedInstructions?.[0]?.steps?.map((step) => ({
      step: step.number,
      instruction: step.step,
    })) ?? [];

  const ingredients: RecipeIngredient[] = (info?.extendedIngredients ?? []).map(
    (item) => {
      const name = item.name;
      const lower = name.toLowerCase();
      // "Available" = the user said they have it, and Spoonacular didn't flag it missing.
      const available =
        !missingLower.has(lower) &&
        [...have].some(
          (owned) => lower.includes(owned) || owned.includes(lower),
        );

      return {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        amount:
          item.original ||
          [item.amount, item.unit].filter(Boolean).join(" ").trim(),
        available,
      };
    },
  );

  const total = hit.usedIngredientCount + hit.missedIngredientCount;
  const matchPercentage =
    total > 0 ? Math.round((hit.usedIngredientCount / total) * 100) : undefined;

  const minutes = info?.readyInMinutes ?? 30;
  const usedCount = hit.usedIngredientCount;
  const fallbackDescription = `Uses ${usedCount} of the ingredients you already have.`;
  const summary = info?.summary
    ? describe(info.summary, fallbackDescription)
    : fallbackDescription;

  const tags = [...(info?.dishTypes ?? []), ...(info?.diets ?? [])]
    .slice(0, 4)
    .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));

  return {
    id: `spoonacular-${hit.id}`,
    title: hit.title,
    description: summary,
    image: hit.image || info?.image || "/images/food.webp",
    cookingTimeMinutes: minutes,
    difficulty: difficultyOf(minutes, steps.length),
    servings: info?.servings ?? 2,
    rating: info?.spoonacularScore
      ? Math.round((info.spoonacularScore / 20) * 10) / 10 // 0-100 -> 0-5
      : undefined,
    matchPercentage,
    tags,
    ingredients,
    missingIngredients: missingNames.map(
      (name) => name.charAt(0).toUpperCase() + name.slice(1),
    ),
    instructions: steps,
  };
}

/**
 * Find real recipes that best match the ingredients the user actually has,
 * ranked so that the fewest missing ingredients come first.
 */
export async function findRecipesByIngredients(
  ingredients: string[],
  options: { number?: number; maxReadyTime?: number } = {},
): Promise<Recipe[]> {
  if (ingredients.length === 0) return [];

  const count = options.number ?? 6;

  // ranking=1 maximises the ingredients the user ACTUALLY has. (ranking=2
  // minimises missing ones, which just surfaces recipes with tiny ingredient
  // lists — it returned "Vegetable Dip" for rice+chicken+spinach.)
  // Over-fetch, then rank ourselves and keep the best.
  const hits = await call<FindByIngredientsHit[]>("/recipes/findByIngredients", {
    ingredients: ingredients.join(","),
    number: String(Math.min(count * 3, 20)),
    ranking: "1",
    ignorePantry: "true",
  });

  if (hits.length === 0) return [];

  // Best = uses most of what you have, then fewest missing.
  const ranked = [...hits]
    .sort(
      (a, b) =>
        b.usedIngredientCount - a.usedIngredientCount ||
        a.missedIngredientCount - b.missedIngredientCount,
    )
    .slice(0, count);

  const infos = await call<BulkInfo[]>("/recipes/informationBulk", {
    ids: ranked.map((hit) => hit.id).join(","),
    includeNutrition: "false",
  });

  const byId = new Map(infos.map((info) => [info.id, info]));
  const have = new Set(ingredients.map((item) => item.toLowerCase()));

  let recipes = ranked.map((hit) => toRecipe(hit, byId.get(hit.id), have));

  // Recipes with no instructions are useless to cook along with.
  recipes = recipes.filter((recipe) => recipe.instructions.length > 0);

  // Drop poor matches (e.g. 24% match needing 16 things you don't have) — but
  // only if doing so still leaves a decent set to show.
  const goodMatches = recipes.filter(
    (recipe) =>
      (recipe.matchPercentage ?? 0) >= 30 && recipe.missingIngredients.length <= 8,
  );
  if (goodMatches.length >= 3) recipes = goodMatches;

  if (options.maxReadyTime) {
    const withinTime = recipes.filter(
      (recipe) => recipe.cookingTimeMinutes <= options.maxReadyTime!,
    );
    // Only apply the filter if it doesn't wipe out every result.
    if (withinTime.length > 0) recipes = withinTime;
  }

  return recipes;
}
