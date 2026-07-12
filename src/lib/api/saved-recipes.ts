import type { Recipe } from "@/types/recipe";

export type SavedRecipe = Recipe & { savedAt: string };

async function parse(response: Response) {
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.message ?? "Saved recipes request failed.");
  }
  return result;
}

export async function fetchSavedRecipes(): Promise<SavedRecipe[]> {
  const response = await fetch("/api/recipes/saved", { cache: "no-store" });
  const result = await parse(response);
  return result.recipes ?? [];
}

/**
 * The ids of every saved recipe, shared across all the hearts on a page.
 *
 * A grid of recipe cards mounts one heart each; without this they would each
 * fire their own identical request. They share one instead.
 */
let savedIdsPromise: Promise<Set<string>> | null = null;

export function getSavedRecipeIds(): Promise<Set<string>> {
  if (!savedIdsPromise) {
    savedIdsPromise = fetchSavedRecipes()
      .then((recipes) => new Set(recipes.map((recipe) => recipe.id)))
      // No database configured — nothing is saved, and no heart should break.
      .catch(() => new Set<string>());
  }
  return savedIdsPromise;
}

/** Call after saving/unsaving so the next read reflects the change. */
export function invalidateSavedRecipeIds(): void {
  savedIdsPromise = null;
}

export async function saveRecipe(recipe: Recipe): Promise<SavedRecipe> {
  const response = await fetch("/api/recipes/saved", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipe }),
  });
  const result = await parse(response);
  return result.recipe;
}

export async function unsaveRecipe(id: string): Promise<void> {
  const response = await fetch(
    `/api/recipes/saved?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  await parse(response);
}
