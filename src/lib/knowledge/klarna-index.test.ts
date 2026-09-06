import corpus from "../../../knowledge/generated/klarna-docs.json";
import { describe, expect, it } from "vitest";
import { domainForUrl, searchIndex } from "./klarna-index";
describe("Klarna index relevance", () => { for (const [query, expected] of [["Network Session","Network Session"],["Web SDK events","Web SDK"],["authorization","Authorization"],["notifications","Notification"],["payment presentation","Presentation"]]) it(`finds ${query}`, () => expect(`${searchIndex(query,3)[0]?.title} ${searchIndex(query,3)[0]?.heading}`).toContain(expected)); });

it("ships descendant pages with required KN concepts", () => {
  const urls = new Set(corpus.map((chunk) => chunk.url));
  expect(urls.size).toBeGreaterThan(7);
  const text = corpus.map((chunk) => `${chunk.heading} ${chunk.text}`).join(" ").toLowerCase();
  for (const term of ["mtls", "authorizepayment", "payment authorization", "payment presentation", "onwidgetcancel", "onabort", "network session token"]) expect(text).toContain(term);
});
it("constrains searches to a documentation family", () => { expect(searchIndex("authorization", 5, "identity").every((hit) => domainForUrl(hit.url) === "identity")).toBe(true); expect(searchIndex("authorization", 5, "payment").every((hit) => domainForUrl(hit.url) === "payment")).toBe(true); });
