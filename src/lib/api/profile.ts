import type { Profile } from "@/types/profile";

async function parse(response: Response) {
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.message ?? "Profile request failed.");
  }
  return result;
}

export async function fetchProfile(): Promise<Profile | null> {
  const response = await fetch("/api/profile", { cache: "no-store" });
  const result = await parse(response);
  return result.profile ?? null;
}

export async function updateProfile(profile: Profile): Promise<Profile> {
  const response = await fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  const result = await parse(response);
  return result.profile;
}
