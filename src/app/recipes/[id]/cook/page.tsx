import { redirect } from "next/navigation";

type CookPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * "Start cooking" on a recipe used to point here. Cook Mode now lives at /cook
 * (where the sidebar links), so send them there with the recipe pre-selected.
 * Keeping this route means the existing button keeps working.
 */
export default async function RecipeCookRedirect({ params }: CookPageProps) {
  const { id } = await params;
  redirect(`/cook?recipe=${encodeURIComponent(id)}`);
}
