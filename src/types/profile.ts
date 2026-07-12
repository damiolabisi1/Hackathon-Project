export type Profile = {
  name: string;
  email: string;
  dietaryPreferences: string[];
  allergies: string[];
  cookingLevel: string;
  maximumCookingTime: number;
  servings: number;
  updatedAt?: string;
};
