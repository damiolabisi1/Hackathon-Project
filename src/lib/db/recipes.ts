import "server-only";
import type { Recipe } from "@/types/recipe";
import { getDb, isDbConfigured } from "./mongodb";

/**
 * A cache of recipes we've shown the user.
 *
 * Recipes found via Spoonacular only live in the browser's sessionStorage,
 * which the server can't read — so opening /recipes/<id> would 404. Caching
 * them here means the detail page (a server component) can look any recipe up
 * by id, and it doubles as a cache so we don't re-hit Spoonacular's daily quota.
 */

const COLLECTION = "recipes";

type RecipeDoc = Omit<Recipe, "id"> & { _id: string; cachedAt: string };

async function collection() {
  const db = await getDb();
  return db.collection<RecipeDoc>(COLLECTION);
}

/** Store recipes so they can be looked up by id later. Best-effort. */
export async function cacheRecipes(recipes: Recipe[]): Promise<void> {
  if (!isDbConfigured() || recipes.length === 0) return;

  try {
    const col = await collection();
    const cachedAt = new Date().toISOString();

    await col.bulkWrite(
      recipes.map((recipe) => {
        const { id, ...rest } = recipe;
        return {
          updateOne: {
            filter: { _id: id },
            update: { $set: { ...rest, cachedAt } },
            upsert: true,
          },
        };
      }),
    );
  } catch (error) {
    // Caching is an optimisation. Never fail a search because of it.
    console.error("Caching recipes failed:", error);
  }
}

/** Look up a single recipe by id. Returns null if unknown or no database. */
export async function getCachedRecipe(id: string): Promise<Recipe | null> {
  if (!isDbConfigured()) return null;

  try {
    const col = await collection();
    const doc = await col.findOne({ _id: id });
    if (!doc) return null;

    const { _id, cachedAt, ...rest } = doc;
    void cachedAt; // stored for cache housekeeping, not part of a Recipe
    return { ...rest, id: _id };
  } catch (error) {
    console.error("Looking up a cached recipe failed:", error);
    return null;
  }
}
