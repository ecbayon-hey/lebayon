const providers = [
  ["Chat", ["ANTHROPIC_API_KEY"], ["ANTHROPIC_MODEL"]],
  ["Web research", ["PERPLEXITY_API_KEY"], []],
  ["Image generation", ["OPENAI_API_KEY"], ["OPENAI_IMAGE_MODEL"]],
  ["Voice transcription", ["MISTRAL_API_KEY"], []],
];

const invalid = (value) => !value?.trim() || ["changeme", "replace-me", "your-api-key", "your_api_key"].includes(value.trim().toLowerCase());
let missingRequired = false;
for (const [feature, required, optional] of providers) {
  const missing = required.filter((name) => invalid(process.env[name]));
  missingRequired ||= feature === "Chat" && missing.length > 0;
  const overrides = optional.filter((name) => !invalid(process.env[name]));
  console.log(`${missing.length ? "○" : "●"} ${feature}: ${missing.length ? `missing ${missing.join(", ")}` : "configured"}${overrides.length ? ` (${overrides.join(", ")} overridden)` : ""}`);
}
console.log("\nOnly Chat is mandatory; the other providers power optional tools.");
if (missingRequired) process.exitCode = 1;
