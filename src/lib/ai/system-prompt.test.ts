import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT, withContext } from "./system-prompt";

describe("LeBayon response contract", () => {
  it("defaults to the shortest complete answer without padding", () => {
    expect(SYSTEM_PROMPT).toContain("fewest words that properly solve it, then stop");
    expect(SYSTEM_PROMPT).toContain("Do not restate the question");
    expect(SYSTEM_PROMPT).not.toContain("short answer first, detail second");
  });
  it("permits deep dives and requires direct tool calls", () => {
    expect(SYSTEM_PROMPT).toContain("explicitly asks for depth");
    expect(SYSTEM_PROMPT).toContain("call it directly");
    expect(SYSTEM_PROMPT).toContain("do not routinely append a redundant Sources section");
  });
  it("keeps injected context separate", () => {
    const contextual = withContext("summary", "field note");
    expect(contextual).toContain("HIDDEN ROLLING SUMMARY");
    expect(contextual).toContain("EDDY NOTES");
  });
});
