import { NextResponse } from "next/server";
import {
  findRecipesByIngredients,
  isSpoonacularConfigured,
} from "@/lib/recipes/spoonacular";
import { adaptRecipes } from "@/lib/recipes/adapt";
import { cacheRecipes } from "@/lib/db/recipes";

/**
 * POST /api/recipes/find
 *
 * Real recipes first, AI second:
 *   1. Spoonacular finds recipes that actually match the user's ingredients.
 *   2. Gemini personalises them (diet, substitutions) in a single call.
 *
 * If Gemini is rate-limited the real recipes are still returned, just
 * unpersonalised — the feature degrades instead of failing.
 */

type FindRequest = {
  ingredients?: string[];
  dietaryPreferences?: string[];
  maximumCookingTime?: number;
  servings?: number;
};

export async function POST(request: Request) {
  if (!isSpoonacularConfigured()) {
    return NextResponse.json(
      {
        error:
          "SPOONACULAR_API_KEY is not set. Add it to .env.local (see .env.template).",
      },
      { status: 503 },
    );
  }

  let body: FindRequest;
  try {
    body = (await request.json()) as FindRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const ingredients = (body.ingredients ?? [])
    .map((item) => item.trim())
    .filter(Boolean);

  if (ingredients.length === 0) {
    return NextResponse.json(
      { error: "At least one ingredient is required." },
      { status: 400 },
    );
  }

  try {
    const found = await findRecipesByIngredients(ingredients, {
      number: 6,
      maxReadyTime: body.maximumCookingTime,
    });

    if (found.length === 0) {
      return NextResponse.json(
        {
          error:
            "No recipes matched those ingredients. Try adding a couple more.",
        },
        { status: 404 },
      );
    }

    const { recipes, adapted, reason } = await adaptRecipes(found, {
      ingredients,
      dietaryPreferences: body.dietaryPreferences,
      servings: body.servings,
    });

    // Cache them so /recipes/<id> (a server component) can look them up.
    await cacheRecipes(recipes);

    return NextResponse.json({
      recipes,
      source: "spoonacular",
      personalised: adapted,
      // Present when Gemini couldn't personalise, so the UI can say why.
      notice: adapted ? undefined : reason,
    });
  } catch (error) {
    console.error("Recipe search failed:", error);

    const message =
      error instanceof Error ? error.message : "We could not find recipes.";

    // Spoonacular's own daily cap.
    const status = /quota/i.test(message) ? 429 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
