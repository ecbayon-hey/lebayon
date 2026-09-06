import { describe, expect, it } from "vitest";
import { encodeWav, isIOS } from "./use-transcription";

describe("Safari PCM fallback", () => {
  it("creates a valid WAV recording instead of MP4", async () => {
    const wav = encodeWav([new Float32Array([0, 0.5, -0.5])], 48_000);
    const buffer = await wav.arrayBuffer();
    const view = new DataView(buffer);
    const text = (start: number, length: number) => new TextDecoder().decode(buffer.slice(start, start + length));
    expect(wav.type).toBe("audio/wav");
    expect(text(0, 4)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(buffer.byteLength - 8);
    expect(text(8, 4)).toBe("WAVE");
    expect(text(12, 4)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint32(28, true)).toBe(96_000);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(6);
  });

  it("recognizes iPhone, iPad, and touch-capable iPad desktop mode", () => {
    expect(isIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(true);
    expect(isIOS("Mozilla/5.0", "MacIntel", 5)).toBe(true);
    expect(isIOS("Mozilla/5.0 (X11; Linux x86_64)", "Linux", 0)).toBe(false);
  });
});
