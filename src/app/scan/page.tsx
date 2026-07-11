"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CircleCheck,
  Lightbulb,
  LoaderCircle,
  ScanLine,
} from "lucide-react";

import { ImageUploader } from "@/components/scan/image-uploader";
import { IngredientChat } from "@/components/scan/ingredient-chat";
import { Button } from "@/components/ui/button";
import { detectIngredients } from "@/lib/api/ingredients";
import type { IngredientDetectionResponse } from "@/types/ingredient";

const tips = [
  "Use good lighting.",
  "Make each ingredient clearly visible.",
  "Avoid blurry or distant photos.",
];

type ChatCompleteResult = {
  ingredients: string[];
  dietaryPreferences: string[];
};

export default function ScanPage() {
  const router = useRouter();

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState("");
  const [inputMode, setInputMode] = useState<"photo" | "chat">("photo");

  async function handleDetectIngredients() {
    if (!selectedImage || isDetecting) return;

    setIsDetecting(true);
    setError("");

    try {
      const result: IngredientDetectionResponse =
        await detectIngredients(selectedImage);

      sessionStorage.setItem(
        "detectedIngredients",
        JSON.stringify(result),
      );

      router.push("/ingredients");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong while detecting the ingredients.",
      );
    } finally {
      setIsDetecting(false);
    }
  }

  function handleChatComplete({
    ingredients,
    dietaryPreferences,
  }: ChatCompleteResult) {
    if (ingredients.length === 0) {
      setError("Please provide at least one ingredient.");
      return;
    }

    const result: IngredientDetectionResponse = {
      ingredients: ingredients.map((name) => ({
        id: crypto.randomUUID(),
        name,
        confidence: 1,
        confirmed: true,
      })),
      uncertainItems: [],
    };

    sessionStorage.setItem(
      "detectedIngredients",
      JSON.stringify(result),
    );

    sessionStorage.setItem(
      "dietaryPreferences",
      JSON.stringify(dietaryPreferences),
    );

    router.push("/ingredients");
  }

  function switchInputMode(mode: "photo" | "chat") {
    setInputMode(mode);
    setError("");
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <div className="mb-10">
        <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
          <ScanLine className="size-4" />
          Step 1 of 3
        </div>

        <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
          Add your ingredients
        </h1>

        <p className="mt-3 max-w-2xl text-muted-foreground">
          Upload a clear photo of the ingredients you already have, or describe
          them to our AI assistant.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 rounded-2xl bg-muted p-1">
        <button
          type="button"
          onClick={() => switchInputMode("photo")}
          className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
            inputMode === "photo"
              ? "bg-white text-green-700 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Upload a photo
        </button>

        <button
          type="button"
          onClick={() => switchInputMode("chat")}
          className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
            inputMode === "chat"
              ? "bg-white text-green-700 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Describe ingredients
        </button>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        <div>
          {inputMode === "photo" ? (
            <>
              <ImageUploader
                selectedImage={selectedImage}
                onImageSelect={(image) => {
                  setSelectedImage(image);
                  setError("");
                }}
              />

              <Button
                type="button"
                size="lg"
                className="mt-6 w-full"
                disabled={!selectedImage || isDetecting}
                onClick={handleDetectIngredients}
              >
                {isDetecting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Identifying ingredients...
                  </>
                ) : (
                  <>
                    Analyze ingredients
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </>
          ) : (
            <IngredientChat onComplete={handleChatComplete} />
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <aside className="h-fit rounded-3xl border bg-white p-6 shadow-sm">
          <span className="flex size-11 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <Lightbulb className="size-5" />
          </span>

          <h2 className="mt-5 text-lg font-bold">Tips for better results</h2>

          <div className="mt-5 space-y-4">
            {tips.map((tip) => (
              <div key={tip} className="flex items-start gap-3">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-green-600" />

                <p className="text-sm text-muted-foreground">{tip}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            The app cannot confirm whether food is spoiled or allergen-free.
            Always inspect ingredients before cooking.
          </div>
        </aside>
      </div>
    </section>
  );
}