"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink } from "lucide-react";
import { MermaidView } from "@/components/artifacts/mermaid-view";
import { ChartView } from "@/components/artifacts/chart-view";
import type { ChartArtifact, Source } from "@/lib/stream/events";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; sources: Source[]; charts: ChartArtifact[]; images: { url: string; alt: string }[]; streaming?: boolean };

function isMermaidCode(className?: string) {
  return className?.split(" ").includes("language-mermaid") ?? false;
}

function Code({ className, children }: { className?: string; children?: ReactNode }) {
  const text = String(children).replace(/\n$/, "");
  if (isMermaidCode(className)) return <MermaidView code={text} />;
  return <code className={className}>{children}</code>;
}

function Pre({ children }: { children?: ReactNode }) {
  // A Mermaid component is a block-level visual and must not be nested in the
  // markdown renderer's <pre>. Apart from invalid HTML, that wrapper also gives
  // diagrams code-block sizing and colours.
  if (children && typeof children === "object" && "props" in children) {
    const props = children.props as { className?: string; children?: ReactNode };
    if (isMermaidCode(props.className)) {
      return <MermaidView code={String(props.children).replace(/\n$/, "")} />;
    }
  }
  return <pre>{children}</pre>;
}

export function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") return <div className="message user">{message.content}</div>;

  return (
    <article className="message">
      <div className="assistant-head"><span className="assistant-dot">LB</span>LeBayon</div>
      <div className="prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: Code, pre: Pre, a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>
          {message.content}
        </ReactMarkdown>
        {message.streaming && <span className="cursor" />}
      </div>
      {message.charts.map((chart, index) => <ChartView chart={chart} key={index} />)}
      {message.images.map((image, index) => <figure className="image-card" key={index}><img src={image.url} alt={image.alt} /></figure>)}
      {message.sources.length > 0 && <div className="sources" aria-label="Sources">{message.sources.map((source, index) => <a className={`source ${source.type}`} href={source.url} target="_blank" rel="noopener noreferrer" key={index}><span>{source.type === "klarna" ? "Klarna docs" : source.type === "eddy" ? "Eddy note" : "Web"} • {source.title}{source.heading ? ` › ${source.heading}` : ""}</span><ExternalLink size={11} /></a>)}</div>}
    </article>
  );
}
