import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Message, type ChatMessage } from "./message";

function assistant(content: string): ChatMessage {
  return { id: "message", role: "assistant", content, sources: [], charts: [], images: [] };
}

describe("Message visualizations", () => {
  it("renders Mermaid fences as a visual without a code-block wrapper", () => {
    const html = renderToStaticMarkup(<Message message={assistant("```mermaid\nflowchart LR\nA --> B\n```")} />);

    expect(html).toContain("Rendering diagram…");
    expect(html).not.toContain("<pre>");
    expect(html).not.toContain("language-mermaid");
  });

  it("keeps ordinary fenced code in a preformatted block", () => {
    const html = renderToStaticMarkup(<Message message={assistant("```ts\nconst answer = 42;\n```")} />);

    expect(html).toContain("<pre>");
    expect(html).toContain("language-ts");
  });
});
