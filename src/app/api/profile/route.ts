import { NextResponse } from "next/server";

import { isDbConfigured } from "@/lib/db/mongodb";
import { getProfile, saveProfile } from "@/lib/db/profile";
import type { Profile } from "@/types/profile";

function dbMissing() {
  return NextResponse.json(
    { message: "MongoDB Atlas is not configured." },
    { status: 503 },
  );
}

function failed(error: unknown, action: string) {
  console.error(`Profile (${action}) failed:`, error);
  return NextResponse.json(
    { message: `Could not ${action}.` },
    { status: 500 },
  );
}

export async function GET() {
  if (!isDbConfigured()) return dbMissing();

  try {
    return NextResponse.json({ profile: await getProfile() });
  } catch (error) {
    return failed(error, "load profile");
  }
}

export async function PUT(request: Request) {
  if (!isDbConfigured()) return dbMissing();

  try {
    const profile = (await request.json()) as Profile;

    if (
      !profile.name?.trim() ||
      !profile.email?.trim() ||
      !Array.isArray(profile.dietaryPreferences) ||
      !Array.isArray(profile.allergies) ||
      !profile.cookingLevel ||
      !Number.isFinite(profile.maximumCookingTime) ||
      !Number.isFinite(profile.servings)
    ) {
      return NextResponse.json(
        { message: "Complete all required profile fields." },
        { status: 400 },
      );
    }

    const saved = await saveProfile({
      ...profile,
      name: profile.name.trim(),
      email: profile.email.trim(),
      servings: Math.min(12, Math.max(1, profile.servings)),
    });

    return NextResponse.json({ profile: saved });
  } catch (error) {
    return failed(error, "save profile");
  }
}
