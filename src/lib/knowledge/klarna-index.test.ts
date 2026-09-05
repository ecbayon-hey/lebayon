import corpus from "../../../knowledge/generated/klarna-docs.json";
import { describe, expect, it } from "vitest";
import { domainForUrl, searchIndex } from "./klarna-index";
describe("Klarna index relevance", () => { for (const [query, expected] of [["Network Session","Network Session"],["Web SDK events","Web SDK"],["authorization","Authorization"],["notifications","Notification"],["payment presentation","Presentation"]]) it(`finds ${query}`, () => expect(`${searchIndex(query,3)[0]?.title} ${searchIndex(query,3)[0]?.heading}`).toContain(expected)); });

it("ships a non-trivial generated corpus", () => { expect(corpus.length).toBeGreaterThanOrEqual(25); expect(corpus.reduce((sum, chunk) => sum + chunk.text.length, 0)).toBeGreaterThanOrEqual(10_000); });
it("constrains searches to a documentation family", () => { expect(searchIndex("authorization", 5, "identity").every((hit) => domainForUrl(hit.url) === "identity")).toBe(true); expect(searchIndex("authorization", 5, "payment").every((hit) => domainForUrl(hit.url) === "payment")).toBe(true); });
