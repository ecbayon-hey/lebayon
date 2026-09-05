import "server-only";

const PLACEHOLDERS = new Set(["changeme", "replace-me", "your-api-key", "your_api_key"]);

export function optionalSecret(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || PLACEHOLDERS.has(value.toLowerCase())) return undefined;
  return value;
}

export function requiredSecret(name: string): string {
  const value = optionalSecret(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function optionalValue(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}
