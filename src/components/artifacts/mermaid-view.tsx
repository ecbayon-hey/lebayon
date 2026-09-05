"use client";

import { useEffect, useId, useRef, useState } from "react";

const RENDER_DELAY_MS = 120;

export function MermaidView({ code }: { code: string }) {
  const componentId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const renderNumber = useRef(0);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const currentRender = ++renderNumber.current;

    // Markdown arrives token by token. Waiting briefly prevents Mermaid from
    // trying to parse every incomplete intermediate version of a diagram.
    const timer = window.setTimeout(async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            primaryColor: "#faf7ef",
            primaryTextColor: "#142a3a",
            lineColor: "#5e9273",
            fontFamily: "system-ui",
          },
        });

        // Mermaid temporarily adds an element with this id to the document.
        // A unique id per attempt prevents Strict Mode and rapid stream updates
        // from making concurrent render attempts collide.
        const result = await mermaid.render(
          `mermaid-${componentId}-${currentRender}`,
          code.trim(),
        );

        if (active && currentRender === renderNumber.current) {
          setSvg(result.svg);
          setError("");
        }
      } catch (renderError) {
        if (active && currentRender === renderNumber.current) {
          console.warn("Unable to render Mermaid diagram", renderError);
          setSvg("");
          setError("This diagram couldn't be rendered.");
        }
      }
    }, RENDER_DELAY_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [code, componentId]);

  if (error) return <div className="diagram error">{error}</div>;
  if (!svg) return <div className="diagram diagram-loading" role="status">Rendering diagram…</div>;

  return (
    <div
      className="diagram"
      role="img"
      aria-label="Diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
