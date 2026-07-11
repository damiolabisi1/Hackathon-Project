import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ingredientSchema = {
  type: "object",
  properties: {
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "A simple, ordinary ingredient name.",
          },
          confidence: {
            type: "number",
            description: "Confidence between 0 and 1.",
          },
        },
        required: ["name", "confidence"],
      },
    },
    uncertainItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
          },
          confidence: {
            type: "number",
          },
        },
        required: ["name", "confidence"],
      },
    },
  },
  required: ["ingredients", "uncertainItems"],
};

type GeminiIngredientResult = {
  ingredients: {
    name: string;
    confidence: number;
  }[];
  uncertainItems: {
    name: string;
    confidence: number;
  }[];
};

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { message: "Gemini API key is missing." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { message: "Please upload an image." },
        { status: 400 },
      );
    }

    if (!image.type.startsWith("image/")) {
      return NextResponse.json(
        { message: "The uploaded file must be an image." },
        { status: 400 },
      );
    }

    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { message: "The image must be smaller than 10 MB." },
        { status: 400 },
      );
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const base64Image = imageBuffer.toString("base64");

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const interaction = await ai.interactions.create({
      model: "gemini-3.5-flash",
      input: [
        {
          type: "text",
          text: `
You are the ingredient-recognition component of KitchenAid.

Analyze the uploaded photo of a fridge, pantry, countertop, or groceries.

Rules:
1. Return only ingredients visibly present.
2. Do not invent ingredients that cannot be seen.
3. Use simple names such as "eggs", "tomatoes", or "chicken breast".
4. Put clearly visible ingredients in ingredients.
5. Put unclear or partially hidden food items in uncertainItems.
6. Give each item a confidence value from 0 to 1.
7. Do not decide whether food is spoiled, safe, allergen-free, or expired.
8. Do not include kitchen equipment, packaging, shelves, containers, or utensils.
9. Avoid duplicate ingredient names.
          `,
        },
        {
          type: "image",
          data: base64Image,
          mime_type: image.type,
        },
      ],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: ingredientSchema,
      },
    });

    if (!interaction.output_text) {
      throw new Error("Gemini returned an empty response.");
    }

    const result = JSON.parse(
      interaction.output_text,
    ) as GeminiIngredientResult;

   const detectedIngredients = [
    ...result.ingredients.map((ingredient) => ({
      id: crypto.randomUUID(),
      name: ingredient.name,
      confidence: ingredient.confidence,
      confirmed: true,
    })),

  ...result.uncertainItems.map((ingredient) => ({
    id: crypto.randomUUID(),
    name: ingredient.name,
    confidence: ingredient.confidence,
    confirmed: false,
    })),
  ];

  if (detectedIngredients.length === 0) {
    return NextResponse.json(
      { message: "No recognizable ingredients were found." },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ingredients: detectedIngredients,
    uncertainItems: [],
  });
  } catch (error) {
    console.error("Ingredient detection error:", error);

    return NextResponse.json(
      { message: "We could not identify the ingredients." },
      { status: 500 },
    );
  }
}