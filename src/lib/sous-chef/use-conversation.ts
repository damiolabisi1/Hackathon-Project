"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hands-free conversation mode.
 *
 *  - Toggle ON → listens continuously.
 *  - Segments speech with an energy VAD and RESPONDS once you go quiet (it
 *    assumes you're done talking) — no button press per turn.
 *  - BARGE-IN: talk while it's speaking and it stops instantly, then answers
 *    your new utterance.
 *  - Toggle OFF → stops listening.
 *
 * You provide `onUtterance(text)`; return the reply text to speak (or null to
 * stay silent). STT uses ElevenLabs Scribe (/api/stt); TTS uses ElevenLabs
 * (/api/voice). Use headphones so its own voice doesn't retrigger the mic.
 */

export type ConversationState = "idle" | "listening" | "thinking" | "speaking";

const SPEECH_RMS = 0.025; // energy above this = talking
const SILENCE_HANG_MS = 900; // this much silence ends your turn
const MIN_UTTERANCE_MS = 350; // ignore blips
const BARGE_SUSTAIN_MS = 220; // sustained speech to interrupt a reply

type Options = {
  onUtterance: (text: string) => Promise<string | null>;
  onUserText?: (text: string) => void;
  onError?: (message: string) => void;
};

export function useConversation({
  onUtterance,
  onUserText,
  onError,
}: Options) {
  const [active, setActive] = useState(false);
  const [state, setStateValue] = useState<ConversationState>("idle");

  const stateRef = useRef<ConversationState>("idle");
  const setState = useCallback((s: ConversationState) => {
    stateRef.current = s;
    setStateValue(s);
  }, []);

  const onUtteranceRef = useRef(onUtterance);
  const onUserTextRef = useRef(onUserText);
  useEffect(() => {
    onUtteranceRef.current = onUtterance;
    onUserTextRef.current = onUserText;
  }, [onUtterance, onUserText]);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);

  const activeRef = useRef(false);
  const recordingRef = useRef(false);
  const thinkingRef = useRef(false);
  const speechStartRef = useRef(0);
  const lastVoiceRef = useRef(0);
  const bargeAccumRef = useRef(0);
  const lastFrameRef = useRef(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolveSpeakRef = useRef<(() => void) | null>(null);

  const fail = useCallback(
    (m: string) => onError?.(m),
    [onError],
  );

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setState("speaking");
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
        await new Promise<void>((resolve) => {
          resolveSpeakRef.current = resolve;
          const finish = () => {
            URL.revokeObjectURL(url);
            if (audioRef.current === audio) audioRef.current = null;
            resolveSpeakRef.current = null;
            resolve();
          };
          audio.onended = finish;
          audio.onerror = finish;
          audio.play().catch(finish);
        });
      } catch (err) {
        fail(err instanceof Error ? err.message : "Voice playback failed");
      } finally {
        setState(activeRef.current ? "listening" : "idle");
      }
    },
    [fail, setState],
  );

  const stopSpeaking = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (resolveSpeakRef.current) {
      resolveSpeakRef.current();
      resolveSpeakRef.current = null;
    }
    audioRef.current = null;
  }, []);

  const processUtterance = useCallback(
    async (audio: Blob) => {
      thinkingRef.current = true;
      setState("thinking");
      try {
        const form = new FormData();
        form.append("audio", audio, "utterance.webm");
        const sttRes = await fetch("/api/stt", { method: "POST", body: form });
        if (!sttRes.ok) throw new Error(`Transcription failed (${sttRes.status})`);
        const { text } = (await sttRes.json()) as { text: string };
        const userText = (text ?? "").trim();
        if (!userText) {
          setState(activeRef.current ? "listening" : "idle");
          return;
        }
        onUserTextRef.current?.(userText);
        const reply = await onUtteranceRef.current(userText);
        thinkingRef.current = false;
        if (reply && activeRef.current) {
          await speak(reply);
        } else {
          setState(activeRef.current ? "listening" : "idle");
        }
      } catch (err) {
        fail(err instanceof Error ? err.message : "Something went wrong");
        setState(activeRef.current ? "listening" : "idle");
      } finally {
        thinkingRef.current = false;
      }
    },
    [fail, setState, speak],
  );

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || recordingRef.current) return;
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      const durationMs = performance.now() - speechStartRef.current;
      if (blob.size > 0 && durationMs >= MIN_UTTERANCE_MS) {
        void processUtterance(blob);
      } else {
        setState(activeRef.current ? "listening" : "idle");
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    recordingRef.current = true;
    speechStartRef.current = performance.now();
  }, [processUtterance, setState]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recordingRef.current) {
      recordingRef.current = false;
      recorder.stop();
    }
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !activeRef.current) return;

    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);

    const now = performance.now();
    const dt = lastFrameRef.current ? now - lastFrameRef.current : 16;
    lastFrameRef.current = now;
    const voiced = rms > SPEECH_RMS;
    if (voiced) lastVoiceRef.current = now;

    const s = stateRef.current;
    if (s === "speaking") {
      bargeAccumRef.current = voiced ? bargeAccumRef.current + dt : 0;
      if (bargeAccumRef.current >= BARGE_SUSTAIN_MS) {
        bargeAccumRef.current = 0;
        stopSpeaking();
        setState("listening");
      }
    } else if (s === "listening" && !thinkingRef.current) {
      if (!recordingRef.current && voiced) {
        startRecording();
      } else if (
        recordingRef.current &&
        now - lastVoiceRef.current > SILENCE_HANG_MS
      ) {
        stopRecording();
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [setState, startRecording, stopRecording, stopSpeaking]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      ctxRef.current = ctx;
      analyserRef.current = analyser;

      activeRef.current = true;
      setActive(true);
      lastVoiceRef.current = performance.now();
      lastFrameRef.current = 0;
      setState("listening");
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      fail(
        err instanceof Error
          ? `Microphone access failed: ${err.message}`
          : "Microphone access failed",
      );
    }
  }, [fail, setState, tick]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    stopRecording();
    stopSpeaking();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    analyserRef.current = null;
    setState("idle");
  }, [setState, stopRecording, stopSpeaking]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else void start();
  }, [start, stop]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void ctxRef.current?.close();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { active, state, toggle, stop, speak };
}
