"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Mic,
  Square,
  UserRound,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useConversation } from "@/lib/sous-chef/use-conversation";
import { CookChatError, sendCookMessage } from "@/lib/api/cook";
import { localCookFallback } from "@/lib/cook/fallback";
import {
  applyActions,
  createSession,
  currentStep,
  paceFromActions,
  withTurns,
} from "@/lib/cook/session";
import type { CookChatResponse, CookingSession } from "@/lib/cook/types";
import type { Recipe } from "@/types/recipe";

/**
 * Cook Mode — a voice-first sous-chef.
 *
 * The user talks; ElevenLabs Scribe transcribes; Gemini answers with the WHOLE
 * cooking session as context (recipe, current step, servings, substitutions,
 * conversation so far); ElevenLabs speaks the answer back. Gemini also returns
 * actions, which is how "I don't have garlic" or "I'm cooking for four" actually
 * rewrite the recipe for every later instruction.
 */
export function CookMode({ recipe }: { recipe: Recipe }) {
  const [session, setSession] = useState<CookingSession>(() =>
    createSession(recipe),
  );
  const [basicMode, setBasicMode] = useState(false);
  const [error, setError] = useState("");

  // The voice callbacks are long-lived, so they must read the freshest session
  // rather than whatever was captured when they were created.
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // "Go slower" — read at playback time by the conversation hook.
  const paceRef = useRef(1);

  const step = currentStep(session);
  const totalSteps = session.recipe.instructions.length;
  const progress = totalSteps > 0 ? ((session.currentStepIndex + 1) / totalSteps) * 100 : 0;

  /**
   * One turn of the conversation. Returns the text to speak, which the hook
   * plays through ElevenLabs.
   */
  const handleUtterance = useCallback(
    async (message: string): Promise<string | null> => {
      setError("");

      // Record what they said before asking, so Gemini sees it in the history.
      const asked = withTurns(sessionRef.current, {
        role: "user",
        content: message,
      });
      sessionRef.current = asked;
      setSession(asked);

      let reply: CookChatResponse;

      try {
        reply = await sendCookMessage(message, asked);
      } catch (caught) {
        if (caught instanceof CookChatError && caught.isRateLimited) {
          // Gemini is out of quota. Keep cooking with basic step navigation
          // rather than going silent — the UI says so plainly.
          setBasicMode(true);
          reply = localCookFallback(message, asked);
        } else {
          setError(
            caught instanceof Error
              ? caught.message
              : "The sous-chef could not respond.",
          );
          return null;
        }
      }

      const pace = paceFromActions(reply.actions);
      if (pace !== null) paceRef.current = pace;

      // Apply the actions (step moves, substitutions, serving changes) and
      // remember what was said.
      const next = withTurns(applyActions(asked, reply.actions), {
        role: "assistant",
        content: reply.speech,
      });

      sessionRef.current = next;
      setSession(next);

      return reply.speech;
    },
    [],
  );

  const conversation = useConversation({
    onUtterance: handleUtterance,
    getPlaybackRate: () => paceRef.current,
    onError: setError,
  });

  // Greet once, on the first activation — a user gesture, which is also what
  // unlocks audio playback in the browser.
  const greetedRef = useRef(false);
  const handleMicToggle = useCallback(() => {
    const wasActive = conversation.active;
    conversation.toggle();

    if (!wasActive && !greetedRef.current) {
      greetedRef.current = true;
      void conversation.speak(
        `Let's cook ${recipe.title}. I'll take you through it one step at a time. ` +
          `Say "what's next" when you're ready, and just talk to me if you need anything.`,
      );
    }
  }, [conversation, recipe.title]);

  // Manual controls, so Cook Mode is still usable without speaking.
  function moveStep(delta: number) {
    setSession((current) => ({
      ...current,
      currentStepIndex: Math.max(
        0,
        Math.min(
          current.currentStepIndex + delta,
          current.recipe.instructions.length - 1,
        ),
      ),
    }));
  }

  const statusLabel = useMemo(() => {
    switch (conversation.state) {
      case "listening":
        return "Listening…";
      case "thinking":
        return "Thinking…";
      case "speaking":
        return "Speaking… (talk to interrupt)";
      default:
        return "Tap the mic to start cooking together";
    }
  }, [conversation.state]);

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 pb-32 lg:px-10">
      <Link
        href={`/recipes/${recipe.id}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-green-700"
      >
        <ArrowLeft className="size-4" />
        Back to recipe
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-green-700">Cook Mode</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">
            {recipe.title}
          </h1>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm font-medium">
          <Users className="size-4 text-green-600" />
          {session.currentServings} servings
        </span>
      </div>

      {basicMode && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <span className="font-semibold">Basic mode.</span> The Gemini
          free-tier quota is used up, so I can only handle simple commands
          (&quot;next&quot;, &quot;repeat&quot;, &quot;how much salt&quot;).
          Voice still works.
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Current step */}
        <div>
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span className="font-semibold text-green-700">
                Step {session.currentStepIndex + 1} of {totalSteps}
              </span>

              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Previous step"
                  disabled={session.currentStepIndex === 0}
                  onClick={() => moveStep(-1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Next step"
                  disabled={session.currentStepIndex >= totalSteps - 1}
                  onClick={() => moveStep(1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-green-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="mt-6 text-2xl leading-relaxed font-medium">
              {step?.instruction ?? "This recipe has no steps."}
            </p>
          </div>

          {/* Conversation */}
          <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold">Conversation</h2>

            {session.history.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Tap the mic and talk to me. Try &quot;what&apos;s next&quot;,
                &quot;I don&apos;t have garlic&quot;, &quot;how much salt&quot;,
                or &quot;I&apos;m cooking for four&quot;.
              </p>
            ) : (
              <div className="mt-4 max-h-72 space-y-3 overflow-y-auto overscroll-contain pr-1">
                {session.history.map((turn, index) => (
                  <div
                    key={`${turn.role}-${index}`}
                    className={`flex items-start gap-2 ${
                      turn.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {turn.role === "assistant" && (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                        <Bot className="size-3.5" />
                      </span>
                    )}

                    <p
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-6 ${
                        turn.role === "user"
                          ? "bg-green-600 text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {turn.content}
                    </p>

                    {turn.role === "user" && (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                        <UserRound className="size-3.5" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live recipe — reflects substitutions and serving changes */}
        <aside className="h-fit space-y-6">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold">Ingredients</h2>

            <ul className="mt-4 space-y-2 text-sm">
              {session.recipe.ingredients.map((ingredient, index) => (
                <li
                  key={`${ingredient.name}-${index}`}
                  className="flex justify-between gap-4"
                >
                  <span className="font-medium">{ingredient.name}</span>
                  <span className="text-muted-foreground">
                    {ingredient.amount}
                  </span>
                </li>
              ))}
            </ul>

            {session.substitutions.length > 0 && (
              <div className="mt-5 border-t pt-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Substitutions
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {session.substitutions.map((swap, index) => (
                    <span
                      key={`${swap.from}-${index}`}
                      className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
                    >
                      {swap.from} → {swap.to}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold">All steps</h2>

            <ol className="mt-4 space-y-3 text-sm">
              {session.recipe.instructions.map((item, index) => (
                <li
                  key={item.step}
                  className={`flex gap-3 ${
                    index === session.currentStepIndex
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      index === session.currentStepIndex
                        ? "bg-green-600 text-white"
                        : "bg-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="leading-6">{item.instruction}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>

      {/* Floating mic */}
      <div className="fixed inset-x-0 bottom-6 z-40 flex flex-col items-center gap-2 px-6">
        <span
          className={`rounded-full border bg-white/95 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur ${
            conversation.active ? "text-green-800" : "text-muted-foreground"
          }`}
        >
          {statusLabel}
        </span>

        <button
          type="button"
          onClick={handleMicToggle}
          aria-pressed={conversation.active}
          aria-label={
            conversation.active ? "Stop talking to the sous-chef" : "Talk to the sous-chef"
          }
          className={`relative flex size-16 items-center justify-center rounded-full shadow-lg transition ${
            conversation.active
              ? "bg-green-600 text-white"
              : "bg-white text-gray-700 hover:bg-muted"
          }`}
        >
          {conversation.state === "listening" && (
            <span className="absolute inset-0 animate-ping rounded-full bg-green-500/40" />
          )}

          {conversation.state === "thinking" ? (
            <LoaderCircle className="relative size-6 animate-spin" />
          ) : conversation.active ? (
            <Square className="relative size-5 fill-current" />
          ) : (
            <Mic className="relative size-6" />
          )}
        </button>
      </div>
    </section>
  );
}
