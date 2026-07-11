import type { IngredientDetectionResponse } from "@/types/ingredient";

export async function detectIngredients(
  image: File,
): Promise<IngredientDetectionResponse> {
  const formData = new FormData();

  formData.append("image", image);

  const response = await fetch("/api/ingredients/detect", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);

    throw new Error(
      errorData?.message ?? "We could not identify the ingredients.",
    );
  }

  return response.json();
}
