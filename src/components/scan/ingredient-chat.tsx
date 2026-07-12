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
import {
  IngredientChatError,
  sendIngredientMessage,
  type IngredientChatMessage,
} from "@/lib/api/ingredients-chat";
import { useVoice } from "@/lib/sous-chef/use-voice";
import { useConversation } from "@/lib/sous-chef/use-conversation";
import { classifyUtterance, generateReply } from "@/lib/sous-chef/conversation";
import { createId } from "@/lib/create-id";

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

const dietaryOptions = ["None", "Vegetarian", "Vegan", "Halal", "Gluten Free"];

/**
 * Ingredient assistant — text + voice.
 *
 * The brain is Gemini (`/api/ingredients/chat`), which replies conversationally
 * AND extracts ingredients — so it tells "rice, chicken" apart from "what can I
 * make?" on its own. The ElevenLabs voice layer sits on top:
 *   - mic button     : push-to-talk, speak instead of type (Scribe STT)
 *   - speaker toggle : hear Gemini's replies read aloud (TTS)
 *   - conversation   : hands-free, replies when you pause, interruptible
 */
export function IngredientChat({ onComplete }: IngredientChatProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: createId(),
      role: "assistant",
      text: "Hi! Tell me what ingredients you currently have. You can mention them naturally, like: I have rice, chicken, spinach, and onions.",
    },
  ]);

  const [input, setInput] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [step, setStep] = useState<"ingredients" | "diet">("ingredients");
  const [isSending, setIsSending] = useState(false);
  const [readyToContinue, setReadyToContinue] = useState(false);
  const [error, setError] = useState("");
  // True once Gemini has rate-limited us and we fell back to basic mode.
  const [basicMode, setBasicMode] = useState(false);

  // Voice (ElevenLabs).
  const {
    isRecording,
    isTranscribing,
    isSpeaking,
    error: voiceError,
    toggleRecording,
    speak,
  } = useVoice();
  const [voiceReplies, setVoiceReplies] = useState(false);
  const lastSpokenIdRef = useRef<string | null>(null);

  // Mirrors of state that the async voice callbacks must read freshly.
  const messagesRef = useRef(messages);
  const stepRef = useRef(step);
  const ingredientsRef = useRef(ingredients);
  const isSendingRef = useRef(false);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    ingredientsRef.current = ingredients;
  }, [ingredients]);

  /**
   * The single path for every input — typed, push-to-talk, or conversation mode.
   * Sends the conversation to Gemini and returns its reply so voice can speak it.
   */
  async function sendMessage(rawText: string): Promise<string | null> {
    const cleaned = rawText.trim();

    if (!cleaned || stepRef.current !== "ingredients" || isSendingRef.current) {
      return null;
    }

    const userMessage: DisplayMessage = {
      id: createId(),
      role: "user",
      text: cleaned,
    };

    const updated = [...messagesRef.current, userMessage];
    messagesRef.current = updated;
    setMessages(updated);
    setInput("");
    setIsSending(true);
    isSendingRef.current = true;
    setError("");

    try {
      const apiMessages: IngredientChatMessage[] = updated.map((message) => ({
        role: message.role,
        content: message.text,
      }));

      const result = await sendIngredientMessage(apiMessages);

      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          text: result.reply,
        },
      ]);

      setIngredients(result.ingredients.map((ingredient) => ingredient.name));
      setReadyToContinue(result.readyToContinue);

      return result.reply;
    } catch (caughtError) {
      // Gemini rate-limited (free-tier quota). Rather than dying mid-demo, fall
      // back to the local classifier so voice, ingredient capture and spoken
      // replies all keep working. The UI says so plainly — see the banner below.
      if (
        caughtError instanceof IngredientChatError &&
        caughtError.isRateLimited
      ) {
        setBasicMode(true);

        const classified = classifyUtterance(cleaned);

        if (classified.ingredients.length > 0) {
          setIngredients((current) => [
            ...new Set([...current, ...classified.ingredients]),
          ]);
        }

        const reply = generateReply(classified, {
          knownIngredients: ingredientsRef.current,
        });

        setMessages((current) => [
          ...current,
          {
            id: createId(),
            role: "assistant",
            text: reply,
          },
        ]);

        return reply;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong while processing your ingredients.",
      );
      return null;
    } finally {
      setIsSending(false);
      isSendingRef.current = false;
    }
  }

  // Hands-free: Gemini answers, ElevenLabs speaks, and you can talk over it.
  const conversation = useConversation({
    onUtterance: async (text) => sendMessage(text),
  });

  // Speak replies when the speaker is on. Conversation mode speaks its own
  // replies, so skip it there to avoid double-talk.
  useEffect(() => {
    if (!voiceReplies || conversation.active) return;
    const last = messages[messages.length - 1];
    if (
      last &&
      last.role === "assistant" &&
      last.id !== lastSpokenIdRef.current
    ) {
      lastSpokenIdRef.current = last.id;
      void speak(last.text);
    }
  }, [messages, voiceReplies, conversation.active, speak]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  // Push-to-talk: transcribe, then send as a message.
  function handleMic() {
    toggleRecording((transcript) => {
      void sendMessage(transcript);
    });
  }

  function continueToDiet() {
    if (ingredients.length === 0) return;

    setStep("diet");

    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: "assistant",
        text: "Great, I have your ingredient list. Do you have any dietary preferences or restrictions?",
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
    if (ingredients.length === 0) return;

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

      <div className="flex h-[330px] flex-col gap-4 overflow-y-auto overscroll-contain p-5">
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
        {basicMode && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <span className="font-semibold">Basic mode.</span> The Gemini
            free-tier quota is used up, so replies are coming from a simple
            local matcher instead of the AI. Voice still works.
          </div>
        )}
        {(error || voiceError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error || voiceError}
          </div>
        )}
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
                      : "Example: I have rice, eggs and tomatoes… or tap the mic"
                }
                aria-label="Describe your ingredients"
                disabled={isSending}
                className="pr-11"
              />

              <button
                type="button"
                onClick={handleMic}
                disabled={isSending || isTranscribing}
                aria-pressed={isRecording}
                aria-label={
                  isRecording ? "Stop recording" : "Record with microphone"
                }
                title={
                  isRecording ? "Stop recording" : "Speak your ingredients"
                }
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

          {/* <div className="px-5 pb-5">
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={ingredients.length === 0 || isSending}
              onClick={continueToDiet}
            >
              {readyToContinue ? "Continue" : "Continue with ingredients found"}
            </Button>
          </div> */}
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
