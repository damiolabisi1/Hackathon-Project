import "server-only";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { SpeechToTextConvertRequestModelId } from "@elevenlabs/elevenlabs-js/api";

/**
 * Server-only ElevenLabs wrapper. Handles both directions of the voice loop:
 *  - textToSpeech: the assistant's words -> spoken audio (streamed back to the browser)
 *  - speechToText: the user's mic audio -> text (ElevenLabs Scribe)
 *
 * The API key never leaves the server.
 */

// A warm, friendly built-in ElevenLabs voice as the default for the KitchenAid assistant.
// Override with ELEVENLABS_VOICE_ID in .env.local.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

let cached: ElevenLabsClient | null = null;

function client(): ElevenLabsClient {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  if (!cached) cached = new ElevenLabsClient({ apiKey });
  return cached;
}

/** Convert text to an MP3 audio stream using the KitchenAid voice. */
export async function textToSpeech(
  text: string,
): Promise<ReadableStream<Uint8Array>> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";

  return client().textToSpeech.stream(voiceId, {
    text,
    modelId,
    outputFormat: "mp3_44100_128",
    voiceSettings: {
      stability: 0.4,
      similarityBoost: 0.75,
      // A little style makes it sound like an encouraging cook, not a reader.
      style: 0.3,
    },
  });
}

/** Transcribe user mic audio with ElevenLabs Scribe. Returns plain text. */
export async function speechToText(audio: Blob): Promise<string> {
  const modelId = (process.env.ELEVENLABS_STT_MODEL_ID ||
    "scribe_v1") as SpeechToTextConvertRequestModelId;
  const res = await client().speechToText.convert({
    file: audio,
    modelId,
  });
  return (res.text ?? "").trim();
}
