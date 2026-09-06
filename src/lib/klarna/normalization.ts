export const klarnaAreas = ["integration", "management", "payment", "network_session", "notifications", "identity", "web_sdk"] as const;
export type KlarnaArea = (typeof klarnaAreas)[number];

const STOPWORDS = new Set(["the", "a", "an", "i", "me", "my", "to", "of", "in", "on", "for", "just", "cant", "can't", "remember"]);

/** Canonical KN text used by both request routing and live-document retrieval. */
export function normalizeKnText(value: string) {
  return value.normalize("NFKC")
    // This must happen before lower-casing or the camel-case boundary is lost.
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\bweb[\s-]*sdk\b/g, "web sdk")
    .replace(/\bauthorize[\s-]*payment\b/g, "authorize payment")
    .replace(/\bon[\s-]*widget[\s-]*(cancel|complete|error)\b/g, "on widget $1")
    .replace(/\bm[\s-]*tls\b/g, "mtls")
    .replace(/[^a-z0-9']+/g, " ")
    .split(/\s+/)
    .filter((term) => term && !STOPWORDS.has(term))
    .join(" ");
}

export function classifyKlarnaArea(value: string): KlarnaArea {
  const text = normalizeKnText(value);
  if (/\b(web sdk|on widget (?:cancel|complete|error)|klarna sdk)\b/.test(text)) return "web_sdk";
  if (/\b(authorize payment|payment authorization|payment api)\b/.test(text)) return "payment";
  if (/\b(network session|knst)\b/.test(text)) return "network_session";
  if (/\b(notification|notifications)\b/.test(text)) return "notifications";
  if (/\b(identity|siwk|sign with klarna)\b/.test(text)) return "identity";
  if (/\b(management|partner account)\b/.test(text)) return "management";
  return "integration";
}

export function focusedKlarnaQuery(value: string, area = classifyKlarnaArea(value)) {
  const text = normalizeKnText(value);
  if (area === "web_sdk") {
    if (/on widget cancel/.test(text)) return "onWidgetCancel onAbort Web SDK callbacks";
    return "Web SDK launch initialize initialization load setup script KlarnaSDK client";
  }
  if (area === "payment") return "authorizePayment authorize payment Payment Authorization return response";
  if (area === "network_session") return "Network Session create API KNST";
  if (area === "identity") return "Identity API SIWK Sign in with Klarna";
  if (area === "notifications") return "Notifications API webhook event";
  if (area === "management") return "Management API Partner Account";
  if (/\bmtls\b/.test(text)) return "mTLS mutual TLS requirement";
  return text;
}

export function knTokens(value: string) {
  const words = normalizeKnText(value).split(" ").filter((word) => word.length > 1);
  const phrases = words.slice(0, -1).map((word, index) => `${word} ${words[index + 1]}`);
  // Joined variants make URL slugs and APIs equivalent to their spoken forms.
  const joined = phrases.map((phrase) => phrase.replace(" ", ""));
  return [...new Set([...words, ...phrases, ...joined])];
}
