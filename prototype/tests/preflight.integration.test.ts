// tests/preflight.integration.test.ts
//
// Integration test for `preflightForWorkload` — sends a real probe to
// the Anthropic API. Gated on `ANTHROPIC_API_KEY` being set; cleanly
// skipped otherwise so CI without the secret stays green.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { preflightForWorkload } from "../runtime/preflight";

const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY);

// Use Bun's describe.skipIf — when the key is absent, the entire block
// is skipped and the suite reports cleanly without failing CI.
describe.skipIf(!HAS_KEY)("preflightForWorkload — live API (integration)", () => {
  it("returns ok:true against claude-haiku-4-5 with workload-shape input", async () => {
    const result = await preflightForWorkload({
      model: "claude-haiku-4-5",
      estimatedInputTokens: 5_000,
      estimatedOutputTokens: 500,
      expectedCallCount: 60,
    });

    if (!result.ok) {
      // Surface the failure reason verbatim — if a CI runner has a
      // key but the account credit is exhausted or auth changes, the
      // test should fail loudly with the exact reason rather than
      // silently green.
      throw new Error(`Preflight failed: reason=${result.reason} detail=${result.detail}`);
    }

    expect(result.usage.inputTokens).toBeGreaterThan(1_000);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    expect(result.model).toContain("haiku");
    // 30s timeout: the probe is a real API call; give it generous
    // headroom for network + cold-start latency.
  }, 30_000);
});

describe("preflightForWorkload — key missing", () => {
  it.skipIf(HAS_KEY)("returns key_missing when ANTHROPIC_API_KEY is unset", async () => {
    const result = await preflightForWorkload({
      model: "claude-haiku-4-5",
      estimatedInputTokens: 5_000,
      estimatedOutputTokens: 500,
      expectedCallCount: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("key_missing");
    }
  });
});
