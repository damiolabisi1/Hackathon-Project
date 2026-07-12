"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, Heart, LoaderCircle, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  fetchSavedRecipes,
  unsaveRecipe,
  type SavedRecipe,
} from "@/lib/api/saved-recipes";

export default function SavedRecipesPage() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const saved = await fetchSavedRecipes();
        if (!cancelled) setRecipes(saved);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load your saved recipes.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(id: string) {
    setRemovingId(id);

    try {
      await unsaveRecipe(id);
      setRecipes((current) => current.filter((recipe) => recipe.id !== id));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not remove it.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-green-100 text-green-700">
          <Heart className="size-5" />
        </span>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Saved recipes
          </h1>

          <p className="mt-1 text-muted-foreground">
            Recipes you have saved, stored in your recipe box.
          </p>
        </div>
      </div>

      {loading && (
        <div className="mt-10 flex items-center gap-2 text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading your recipes...
        </div>
      )}

      {!loading && error && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && recipes.length === 0 && (
        <div className="mt-10 rounded-3xl border border-dashed p-10 text-center">
          <p className="font-semibold">No saved recipes yet.</p>

          <p className="mt-2 text-sm text-muted-foreground">
            Save a recipe and it will show up here.
          </p>

          <Button
            nativeButton={false}
            className="mt-6"
            render={<Link href="/scan?mode=chat">Find a recipe</Link>}
          />
        </div>
      )}

      {!loading && recipes.length > 0 && (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="relative flex flex-col overflow-hidden rounded-3xl border bg-white shadow-sm"
            >
              <button
                type="button"
                aria-label={`Remove ${recipe.title} from saved recipes`}
                title="Saved — click to remove"
                disabled={removingId === recipe.id}
                onClick={() => remove(recipe.id)}
                className="absolute top-4 right-4 z-20 flex size-11 items-center justify-center rounded-full border border-white/80 bg-white/95 text-red-500 shadow-md backdrop-blur transition hover:scale-105 disabled:opacity-60"
              >
                {removingId === recipe.id ? (
                  <LoaderCircle className="size-5 animate-spin" />
                ) : (
                  <Heart className="size-5 fill-current" />
                )}
              </button>

              <div className="relative aspect-[4/3] bg-muted">
                <Image
                  src={recipe.image}
                  alt={recipe.imageAlt || `Photo representing ${recipe.title}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h2 className="text-lg font-bold">{recipe.title}</h2>

                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {recipe.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" />
                    {recipe.cookingTimeMinutes} min
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Users className="size-4" />
                    {recipe.servings} servings
                  </span>

                  <span>{recipe.difficulty}</span>
                </div>

                <Button
                  nativeButton={false}
                  variant="outline"
                  className="mt-5 w-full"
                  render={<Link href={`/recipes/${recipe.id}`}>View</Link>}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
