import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { chartSchema } from "@/lib/validation/schemas";
import { generateImage } from "@/lib/tools/openai-image";
import { readKlarnaDocs } from "@/lib/tools/klarna-docs";
import { searchWeb } from "@/lib/tools/perplexity";

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "read_klarna_docs",
    description: "Read one live page from the authoritative Klarna Network documentation. Choose a documentation root from the system prompt, then follow relevant links returned by this tool when needed. Only official Klarna Network documentation URLs are accepted.",
    input_schema: { type: "object", properties: { url: { type: "string", description: "Exact official Klarna Network documentation URL to read." }, search: { type: "string", description: "Optional subject used to prioritize relevant headings and sections." } }, required: ["url"] },
  },
  {
    name: "search_web",
    description: "Search the current public web for general or non-Klarna research. Do not use this as the primary source for Klarna Network documentation.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
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

const image = z.object({ prompt: z.string().min(3).max(4000), sizeIntent: z.enum(["square", "portrait", "landscape"]).optional(), context: z.string().max(1000).optional() });
const docs = z.object({ url: z.string().url(), search: z.string().max(500).optional() });
const web = z.object({ query: z.string().min(2).max(1000) });

export async function executeTool(name: string, input: unknown) {
  if (name === "read_klarna_docs") return readKlarnaDocs(docs.parse(input));
  if (name === "search_web") return searchWeb(web.parse(input).query);
  if (name === "generate_image") {
    const value = image.parse(input);
    return generateImage(`${value.prompt}${value.context ? `\nContext: ${value.context}` : ""}`, value.sizeIntent);
  }
  if (name === "create_chart") return { chart: chartSchema.parse(input) };
  throw new Error("Unknown tool");
}
