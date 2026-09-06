import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT, withContext } from "./system-prompt";

describe("LeBayon system prompt", () => {
  it("lets Claude choose when to read live Klarna docs", () => {
    expect(SYSTEM_PROMPT).toContain("READ THE CURRENT OFFICIAL KLARNA DOCUMENTATION BEFORE ANSWERING");
    expect(SYSTEM_PROMPT).toContain("https://docs.klarna.com/klarna-network-distribution/web-sdk/");
    expect(SYSTEM_PROMPT).toContain("read_klarna_docs");
    expect(SYSTEM_PROMPT).not.toContain("HIDDEN ROUTE");
  });

  it("always includes Eddy notes", () => {
    expect(withContext("summary", "field note")).toContain("field note");
  });
});
