import { textToSpeech } from "@/lib/sous-chef/elevenlabs";

/**
 * POST /api/voice
 * Body: { text: string }
 * Returns: streamed audio/mpeg — Assistant speaking, via ElevenLabs TTS.
 */
export async function POST(req: Request) {
  let text: string;
  try {
    const body = (await req.json()) as { text?: string };
    text = (body.text ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!text) {
    return Response.json({ error: "Missing 'text'" }, { status: 400 });
  }

  try {
    const audio = await textToSpeech(text);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
