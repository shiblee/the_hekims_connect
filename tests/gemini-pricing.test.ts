// Gemini usage cost: tokens from Google's usageMetadata × the price in force that day.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PRICING, costUsd, priceAt, pricingError, tokensFromUsage, GEMINI_FEATURES } from "@/lib/gemini-pricing";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

describe("tokensFromUsage", () => {
  it("splits cached input out and counts search-tool input as input", () => {
    const t = tokensFromUsage({ promptTokenCount: 1000, toolUsePromptTokenCount: 200, cachedContentTokenCount: 300, candidatesTokenCount: 500, thoughtsTokenCount: 150, totalTokenCount: 1850 });
    assert.deepEqual(t, { inputTokens: 900, cachedTokens: 300, outputTokens: 500, thinkingTokens: 150, totalTokens: 1850 });
  });
  it("missing metadata is zero, never NaN", () => {
    assert.deepEqual(tokensFromUsage(undefined), { inputTokens: 0, cachedTokens: 0, outputTokens: 0, thinkingTokens: 0, totalTokens: 0 });
  });
});

describe("prices", () => {
  it("uses the 2026 price before 1 Jan 2027 and the new price from that day", () => {
    assert.equal(priceAt(DEFAULT_PRICING, new Date("2026-12-31T23:59:00Z")).input, 0.75);
    assert.equal(priceAt(DEFAULT_PRICING, new Date("2027-01-01T00:00:00Z")).input, 1.5);
  });
  it("1M input + 1M output (half thinking) at 2026 prices = $4.50", () => {
    const t = { inputTokens: 1_000_000, cachedTokens: 0, outputTokens: 500_000, thinkingTokens: 500_000, totalTokens: 2_000_000 };
    close(costUsd(DEFAULT_PRICING, new Date("2026-10-25"), t), 4.5);
  });
  it("cached input is billed at the cached price", () => {
    const t = { inputTokens: 0, cachedTokens: 1_000_000, outputTokens: 0, thinkingTokens: 0, totalTokens: 1_000_000 };
    close(costUsd(DEFAULT_PRICING, new Date("2026-10-25"), t), 0.075);
  });
  it("billed Google searches add $14 per 1,000", () => {
    const zero = { inputTokens: 0, cachedTokens: 0, outputTokens: 0, thinkingTokens: 0, totalTokens: 0 };
    close(costUsd(DEFAULT_PRICING, new Date("2026-10-25"), zero, 1), 0.014);
  });
  it("a free-tier key costs nothing", () => {
    const t = { inputTokens: 5000, cachedTokens: 0, outputTokens: 5000, thinkingTokens: 0, totalTokens: 10000 };
    assert.equal(costUsd({ ...DEFAULT_PRICING, freeTier: true }, new Date(), t, 3), 0);
  });
});

describe("pricingError", () => {
  it("defaults are valid", () => assert.equal(pricingError(DEFAULT_PRICING), null));
  it("needs an open-ended first period", () => assert.ok(pricingError({ ...DEFAULT_PRICING, periods: [{ from: "2026-01-01", input: 1, cachedInput: 0.1, output: 2 }] })));
  it("rejects negative or missing prices", () => assert.ok(pricingError({ ...DEFAULT_PRICING, periods: [{ from: null, input: -1, cachedInput: 0, output: NaN }] })));
  it("rejects two periods starting the same day", () => assert.ok(pricingError({ ...DEFAULT_PRICING, periods: [...DEFAULT_PRICING.periods, { from: "2027-01-01", input: 1, cachedInput: 1, output: 1 }] })));
});

it("every feature has a label and an area", () => {
  for (const [k, f] of Object.entries(GEMINI_FEATURES)) assert.ok(f.label && f.area, k);
});
