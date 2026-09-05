import { afterEach, describe, expect, it } from "vitest";
import { optionalSecret, optionalValue, requiredSecret } from "./env";

describe("server environment configuration", () => {
  afterEach(() => delete process.env.TEST_PROVIDER_KEY);

  it("trims configured values", () => {
    process.env.TEST_PROVIDER_KEY = "  secret  ";
    expect(optionalSecret("TEST_PROVIDER_KEY")).toBe("secret");
    expect(optionalValue("TEST_PROVIDER_KEY", "fallback")).toBe("secret");
  });

  it.each(["", "   ", "changeme", "replace-me", "your-api-key"])(
    "rejects an empty or placeholder secret: %j",
    (value) => {
      process.env.TEST_PROVIDER_KEY = value;
      expect(optionalSecret("TEST_PROVIDER_KEY")).toBeUndefined();
      expect(() => requiredSecret("TEST_PROVIDER_KEY")).toThrow("TEST_PROVIDER_KEY is not configured");
    },
  );
});
