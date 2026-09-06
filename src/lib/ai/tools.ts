import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { chartSchema } from "@/lib/validation/schemas";
import { generateImage } from "@/lib/tools/openai-image";

export const toolDefinitions: Anthropic.Tool[] = [
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

export async function executeTool(name: string, input: unknown) {
  if (name === "generate_image") {
    const value = image.parse(input);
    return generateImage(`${value.prompt}${value.context ? `\nContext: ${value.context}` : ""}`, value.sizeIntent);
  }
  if (name === "create_chart") return { chart: chartSchema.parse(input) };
  throw new Error("Unknown tool");
}
