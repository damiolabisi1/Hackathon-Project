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
    throw new Error(
      result.message ?? "We could not process your ingredients.",
    );
  }

  return result;
}