import corpus from "../knowledge/generated/klarna-docs.json";
const characters = corpus.reduce((sum, chunk) => sum + chunk.text.length, 0);
if (corpus.length < 25 || characters < 10_000) throw new Error(`Klarna corpus is unexpectedly tiny: ${corpus.length} chunks / ${characters} characters.`);
console.log(`Klarna corpus integrity OK: ${corpus.length} chunks / ${characters} characters.`);
