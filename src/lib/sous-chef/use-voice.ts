"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Lightweight voice helper for a text + voice chatbox, powered by the
 * ElevenLabs key on the server:
 *   - push-to-talk recording -> ElevenLabs Scribe (/api/stt) -> transcript
 *   - speak(text) -> ElevenLabs TTS (/api/voice) -> audio playback
 *
 * Push-to-talk (click to start, click to stop) is used instead of continuous
 * listening — it's robust in a noisy room and fits a chat input naturally.
 */
export function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onTranscriptRef = useRef<((text: string) => void) | null>(null);

  const startRecording = useCallback(
    async (onTranscript: (text: string) => void) => {
      setError(null);
      onTranscriptRef.current = onTranscript;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = stream;
        const mime = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
        const recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          if (blob.size === 0) return;

          setIsTranscribing(true);
          try {
            const form = new FormData();
            form.append("audio", blob, "utterance.webm");
            const res = await fetch("/api/stt", {
              method: "POST",
              body: form,
            });
            if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
            const { text } = (await res.json()) as { text: string };
            const clean = (text ?? "").trim();
            if (clean) onTranscriptRef.current?.(clean);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Transcription failed",
            );
          } finally {
            setIsTranscribing(false);
          }
        };

        recorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? `Microphone access failed: ${err.message}`
            : "Microphone access failed",
        );
      }
    },
    [],
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(
    (onTranscript: (text: string) => void) => {
      if (recorderRef.current && recorderRef.current.state === "recording") {
        stopRecording();
      } else {
        void startRecording(onTranscript);
      }
    },
    [startRecording, stopRecording],
  );

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      stopSpeaking();
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(`Voice failed (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        setIsSpeaking(true);
        const done = () => {
          URL.revokeObjectURL(url);
          if (audioRef.current === audio) audioRef.current = null;
          setIsSpeaking(false);
        };
        audio.onended = done;
        audio.onerror = done;
        await audio.play().catch(done);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Voice playback failed");
        setIsSpeaking(false);
      }
    },
    [stopSpeaking],
  );

  return {
    isRecording,
    isTranscribing,
    isSpeaking,
    error,
    toggleRecording,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking,
  };
}
