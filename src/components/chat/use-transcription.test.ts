import { describe, expect, it } from "vitest";
import { encodeWav } from "./use-transcription";

describe("Safari PCM fallback", () => {
  it("creates a valid WAV recording instead of MP4", async () => {
    const wav = encodeWav([new Float32Array([0, 0.5, -0.5])], 48_000);
    const header = new TextDecoder().decode((await wav.arrayBuffer()).slice(0, 12));
    expect(wav.type).toBe("audio/wav");
    expect(header).toContain("RIFF");
    expect(header).toContain("WAVE");
  });
});
