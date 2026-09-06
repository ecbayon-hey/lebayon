"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecordingState = "idle" | "recording" | "transcribing" | "failed";

type Resources = { stream?: MediaStream; recorder?: MediaRecorder; context?: AudioContext; processor?: ScriptProcessorNode; sampleRate?: number; timer?: ReturnType<typeof setInterval> };
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];

function supportedMimeType() {
  return MIME_CANDIDATES.find((type) => typeof MediaRecorder.isTypeSupported !== "function" || MediaRecorder.isTypeSupported(type)) ?? "";
}

export function isIOS(userAgent: string, platform = "", touchPoints = 0) {
  return /iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && touchPoints > 1);
}

/** Encodes mono browser PCM without ffmpeg; iOS always uses this predictable container. */
export function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const samples = chunks.reduce((size, chunk) => size + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, "data"); view.setUint32(40, samples * 2, true);
  let offset = 44;
  for (const chunk of chunks) for (const value of chunk) { view.setInt16(offset, Math.max(-1, Math.min(1, value)) * (value < 0 ? 0x8000 : 0x7fff), true); offset += 2; }
  return new Blob([buffer], { type: "audio/wav" });
}

export function useTranscription(text: string, setText: (value: string) => void) {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const resources = useRef<Resources>({});
  const chunks = useRef<Blob[]>([]);
  const pcmChunks = useRef<Float32Array[]>([]);
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
    pcmChunks.current = [];
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (id !== run.current) return stream.getTracks().forEach((track) => track.stop());
      const context = new AudioContext();
      const node = context.createAnalyser();
      node.fftSize = 512;
      const source = context.createMediaStreamSource(stream);
      source.connect(node);
      const forcePcm = isIOS(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
      const mimeType = forcePcm ? "" : supportedMimeType();
      let recorder: MediaRecorder | undefined;
      let processor: ScriptProcessorNode | undefined;
      if (mimeType) {
        recorder = new MediaRecorder(stream, { mimeType });
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
        recorder.start(250);
      } else {
        processor = context.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (event) => pcmChunks.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
        source.connect(processor);
        processor.connect(context.destination);
        await context.resume();
      }
      resources.current = { stream, context, recorder, processor, sampleRate: context.sampleRate };
      resources.current.timer = setInterval(() => setElapsed((value) => value + 1), 1_000);
      setAnalyser(node);
      setState("recording");
    } catch (caught) {
      const denied = caught instanceof DOMException && caught.name === "NotAllowedError";
      fail(denied ? "Microphone permission was denied." : "Voice recording could not start.");
    }
  }, [fail, text]);

  const stop = useCallback(() => {
    const { recorder, processor, sampleRate } = resources.current;
    if ((!recorder || recorder.state === "inactive") && !processor) return;
    // Preserve the guard's narrowing across the asynchronous callback. Reading
    // the mutable ref again in onstop would correctly be considered optional.
    const id = run.current;
    setState("transcribing");
    const upload = async () => {
      const type = recorder?.mimeType || chunks.current[0]?.type || "audio/wav";
      if (!recorder && pcmChunks.current.reduce((count, chunk) => count + chunk.length, 0) < 1_024) {
        fail("No audio was captured. Please record for a little longer.");
        return;
      }
      const blob = recorder ? new Blob(chunks.current, { type }) : encodeWav(pcmChunks.current, sampleRate || 44_100);
      disposeAudio();
      try {
        const form = new FormData();
        const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("wav") ? "wav" : "webm";
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
    if (recorder) { recorder.onstop = upload; recorder.stop(); }
    else { if (processor) processor.onaudioprocess = null; void upload(); }
  }, [disposeAudio, fail, setText]);

  const cancel = useCallback(() => {
    run.current += 1;
    const recorder = resources.current.recorder;
    if (recorder && recorder.state !== "inactive") { recorder.onstop = null; recorder.stop(); }
    disposeAudio();
    chunks.current = [];
    setError("");
    setState("idle");
  }, [disposeAudio]);
  const reset = cancel;

  useEffect(() => () => { run.current += 1; disposeAudio(); }, [disposeAudio]);
  return { state, error, elapsed, analyser, start, stop, cancel, reset };
}
