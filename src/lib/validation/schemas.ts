import {z} from "zod";
export const messageSchema=z.object({role:z.enum(["user","assistant"]),content:z.string().min(1).max(30_000)});
export const chatRequestSchema=z.object({messages:z.array(messageSchema).min(1).max(50),summary:z.string().max(12_000).optional().default("")}).refine(v=>JSON.stringify(v).length<250_000,"Conversation is too large");
export const chartSchema=z.object({type:z.enum(["line","bar","area","pie","donut"]),title:z.string().max(120),labels:z.array(z.string().max(80)).min(1).max(40),series:z.array(z.object({name:z.string().max(80),data:z.array(z.number().finite()).max(40)})).min(1).max(6),xAxisLabel:z.string().max(80).optional(),yAxisLabel:z.string().max(80).optional()}).refine(v=>v.series.every(s=>s.data.length===v.labels.length),"Each series must match labels");
export type ChatRequest=z.infer<typeof chatRequestSchema>;
