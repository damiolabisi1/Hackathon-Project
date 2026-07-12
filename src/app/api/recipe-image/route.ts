import { NextResponse } from "next/server";

type PexelsPhoto = {
  id: number;
  alt: string;
  url: string;
  photographer: string;
  photographer_url: string;
  src: {
    landscape: string;
    large: string;
    large2x: string;
    medium: string;
  };
};

type PexelsSearchResponse = {
  photos: PexelsPhoto[];
};

export async function POST(request: Request) {
  try {
    if (!process.env.PEXELS_API_KEY) {
      return NextResponse.json(
        { error: "Pexels API key is missing." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      recipeName?: string;
      description?: string;
      ingredients?: string[];
    };

    const recipeName = body.recipeName?.trim();

    if (!recipeName) {
      return NextResponse.json(
        { error: "Recipe name is required." },
        { status: 400 },
      );
    }

    const mainIngredients = Array.isArray(body.ingredients)
      ? body.ingredients.slice(0, 4).join(" ")
      : "";

    const query = `${recipeName} ${mainIngredients} plated meal food`;

    const searchUrl = new URL("https://api.pexels.com/v1/search");
    searchUrl.searchParams.set("query", query);
    searchUrl.searchParams.set("orientation", "landscape");
    searchUrl.searchParams.set("per_page", "5");

    const response = await fetch(searchUrl, {
      headers: {
        Authorization: process.env.PEXELS_API_KEY,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Pexels request failed: ${response.status}`);
    }

    const data = (await response.json()) as PexelsSearchResponse;
    const photo = data.photos[0];

    if (!photo) {
      return NextResponse.json({
        imageUrl: "/images/food.webp",
        imageAlt: `Photo representing ${recipeName}`,
        photographer: null,
        photographerUrl: null,
        photoUrl: null,
      });
    }

    return NextResponse.json({
      imageUrl:
        photo.src.landscape ||
        photo.src.large ||
        photo.src.large2x ||
        photo.src.medium,
      imageAlt: photo.alt || `Photo representing ${recipeName}`,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      photoUrl: photo.url,
    });
  } catch (error) {
    console.error("Recipe image search failed:", error);

    return NextResponse.json({
      imageUrl: "/images/food.webp",
      imageAlt: "A plated meal",
      photographer: null,
      photographerUrl: null,
      photoUrl: null,
    });
  }
}
