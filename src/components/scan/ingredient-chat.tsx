"use client";

import { FormEvent, useState } from "react";
import { Bot, Check, Send, Sparkles, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type IngredientChatProps = {
  onComplete: (data: {
    ingredients: string[];
    dietaryPreferences: string[];
  }) => void;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const dietaryOptions = ["None", "Vegetarian", "Vegan", "Halal", "Gluten Free"];

export function IngredientChat({ onComplete }: IngredientChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "Hi! Tell me what ingredients you have. You can write something like: rice, chicken, spinach, and onions.",
    },
  ]);

  const [input, setInput] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [step, setStep] = useState<"ingredients" | "diet">("ingredients");

  function parseIngredients(text: string) {
    return text
      .split(/,|\band\b|\n/gi)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.charAt(0).toUpperCase() + item.slice(1));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();

    if (!message || step !== "ingredients") return;

    const parsedIngredients = parseIngredients(message);
    const mergedIngredients = [
      ...new Set([...ingredients, ...parsedIngredients]),
    ];

    setIngredients(mergedIngredients);

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user",
        text: message,
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text:
          parsedIngredients.length > 0
            ? `Great! I found ${parsedIngredients.join(
                ", ",
              )}. You can add more ingredients or continue.`
            : "I could not identify any ingredients. Try separating them with commas.",
      },
    ]);

    setInput("");
  }

  function continueToDiet() {
    if (ingredients.length === 0) return;

    setStep("diet");

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Do you have any dietary preferences or restrictions?",
      },
    ]);
  }

  function toggleDiet(option: string) {
    if (option === "None") {
      setDietaryPreferences([]);
      return;
    }

    setDietaryPreferences((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option],
    );
  }

  function handleComplete() {
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
            <h2 className="font-bold">Ingredient assistant</h2>
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
              message.role === "user" ? "justify-end" : "justify-start"
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

        {ingredients.length > 0 && (
          <div className="rounded-2xl border bg-green-50/40 p-4">
            <p className="text-sm font-semibold">Ingredients found</p>

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
            <p className="text-sm font-semibold">Dietary preferences</p>

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
          <form onSubmit={handleSubmit} className="flex gap-3 border-t p-5">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Example: rice, eggs, tomatoes..."
              aria-label="Describe your ingredients"
            />

            <Button type="submit" size="icon" aria-label="Send message">
              <Send className="size-4" />
            </Button>
          </form>

          <div className="px-5 pb-5">
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={ingredients.length === 0}
              onClick={continueToDiet}
            >
              Continue
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
