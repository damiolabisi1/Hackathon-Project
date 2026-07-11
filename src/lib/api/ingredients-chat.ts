export type IngredientChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type IngredientChatResponse = {
  reply: string;
  ingredients: {
    name: string;
    confidence: number;
  }[];
  readyToContinue: boolean;
};

/** Carries the HTTP status so callers can tell a rate limit (429) from a real failure. */
export class IngredientChatError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "IngredientChatError";
    this.status = status;
  }

  /** Gemini quota exhausted — the app can degrade instead of dying. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

export async function sendIngredientMessage(
  messages: IngredientChatMessage[],
): Promise<IngredientChatResponse> {
  const response = await fetch("/api/ingredients/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new IngredientChatError(
      result.message ?? "We could not process your ingredients.",
      response.status,
    );
  }

  return result;
}