"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  DetectedIngredient,
  IngredientDetectionResponse,
} from "@/types/ingredient";

const dietaryOptions = ["Vegetarian", "Vegan", "Halal", "Gluten Free"];

const cookingTimes = [15, 30, 45, 60];

export default function IngredientsPage() {
  const router = useRouter();

  const [ingredients, setIngredients] = useState<DetectedIngredient[]>([]);
  const [newIngredient, setNewIngredient] = useState("");
  const [selectedDiet, setSelectedDiet] = useState<string[]>([]);
  const [cookingTime, setCookingTime] = useState(30);
  const [servings, setServings] = useState(2);

  useEffect(() => {
    const storedResult = sessionStorage.getItem("detectedIngredients");

    if (!storedResult) return;

    try {
      const result: IngredientDetectionResponse = JSON.parse(storedResult);

      setIngredients(result.ingredients);
    } catch {
      setIngredients([]);
    }
  }, []);

  function toggleIngredient(id: string) {
    setIngredients((currentIngredients) =>
      currentIngredients.map((ingredient) =>
        ingredient.id === id
          ? {
              ...ingredient,
              confirmed: !ingredient.confirmed,
            }
          : ingredient,
      ),
    );
  }

  function removeIngredient(id: string) {
    setIngredients((currentIngredients) =>
      currentIngredients.filter((ingredient) => ingredient.id !== id),
    );
  }

  function addIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedName = newIngredient.trim();

    if (!cleanedName) return;

    setIngredients((currentIngredients) => [
      ...currentIngredients,
      {
        id: crypto.randomUUID(),
        name: cleanedName,
        confirmed: true,
      },
    ]);

    setNewIngredient("");
  }

  function toggleDiet(option: string) {
    setSelectedDiet((currentOptions) =>
      currentOptions.includes(option)
        ? currentOptions.filter((item) => item !== option)
        : [...currentOptions, option],
    );
  }

  async function handleGenerateRecipes() {
    const confirmedIngredients = ingredients
      .filter((ingredient) => ingredient.confirmed)
      .map((ingredient) => ingredient.name);

    if (confirmedIngredients.length === 0) {
      console.error("No confirmed ingredients selected.");
      return;
    }

    const requestData = {
      ingredients: confirmedIngredients,
      dietaryPreferences: selectedDiet,
      maximumCookingTime: cookingTime,
      servings,
    };

    try {
      const response = await fetch("/api/generate-recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "We could not generate recipes.",
        );
      }

      const frontendRecipes = await Promise.all(
        result.recipes.map(
          async (
            recipe: {
              id?: string;
              name: string;
              description?: string;
              prepTimeMinutes?: number;
              cookTimeMinutes?: number;
              difficulty?: "easy" | "medium" | "hard";
              servings?: number;
              ingredients?: {
                name: string;
                quantity: string;
                userAlreadyHas: boolean;
              }[];
              missingIngredients?: string[];
              steps?: {
                stepNumber: number;
                instruction: string;
                estimatedMinutes?: number;
              }[];
              substitutions?: string[];
              wasteReductionNote?: string;
            },
            index: number,
          ) => {
            const recipeIngredients = recipe.ingredients ?? [];

            let imageResult = {
              imageUrl: "/images/food.webp",
              imageAlt: `Photo representing ${recipe.name}`,
              photographer: null as string | null,
              photographerUrl: null as string | null,
              photoUrl: null as string | null,
            };

            try {
              const imageResponse = await fetch("/api/recipe-image", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  recipeName: recipe.name,
                  description: recipe.description,
                  ingredients: recipeIngredients.map(
                    (ingredient) => ingredient.name,
                  ),
                }),
              });

              if (imageResponse.ok) {
                imageResult = await imageResponse.json();
              }
            } catch (imageError) {
              console.error(
                `Could not find an image for ${recipe.name}:`,
                imageError,
              );
            }

            return {
              id: recipe.id || `generated-recipe-${index + 1}`,
              title: recipe.name,
              description: recipe.description ?? "",
              image:
                imageResult.imageUrl ??
                "/images/food.webp",
              imageAlt:
                imageResult.imageAlt ??
                `Photo representing ${recipe.name}`,
              photographer: imageResult.photographer,
              photographerUrl: imageResult.photographerUrl,
              photoUrl: imageResult.photoUrl,
              cookingTimeMinutes:
                (recipe.prepTimeMinutes ?? 0) +
                (recipe.cookTimeMinutes ?? 0),
              difficulty:
                recipe.difficulty === "hard"
                  ? "Hard"
                  : recipe.difficulty === "medium"
                    ? "Medium"
                    : "Easy",
              servings: recipe.servings ?? servings,
              matchPercentage: Math.max(85, 96 - index * 5),
              tags: [
                index === 0 ? "Best match" : "AI generated",
                ...selectedDiet,
              ],
              ingredients: recipeIngredients.map((ingredient) => ({
                name: ingredient.name,
                amount: ingredient.quantity,
                available: ingredient.userAlreadyHas,
              })),
              missingIngredients: recipe.missingIngredients ?? [],
              instructions: (recipe.steps ?? []).map((step) => ({
                step: step.stepNumber,
                instruction: step.instruction,
              })),
              substitutions: recipe.substitutions ?? [],
              wasteReductionNote: recipe.wasteReductionNote ?? "",
            };
          },
        ),
      );

      sessionStorage.setItem(
        "generatedRecipes",
        JSON.stringify(frontendRecipes),
      );

      router.push("/recipes");
    } catch (error) {
      console.error("Recipe generation failed:", error);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <div className="mb-10">
        <p className="text-sm font-semibold text-green-700">Step 2 of 3</p>

        <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
          We found these ingredients
        </h1>

        <p className="mt-3 text-muted-foreground">
          Confirm, remove, or add ingredients before generating recipes.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          {ingredients.length === 0 ? (
            <div className="rounded-3xl border border-dashed p-12 text-center">
              <Sparkles className="mx-auto size-8 text-green-600" />

              <h2 className="mt-4 text-lg font-bold">
                No ingredients available
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Return to the scan page or add ingredients manually.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {ingredients.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm"
                >
                  <input
                    type="checkbox"
                    checked={ingredient.confirmed}
                    onChange={() => toggleIngredient(ingredient.id)}
                    className="size-5 accent-green-600"
                    aria-label={`Confirm ${ingredient.name}`}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{ingredient.name}</p>

                    {ingredient.confidence !== undefined && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Math.round(ingredient.confidence * 100)}% confidence
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${ingredient.name}`}
                    onClick={() => removeIngredient(ingredient.id)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={addIngredient}
            className="mt-5 flex flex-col gap-3 sm:flex-row"
          >
            <Input
              value={newIngredient}
              onChange={(event) => setNewIngredient(event.target.value)}
              placeholder="Add an ingredient manually"
            />

            <Button type="submit" variant="outline">
              <Plus className="size-4" />
              Add ingredient
            </Button>
          </form>
        </div>

        <aside className="h-fit rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">Recipe preferences</h2>

          <div className="mt-6">
            <p className="text-sm font-semibold">Dietary preferences</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {dietaryOptions.map((option) => {
                const selected = selectedDiet.includes(option);

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

          <div className="mt-7">
            <p className="text-sm font-semibold">Maximum cooking time</p>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {cookingTimes.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setCookingTime(time)}
                  className={`rounded-xl border px-2 py-2 text-sm font-medium ${
                    cookingTime === time
                      ? "border-green-600 bg-green-50 text-green-700"
                      : ""
                  }`}
                >
                  {time}m
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7">
            <label htmlFor="servings" className="text-sm font-semibold">
              Servings
            </label>

            <Input
              id="servings"
              type="number"
              min={1}
              max={12}
              value={servings}
              onChange={(event) => setServings(Number(event.target.value))}
              className="mt-3"
            />
          </div>

          <Button
            type="button"
            size="lg"
            className="mt-7 w-full"
            disabled={
              ingredients.filter((ingredient) => ingredient.confirmed)
                .length === 0
            }
            onClick={handleGenerateRecipes}
          >
            Generate recipes
            <ArrowRight className="size-4" />
          </Button>
        </aside>
      </div>
    </section>
  );
}
