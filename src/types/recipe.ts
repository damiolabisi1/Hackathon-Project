export type RecipeIngredient = {
  name: string;
  amount: string;
  available: boolean;
};

export type RecipeStep = {
  step: number;
  instruction: string;
};

export type Recipe = {
  id: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  photographer?: string | null;
  photographerUrl?: string | null;
  photoUrl?: string | null;
  cookingTimeMinutes: number;
  difficulty: "Easy" | "Medium" | "Hard";
  servings: number;
  rating?: number;
  matchPercentage?: number;
  tags: string[];
  ingredients: RecipeIngredient[];
  missingIngredients: string[];
  instructions: RecipeStep[];
  substitutions?: string[];
  wasteReductionNote?: string;
};
