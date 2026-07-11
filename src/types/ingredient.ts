export type DetectedIngredient = {
  id: string;
  name: string;
  confidence?: number;
  confirmed: boolean;
};

export type IngredientDetectionResponse = {
  ingredients: DetectedIngredient[];
  uncertainItems?: {
    id: string;
    name: string;
    confidence?: number;
  }[];
};
