"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AudioLines,
  Bot,
  Clock,
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
  sendIngredientMessage,
  type IngredientChatMessage,
  type IngredientChatResponse,
} from "@/lib/api/ingredients-chat";
import {
  convertGeneratedRecipes,
  type GeneratedRecipe,
} from "@/lib/recipes/convert-generated-recipes";
import { useConversation } from "@/lib/sous-chef/use-conversation";
import { useVoice } from "@/lib/sous-chef/use-voice";
import type { Recipe } from "@/types/recipe";

type DisplayMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

export function IngredientChat() {
  const router = useRouter();

  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "Hi! Tell me what ingredients you currently have, and I’ll help you turn them into a meal.",
    },
  ]);

  const [input, setInput] = useState("");
  const [chatState, setChatState] = useState<IngredientChatResponse | null>(
    null,
  );

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingRecipes, setIsGeneratingRecipes] = useState(false);
  const [error, setError] = useState("");

  const messagesRef = useRef(messages);
  const isSendingRef = useRef(false);
  const generationStartedRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

  async function generateRecipesFromChat(
    state: IngredientChatResponse,
  ): Promise<string> {
    if (
      generationStartedRef.current ||
      state.ingredients.length === 0 ||
      state.servings <= 0 ||
      state.maximumCookingTime <= 0
    ) {
      return "I still need a few details before generating recipes.";
    }

    generationStartedRef.current = true;
    setIsGeneratingRecipes(true);
    setError("");

    try {
      const response = await fetch("/api/generate-recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ingredients: state.ingredients,
          dietaryPreferences: state.dietaryPreferences,
          maximumCookingTime: state.maximumCookingTime,
          servings: state.servings,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "We could not generate recipes.");
      }

      const convertedRecipes = await convertGeneratedRecipes(
        result.recipes as GeneratedRecipe[],
        {
          servings: state.servings,
          dietaryPreferences: state.dietaryPreferences,
        },
      );

      setRecipes(convertedRecipes);

      sessionStorage.setItem(
        "generatedRecipes",
        JSON.stringify(convertedRecipes),
      );

      const finalReply =
        "I found three meal options for you. Choose the one you would like to cook.";

      const assistantMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: finalReply,
      };

      messagesRef.current = [...messagesRef.current, assistantMessage];

      setMessages(messagesRef.current);

      return finalReply;
    } catch (caughtError) {
      generationStartedRef.current = false;

      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "We could not generate recipes.";

      setError(message);

      return message;
    } finally {
      setIsGeneratingRecipes(false);
    }
  }

  async function sendMessage(rawText: string): Promise<string | null> {
    const cleaned = rawText.trim();

    if (
      !cleaned ||
      isSendingRef.current ||
      isGeneratingRecipes ||
      recipes.length > 0
    ) {
      return null;
    }

    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: cleaned,
    };

    const updatedMessages = [...messagesRef.current, userMessage];

    messagesRef.current = updatedMessages;
    setMessages(updatedMessages);
    setInput("");
    setIsSending(true);
    isSendingRef.current = true;
    setError("");

    try {
      const apiMessages: IngredientChatMessage[] = updatedMessages.map(
        (message) => ({
          role: message.role,
          content: message.text,
        }),
      );

      const result = await sendIngredientMessage(apiMessages);

      setChatState(result);

      const assistantMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: result.reply,
      };

      const messagesWithReply = [...messagesRef.current, assistantMessage];

      messagesRef.current = messagesWithReply;
      setMessages(messagesWithReply);

      if (result.readyToGenerate) {
        return await generateRecipesFromChat(result);
      }

      return result.reply;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong while processing your request.";

      setError(message);
      return null;
    } finally {
      setIsSending(false);
      isSendingRef.current = false;
    }
  }

  const conversation = useConversation({
    onUtterance: async (text) => sendMessage(text),
  });

  useEffect(() => {
    if (!voiceReplies || conversation.active) return;

    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      lastMessage.id !== lastSpokenIdRef.current
    ) {
      lastSpokenIdRef.current = lastMessage.id;
      void speak(lastMessage.text);
    }
  }, [messages, voiceReplies, conversation.active, speak]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleMic() {
    toggleRecording((transcript) => {
      void sendMessage(transcript);
    });
  }

  function openRecipe(recipe: Recipe) {
    sessionStorage.setItem("selectedRecipe", JSON.stringify(recipe));

    router.push(`/recipes/${recipe.id}`);
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
                Describe what you have and get meal ideas.
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
              className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
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
              onClick={() => setVoiceReplies((current) => !current)}
              aria-pressed={voiceReplies}
              aria-label={
                voiceReplies
                  ? "Turn off voice replies"
                  : "Turn on voice replies"
              }
              className={`flex size-10 items-center justify-center rounded-xl border transition ${
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

        {(isSending || isGeneratingRecipes) && (
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Bot className="size-4" />
            </span>

            <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />

              {isGeneratingRecipes
                ? "Creating three meal options..."
                : "Thinking..."}
            </div>
          </div>
        )}

        {chatState && recipes.length === 0 && (
          <div className="rounded-2xl border bg-green-50/40 p-4 text-xs leading-6 text-muted-foreground">
            <p>
              <strong>Ingredients:</strong>{" "}
              {chatState.ingredients.length > 0
                ? chatState.ingredients.join(", ")
                : "Not confirmed"}
            </p>

            <p>
              <strong>Dietary needs:</strong>{" "}
              {chatState.dietaryPreferences.length > 0
                ? chatState.dietaryPreferences.join(", ")
                : chatState.stage === "ingredients" ||
                    chatState.stage === "confirm-ingredients"
                  ? "Not asked yet"
                  : "None"}
            </p>

            <p>
              <strong>Servings:</strong>{" "}
              {chatState.servings > 0 ? chatState.servings : "Not provided"}
            </p>

            <p>
              <strong>Maximum time:</strong>{" "}
              {chatState.maximumCookingTime > 0
                ? `${chatState.maximumCookingTime} minutes`
                : "Not provided"}
            </p>
          </div>
        )}

        {recipes.length > 0 && (
          <div className="grid gap-4 pt-2 md:grid-cols-3">
            {recipes.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                onClick={() => openRecipe(recipe)}
                className="overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] bg-muted">
                  <Image
                    src={recipe.image}
                    alt={
                      recipe.imageAlt || `Photo representing ${recipe.title}`
                    }
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>

                <div className="p-4">
                  <h3 className="font-bold">{recipe.title}</h3>

                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {recipe.description}
                  </p>

                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {recipe.cookingTimeMinutes} min
                    </span>

                    <span>{recipe.difficulty}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {(error || voiceError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error || voiceError}
          </div>
        )}
      </div>

      {conversation.active && recipes.length === 0 && (
        <div className="flex items-center gap-3 border-t bg-green-50/60 px-5 py-3">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-green-600" />
          </span>

          <p className="text-sm font-medium text-green-800">
            {conversation.state === "thinking"
              ? "Thinking…"
              : conversation.state === "speaking"
                ? "Speaking… talk to interrupt"
                : "Listening… speak and pause when finished"}
          </p>
        </div>
      )}

      {recipes.length === 0 && (
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
                    : "Reply to the sous-chef..."
              }
              disabled={isSending || isGeneratingRecipes || isTranscribing}
              className="pr-11"
            />

            <button
              type="button"
              onClick={handleMic}
              disabled={isSending || isGeneratingRecipes || isTranscribing}
              aria-pressed={isRecording}
              aria-label={
                isRecording ? "Stop recording" : "Record with microphone"
              }
              className={`absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg transition ${
                isRecording
                  ? "bg-red-500 text-white"
                  : "text-gray-500 hover:bg-muted"
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
            disabled={!input.trim() || isSending || isGeneratingRecipes}
          >
            {isSending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
