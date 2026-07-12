import { NextResponse } from "next/server";
import type { Recipe } from "@/types/recipe";
import { isDbConfigured } from "@/lib/db/mongodb";
import {
  deleteSavedRecipe,
  listSavedRecipes,
  saveRecipe,
} from "@/lib/db/saved-recipes";

/**
 * Saved recipes, backed by MongoDB.
 *
 *   GET    /api/recipes/saved        -> { recipes: SavedRecipe[] }
 *   POST   /api/recipes/saved        -> body { recipe } -> saves it
 *   DELETE /api/recipes/saved?id=xxx -> removes it
 */

function dbMissing() {
  return NextResponse.json(
    {
      message:
        "MongoDB is not configured. Add MONGODB_URI to .env.local (see .env.template).",
    },
    { status: 503 },
  );
}

function failed(error: unknown, action: string) {
  console.error(`Saved recipes (${action}) failed:`, error);
  const message = error instanceof Error ? error.message : `Could not ${action}.`;
  return NextResponse.json({ message }, { status: 500 });
}

export async function GET() {
  if (!isDbConfigured()) return dbMissing();

  try {
    const recipes = await listSavedRecipes();
    return NextResponse.json({ recipes });
  } catch (error) {
    return failed(error, "load saved recipes");
  }
}

export async function POST(request: Request) {
  if (!isDbConfigured()) return dbMissing();

  try {
    const body = (await request.json()) as { recipe?: Recipe };
    const recipe = body.recipe;

    if (!recipe?.id || !recipe.title) {
      return NextResponse.json(
        { message: "A recipe with an id and title is required." },
        { status: 400 },
      );
    }

    const saved = await saveRecipe(recipe);
    return NextResponse.json({ recipe: saved }, { status: 201 });
  } catch (error) {
    return failed(error, "save recipe");
  }
}

export async function DELETE(request: Request) {
  if (!isDbConfigured()) return dbMissing();

  try {
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { message: "An id query parameter is required." },
        { status: 400 },
      );
    }

    const removed = await deleteSavedRecipe(id);
    return NextResponse.json({ removed });
  } catch (error) {
    return failed(error, "remove saved recipe");
  }
}
