import { speechToText } from "@/lib/sous-chef/elevenlabs";

/**
 * POST /api/stt
 * Body: multipart/form-data with an "audio" file (the user's mic recording).
 * Returns: { text: string } — the transcript from ElevenLabs Scribe.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return Response.json({ error: "Missing 'audio' file" }, { status: 400 });
  }

  try {
    const text = await speechToText(audio);
    return Response.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "STT failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
