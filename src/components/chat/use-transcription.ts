"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecordingState = "idle" | "recording" | "transcribing" | "failed";

type Resources = { stream?: MediaStream; recorder?: MediaRecorder; context?: AudioContext; timer?: ReturnType<typeof setInterval> };
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

function supportedMimeType() {
  return MIME_CANDIDATES.find((type) => typeof MediaRecorder.isTypeSupported !== "function" || MediaRecorder.isTypeSupported(type)) ?? "";
}

export function useTranscription(text: string, setText: (value: string) => void) {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const resources = useRef<Resources>({});
  const chunks = useRef<Blob[]>([]);
  const prefix = useRef("");
  const run = useRef(0);

  const disposeAudio = useCallback(() => {
    const current = resources.current;
    if (current.timer) clearInterval(current.timer);
    current.stream?.getTracks().forEach((track) => track.stop());
    if (current.context && current.context.state !== "closed") void current.context.close();
    resources.current = {};
    setAnalyser(null);
    setElapsed(0);
  }, []);

  const fail = useCallback((message: string) => {
    run.current += 1;
    const recorder = resources.current.recorder;
    if (recorder?.state !== "inactive") recorder?.stop();
    disposeAudio();
    setError(message);
    setState("failed");
  }, [disposeAudio]);

  const start = useCallback(async () => {
    const id = ++run.current;
    prefix.current = text;
    chunks.current = [];
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (id !== run.current) return stream.getTracks().forEach((track) => track.stop());
      const context = new AudioContext();
      const node = context.createAnalyser();
      node.fftSize = 512;
      context.createMediaStreamSource(stream).connect(node);
      const mimeType = supportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      resources.current = { stream, context, recorder };
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      recorder.start(250);
      resources.current.timer = setInterval(() => setElapsed((value) => value + 1), 1_000);
      setAnalyser(node);
      setState("recording");
    } catch (caught) {
      const denied = caught instanceof DOMException && caught.name === "NotAllowedError";
      fail(denied ? "Microphone permission was denied." : "Voice recording could not start.");
    }
  }, [fail, text]);

  const stop = useCallback(() => {
    const recorder = resources.current.recorder;
    if (!recorder || recorder.state === "inactive") return;
    const id = run.current;
    setState("transcribing");
    recorder.onstop = async () => {
      const type = recorder.mimeType || chunks.current[0]?.type || "audio/webm";
      const blob = new Blob(chunks.current, { type });
      disposeAudio();
      try {
        const form = new FormData();
        const extension = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        form.append("file", blob, `recording.${extension}`);
        const response = await fetch("/api/transcribe", { method: "POST", body: form });
        const body = await response.json().catch(() => ({})) as { text?: string; error?: string };
        if (!response.ok || typeof body.text !== "string") throw new Error(body.error || "The recording could not be transcribed.");
        if (id !== run.current) return;
        const separator = prefix.current && body.text && !/\s$/.test(prefix.current) ? " " : "";
        setText(prefix.current + separator + body.text);
        setError("");
        setState("idle");
      } catch (caught) {
        if (id === run.current) fail(caught instanceof Error ? caught.message : "The recording could not be transcribed.");
      }
    };
    recorder.stop();
  }, [disposeAudio, fail, setText]);

  const cancel = useCallback(() => {
    run.current += 1;
    const recorder = resources.current.recorder;
    if (recorder?.state !== "inactive") { recorder.onstop = null; recorder.stop(); }
    disposeAudio();
    chunks.current = [];
    setError("");
    setState("idle");
  }, [disposeAudio]);
  const reset = cancel;

  useEffect(() => () => { run.current += 1; disposeAudio(); }, [disposeAudio]);
  return { state, error, elapsed, analyser, start, stop, cancel, reset };
}
