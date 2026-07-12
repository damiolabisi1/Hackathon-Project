"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { mockRecipes } from "@/data/recipes";
import type { Recipe } from "@/types/recipe";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [showingSamples, setShowingSamples] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedRecipes = sessionStorage.getItem("generatedRecipes");

      if (storedRecipes) {
        const generatedRecipes = JSON.parse(storedRecipes) as Recipe[];

        if (generatedRecipes.length > 0) {
          setRecipes(generatedRecipes);
          setShowingSamples(false);
          return;
        }
      }

      setRecipes(mockRecipes);
      setShowingSamples(true);
    } catch (error) {
      console.error("Could not load recipes:", error);
      setRecipes(mockRecipes);
      setShowingSamples(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return (
      <section className="mx-auto max-w-6xl px-6 py-20 text-center lg:px-10">
        <Sparkles className="mx-auto size-8 animate-pulse text-green-600" />
        <h1 className="mt-4 text-2xl font-bold">Loading your recipes...</h1>
      </section>
    );
  }

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
              : "Matched to the ingredients and preferences you selected."}
          </p>
        </div>
      </div>

      {showingSamples && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            These are examples. Tell us what you have and we will generate
            recipes you can cook right now.
          </p>

          <Button
            nativeButton={false}
            className="shrink-0"
            render={<Link href="/scan?mode=chat">Add my ingredients</Link>}
          />
        </div>
      )}

      {recipes.length > 0 ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe, index) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              bestMatch={!showingSamples && index === 0}
            />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-dashed p-12 text-center">
          <Sparkles className="mx-auto size-8 text-green-600" />
          <h2 className="mt-4 text-xl font-bold">No recipes found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add your ingredients and generate recipes first.
          </p>
          <Button
            nativeButton={false}
            className="mt-6"
            render={<Link href="/scan">Add ingredients</Link>}
          />
        </div>
      )}
    </section>
  );
}
