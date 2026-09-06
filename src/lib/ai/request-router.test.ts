import { describe, expect, it } from "vitest";
import { routeRequest } from "./request-router";

const route = (...content: string[]) => routeRequest({ messages: content.map((value, index) => ({ role: index % 2 ? "assistant" as const : "user" as const, content: value })) });

describe("request routing", () => {
  it("does not treat general concepts as Klarna questions", () => {
    expect(route("What is mTLS?").domain).toBe("general");
    expect(route("What is JSON?")).toMatchObject({ domain: "general", freshness: "static", depth: "brief", klarnaQueries: [] });
  });
  it("recognises explicit and contextual Klarna questions", () => {
    expect(route("Is mTLS mandatory for a Klarna Network Acquiring Partner?")).toMatchObject({ domain: "klarna", depth: "brief" });
    expect(route("We are integrating with Klarna Network", "Right", "Is mTLS mandatory?").domain).toBe("klarna");
    expect(route("What's the difference between onWidgetCancel and onAbort?").klarnaQueries).toContain("onWidgetCancel onAbort Web SDK callbacks");
  });
  it("routes current and deep visual requests structurally", () => {
    expect(route("Who won the F1 race this weekend?")).toMatchObject({ domain: "general", freshness: "current", depth: "brief" });
    expect(route("Give me the complete Klarna Network authorization flow with a sequence diagram")).toMatchObject({ domain: "klarna", depth: "deep", visual: "mermaid" });
  });
});
