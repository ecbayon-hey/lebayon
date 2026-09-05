import corpus from "../knowledge/generated/klarna-docs.json";
import { corpusStats, validateCorpus, type DocChunk } from "./sync-klarna-docs";

const stats = validateCorpus(corpus as DocChunk[]);
console.log(`Klarna corpus integrity OK: ${stats.pages} pages / ${stats.chunks} chunks / ${stats.characters} characters.`);
console.log("Pages by documentation family:", corpusStats(corpus as DocChunk[]).families);
