"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, Sparkles } from "lucide-react";

import { RecipeCard } from "@/components/recipes/recipe-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Recipe } from "@/types/recipe";

const filters = [
  "All",
  "Quick",
  "Easy",
  "High protein",
  "Vegetarian",
  "Budget friendly",
];

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedRecipes = sessionStorage.getItem("generatedRecipes");

    if (!storedRecipes) {
      setRecipes([]);
      setIsLoading(false);
      return;
    }

    try {
      const parsedRecipes: Recipe[] = JSON.parse(storedRecipes);
      setRecipes(parsedRecipes);
    } catch {
      setRecipes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const matchesSearch =
        (recipe.title ?? "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        (recipe.description ?? "")
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesFilter =
        activeFilter === "All" ||
        recipe.tags.includes(activeFilter) ||
        recipe.difficulty === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [recipes, activeFilter, search]);

  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-20 text-center lg:px-10">
        <Sparkles className="mx-auto size-8 animate-pulse text-green-600" />

        <h1 className="mt-4 text-2xl font-bold">
          Loading your recipes
        </h1>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
            <Sparkles className="size-4" />
            Step 3 of 3
          </div>

          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
            Recipes for you
          </h1>

          <p className="mt-3 max-w-2xl text-muted-foreground">
            Based on your ingredients and preferences, here are the recipes that
            match best.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <div className="relative min-w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search recipes..."
              className="pl-9"
            />
          </div>

          <Button type="button" variant="outline">
            <SlidersHorizontal className="size-4" />
            Filters
          </Button>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              activeFilter === filter
                ? "border-green-600 bg-green-600 text-white"
                : "bg-white text-muted-foreground hover:border-green-300 hover:text-green-700"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {filteredRecipes.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRecipes.map((recipe, index) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              bestMatch={index === 0 && activeFilter === "All"}
            />
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-3xl border border-dashed p-14 text-center">
          <Search className="mx-auto size-8 text-green-600" />

          <h2 className="mt-4 text-xl font-bold">
            No generated recipes found
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Return to the ingredients page and generate recipes first.
          </p>
        </div>
      )}
    </section>
  );
}