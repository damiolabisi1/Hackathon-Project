"use client";

import { useEffect, useState } from "react";
import { Heart, LoaderCircle } from "lucide-react";

import type { Recipe } from "@/types/recipe";
import {
  fetchSavedRecipes,
  saveRecipe,
  unsaveRecipe,
} from "@/lib/api/saved-recipes";

/**
 * The heart on a recipe. Persists the recipe to MongoDB so it shows up on
 * /saved. Keeps the original floating-overlay styling.
 */
export function SaveRecipeButton({ recipe }: { recipe: Recipe }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Reflect whatever is already stored.
  useEffect(() => {
    let cancelled = false;

    fetchSavedRecipes()
      .then((recipes) => {
        if (!cancelled) {
          setSaved(recipes.some((item) => item.id === recipe.id));
        }
      })
      .catch(() => {
        // No database configured yet — leave the heart unfilled rather than
        // breaking the page.
      });

    return () => {
      cancelled = true;
    };
  }, [recipe.id]);

  async function toggle() {
    setBusy(true);
    setError("");

    try {
      if (saved) {
        await unsaveRecipe(recipe.id);
        setSaved(false);
      } else {
        await saveRecipe(recipe);
        setSaved(true);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save the recipe.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${recipe.title}` : `Save ${recipe.title}`}
        title={saved ? "Saved — click to remove" : "Save recipe"}
        className={`absolute top-4 right-4 z-20 flex size-11 items-center justify-center rounded-full border border-white/80 bg-white/95 shadow-md backdrop-blur transition hover:scale-105 hover:text-red-500 disabled:opacity-60 ${
          saved ? "text-red-500" : "text-gray-700"
        }`}
      >
        {busy ? (
          <LoaderCircle className="size-5 animate-spin" />
        ) : (
          <Heart className={`size-5 ${saved ? "fill-current" : ""}`} />
        )}
      </button>

      {error && (
        <p className="absolute right-4 bottom-4 z-20 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 shadow-sm">
          {error}
        </p>
      )}
    </>
  );
}
