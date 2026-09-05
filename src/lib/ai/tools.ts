import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { chartSchema } from "@/lib/validation/schemas";
import { searchKlarnaDocs, klarnaDocDomains } from "@/lib/tools/klarna-docs";
import { searchWeb } from "@/lib/tools/perplexity";
import { generateImage } from "@/lib/tools/openai-image";

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "search_klarna_network_docs",
    description: "Search and live-verify official Klarna Network documentation. Use before making concrete KN technical claims; retry with a focused query when evidence is insufficient.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A short, targeted documentation query." },
        domain: { type: "string", enum: [...klarnaDocDomains], description: "Optional documentation family filter. Omit when a plain search is sufficient." },
      },
      required: ["query"],
    },
  },
  {
    name: "search_web",
    description: "Research current information outside the authoritative KN corpus. Use for wider industry research, external companies, comparisons, or explicit web requests.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "A focused web research query." } }, required: ["query"] },
  },
  {
    name: "generate_image",
    description: "Generate an image when the user explicitly asks to create, draw, generate, or visualise one.",
    input_schema: { type: "object", properties: { prompt: { type: "string" }, sizeIntent: { type: "string", enum: ["square", "portrait", "landscape"] }, context: { type: "string" } }, required: ["prompt"] },
  },
  {
    name: "create_chart",
    description: "Render quantitative data as an inline chart when requested or clearly more readable than prose.",
    input_schema: { type: "object", properties: { type: { type: "string", enum: ["line", "bar", "area", "pie", "donut"] }, title: { type: "string" }, labels: { type: "array", items: { type: "string" } }, series: { type: "array", items: { type: "object", properties: { name: { type: "string" }, data: { type: "array", items: { type: "number" } } }, required: ["name", "data"] } }, xAxisLabel: { type: "string" }, yAxisLabel: { type: "string" } }, required: ["type", "title", "labels", "series"] },
  },
];

const docsQuery = z.object({ query: z.string().min(2).max(1000), domain: z.enum(klarnaDocDomains).optional() });
const query = z.object({ query: z.string().min(2).max(1000) });
const image = z.object({ prompt: z.string().min(3).max(4000), sizeIntent: z.enum(["square", "portrait", "landscape"]).optional(), context: z.string().max(1000).optional() });

export async function executeTool(name: string, input: unknown) {
  if (name === "search_klarna_network_docs") {
    const value = docsQuery.parse(input);
    return searchKlarnaDocs(value.query, value.domain);
  }
  if (name === "search_web") return searchWeb(query.parse(input).query);
  if (name === "generate_image") {
    const value = image.parse(input);
    return generateImage(`${value.prompt}${value.context ? `\nContext: ${value.context}` : ""}`, value.sizeIntent);
  }
  if (name === "create_chart") return { chart: chartSchema.parse(input) };
  throw new Error("Unknown tool");
}
