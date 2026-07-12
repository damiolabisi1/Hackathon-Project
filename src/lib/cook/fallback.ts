import type { CookChatResponse, CookingSession } from "./types";
import { currentStep, isLastStep } from "./session";

/**
 * A dumb, offline stand-in for the sous-chef.
 *
 * Only used when Gemini is rate-limited (its free tier allows very few
 * requests). Going silent mid-cook would be far worse than answering the basics
 * without AI, so this keeps step navigation and quantity lookups working. The UI
 * says plainly that it is running without the AI.
 */
export function localCookFallback(
  message: string,
  session: CookingSession,
): CookChatResponse {
  const said = message.toLowerCase();
  const step = currentStep(session);

  // Move on: "what's next", "next", "done", "ok I added the pepper"
  if (
    /(what'?s next|next step|\bnext\b|done|finished|added|ready|continue|go on|ok(ay)?\b)/.test(
      said,
    )
  ) {
    if (isLastStep(session)) {
      return {
        speech: "That was the last step. Nice work — enjoy your meal!",
        actions: [],
      };
    }

    const next = session.recipe.instructions[session.currentStepIndex + 1];
    return {
      speech: next.instruction,
      actions: [{ type: "advance_step" }],
    };
  }

  if (/(repeat|say that again|again|what was that|didn'?t catch)/.test(said)) {
    return {
      speech: step?.instruction ?? "We're between steps right now.",
      actions: [{ type: "repeat_step" }],
    };
  }

  if (/(slower|slow down|too fast)/.test(said)) {
    return {
      speech: `Sure, I'll slow down. ${step?.instruction ?? ""}`,
      actions: [{ type: "set_pace", pace: "slower" }],
    };
  }

  // "How much salt?" — answer straight from the current ingredient list.
  const quantity = said.match(/how (?:much|many) ([a-z ]+)/);
  if (quantity) {
    const asked = quantity[1].trim();
    const match = session.recipe.ingredients.find(
      (item) =>
        item.name.toLowerCase().includes(asked) ||
        asked.includes(item.name.toLowerCase()),
    );

    if (match) {
      return {
        speech: `${match.amount} of ${match.name}, for ${session.currentServings} servings.`,
        actions: [],
      };
    }
  }

  return {
    speech: `I'm running without the AI right now, so I can only handle the basics. We're on: ${
      step?.instruction ?? "the recipe"
    } Say "next" when you're ready.`,
    actions: [],
  };
}
