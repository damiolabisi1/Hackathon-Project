import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type IngredientChatRequest = {
  messages: ChatMessage[];
};

const chatResponseSchema = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description:
        "A short conversational reply or follow-up question for the user.",
    },
    ingredients: {
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
    readyToContinue: {
      type: "boolean",
      description:
        "True when the user has given enough ingredient information to continue.",
    },
  },
  required: ["reply", "ingredients", "readyToContinue"],
};

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { message: "Gemini API key is missing." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as IngredientChatRequest;

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { message: "A conversation message is required." },
        { status: 400 },
      );
    }

    const conversation = body.messages
      .map(
        (message) =>
          `${message.role === "user" ? "User" : "KitchenAid"}: ${
            message.content
          }`,
      )
      .join("\n");

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `
You are KitchenAid, a friendly AI kitchen assistant.

Your job is to help the user describe the food ingredients they currently have.

CONVERSATION:
${conversation}

Instructions:
1. Extract every food ingredient the user has clearly mentioned.
2. Ask only one short, useful follow-up question at a time.
3. Do not ask unnecessary questions once enough ingredients have been provided.
4. Do not invent ingredients.
5. Do not assume quantities unless the user gives them.
6. Do not generate recipes yet.
7. Keep the response warm and concise.
8. If the user appears finished, summarize the ingredients and set readyToContinue to true.
9. If more information would help, set readyToContinue to false.
10. Ingredient confidence should be between 0 and 1.
11. Do not determine whether food is spoiled, safe, expired, or allergen-free.

Examples of useful follow-up questions:
- "Do you have any vegetables, proteins, or pantry staples to add?"
- "Anything else, such as spices, oil, milk, or cheese?"
- "Is that everything you would like to cook with today?"

Do not ask about dietary preferences, cooking time, or servings here. Those are collected on the next page.
`;

    const interaction = await ai.interactions.create({
      model: "gemini-3.5-flash",
      input: prompt,
      // Extracting ingredients from a sentence needs no deep reasoning, and
      // this runs in a live voice loop — default thinking added ~18s per turn.
      generation_config: {
        thinking_level: "minimal",
      },
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: chatResponseSchema,
      },
    });

    if (!interaction.output_text) {
      throw new Error("Gemini returned an empty response.");
    }

    const result = JSON.parse(interaction.output_text);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Ingredient chat failed:", error);

    // A Gemini rate limit is not an app failure — say so plainly instead of
    // showing a generic error that looks like the app is broken.
    const detail = error instanceof Error ? error.message : "";
    const isRateLimited =
      detail.includes("429") ||
      detail.includes("RESOURCE_EXHAUSTED") ||
      detail.toLowerCase().includes("quota");

    if (isRateLimited) {
      return NextResponse.json(
        {
          message:
            "The AI is rate-limited right now (Gemini free-tier quota). Wait a moment and try again.",
        },
        { status: 429 },
      );
    }

    if (detail.includes("API key") || detail.includes("API_KEY")) {
      return NextResponse.json(
        { message: "The Gemini API key is missing or invalid." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        message: "We could not process your ingredients right now.",
      },
      { status: 500 },
    );
  }
}