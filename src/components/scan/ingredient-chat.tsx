"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Bot,
  Check,
  LoaderCircle,
  Mic,
  Send,
  Sparkles,
  Square,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVoice } from "@/lib/sous-chef/use-voice";
import { useConversation } from "@/lib/sous-chef/use-conversation";
import { classifyUtterance, generateReply } from "@/lib/sous-chef/conversation";

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

  // Voice (ElevenLabs): speak-to-type + read replies aloud.
  const { isRecording, isTranscribing, isSpeaking, error, toggleRecording, speak } =
    useVoice();
  const [voiceReplies, setVoiceReplies] = useState(false);
  const lastSpokenIdRef = useRef<string | null>(null);

  // Latest ingredients, readable inside async voice callbacks.
  const ingredientsRef = useRef<string[]>([]);
  useEffect(() => {
    ingredientsRef.current = ingredients;
  }, [ingredients]);

  // Hands-free conversation mode (continuous listening, interruptible).
  const conversation = useConversation({
    onUtterance: async (text) => processUserText(text),
  });

  // When voice replies are on, speak each new assistant message once — but not
  // during conversation mode, which speaks its own replies (avoids double-talk).
  useEffect(() => {
    if (!voiceReplies || conversation.active) return;
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.id !== lastSpokenIdRef.current) {
      lastSpokenIdRef.current = last.id;
      void speak(last.text);
    }
  }, [messages, voiceReplies, conversation.active, speak]);

  /**
   * The smart core: classify the utterance (ingredients vs conversation),
   * update the ingredient list only for real ingredients, append the exchange,
   * and return a spoken reply. Used by typed input, push-to-talk, and
   * conversation mode alike. Returns the reply text (for conversation TTS).
   */
  function processUserText(rawText: string): string | null {
    const text = rawText.trim();
    if (!text) return null;

    const c = classifyUtterance(text);

    if (c.ingredients.length > 0 && step === "ingredients") {
      setIngredients((prev) => [...new Set([...prev, ...c.ingredients])]);
    }

    const reply = generateReply(c, {
      knownIngredients: ingredientsRef.current,
    });

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text },
      { id: crypto.randomUUID(), role: "assistant", text: reply },
    ]);

    return reply;
  }

  function submitIngredients(rawMessage: string) {
    if (!rawMessage.trim()) return;
    processUserText(rawMessage);
    setInput("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitIngredients(input);
  }

  // Push-to-talk: transcribe speech, then send it as a chat message.
  function handleMic() {
    toggleRecording((transcript) => submitIngredients(transcript));
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
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <Sparkles className="size-5" />
            </span>

            <div>
              <h2 className="font-bold">Sous Chef</h2>
              <p className="text-sm text-muted-foreground">
                Describe what you already have.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={conversation.toggle}
              aria-pressed={conversation.active}
              aria-label={
                conversation.active
                  ? "End conversation"
                  : "Start hands-free conversation"
              }
              title={
                conversation.active
                  ? "End conversation"
                  : "Start hands-free conversation"
              }
              className={`flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                conversation.active
                  ? "border-green-600 bg-green-600 text-white"
                  : "bg-white text-gray-600 hover:bg-muted"
              }`}
            >
              <AudioLines
                className={`size-5 ${
                  conversation.active ? "animate-pulse" : ""
                }`}
              />
              <span className="hidden sm:inline">
                {conversation.active ? "End" : "Talk"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setVoiceReplies((on) => !on)}
              aria-pressed={voiceReplies}
              aria-label={
                voiceReplies
                  ? "Turn off voice replies"
                  : "Turn on voice replies"
              }
              title={voiceReplies ? "Voice replies on" : "Voice replies off"}
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl border transition ${
                voiceReplies
                  ? "border-green-600 bg-green-100 text-green-700"
                  : "bg-white text-gray-500 hover:bg-muted"
              }`}
            >
              {voiceReplies ? (
                <Volume2
                  className={`size-5 ${isSpeaking ? "animate-pulse" : ""}`}
                />
              ) : (
                <VolumeX className="size-5" />
              )}
            </button>
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
          {conversation.active && (
            <div className="flex items-center gap-3 border-t bg-green-50/60 px-5 py-3">
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-green-600" />
              </span>
              <p className="text-sm font-medium text-green-800">
                {conversation.state === "thinking"
                  ? "Thinking…"
                  : conversation.state === "speaking"
                    ? "Speaking… (talk to interrupt)"
                    : "Listening… just talk, I'll reply when you pause."}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-3 border-t p-5">
            <div className="relative flex-1">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  isRecording
                    ? "Listening… tap the mic to stop"
                    : isTranscribing
                      ? "Transcribing…"
                      : "Example: rice, eggs, tomatoes… or tap the mic"
                }
                aria-label="Describe your ingredients"
                className="pr-11"
              />

              <button
                type="button"
                onClick={handleMic}
                disabled={isTranscribing}
                aria-pressed={isRecording}
                aria-label={
                  isRecording ? "Stop recording" : "Record with microphone"
                }
                title={isRecording ? "Stop recording" : "Speak your ingredients"}
                className={`absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg transition ${
                  isRecording
                    ? "bg-red-500 text-white"
                    : "text-gray-500 hover:bg-muted hover:text-gray-900"
                } disabled:opacity-50`}
              >
                {isTranscribing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : isRecording ? (
                  <Square className="size-3.5 fill-current" />
                ) : (
                  <Mic className="size-4" />
                )}
              </button>
            </div>

            <Button type="submit" size="icon" aria-label="Send message">
              <Send className="size-4" />
            </Button>
          </form>

          {error && (
            <p className="px-5 -mt-2 pb-1 text-xs text-red-600">{error}</p>
          )}

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
