/**
 * Understands a spoken utterance in Cook Mode and decides whether the user is
 * LISTING INGREDIENTS ("rice, chicken, and spinach") or having a CONVERSATION
 * ("what can I make?", "how are you?"). Also extracts any ingredient names that
 * appear inside a conversational sentence.
 *
 * The reply text here is a LOCAL stand-in so voice conversation works before the
 * Gemini brain is wired in. When `/api/chat` is ready, replace `generateReply`
 * with a call to it — the classifier can still run client-side to keep the
 * ingredient list in sync.
 */

export type Classification = {
  kind: "ingredients" | "conversation";
  /** Ingredient names detected in the utterance (may be empty). */
  ingredients: string[];
  /** Ingredients the user said they DON'T have (negation) — never added. */
  negated: string[];
  /** True if the utterance reads as a question / request. */
  isQuestion: boolean;
  text: string;
};

// A pragmatic lexicon of common cooking ingredients. Matches here are always
// treated as ingredients, even inside a question.
const INGREDIENT_LEXICON = new Set([
  "rice", "pasta", "noodles", "bread", "flour", "quinoa", "couscous", "oats",
  "tortilla", "tortillas", "potato", "potatoes", "sweet potato",
  "chicken", "beef", "pork", "lamb", "turkey", "bacon", "sausage", "ham",
  "fish", "salmon", "tuna", "shrimp", "prawns", "tofu", "tempeh", "eggs", "egg",
  "spinach", "kale", "lettuce", "arugula", "cabbage", "broccoli", "cauliflower",
  "carrot", "carrots", "onion", "onions", "garlic", "ginger", "tomato",
  "tomatoes", "pepper", "peppers", "bell pepper", "mushroom", "mushrooms",
  "zucchini", "cucumber", "celery", "corn", "peas", "green beans", "beans",
  "chickpeas", "lentils", "avocado", "eggplant", "asparagus", "leek", "shallots",
  "cheese", "parmesan", "cheddar", "mozzarella", "feta", "butter", "milk",
  "cream", "heavy cream", "yogurt", "sour cream", "cream cheese",
  "olive oil", "oil", "vinegar", "soy sauce", "honey", "sugar", "salt",
  "black pepper", "cumin", "paprika", "cinnamon", "basil", "cilantro",
  "parsley", "oregano", "thyme", "rosemary", "chili", "chilli", "lime", "lemon",
  "orange", "apple", "banana", "strawberries", "blueberries", "mango",
  "coconut milk", "stock", "broth", "tomato sauce", "peanut butter", "nuts",
  "almonds", "walnuts", "cashews", "raisins", "chocolate", "vanilla",
]);

// Words that signal conversation rather than an ingredient list.
const QUESTION_STARTERS = [
  "what", "how", "why", "when", "where", "who", "which", "can", "could",
  "would", "should", "do", "does", "did", "is", "are", "am", "will", "may",
  "tell", "explain", "give", "show", "suggest", "recommend", "help", "let's",
  "lets", "make", "find", "any", "got",
];

const GREETINGS = [
  "hi", "hello", "hey", "yo", "thanks", "thank", "okay", "ok", "cool", "great",
  "nice", "awesome", "sounds good", "yes", "no", "yeah", "nope", "bye",
];

// Tokens that must never be captured as an ingredient.
const STOPWORDS = new Set([
  "i", "you", "we", "he", "she", "it", "they", "me", "my", "your", "our",
  "have", "has", "had", "having", "got", "get", "want", "need", "like", "make",
  "cook", "cooking", "eat", "some", "a", "an", "the", "of", "with", "and", "or",
  "to", "for", "in", "on", "is", "are", "am", "be", "can", "could", "would",
  "should", "do", "does", "what", "how", "why", "when", "where", "who", "which",
  "please", "thanks", "thank", "hi", "hello", "hey", "okay", "ok", "yes", "no",
  "there", "here", "this", "that", "these", "those", "also", "just", "only",
  "something", "anything", "recipe", "recipes", "food", "meal", "dinner",
  "lunch", "breakfast", "today", "tonight", "right", "now",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[.!?]+$/g, "").trim();
}

function firstWord(text: string): string {
  return normalize(text).split(/\s+/)[0] ?? "";
}

/** Find lexicon ingredients mentioned anywhere in the text (uni- and bigrams). */
function lexiconHits(text: string): string[] {
  const clean = text.toLowerCase().replace(/[^a-z\s]/g, " ");
  const words = clean.split(/\s+/).filter(Boolean);
  const hits: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const bigram = i + 1 < words.length ? `${words[i]} ${words[i + 1]}` : "";
    if (bigram && INGREDIENT_LEXICON.has(bigram)) {
      hits.push(bigram);
      i++; // consume the second word
    } else if (INGREDIENT_LEXICON.has(words[i])) {
      hits.push(words[i]);
    }
  }
  return hits;
}

/** Accept an unknown token as an ingredient only if it looks like a food name. */
function looksLikeIngredient(item: string): boolean {
  const words = item.trim().split(/\s+/);
  if (words.length === 0 || words.length > 3) return false;
  return words.every(
    (w) => /^[a-z][a-z-]*$/.test(w) && !STOPWORDS.has(w),
  );
}

function titleCase(item: string): string {
  return item
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const key = raw.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(titleCase(raw));
    }
  }
  return out;
}

export function classifyUtterance(text: string): Classification {
  const norm = normalize(text);
  const isQuestion =
    /\?/.test(text) ||
    QUESTION_STARTERS.includes(firstWord(norm)) ||
    /\b(what|how|can i|could i|should i|do you|is there|are there)\b/.test(norm);
  const isGreeting = GREETINGS.includes(norm) || GREETINGS.includes(firstWord(norm));

  const hits = lexiconHits(text);

  // Negation: "I don't have onions", "out of butter", "ran out of eggs".
  // These mention an ingredient but must NEVER add it to the list.
  const isNegation =
    /(don'?t have|do not have|dont have|no more|out of|without|ran out|haven'?t got|i have no|there'?s no|got no|not have)/.test(
      norm,
    );
  if (isNegation) {
    return {
      kind: "conversation",
      ingredients: [],
      negated: hits,
      isQuestion,
      text,
    };
  }

  // Strip a leading "I have / I've got / there's / add ..." lead-in so the rest
  // can be parsed as a list.
  const listPart = norm.replace(
    /^(i have|i've got|i got|i've|we have|we've got|there'?s|there is|there are|add|also|and)\s+/,
    "",
  );

  // A declarative (non-question, non-greeting) utterance is parsed as a list.
  let listItems: string[] = [];
  if (!isQuestion && !isGreeting) {
    listItems = listPart
      .split(/,|\band\b|\bor\b|\n|&|\bwith\b/gi)
      .map((s) => s.trim())
      .filter((s) => s && looksLikeIngredient(s));
  }

  const ingredients = dedupe([...hits, ...listItems]);

  // If we only found ingredients and it wasn't phrased as a question, it's an
  // ingredient list. Otherwise it's conversation (possibly mentioning food).
  const kind: Classification["kind"] =
    ingredients.length > 0 && !isQuestion && !isGreeting
      ? "ingredients"
      : "conversation";

  return { kind, ingredients, negated: [], isQuestion, text };
}

// --- Local reply generator (placeholder until Gemini `/api/chat` is wired) ---

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function generateReply(
  c: Classification,
  ctx: { knownIngredients: string[] },
): string {
  const norm = normalize(c.text);

  // User said they DON'T have something — offer a substitute, don't add it.
  if (c.negated.length > 0) {
    return `No problem — you can usually swap ${joinList(
      c.negated,
    )} for something similar. What else do you have?`;
  }

  // Ingredients were captured this turn.
  if (c.ingredients.length > 0 && c.kind === "ingredients") {
    return `Nice — I've added ${joinList(
      c.ingredients,
    )}. What else do you have, or say "that's everything" and I'll suggest recipes.`;
  }

  // Conversational, but food was mentioned (e.g. "what can I make with rice?").
  if (c.ingredients.length > 0) {
    return `I heard ${joinList(
      c.ingredients,
    )} — I've added those. Tell me anything else you have and I'll help you cook.`;
  }

  // Pure conversation — light, cooking-oriented replies.
  if (/(hello|^hi\b|^hey\b|how are you)/.test(norm)) {
    return "Hey! I'm ready to cook. Tell me what ingredients you have.";
  }
  if (/(what can i|what should i|suggest|recommend|idea|make|cook)/.test(norm)) {
    return ctx.knownIngredients.length > 0
      ? `With ${joinList(
          ctx.knownIngredients.slice(0, 5),
        )}, we can definitely make something. Add a couple more items or tap Continue and I'll pull up recipes.`
      : "Tell me a few ingredients you have and I'll suggest something you can make.";
  }
  if (/(thank|thanks|appreciate)/.test(norm)) {
    return "Anytime! Anything else in your kitchen?";
  }
  if (/(help|how does this|what do you do)/.test(norm)) {
    return "Just tell me the ingredients you have — like 'rice, chicken, and spinach' — and I'll gather them, then suggest recipes. You can talk to me naturally.";
  }
  return "Got it. You can list ingredients like 'rice, chicken, spinach', or ask me what to cook.";
}
