import Image from "next/image";
import Link from "next/link";
import { Clock3, Heart, Star, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Recipe } from "@/types/recipe";

type RecipeCardProps = {
  recipe: Recipe;
  bestMatch?: boolean;
};

export function RecipeCard({ recipe, bestMatch = false }: RecipeCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      {bestMatch && (
        <span className="absolute left-3 top-3 z-20 rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">
          Best match
        </span>
      )}

      <button
        type="button"
        aria-label={`Save ${recipe.title}`}
        className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm transition hover:text-red-500"
      >
        <Heart className="size-4" />
      </button>

      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <Image
          src={recipe.image}
          alt={recipe.imageAlt || `Photo representing ${recipe.title}`}
          fill
          unoptimized
          className="object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      {recipe.photographer && recipe.photoUrl && (
        <p className="px-5 pt-2 text-xs text-muted-foreground">
          Photo by{" "}
          <a
            href={recipe.photographerUrl ?? recipe.photoUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {recipe.photographer}
          </a>{" "}
          on{" "}
          <a
            href={recipe.photoUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Pexels
          </a>
        </p>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">
              {recipe.title}
            </h2>

            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {recipe.description}
            </p>
          </div>

          {recipe.matchPercentage && (
            <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
              {recipe.matchPercentage}%
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock3 className="size-4" />
            {recipe.cookingTimeMinutes} min
          </span>

          <span>{recipe.difficulty}</span>

          <span className="flex items-center gap-1.5">
            <UsersRound className="size-4" />
            {recipe.servings}
          </span>

          {recipe.rating && (
            <span className="flex items-center gap-1">
              <Star className="size-4 fill-amber-400 text-amber-400" />
              {recipe.rating}
            </span>
          )}
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Uses
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {recipe.ingredients
              .filter((ingredient) => ingredient.available)
              .slice(0, 4)
              .map((ingredient) => (
                <span
                  key={ingredient.name}
                  className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
                >
                  {ingredient.name}
                </span>
              ))}
          </div>
        </div>

        {recipe.missingIngredients.length > 0 && (
          <p className="mt-4 text-xs text-red-600">
            Missing: {recipe.missingIngredients.join(", ")}
          </p>
        )}

        <Button
          nativeButton={false}
          variant="outline"
          className="mt-5 w-full border-green-600 text-green-700 hover:bg-green-50"
          render={<Link href={`/recipes/${recipe.id}`}>View recipe</Link>}
        />
      </div>
    </article>
  );
}
