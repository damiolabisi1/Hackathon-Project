"use client";

import { FormEvent, useState } from "react";
import {
  Bot,
  Check,
  LoaderCircle,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  sendIngredientMessage,
  type IngredientChatMessage,
} from "@/lib/api/ingredients-chat";

type IngredientChatProps = {
  onComplete: (data: {
    ingredients: string[];
    dietaryPreferences: string[];
  }) => void;
};

type DisplayMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const dietaryOptions = [
  "None",
  "Vegetarian",
  "Vegan",
  "Halal",
  "Gluten Free",
];

export function IngredientChat({
  onComplete,
}: IngredientChatProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text:
        "Hi! Tell me what ingredients you currently have. You can mention them naturally, like: I have rice, chicken, spinach, and onions.",
    },
  ]);

  const [input, setInput] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [dietaryPreferences, setDietaryPreferences] = useState<
    string[]
  >([]);
  const [step, setStep] = useState<"ingredients" | "diet">(
    "ingredients",
  );
  const [isSending, setIsSending] = useState(false);
  const [readyToContinue, setReadyToContinue] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const cleanedInput = input.trim();

    if (
      !cleanedInput ||
      step !== "ingredients" ||
      isSending
    ) {
      return;
    }

    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: cleanedInput,
    };

    const updatedDisplayMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(updatedDisplayMessages);
    setInput("");
    setIsSending(true);
    setError("");

    try {
      const apiMessages: IngredientChatMessage[] =
        updatedDisplayMessages.map((message) => ({
          role: message.role,
          content: message.text,
        }));

      const result = await sendIngredientMessage(
        apiMessages,
      );

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: result.reply,
        },
      ]);

      setIngredients(
        result.ingredients.map(
          (ingredient) => ingredient.name,
        ),
      );

      setReadyToContinue(result.readyToContinue);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong while processing your ingredients.",
      );
    } finally {
      setIsSending(false);
    }
  }

  function continueToDiet() {
    if (ingredients.length === 0) return;

    setStep("diet");

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text:
          "Great, I have your ingredient list. Do you have any dietary preferences or restrictions?",
      },
    ]);
  }

  function toggleDiet(option: string) {
    if (option === "None") {
      setDietaryPreferences([]);
      return;
    }

    setDietaryPreferences((currentOptions) =>
      currentOptions.includes(option)
        ? currentOptions.filter(
            (item) => item !== option,
          )
        : [...currentOptions, option],
    );
  }

  function handleComplete() {
    if (ingredients.length === 0) return;

    onComplete({
      ingredients,
      dietaryPreferences,
    });
  }

  return (
    <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="border-b bg-green-50/50 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <Sparkles className="size-5" />
          </span>

          <div>
            <h2 className="font-bold">
              Ingredient assistant
            </h2>

            <p className="text-sm text-muted-foreground">
              Describe what you already have.
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-[330px] flex-col gap-4 p-5">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 ${
              message.role === "user"
                ? "justify-end"
                : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                <Bot className="size-4" />
              </span>
            )}

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                message.role === "user"
                  ? "bg-green-600 text-white"
                  : "bg-muted text-foreground"
              }`}
            >
              {message.text}
            </div>

            {message.role === "user" && (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <UserRound className="size-4" />
              </span>
            )}
          </div>
        ))}

        {isSending && (
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Bot className="size-4" />
            </span>

            <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Thinking...
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {ingredients.length > 0 && (
          <div className="rounded-2xl border bg-green-50/40 p-4">
            <p className="text-sm font-semibold">
              Ingredients found
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {ingredients.map((ingredient) => (
                <span
                  key={ingredient}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-green-700 shadow-sm"
                >
                  <Check className="size-3.5" />
                  {ingredient}
                </span>
              ))}
            </div>
          </div>
        )}

        {step === "diet" && (
          <div className="rounded-2xl border p-4">
            <p className="text-sm font-semibold">
              Dietary preferences
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {dietaryOptions.map((option) => {
                const selected =
                  option === "None"
                    ? dietaryPreferences.length === 0
                    : dietaryPreferences.includes(option);

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleDiet(option)}
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                      selected
                        ? "border-green-600 bg-green-50 text-green-700"
                        : "hover:bg-muted"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {step === "ingredients" && (
        <>
          <form
            onSubmit={handleSubmit}
            className="flex gap-3 border-t p-5"
          >
            <Input
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              placeholder="Example: I have rice, eggs and tomatoes..."
              aria-label="Describe your ingredients"
              disabled={isSending}
            />

            <Button
              type="submit"
              size="icon"
              aria-label="Send message"
              disabled={!input.trim() || isSending}
            >
              {isSending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </form>

          <div className="px-5 pb-5">
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={
                ingredients.length === 0 || isSending
              }
              onClick={continueToDiet}
            >
              {readyToContinue
                ? "Continue"
                : "Continue with ingredients found"}
            </Button>
          </div>
        </>
      )}

      {step === "diet" && (
        <div className="border-t p-5">
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={handleComplete}
          >
            Continue with these ingredients
          </Button>
        </div>
      )}
    </div>
  );
}