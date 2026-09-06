import { describe, expect, it } from "vitest";
import { routeRequest } from "./request-router";

const route = (...content: string[]) => routeRequest({ summary: "", messages: content.map((value, index) => ({ role: index % 2 ? "assistant" as const : "user" as const, content: value })) });

describe("request routing", () => {
  it("does not treat general concepts as Klarna questions", () => {
    expect(route("What is mTLS?").domain).toBe("general");
    expect(route("What is JSON?")).toMatchObject({ domain: "general", freshness: "static", depth: "brief", klarnaQueries: [] });
  });
  it("recognises explicit and contextual Klarna questions", () => {
    expect(route("Is mTLS mandatory for a Klarna Network Acquiring Partner?")).toMatchObject({ domain: "klarna", depth: "brief" });
    expect(route("We are integrating with Klarna Network", "Right", "Is mTLS mandatory?").domain).toBe("klarna");
    expect(route("What's the difference between onWidgetCancel and onAbort?").klarnaQueries).toContain("onWidgetCancel onAbort Web SDK callbacks");
    expect(route("I forgot how to launch the klarna websdk")).toMatchObject({ domain: "klarna", depth: "brief" });
    expect(route("where does authorizePayment sit in the flow?").domain).toBe("klarna");
  });
  it.each([
    ["the websdk", "web_sdk", "Web SDK launch initialize initialization load setup script KlarnaSDK client"],
    ["no i just cant remember how to launch the websdk", "web_sdk", "Web SDK launch initialize initialization load setup script KlarnaSDK client"],
    ["how do I initialize WebSDK", "web_sdk", "Web SDK launch initialize initialization load setup script KlarnaSDK client"],
    ["how does authorizePayment work", "payment", "authorizePayment authorize payment Payment Authorization return response"],
    ["what does onWidgetCancel do", "web_sdk", "onWidgetCancel onAbort Web SDK callbacks"],
    ["do I need mTLS", "integration", "mTLS mutual TLS requirement"],
  ])("classifies and focuses %s", (message, area, query) => {
    expect(route(message)).toMatchObject({ domain: "klarna", klarnaArea: area, klarnaQueries: [query] });
  });
  it("routes current and deep visual requests structurally", () => {
    expect(route("Who won the F1 race this weekend?")).toMatchObject({ domain: "general", freshness: "current", depth: "brief" });
    expect(route("Give me the complete Klarna Network authorization flow with a sequence diagram")).toMatchObject({ domain: "klarna", depth: "deep", visual: "mermaid" });
  });
});
