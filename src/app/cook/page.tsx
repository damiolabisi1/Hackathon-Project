import Link from "next/link";
import Image from "next/image";
import { ChefHat, Clock3, Mic, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CookMode } from "@/components/cook/cook-mode";
import { mockRecipes } from "@/data/recipes";
import { getCachedRecipe } from "@/lib/db/recipes";
import { listSavedRecipes } from "@/lib/db/saved-recipes";
import type { Recipe } from "@/types/recipe";

type CookPageProps = {
  searchParams: Promise<{ recipe?: string }>;
};

/**
 * Cook Mode — reached from the sidebar.
 *
 * With ?recipe=<id> it cooks that recipe. Without one it asks which recipe to
 * cook, offering the user's saved recipes first and the demo recipes after.
 */
export default async function CookPage({ searchParams }: CookPageProps) {
  const { recipe: recipeId } = await searchParams;

  if (recipeId) {
    const recipe =
      (await getCachedRecipe(recipeId)) ??
      mockRecipes.find((item) => item.id === recipeId);

    if (recipe) {
      return <CookMode recipe={recipe} />;
    }
  }

  // A missing database shouldn't stop someone cooking a demo recipe.
  let saved: Recipe[] = [];
  try {
    saved = await listSavedRecipes();
  } catch {
    saved = [];
  }

  const savedIds = new Set(saved.map((item) => item.id));
  const samples = mockRecipes.filter((item) => !savedIds.has(item.id));

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-green-100 text-green-700">
          <Mic className="size-5" />
        </span>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Cook Mode</h1>

          <p className="mt-1 text-muted-foreground">
            Pick a recipe and I&apos;ll talk you through it, step by step, hands
            free.
          </p>
        </div>
      </div>

      {saved.length > 0 && (
        <RecipeRow title="Your saved recipes" recipes={saved} />
      )}

      <RecipeRow
        title={saved.length > 0 ? "Or try one of these" : "Choose a recipe"}
        recipes={samples}
      />

      {saved.length === 0 && samples.length === 0 && (
        <div className="mt-10 rounded-3xl border border-dashed p-10 text-center">
          <ChefHat className="mx-auto size-8 text-green-600" />

          <p className="mt-4 font-semibold">No recipes yet.</p>

          <p className="mt-2 text-sm text-muted-foreground">
            Tell us what ingredients you have and we&apos;ll find one.
          </p>

          <Button
            nativeButton={false}
            className="mt-6"
            render={<Link href="/scan?mode=chat">Find a recipe</Link>}
          />
        </div>
      )}
    </section>
  );
}

function RecipeRow({ title, recipes }: { title: string; recipes: Recipe[] }) {
  if (recipes.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold">{title}</h2>

      <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {recipes.map((recipe) => (
          <article
            key={recipe.id}
            className="group overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
              <Image
                src={recipe.image}
                alt={recipe.title}
                fill
                className="object-cover transition duration-300 group-hover:scale-105"
              />
            </div>

            <div className="p-5">
              <h3 className="text-lg font-extrabold tracking-tight">
                {recipe.title}
              </h3>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock3 className="size-4" />
                  {recipe.cookingTimeMinutes} min
                </span>

                <span className="flex items-center gap-1.5">
                  <UsersRound className="size-4" />
                  {recipe.servings}
                </span>

                <span>{recipe.difficulty}</span>
              </div>

              <Button
                nativeButton={false}
                className="mt-5 w-full"
                render={
                  <Link href={`/cook?recipe=${recipe.id}`}>
                    <Mic className="size-4" />
                    Cook this
                  </Link>
                }
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
