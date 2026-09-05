import { readFile } from "node:fs/promises";
import { corpusStats, type DocChunk, validateCorpus } from "./sync-klarna-docs";

const input = new URL("../knowledge/generated/klarna-docs.json", import.meta.url);
const chunks = JSON.parse(await readFile(input, "utf8")) as DocChunk[];
const stats = corpusStats(chunks);
console.log(`Corpus: ${stats.pages} pages, ${stats.chunks} chunks, ${stats.characters} characters`);
console.log("Pages by documentation family:", stats.families);
validateCorpus(chunks);
