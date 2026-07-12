import "server-only";

import { getDb } from "./mongodb";
import type { Profile } from "@/types/profile";

const COLLECTION = "profiles";
const DEMO_PROFILE_ID = "demo-user";

type ProfileDoc = Profile & { _id: string };

async function collection() {
  const db = await getDb();
  return db.collection<ProfileDoc>(COLLECTION);
}

export async function getProfile(): Promise<Profile | null> {
  const doc = await (await collection()).findOne({ _id: DEMO_PROFILE_ID });
  if (!doc) return null;

  const { _id, ...profile } = doc;
  void _id;
  return profile;
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const updatedAt = new Date().toISOString();
  const saved = { ...profile, updatedAt };

  await (
    await collection()
  ).updateOne({ _id: DEMO_PROFILE_ID }, { $set: saved }, { upsert: true });

  return saved;
}
