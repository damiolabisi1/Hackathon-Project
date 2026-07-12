import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChefHat,
  Clock3,
  Play,
  Star,
  UsersRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SaveRecipeButton } from "@/components/recipes/save-recipe-button";
import { mockRecipes } from "@/data/recipes";
import { getCachedRecipe } from "@/lib/db/recipes";

type RecipePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RecipePage({ params }: RecipePageProps) {
  const { id } = await params;

  // Recipes found for this user (Spoonacular) are cached in MongoDB; the demo
  // recipes are bundled. Check both so either kind opens.
  const recipe =
    (await getCachedRecipe(id)) ?? mockRecipes.find((item) => item.id === id);

  if (!recipe) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <Link
        href="/recipes"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-green-700"
      >
        <ArrowLeft className="size-4" />
        Back to recipes
      </Link>

      <div className="mt-8 grid gap-10 xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-muted shadow-sm">
            <Image
              src={recipe.image}
              alt={recipe.title}
              fill
              priority
              className="object-cover"
            />

            <SaveRecipeButton recipe={recipe} />
          </div>

          <div className="mt-7">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                  {recipe.title}
                </h1>

                <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
                  {recipe.description}
                </p>
              </div>

              {recipe.matchPercentage && (
                <span className="w-fit rounded-full bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
                  {recipe.matchPercentage}% match
                </span>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm font-medium">
                <Clock3 className="size-4 text-green-600" />
                {recipe.cookingTimeMinutes} min
              </span>

              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm font-medium">
                <ChefHat className="size-4 text-green-600" />
                {recipe.difficulty}
              </span>

              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm font-medium">
                <UsersRound className="size-4 text-green-600" />
                {recipe.servings} servings
              </span>

              {recipe.rating && (
                <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm font-medium">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  {recipe.rating}
                </span>
              )}
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-700">
                  What you need
                </p>

                <h2 className="mt-1 text-2xl font-extrabold">Ingredients</h2>
              </div>

              <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
                {recipe.ingredients.length} items
              </span>
            </div>

            <div className="mt-6 divide-y">
              {recipe.ingredients.map((ingredient) => (
                <div
                  key={ingredient.name}
                  className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                      ingredient.available
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {ingredient.available ? (
                      <Check className="size-4" />
                    ) : (
                      <X className="size-4" />
                    )}
                  </span>

                  <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                    <p className="font-semibold">{ingredient.name}</p>

                    <p className="text-sm text-muted-foreground">
                      {ingredient.amount}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {recipe.missingIngredients.length > 0 && (
              <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-bold text-red-700">
                  Missing ingredients
                </p>

                <p className="mt-1 text-sm leading-6 text-red-600">
                  {recipe.missingIngredients.join(", ")}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-green-700">Step by step</p>

            <h2 className="mt-1 text-2xl font-extrabold">Instructions</h2>

            <div className="mt-6 space-y-5">
              {recipe.instructions.map((instruction) => (
                <div key={instruction.step} className="flex items-start gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                    {instruction.step}
                  </span>

                  <p className="pt-1 text-sm leading-7 text-muted-foreground">
                    {instruction.instruction}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <Button
            nativeButton={false}
            size="lg"
            className="w-full"
            render={
              <Link href={`/recipes/${recipe.id}/cook`}>
                <Play className="size-5" />
                Start cooking
              </Link>
            }
          />
        </div>
      </div>
    </section>
  );
}
