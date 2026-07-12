import type { Recipe } from "@/types/recipe";
import type { CookAction, CookingSession, CookTurn } from "./types";

/** Start a cooking session for a recipe. */
export function createSession(recipe: Recipe): CookingSession {
  return {
    recipe,
    currentStepIndex: 0,
    originalServings: recipe.servings,
    currentServings: recipe.servings,
    substitutions: [],
    history: [],
  };
}

export function currentStep(session: CookingSession) {
  return session.recipe.instructions[session.currentStepIndex];
}

export function isLastStep(session: CookingSession): boolean {
  return session.currentStepIndex >= session.recipe.instructions.length - 1;
}

function clampStep(session: CookingSession, index: number): number {
  const last = session.recipe.instructions.length - 1;
  return Math.max(0, Math.min(index, last));
}

/**
 * Apply one assistant action to the session.
 *
 * `update_recipe` is how a substitution or serving change actually takes hold:
 * Gemini returns the rewritten ingredients/steps and they become the new source
 * of truth, so every later instruction reflects them.
 */
export function applyAction(
  session: CookingSession,
  action: CookAction,
): CookingSession {
  switch (action.type) {
    case "advance_step": {
      const target =
        action.toStep !== undefined
          ? action.toStep
          : session.currentStepIndex + 1;
      return { ...session, currentStepIndex: clampStep(session, target) };
    }

    case "repeat_step":
      // The step is re-spoken; no state changes.
      return session;

    case "substitute": {
      if (!action.from || !action.to) return session;
      return {
        ...session,
        substitutions: [
          ...session.substitutions,
          { from: action.from, to: action.to, reason: action.reason },
        ],
      };
    }

    case "set_servings": {
      if (!action.servings || action.servings <= 0) return session;
      return {
        ...session,
        currentServings: action.servings,
        recipe: { ...session.recipe, servings: action.servings },
      };
    }

    case "update_recipe": {
      // Only replace what was actually provided.
      return {
        ...session,
        recipe: {
          ...session.recipe,
          ...(action.ingredients ? { ingredients: action.ingredients } : {}),
          ...(action.instructions ? { instructions: action.instructions } : {}),
        },
      };
    }

    case "set_pace":
    case "none":
    default:
      return session;
  }
}

/** Apply every action from one assistant turn, in order. */
export function applyActions(
  session: CookingSession,
  actions: CookAction[],
): CookingSession {
  return actions.reduce(applyAction, session);
}

/** Record an exchange so the assistant keeps its memory of the conversation. */
export function withTurns(
  session: CookingSession,
  ...turns: CookTurn[]
): CookingSession {
  return { ...session, history: [...session.history, ...turns] };
}

/** "slower" plays the spoken reply back at a gentler pace. */
export function paceFromActions(actions: CookAction[]): number | null {
  const pace = actions.find((action) => action.type === "set_pace")?.pace;
  if (pace === "slower") return 0.85;
  if (pace === "normal") return 1;
  return null;
}
