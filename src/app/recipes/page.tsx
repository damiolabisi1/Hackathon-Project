"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Info, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { mockRecipes } from "@/data/recipes";
import type { Recipe } from "@/types/recipe";

/**
 * Recipes matched to the user's ingredients.
 *
 * /ingredients puts the results in sessionStorage and navigates here. They come
 * from Spoonacular (real recipes) and are personalised by Gemini where possible.
 *
 * With nothing generated yet we show the sample recipes instead — the home page
 * links straight here with "View sample recipes".
 */
export default function RecipesPage() {
  // Start with the samples so they render server-side and are visible instantly
  // (the home page's "View sample recipes" links straight here). If the user has
  // actually generated recipes, we swap them in on mount — sessionStorage isn't
  // readable during SSR.
  const [recipes, setRecipes] = useState<Recipe[]>(mockRecipes);
  const [showingSamples, setShowingSamples] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = sessionStorage.getItem("generatedRecipes");
        const generated = stored ? (JSON.parse(stored) as Recipe[]) : [];

        if (generated.length > 0) {
          setRecipes(generated);
          setShowingSamples(false);

          const storedNotice = sessionStorage.getItem("recipesNotice");
          if (storedNotice) setNotice(storedNotice);
        }
      } catch {
        // Unreadable — keep showing the samples.
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-green-100 text-green-700">
          <Sparkles className="size-5" />
        </span>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {showingSamples ? "Sample recipes" : "Recipes for you"}
          </h1>

          <p className="mt-1 text-muted-foreground">
            {showingSamples
              ? "A taste of what KitchenAid can do. Add your ingredients for recipes matched to you."
              : "Matched to the ingredients you already have."}
          </p>
        </div>
      </div>

      {notice && !showingSamples && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Info className="mt-0.5 size-4 shrink-0" />
          {notice}
        </div>
      )}

      {showingSamples && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            These are examples. Tell us what you actually have and we will find
            recipes you can cook right now.
          </p>

          <Button
            nativeButton={false}
            className="shrink-0"
            render={<Link href="/scan?mode=chat">Add my ingredients</Link>}
          />
        </div>
      )}

      {recipes.length > 0 && (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe, index) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              bestMatch={!showingSamples && index === 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}
