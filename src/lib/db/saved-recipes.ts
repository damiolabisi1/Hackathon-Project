import "server-only";
import type { Recipe } from "@/types/recipe";
import { getDb } from "./mongodb";

/**
 * Saved (favourited) recipes, stored in MongoDB.
 *
 * The recipe's own `id` is used as the Mongo `_id`, so saving the same recipe
 * twice updates it rather than creating a duplicate.
 */

const COLLECTION = "savedRecipes";

export type SavedRecipe = Recipe & {
  /** ISO timestamp of when it was saved. */
  savedAt: string;
};

/** Shape as stored: the recipe, with its id promoted to Mongo's _id. */
type SavedRecipeDoc = Omit<Recipe, "id"> & {
  _id: string;
  savedAt: string;
};

function toSavedRecipe(doc: SavedRecipeDoc): SavedRecipe {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
}

async function collection() {
  const db = await getDb();
  return db.collection<SavedRecipeDoc>(COLLECTION);
}

/** Newest first. */
export async function listSavedRecipes(): Promise<SavedRecipe[]> {
  const col = await collection();
  const docs = await col.find({}).sort({ savedAt: -1 }).toArray();
  return docs.map(toSavedRecipe);
}

/** Save (or re-save) a recipe. Idempotent on recipe.id. */
export async function saveRecipe(recipe: Recipe): Promise<SavedRecipe> {
  const col = await collection();
  const { id, ...rest } = recipe;
  const savedAt = new Date().toISOString();

  await col.updateOne(
    { _id: id },
    { $set: { ...rest, savedAt } },
    { upsert: true },
  );

  return { ...recipe, savedAt };
}

/** Remove a saved recipe. Returns true if something was actually removed. */
export async function deleteSavedRecipe(id: string): Promise<boolean> {
  const col = await collection();
  const result = await col.deleteOne({ _id: id });
  return result.deletedCount > 0;
}

/** Whether a given recipe is already saved. */
export async function isRecipeSaved(id: string): Promise<boolean> {
  const col = await collection();
  return (await col.countDocuments({ _id: id }, { limit: 1 })) > 0;
}
