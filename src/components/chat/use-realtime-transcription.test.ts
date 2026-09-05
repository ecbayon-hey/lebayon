import { beforeEach, describe, expect, it, vi } from "vitest";

const unmounts: Array<() => void> = [];
vi.mock("react", () => ({
  useState: (initial: unknown) => [initial, vi.fn()],
  useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) unmounts.push(cleanup);
  },
}));

import { useRealtimeTranscription } from "./use-realtime-transcription";

class SocketMock {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2;
  readyState = SocketMock.CONNECTING;
  sent: string[] = [];
  close = vi.fn(() => { this.readyState = SocketMock.CLOSING; });
  send = vi.fn((value: string) => this.sent.push(value));
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onerror?: () => void;
  onclose?: () => void;
  constructor(readonly url: string, readonly protocols: string[]) { sockets.push(this); }
}

class RecorderMock {
  state: RecordingState = "inactive";
  start = vi.fn(() => { this.state = "recording"; });
  stop = vi.fn(() => { this.state = "inactive"; });
  ondataavailable?: (event: { data: Blob }) => void;
  constructor(readonly stream: MediaStream, readonly options: MediaRecorderOptions) { recorders.push(this); }
}

const sockets: SocketMock[] = [];
const recorders: RecorderMock[] = [];
const track = { stop: vi.fn() };
const context = { state: "running", createMediaStreamSource: () => ({ connect: vi.fn() }), createAnalyser: () => ({ fftSize: 0 }), close: vi.fn() };
const session = {
  credential: "short-lived",
  endpoint: "wss://api.mistral.ai/v1/realtime?model=voxtral-mini-transcribe-realtime-2602",
  expiresAt: Math.floor(Date.now() / 1000) + 60,
  protocols: ["realtime", "mistral-insecure-api-key.short-lived"],
  audioFormat: "audio/webm;codecs=opus",
};

describe("realtime transcription browser lifecycle", () => {
  beforeEach(() => {
    sockets.length = 0; recorders.length = 0; unmounts.length = 0;
    track.stop.mockClear(); context.close.mockClear();
    vi.stubGlobal("WebSocket", SocketMock);
    vi.stubGlobal("MediaRecorder", RecorderMock);
    vi.stubGlobal("AudioContext", vi.fn(() => context));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(session)));
    Object.defineProperty(globalThis.navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }),
    }});
  });

  it("reports permission denial without allocating browser resources", async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    const voice = useRealtimeTranscription("typed", vi.fn());
    await voice.start();
    expect(sockets).toHaveLength(0);
    expect(context.close).not.toHaveBeenCalled();
  });

  it("cleans every allocated resource after connection failure and unmount", async () => {
    const voice = useRealtimeTranscription("typed", vi.fn());
    await voice.start();
    sockets[0].onerror?.();
    expect(recorders[0].stop).not.toHaveBeenCalled();
    expect(sockets[0].close).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalled();
    unmounts.forEach((cleanup) => cleanup());
  });

  it("accepts documented deltas, commits on Stop, and preserves typed text on Cancel", async () => {
    const setText = vi.fn();
    const voice = useRealtimeTranscription("typed ", setText);
    await voice.start();
    sockets[0].readyState = SocketMock.OPEN;
    sockets[0].onopen?.();
    expect(JSON.parse(sockets[0].sent[0])).toEqual({ type: "session.update", session: { audio_format: "audio/webm;codecs=opus" } });
    sockets[0].onmessage?.({ data: JSON.stringify({ type: "transcription.text.delta", delta: "hello" }) });
    sockets[0].onmessage?.({ data: JSON.stringify({ type: "unrelated.event", text: "ignored" }) });
    expect(setText).toHaveBeenLastCalledWith("typed hello");
    voice.stop();
    expect(sockets[0].sent.map((value) => JSON.parse(value))).toContainEqual({ type: "input_audio_buffer.commit" });
    voice.cancel();
    expect(setText).toHaveBeenLastCalledWith("typed ");
  });

  it("reset and cancellation stop tracks, recorder, socket, timers, and audio context", async () => {
    const voice = useRealtimeTranscription("", vi.fn());
    await voice.start();
    sockets[0].readyState = SocketMock.OPEN;
    sockets[0].onopen?.();
    voice.reset();
    expect(recorders[0].stop).toHaveBeenCalled();
    expect(sockets[0].close).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalled();
  });
});
