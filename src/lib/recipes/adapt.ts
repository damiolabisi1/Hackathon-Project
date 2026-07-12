import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { Recipe } from "@/types/recipe";

/**
 * Gemini personalises real recipes that Spoonacular already found.
 *
 * Deliberately ONE Gemini call for the whole batch: the free tier is tiny, and
 * recipe generation is not where the intelligence needs to be — the recipes are
 * already real. Gemini's job is only to tailor them to this user (diet,
 * substitutions for what they're missing, serving size).
 *
 * If Gemini is rate-limited or unset, this returns the recipes untouched. A
 * personalised description is a bonus; losing it must never break the feature.
 */

export type AdaptedRecipe = Recipe & {
  /** Swaps Gemini suggests for ingredients the user doesn't have. */
  substitutions?: { from: string; to: string }[];
  /** A short note about how it fits their dietary preferences. */
  dietNote?: string;
};

type AdaptationContext = {
  ingredients: string[];
  dietaryPreferences?: string[];
  servings?: number;
};

const adaptationSchema = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          description: {
            type: "string",
            description:
              "One or two warm sentences about this recipe for THIS user.",
          },
          substitutions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string" },
                to: { type: "string" },
              },
              required: ["from", "to"],
            },
          },
          dietNote: { type: "string" },
        },
        required: ["id", "description"],
      },
    },
  },
  required: ["recipes"],
};

type AdaptationResult = {
  recipes: {
    id: string;
    description: string;
    substitutions?: { from: string; to: string }[];
    dietNote?: string;
  }[];
};

export async function adaptRecipes(
  recipes: Recipe[],
  context: AdaptationContext,
): Promise<{ recipes: AdaptedRecipe[]; adapted: boolean; reason?: string }> {
  if (recipes.length === 0 || !process.env.GEMINI_API_KEY) {
    return { recipes, adapted: false, reason: "Gemini not configured." };
  }

  const summary = recipes
    .map(
      (recipe) =>
        `- id: ${recipe.id} | ${recipe.title} | missing: ${
          recipe.missingIngredients.join(", ") || "nothing"
        }`,
    )
    .join("\n");

  const prompt = `
You are KitchenAid, a friendly kitchen assistant.

The user has these ingredients: ${context.ingredients.join(", ")}.
Dietary preferences: ${context.dietaryPreferences?.join(", ") || "none"}.
Preferred servings: ${context.servings ?? "unspecified"}.

These real recipes were matched to their ingredients:
${summary}

For EACH recipe, using its exact id:
1. Write a short, warm description (1-2 sentences) explaining why it suits this user.
2. If it is missing ingredients, suggest a realistic substitution the user could
   use instead. Only substitute things that are genuinely missing.
3. If they gave dietary preferences, add a one-line note on how it fits, or how
   to adjust it.

Do not invent new recipes. Do not change the cooking steps.
`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const interaction = await ai.interactions.create({
      model: "gemini-3.5-flash",
      input: prompt,
      generation_config: {
        thinking_level: "minimal",
      },
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: adaptationSchema,
      },
    });

    if (!interaction.output_text) {
      return { recipes, adapted: false, reason: "Gemini returned nothing." };
    }

    const result = JSON.parse(interaction.output_text) as AdaptationResult;
    const byId = new Map(result.recipes.map((item) => [item.id, item]));

    const merged: AdaptedRecipe[] = recipes.map((recipe) => {
      const extra = byId.get(recipe.id);
      if (!extra) return recipe;

      return {
        ...recipe,
        description: extra.description || recipe.description,
        substitutions: extra.substitutions,
        dietNote: extra.dietNote,
      };
    });

    return { recipes: merged, adapted: true };
  } catch (error) {
    // Rate limited or otherwise unavailable — the real recipes still stand.
    const reason =
      error instanceof Error && /429|quota/i.test(error.message)
        ? "Gemini is rate-limited, so recipes are shown unpersonalised."
        : "Gemini could not personalise these recipes.";

    console.error("Recipe adaptation failed:", error);
    return { recipes, adapted: false, reason };
  }
}
