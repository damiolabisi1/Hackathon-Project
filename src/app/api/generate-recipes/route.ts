import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

type GenerateRecipesRequest = {
  ingredients: string[];
  servings?: number;
  maximumCookingTime?: number;
  dietaryPreferences?: string[];
  allergies?: string[];
  skillLevel?: "beginner" | "intermediate" | "advanced";
  appliances?: string[];
};

const recipeResponseSchema = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "A short unique ID for the recipe.",
          },
          name: {
            type: "string",
            description: "The recipe name.",
          },
          description: {
            type: "string",
            description: "A short, appealing description.",
          },
          prepTimeMinutes: {
            type: "integer",
          },
          cookTimeMinutes: {
            type: "integer",
          },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard"],
          },
          servings: {
            type: "integer",
          },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                },
                quantity: {
                  type: "string",
                },
                userAlreadyHas: {
                  type: "boolean",
                },
              },
              required: ["name", "quantity", "userAlreadyHas"],
            },
          },
          missingIngredients: {
            type: "array",
            items: {
              type: "string",
            },
          },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stepNumber: {
                  type: "integer",
                },
                instruction: {
                  type: "string",
                },
                estimatedMinutes: {
                  type: "integer",
                },
              },
              required: [
                "stepNumber",
                "instruction",
                "estimatedMinutes",
              ],
            },
          },
          substitutions: {
            type: "array",
            items: {
              type: "string",
            },
          },
          wasteReductionNote: {
            type: "string",
            description:
              "Explain briefly how the recipe uses the user's existing ingredients.",
          },
        },
        required: [
          "id",
          "name",
          "description",
          "prepTimeMinutes",
          "cookTimeMinutes",
          "difficulty",
          "servings",
          "ingredients",
          "missingIngredients",
          "steps",
          "substitutions",
          "wasteReductionNote",
        ],
      },
    },
  },
  required: ["recipes"],
};

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key is missing." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as GenerateRecipesRequest;

    if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      return NextResponse.json(
        { error: "Please provide at least one ingredient." },
        { status: 400 },
      );
    }

    const servings = body.servings ?? 2;
    const maximumCookingTime = body.maximumCookingTime ?? 30;
    const allergies = body.allergies ?? [];
    const dietaryPreferences = body.dietaryPreferences ?? [];
    const skillLevel = body.skillLevel ?? "beginner";
    const appliances = body.appliances ?? [
      "stove",
      "oven",
      "basic cookware",
    ];

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `
You are KitchenAid, a practical and accessible AI sous-chef.

Create exactly 3 realistic recipes using mostly the ingredients the user already has.

USER'S INGREDIENTS:
${body.ingredients.join(", ")}

SERVINGS:
${servings}

MAXIMUM TOTAL COOKING TIME:
${maximumCookingTime} minutes

ALLERGIES:
${allergies.length > 0 ? allergies.join(", ") : "None provided"}

DIETARY PREFERENCES:
${
  dietaryPreferences.length > 0
    ? dietaryPreferences.join(", ")
    : "None provided"
}

COOKING SKILL:
${skillLevel}

AVAILABLE APPLIANCES:
${appliances.join(", ")}

Rules:
1. Never include any listed allergen.
2. Respect all dietary preferences.
3. Use as many available ingredients as reasonably possible.
4. Keep missing ingredients minimal.
5. Use realistic quantities for ${servings} servings.
6. Keep each recipe within approximately ${maximumCookingTime} minutes.
7. Write clear steps suitable for a beginner and voice guidance.
8. Do not assume ingredients are fresh or safe to eat.
9. Do not provide exact medical or nutritional claims.
10. Make the three recipes noticeably different from one another.
11. Mark whether each ingredient is already available to the user.
12. Include useful substitutions where appropriate.
`;

    const interaction = await ai.interactions.create({
      model: "gemini-3.5-flash",
      input: prompt,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: recipeResponseSchema,
      },
    });

    if (!interaction.output_text) {
      throw new Error("Gemini returned an empty response.");
    }

    const result = JSON.parse(interaction.output_text);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Recipe generation error:", error);

    return NextResponse.json(
      {
        error: "Unable to generate recipes right now.",
      },
      {
        status: 500,
      },
    );
  }
}