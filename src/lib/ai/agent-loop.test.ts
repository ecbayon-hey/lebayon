import { afterEach, describe, expect, it } from "vitest";
import { toolIterationLimit } from "./agent-loop";

describe("agent tool iteration limit", () => {
  afterEach(() => delete process.env.MAX_TOOL_ITERATIONS);

  it("allows enough research rounds by default", () => {
    expect(toolIterationLimit()).toBe(10);
  });

  it("honors a configured limit above the old four-round cap", () => {
    expect(toolIterationLimit("12")).toBe(12);
  });

  it.each(["0", "-1", "2.5", "not-a-number"])("uses the default for invalid value %s", (value) => {
    expect(toolIterationLimit(value)).toBe(10);
  });

  it("retains a generous upper safety bound", () => {
    expect(toolIterationLimit("100")).toBe(20);
  });
});
