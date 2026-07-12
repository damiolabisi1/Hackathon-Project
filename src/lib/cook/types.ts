import type { Recipe, RecipeIngredient, RecipeStep } from "@/types/recipe";

/**
 * Cook Mode — the state of a live cooking session.
 *
 * This whole object is sent to Gemini on every turn, so the assistant always
 * knows which recipe is being cooked, which step the user is on, what has
 * already been substituted, how many people they are cooking for, and what has
 * been said. It never has to ask the user to repeat themselves.
 */

export type Substitution = {
  from: string;
  to: string;
  reason?: string;
};

export type CookTurn = {
  role: "user" | "assistant";
  content: string;
};

export type CookingSession = {
  /** The live recipe. Substitutions and serving changes rewrite this. */
  recipe: Recipe;
  /** Zero-based index into recipe.instructions. */
  currentStepIndex: number;
  /** Servings the recipe was written for, so we can scale relative to it. */
  originalServings: number;
  /** Servings the user is actually cooking for now. */
  currentServings: number;
  substitutions: Substitution[];
  history: CookTurn[];
};

/**
 * What the assistant can do besides talk.
 *
 * Kept as one flat shape (rather than a discriminated union) because Gemini's
 * structured-output schema handles a single object with optional fields far
 * more reliably than a union of variants.
 */
export type CookActionType =
  | "none"
  | "advance_step"
  | "repeat_step"
  | "substitute"
  | "set_servings"
  | "update_recipe"
  | "set_pace";

export type CookAction = {
  type: CookActionType;
  /** advance_step: jump to this step (zero-based). Defaults to the next one. */
  toStep?: number;
  /** substitute: swap `from` for `to`. */
  from?: string;
  to?: string;
  reason?: string;
  /** set_servings: cook for this many people. */
  servings?: number;
  /** set_pace: "slower" makes the spoken reply play more slowly. */
  pace?: "slower" | "normal";
  /**
   * update_recipe: the new source of truth after a substitution or a serving
   * change. Whatever is present replaces what's in the session.
   */
  ingredients?: RecipeIngredient[];
  instructions?: RecipeStep[];
};

/** Sent to POST /api/cook/chat. */
export type CookChatRequest = {
  message: string;
  session: CookingSession;
};

/** Returned by POST /api/cook/chat. */
export type CookChatResponse = {
  /** Natural, conversational text — spoken aloud by ElevenLabs. */
  speech: string;
  /** State changes to apply before the next instruction is given. */
  actions: CookAction[];
};

/** How the assistant is currently behaving — drives the mic button. */
export type CookVoiceState = "idle" | "listening" | "thinking" | "speaking";
