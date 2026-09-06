import { describe, expect, it } from "vitest";
import { currentDateContext, SYSTEM_PROMPT, withContext } from "./system-prompt";

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

  it("injects the authoritative current date in the user's time zone", () => {
    const now = new Date("2026-09-06T14:05:09.000Z");
    const context = currentDateContext(now, "Australia/Sydney");

    expect(context).toContain("Monday, 7 September 2026 at 00:05:09");
    expect(context).toContain("2026-09-06T14:05:09.000Z");
    expect(context).toContain("Australia/Sydney");
  });

  it("requires live web research for date-sensitive facts", () => {
    expect(SYSTEM_PROMPT).toContain("live or recent sports schedules, starting grids, results");
    expect(SYSTEM_PROMPT).toContain("include the relevant date or year in the search query");
  });
});
