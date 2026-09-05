"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecordingState =
  | "idle"
  | "requesting-permission"
  | "connecting"
  | "recording"
  | "stopping"
  | "failed"
  | "expired";

type Session = {
  credential: string;
  endpoint: string;
  expiresAt: number;
  protocols: string[];
  audioFormat: "audio/webm;codecs=opus";
};

type Resources = {
  stream?: MediaStream;
  recorder?: MediaRecorder;
  socket?: WebSocket;
  context?: AudioContext;
  expiryTimer?: ReturnType<typeof setTimeout>;
  elapsedTimer?: ReturnType<typeof setInterval>;
};

const encode = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export function useRealtimeTranscription(text: string, setText: (value: string) => void) {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const resources = useRef<Resources>({});
  const run = useRef(0);
  const typedPrefix = useRef("");
  const transcript = useRef("");

  const dispose = useCallback(() => {
    const current = resources.current;
    if (current.expiryTimer) clearTimeout(current.expiryTimer);
    if (current.elapsedTimer) clearInterval(current.elapsedTimer);
    if (current.recorder && current.recorder.state !== "inactive") current.recorder.stop();
    if (current.socket && current.socket.readyState < WebSocket.CLOSING) current.socket.close();
    current.stream?.getTracks().forEach((track) => track.stop());
    if (current.context && current.context.state !== "closed") void current.context.close();
    resources.current = {};
    setAnalyser(null);
    setElapsed(0);
  }, []);

  const finish = useCallback((next: RecordingState, message = "") => {
    run.current += 1;
    dispose();
    setError(message);
    setState(next);
  }, [dispose]);

  const cancel = useCallback(() => {
    // Restore exactly what existed before recording; only recognized speech is removed.
    setText(typedPrefix.current);
    finish("idle");
  }, [finish, setText]);

  const stop = useCallback(() => {
    const socket = resources.current.socket;
    const recorder = resources.current.recorder;
    if (!socket || socket.readyState !== WebSocket.OPEN) return finish("idle");
    setState("stopping");
    if (recorder && recorder.state !== "inactive") recorder.stop();
    socket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    // The completion event normally closes this promptly; this is a cleanup backstop.
    resources.current.expiryTimer = setTimeout(() => finish("idle"), 2_000);
  }, [finish]);

  const start = useCallback(async () => {
    const id = ++run.current;
    dispose();
    typedPrefix.current = text;
    transcript.current = "";
    setError("");
    setState("requesting-permission");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (id !== run.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      resources.current.stream = stream;

      const context = new AudioContext();
      resources.current.context = context;
      const source = context.createMediaStreamSource(stream);
      const node = context.createAnalyser();
      node.fftSize = 512;
      source.connect(node);
      setAnalyser(node);
      setState("connecting");

      const response = await fetch("/api/stt/session", { method: "POST" });
      if (!response.ok) throw new Error("Voice session unavailable.");
      const session = (await response.json()) as Session;
      if (id !== run.current) return;

      const socket = new WebSocket(session.endpoint, session.protocols);
      resources.current.socket = socket;
      const recorder = new MediaRecorder(stream, { mimeType: session.audioFormat });
      resources.current.recorder = recorder;

      resources.current.expiryTimer = setTimeout(
        () => finish("expired", "The voice session expired. Please try again."),
        Math.max(0, session.expiresAt * 1_000 - Date.now()),
      );

      recorder.ondataavailable = async (event) => {
        if (!event.data.size || socket.readyState !== WebSocket.OPEN) return;
        const audio = await encode(event.data);
        if (id === run.current && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "input_audio_buffer.append", audio }));
        }
      };
      socket.onopen = () => {
        if (id !== run.current) return;
        socket.send(JSON.stringify({
          type: "session.update",
          session: { audio_format: session.audioFormat },
        }));
        recorder.start(250);
        setState("recording");
        resources.current.elapsedTimer = setInterval(() => setElapsed((value) => value + 1), 1_000);
      };
      socket.onmessage = (event) => {
        let message: unknown;
        try { message = JSON.parse(String(event.data)); } catch { return; }
        if (!message || typeof message !== "object") return;
        const data = message as { type?: string; delta?: string; text?: string };
        if (data.type === "transcription.text.delta" && typeof data.delta === "string") {
          transcript.current += data.delta;
          setText(typedPrefix.current + transcript.current);
        } else if (data.type === "transcription.text.done" && typeof data.text === "string") {
          transcript.current = data.text;
          setText(typedPrefix.current + transcript.current);
          finish("idle");
        }
      };
      socket.onerror = () => finish("failed", "Live transcription lost its connection.");
      socket.onclose = () => {
        if (id === run.current) finish("failed", "Live transcription closed unexpectedly.");
      };
    } catch (caught) {
      if (id !== run.current) return;
      const denied = caught instanceof DOMException && caught.name === "NotAllowedError";
      finish("failed", denied ? "Microphone permission was denied." : "Voice transcription could not start.");
    }
  }, [dispose, finish, setText, text]);

  const reset = useCallback(() => {
    finish("idle");
    typedPrefix.current = "";
    transcript.current = "";
  }, [finish]);

  useEffect(() => () => { run.current += 1; dispose(); }, [dispose]);

  return { state, error, elapsed, analyser, start, stop, cancel, reset };
}
