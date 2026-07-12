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
