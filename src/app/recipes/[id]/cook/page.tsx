"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { CookMode } from "@/components/cook/cook-mode";
import { Button } from "@/components/ui/button";
import { mockRecipes } from "@/data/recipes";
import { fetchSavedRecipes } from "@/lib/api/saved-recipes";
import type { Recipe } from "@/types/recipe";

export default function RecipeCookPage() {
  const params = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRecipe() {
      try {
        const selectedRecipe = sessionStorage.getItem("selectedRecipe");

        if (selectedRecipe) {
          const parsed = JSON.parse(selectedRecipe) as Recipe;
          if (parsed.id === params.id) {
            if (!cancelled) setRecipe(parsed);
            return;
          }
        }

        const generatedRecipes = sessionStorage.getItem("generatedRecipes");

        if (generatedRecipes) {
          const generated = (JSON.parse(generatedRecipes) as Recipe[]).find(
            (item) => item.id === params.id,
          );

          if (generated) {
            if (!cancelled) setRecipe(generated);
            return;
          }
        }

        const sample = mockRecipes.find((item) => item.id === params.id);
        if (sample) {
          if (!cancelled) setRecipe(sample);
          return;
        }

        const savedRecipes = await fetchSavedRecipes();
        const saved = savedRecipes.find((item) => item.id === params.id);
        if (!cancelled) setRecipe(saved ?? null);
      } catch (error) {
        console.error("Could not open recipe in cook mode:", error);
        if (!cancelled) setRecipe(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadRecipe();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (isLoading) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Opening Cook Mode...
      </section>
    );
  }

  if (!recipe) {
    return (
      <section className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold">Recipe not found</h1>
        <p className="mt-3 text-muted-foreground">
          This recipe is no longer available in your current session.
        </p>
        <Button
          nativeButton={false}
          className="mt-6"
          render={<Link href="/recipes">Back to recipes</Link>}
        />
      </section>
    );
  }

  return <CookMode recipe={recipe} />;
}
