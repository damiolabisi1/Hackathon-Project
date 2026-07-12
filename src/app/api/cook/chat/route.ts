import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import type { CookChatRequest } from "@/lib/cook/types";

/**
 * POST /api/cook/chat — the sous-chef's brain.
 *
 * The ENTIRE cooking session goes in (recipe, current step, servings,
 * substitutions already made, conversation history), so the assistant never
 * answers as if it has no memory. "How much salt?" resolves against the current
 * recipe, the current step and the current serving size, with no need for the
 * user to restate anything.
 *
 * It returns what to SAY plus what to DO — the actions are what make a
 * substitution or a serving change actually stick for every later instruction.
 */

const cookResponseSchema = {
  type: "object",
  properties: {
    speech: {
      type: "string",
      description:
        "What to say out loud. Warm, encouraging, conversational — never read the whole recipe at once.",
    },
    actions: {
      type: "array",
      description: "State changes to apply. Use an empty array for pure chat.",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "none",
              "advance_step",
              "repeat_step",
              "substitute",
              "set_servings",
              "update_recipe",
              "set_pace",
            ],
          },
          toStep: {
            type: "number",
            description: "advance_step: zero-based step index to move to.",
          },
          from: { type: "string", description: "substitute: ingredient replaced." },
          to: { type: "string", description: "substitute: ingredient used instead." },
          reason: { type: "string" },
          servings: {
            type: "number",
            description: "set_servings: how many people they are cooking for.",
          },
          pace: { type: "string", enum: ["slower", "normal"] },
          ingredients: {
            type: "array",
            description:
              "update_recipe: the FULL rewritten ingredient list, with amounts adjusted.",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                amount: { type: "string" },
                available: { type: "boolean" },
              },
              required: ["name", "amount", "available"],
            },
          },
          instructions: {
            type: "array",
            description:
              "update_recipe: the FULL rewritten step list, if any step text changed.",
            items: {
              type: "object",
              properties: {
                step: { type: "number" },
                instruction: { type: "string" },
              },
              required: ["step", "instruction"],
            },
          },
        },
        required: ["type"],
      },
    },
  },
  required: ["speech", "actions"],
};

function buildPrompt(body: CookChatRequest): string {
  const { message, session } = body;
  const { recipe, currentStepIndex, currentServings, originalServings } = session;

  const steps = recipe.instructions
    .map(
      (item, index) =>
        `${index === currentStepIndex ? ">>" : "  "} [${index}] ${item.instruction}`,
    )
    .join("\n");

  const ingredients = recipe.ingredients
    .map((item) => `- ${item.amount} ${item.name}`)
    .join("\n");

  const substitutions =
    session.substitutions.length > 0
      ? session.substitutions
          .map((item) => `- ${item.from} -> ${item.to}`)
          .join("\n")
      : "- none yet";

  const history =
    session.history.length > 0
      ? session.history
          .slice(-12) // recent turns are what matter; keeps the prompt small
          .map(
            (turn) =>
              `${turn.role === "user" ? "User" : "Sous-chef"}: ${turn.content}`,
          )
          .join("\n")
      : "(this is the first thing they've said)";

  return `
You are KitchenAid's sous-chef: a warm, encouraging cooking companion talking to
someone who is cooking RIGHT NOW, hands busy, listening not reading.

RECIPE: ${recipe.title}
Written for ${originalServings} servings. They are cooking for ${currentServings}.

INGREDIENTS (current — already reflects any substitutions/scaling):
${ingredients}

STEPS ( >> marks the step they are on, index ${currentStepIndex} of ${recipe.instructions.length - 1} ):
${steps}

SUBSTITUTIONS ALREADY MADE:
${substitutions}

CONVERSATION SO FAR:
${history}

THE USER JUST SAID: "${message}"

How to behave:
- Speak like a person in the kitchen with them. One or two sentences. Never read
  the whole recipe. Never dump a list unless they ask for one.
- Give ONE instruction at a time, then let them get on with it.
- If they signal they've finished the current step ("I added the pepper", "done",
  "ok"), acknowledge briefly and move on: emit advance_step and speak the NEXT step.
- "What's next?" -> advance_step, and say only that next instruction.
- "Repeat that" -> repeat_step, and say the current step again.
- "Go slower" -> set_pace with pace "slower", and reassure them.
- "How much salt?" / quantity questions -> answer from the CURRENT ingredient list
  at the CURRENT serving size. Be specific.
- "I don't have X" / "Can I use Y instead?" -> think about whether the swap
  actually works for this dish, then say so honestly. If you substitute, emit a
  substitute action AND an update_recipe action carrying the FULL rewritten
  ingredient list (and the full step list if any step text mentions that
  ingredient). That rewritten recipe becomes the truth for every later step.
- "I'm cooking for N people" -> emit set_servings AND update_recipe with the FULL
  ingredient list rescaled from the ${originalServings}-serving original. Keep the
  amounts human ("1½ cups", not "1.4999 cups").
- If they're on the last step and finish it, congratulate them warmly.
- If you're just chatting or answering, use an empty actions array.

Never invent steps that aren't in the recipe. Never claim you can't remember
something — you have the whole session above.
`;
}

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { message: "The Gemini API key is missing." },
      { status: 503 },
    );
  }

  let body: CookChatRequest;
  try {
    body = (await request.json()) as CookChatRequest;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.message?.trim() || !body.session?.recipe) {
    return NextResponse.json(
      { message: "A message and a cooking session are required." },
      { status: 400 },
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const interaction = await ai.interactions.create({
      model: "gemini-3.5-flash",
      input: buildPrompt(body),
      // This is a live voice loop — a long "thinking" pause is worse than a
      // slightly less clever answer.
      generation_config: { thinking_level: "minimal" },
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: cookResponseSchema,
      },
    });

    if (!interaction.output_text) {
      throw new Error("Gemini returned an empty response.");
    }

    return NextResponse.json(JSON.parse(interaction.output_text));
  } catch (error) {
    console.error("Cook chat failed:", error);

    const detail = error instanceof Error ? error.message : "";

    // A rate limit isn't an app failure — say so, so the client can fall back to
    // basic step navigation instead of the assistant going silent mid-cook.
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(detail)) {
      return NextResponse.json(
        { message: "Gemini is rate-limited (free-tier quota)." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { message: "The sous-chef could not respond right now." },
      { status: 500 },
    );
  }
}
