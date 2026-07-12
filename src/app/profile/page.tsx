"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  Camera,
  ChefHat,
  Clock3,
  Heart,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
  LoaderCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchSavedRecipes } from "@/lib/api/saved-recipes";
import { fetchProfile, updateProfile } from "@/lib/api/profile";

const dietaryOptions = [
  "Vegetarian",
  "Vegan",
  "Halal",
  "Gluten Free",
  "Dairy Free",
];

const cookingLevels = ["Beginner", "Intermediate", "Advanced"];

const cookingTimes = [15, 30, 45, 60];

export default function ProfilePage() {
  const [name, setName] = useState("Damilola Olabisi");
  const [email, setEmail] = useState("damilola@example.com");
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([
    "Halal",
  ]);
  const [allergies, setAllergies] = useState("");
  const [cookingLevel, setCookingLevel] = useState("Intermediate");
  const [maximumCookingTime, setMaximumCookingTime] = useState(30);
  const [servings, setServings] = useState(2);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [savedRecipeCount, setSavedRecipeCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedRecipeCount() {
      try {
        const recipes = await fetchSavedRecipes();
        if (!cancelled) setSavedRecipeCount(recipes.length);
      } catch {
        if (!cancelled) setSavedRecipeCount(0);
      }
    }

    void loadSavedRecipeCount();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const profile = await fetchProfile();
        if (!profile || cancelled) return;

        setName(profile.name);
        setEmail(profile.email);
        setDietaryPreferences(profile.dietaryPreferences);
        setAllergies(profile.allergies.join(", "));
        setCookingLevel(profile.cookingLevel);
        setMaximumCookingTime(profile.maximumCookingTime);
        setServings(profile.servings);
      } catch (caught) {
        if (!cancelled) {
          setProfileError(
            caught instanceof Error
              ? caught.message
              : "Could not load profile.",
          );
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleDietaryPreference(option: string) {
    setSaved(false);

    setDietaryPreferences((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const profileData = {
      name,
      email,
      dietaryPreferences,
      allergies: allergies
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      cookingLevel,
      maximumCookingTime,
      servings,
    };

    setIsSaving(true);
    setProfileError("");

    try {
      await updateProfile(profileData);
      setSaved(true);
    } catch (caught) {
      setProfileError(
        caught instanceof Error ? caught.message : "Could not save profile.",
      );
      setSaved(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
            <UserRound className="size-4" />
            Your account
          </div>

          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
            Profile
          </h1>

          <p className="mt-3 max-w-2xl text-muted-foreground">
            Manage your personal information and cooking preferences.
          </p>
        </div>

        {saved && (
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
            <ShieldCheck className="size-4" />
            Profile saved
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-6">
          <div className="rounded-3xl border bg-white p-6 text-center shadow-sm">
            <div className="relative mx-auto flex size-28 items-center justify-center rounded-full bg-green-100 text-green-700">
              <UserRound className="size-12" />

              <button
                type="button"
                aria-label="Change profile picture"
                className="absolute bottom-0 right-0 flex size-10 items-center justify-center rounded-full border-4 border-white bg-green-600 text-white shadow-sm transition hover:bg-green-700"
              >
                <Camera className="size-4" />
              </button>
            </div>

            <h2 className="mt-5 text-xl font-extrabold">{name}</h2>

            <p className="mt-1 text-sm text-muted-foreground">{email}</p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700">
              <ChefHat className="size-4" />
              {cookingLevel} cook
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/saved"
              className="rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
              aria-label={`View ${savedRecipeCount ?? 0} saved recipes`}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-red-50 text-red-500">
                <Heart className="size-5 fill-current" />
              </span>

              <p className="mt-4 text-2xl font-extrabold">
                {savedRecipeCount ?? "…"}
              </p>

              <p className="text-sm text-muted-foreground">Saved recipes</p>
            </Link>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <span className="flex size-10 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <Sparkles className="size-5" />
              </span>

              <p className="mt-4 text-2xl font-extrabold">14</p>

              <p className="text-sm text-muted-foreground">Meals generated</p>
            </div>
          </div>
        </aside>

        <form onSubmit={handleSubmit} className="space-y-8">
          {profileError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {profileError}
            </div>
          )}
          <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
            <div>
              <p className="text-sm font-semibold text-green-700">
                Personal details
              </p>

              <h2 className="mt-1 text-2xl font-extrabold">
                Account information
              </h2>
            </div>

            <div className="mt-7 grid gap-6 md:grid-cols-2">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-semibold"
                >
                  Full name
                </label>

                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setSaved(false);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold"
                >
                  Email address
                </label>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setSaved(false);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
            <div>
              <p className="text-sm font-semibold text-green-700">
                Food preferences
              </p>

              <h2 className="mt-1 text-2xl font-extrabold">
                Dietary information
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                These preferences will be used when generating recipes.
              </p>
            </div>

            <div className="mt-7">
              <p className="text-sm font-semibold">Dietary preferences</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {dietaryOptions.map((option) => {
                  const selected = dietaryPreferences.includes(option);

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleDietaryPreference(option)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        selected
                          ? "border-green-600 bg-green-50 text-green-700"
                          : "bg-white text-muted-foreground hover:border-green-300 hover:text-green-700"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-7">
              <label
                htmlFor="allergies"
                className="mb-2 block text-sm font-semibold"
              >
                Allergies or ingredients to avoid
              </label>

              <Input
                id="allergies"
                value={allergies}
                onChange={(event) => {
                  setAllergies(event.target.value);
                  setSaved(false);
                }}
                placeholder="Example: peanuts, shellfish, mushrooms"
              />

              <p className="mt-2 text-xs text-muted-foreground">
                Separate multiple items with commas.
              </p>
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
            <div>
              <p className="text-sm font-semibold text-green-700">
                Cooking preferences
              </p>

              <h2 className="mt-1 text-2xl font-extrabold">
                Personalize your recipes
              </h2>
            </div>

            <div className="mt-7">
              <p className="text-sm font-semibold">Cooking experience</p>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {cookingLevels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setCookingLevel(level);
                      setSaved(false);
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      cookingLevel === level
                        ? "border-green-600 bg-green-50 text-green-700"
                        : "hover:border-green-300"
                    }`}
                  >
                    <ChefHat className="size-5" />
                    <p className="mt-3 font-bold">{level}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7 grid gap-7 md:grid-cols-2">
              <div>
                <div className="flex items-center gap-2">
                  <Clock3 className="size-4 text-green-600" />
                  <p className="text-sm font-semibold">Maximum cooking time</p>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  {cookingTimes.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => {
                        setMaximumCookingTime(time);
                        setSaved(false);
                      }}
                      className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition ${
                        maximumCookingTime === time
                          ? "border-green-600 bg-green-50 text-green-700"
                          : "hover:border-green-300"
                      }`}
                    >
                      {time}m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="servings"
                  className="mb-2 block text-sm font-semibold"
                >
                  Default servings
                </label>

                <Input
                  id="servings"
                  type="number"
                  min={1}
                  max={12}
                  value={servings}
                  onChange={(event) => {
                    setServings(Number(event.target.value));
                    setSaved(false);
                  }}
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto"
              disabled={isSaving}
            >
              {isSaving ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {isSaving ? "Saving to Atlas..." : "Save profile"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
