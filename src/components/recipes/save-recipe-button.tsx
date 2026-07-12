"use client";

import { useEffect, useState } from "react";
import { Heart, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Recipe } from "@/types/recipe";
import {
  getSavedRecipeIds,
  invalidateSavedRecipeIds,
  saveRecipe,
  unsaveRecipe,
} from "@/lib/api/saved-recipes";

type SaveRecipeButtonProps = {
  recipe: Recipe;
  /** Position/size overrides — the card heart is smaller than the detail one. */
  className?: string;
  iconClassName?: string;
};

/**
 * The heart on a recipe. Persists it to MongoDB so it appears on /saved.
 * Used on both the recipe cards and the recipe detail page.
 */
export function SaveRecipeButton({
  recipe,
  className,
  iconClassName,
}: SaveRecipeButtonProps) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Reflect what's already stored. All hearts on the page share one request.
  useEffect(() => {
    let cancelled = false;

    getSavedRecipeIds().then((ids) => {
      if (!cancelled) setSaved(ids.has(recipe.id));
    });

    return () => {
      cancelled = true;
    };
  }, [recipe.id]);

  async function toggle(event: React.MouseEvent) {
    // The card is wrapped in a link to the recipe — don't navigate on save.
    event.preventDefault();
    event.stopPropagation();

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
      invalidateSavedRecipeIds();
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
        className={cn(
          "absolute top-4 right-4 z-20 flex size-11 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:text-red-500 disabled:opacity-60",
          saved ? "text-red-500" : "text-gray-700",
          className,
        )}
      >
        {busy ? (
          <LoaderCircle className={cn("size-5 animate-spin", iconClassName)} />
        ) : (
          <Heart
            className={cn("size-5", saved && "fill-current", iconClassName)}
          />
        )}
      </button>

      {error && (
        <p className="absolute right-3 bottom-3 z-20 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700 shadow-sm">
          {error}
        </p>
      )}
    </>
  );
}
