import type {
  CookChatResponse,
  CookingSession,
} from "@/lib/cook/types";

/** Carries the status so a rate limit (429) is distinguishable from a failure. */
export class CookChatError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CookChatError";
    this.status = status;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

/** Ask the sous-chef, sending the whole cooking session as context. */
export async function sendCookMessage(
  message: string,
  session: CookingSession,
): Promise<CookChatResponse> {
  const response = await fetch("/api/cook/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new CookChatError(
      result?.message ?? "The sous-chef could not respond.",
      response.status,
    );
  }

  return result as CookChatResponse;
}
