// runtime/narrative.test.ts
//
// Dispatcher coverage for the config-selectable narrative provider facade.
// No live API call — backends are injected via the `deps` hook and the
// availability checks are driven purely by env vars. CI stays green with no
// ANTHROPIC_API_KEY / GEMINI_API_KEY (the worktree has no .env.local).
//
// Authority: D-NARRATIVE-PROVIDER-CONFIG; D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import type { NarrativeRequest, NarrativeResponse } from "./claude";
import {
  DEFAULT_NARRATIVE_PROVIDER,
  NARRATIVE_PROVIDER_ENV,
  type NarrativeResult,
  UnknownNarrativeProviderError,
  narrativeAvailable,
  narrativeProvider,
  narrativeProviderLabel,
  narrativeSkippedNote,
  tryGenerateNarrative,
} from "./narrative";

const REQ: NarrativeRequest = {
  stableSystem: "You are a narrative agent.",
  userInput: "Summarise the run.",
  maxTokens: 1024,
};

function okResult(text: string): NarrativeResult {
  const result: NarrativeResponse = {
    text,
    usage: {
      inputTokens: 1,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      outputTokens: 1,
    },
    stopReason: "end_turn",
    model: "test-model",
  };
  return { ok: true, result };
}

// Save / restore the three env vars the facade reads so tests don't leak.
let savedProvider: string | undefined;
let savedAnthropicKey: string | undefined;
let savedGeminiKey: string | undefined;

beforeEach(() => {
  savedProvider = process.env[NARRATIVE_PROVIDER_ENV];
  savedAnthropicKey = process.env.ANTHROPIC_API_KEY;
  savedGeminiKey = process.env.GEMINI_API_KEY;
  // Empty string is treated identically to "unset" by the facade
  // (provider → default; availability → false), and avoids `delete`
  // (biome performance/noDelete). Each test sets what it needs.
  process.env[NARRATIVE_PROVIDER_ENV] = "";
  process.env.ANTHROPIC_API_KEY = "";
  process.env.GEMINI_API_KEY = "";
});

afterEach(() => {
  restore(NARRATIVE_PROVIDER_ENV, savedProvider);
  restore("ANTHROPIC_API_KEY", savedAnthropicKey);
  restore("GEMINI_API_KEY", savedGeminiKey);
});

function restore(key: string, value: string | undefined): void {
  process.env[key] = value ?? "";
}

describe("narrativeProvider — config resolution", () => {
  it("defaults to gemini when unset", () => {
    expect(narrativeProvider()).toBe("gemini");
    expect(DEFAULT_NARRATIVE_PROVIDER).toBe("gemini");
  });

  it("defaults to gemini when empty / whitespace", () => {
    process.env[NARRATIVE_PROVIDER_ENV] = "   ";
    expect(narrativeProvider()).toBe("gemini");
  });

  it("resolves gemini (case-insensitive, trimmed)", () => {
    process.env[NARRATIVE_PROVIDER_ENV] = "  GEMINI ";
    expect(narrativeProvider()).toBe("gemini");
  });

  it("resolves anthropic", () => {
    process.env[NARRATIVE_PROVIDER_ENV] = "anthropic";
    expect(narrativeProvider()).toBe("anthropic");
  });

  it("resolves the `claude` alias to anthropic", () => {
    process.env[NARRATIVE_PROVIDER_ENV] = "Claude";
    expect(narrativeProvider()).toBe("anthropic");
  });

  it("fails closed on an unknown value", () => {
    process.env[NARRATIVE_PROVIDER_ENV] = "openai";
    expect(() => narrativeProvider()).toThrow(UnknownNarrativeProviderError);
  });
});

describe("narrativeProviderLabel", () => {
  it("labels gemini by default", () => {
    expect(narrativeProviderLabel()).toBe("Gemini");
  });

  it("labels anthropic when selected", () => {
    process.env[NARRATIVE_PROVIDER_ENV] = "anthropic";
    expect(narrativeProviderLabel()).toBe("Anthropic (Claude)");
  });
});

describe("narrativeAvailable — per-provider availability dispatch", () => {
  it("gemini default: keys off GEMINI_API_KEY", () => {
    expect(narrativeAvailable()).toBe(false);
    process.env.GEMINI_API_KEY = "g-key";
    expect(narrativeAvailable()).toBe(true);
    // An Anthropic key alone does NOT make the gemini path available.
    process.env.GEMINI_API_KEY = "";
    process.env.ANTHROPIC_API_KEY = "a-key";
    expect(narrativeAvailable()).toBe(false);
  });

  it("anthropic: keys off ANTHROPIC_API_KEY", () => {
    process.env[NARRATIVE_PROVIDER_ENV] = "anthropic";
    expect(narrativeAvailable()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "a-key";
    expect(narrativeAvailable()).toBe(true);
    // A Gemini key alone does NOT make the anthropic path available.
    process.env.ANTHROPIC_API_KEY = "";
    process.env.GEMINI_API_KEY = "g-key";
    expect(narrativeAvailable()).toBe(false);
  });
});

describe("tryGenerateNarrative — provider dispatch", () => {
  it("default → gemini backend", async () => {
    let anthropicCalled = false;
    let geminiCalled = false;
    const result = await tryGenerateNarrative(REQ, {
      anthropic: async () => {
        anthropicCalled = true;
        return okResult("anthropic");
      },
      gemini: async () => {
        geminiCalled = true;
        return okResult("gemini");
      },
    });
    expect(geminiCalled).toBe(true);
    expect(anthropicCalled).toBe(false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.result.text).toBe("gemini");
  });

  it("BANK_NARRATIVE_PROVIDER=anthropic → claude backend", async () => {
    process.env[NARRATIVE_PROVIDER_ENV] = "anthropic";
    let anthropicCalled = false;
    let geminiCalled = false;
    const result = await tryGenerateNarrative(REQ, {
      anthropic: async () => {
        anthropicCalled = true;
        return okResult("anthropic");
      },
      gemini: async () => {
        geminiCalled = true;
        return okResult("gemini");
      },
    });
    expect(anthropicCalled).toBe(true);
    expect(geminiCalled).toBe(false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.result.text).toBe("anthropic");
  });

  it("the `claude` alias routes to the anthropic backend", async () => {
    process.env[NARRATIVE_PROVIDER_ENV] = "claude";
    let anthropicCalled = false;
    await tryGenerateNarrative(REQ, {
      anthropic: async () => {
        anthropicCalled = true;
        return okResult("anthropic");
      },
      gemini: async () => okResult("gemini"),
    });
    expect(anthropicCalled).toBe(true);
  });

  it("propagates the backend's failure envelope unchanged (graceful degradation)", async () => {
    const failure: NarrativeResult = { ok: false, error: "boom", retryable: true };
    const result = await tryGenerateNarrative(REQ, {
      gemini: async () => failure,
    });
    expect(result).toEqual(failure);
  });

  it("propagates an anthropic-backend failure when anthropic is selected", async () => {
    process.env[NARRATIVE_PROVIDER_ENV] = "anthropic";
    const failure: NarrativeResult = { ok: false, error: "auth failed", retryable: false };
    const result = await tryGenerateNarrative(REQ, {
      anthropic: async () => failure,
    });
    expect(result).toEqual(failure);
  });

  it("an unknown provider fails closed before dispatching to any backend", async () => {
    process.env[NARRATIVE_PROVIDER_ENV] = "mistral";
    let touched = false;
    await expect(
      tryGenerateNarrative(REQ, {
        anthropic: async () => {
          touched = true;
          return okResult("a");
        },
        gemini: async () => {
          touched = true;
          return okResult("g");
        },
      }),
    ).rejects.toBeInstanceOf(UnknownNarrativeProviderError);
    expect(touched).toBe(false);
  });
});

describe("narrativeSkippedNote — provider-generic skip message", () => {
  it("names GEMINI_API_KEY under the default provider", () => {
    const note = narrativeSkippedNote("Inventory above stands on its own.");
    expect(note).toContain("GEMINI_API_KEY");
    expect(note).toContain("Gemini");
    expect(note).toContain("Inventory above stands on its own.");
    expect(note).not.toContain("ANTHROPIC_API_KEY");
  });

  it("names ANTHROPIC_API_KEY under the anthropic provider", () => {
    process.env[NARRATIVE_PROVIDER_ENV] = "anthropic";
    const note = narrativeSkippedNote("Snapshot above stands on its own.");
    expect(note).toContain("ANTHROPIC_API_KEY");
    expect(note).toContain("Anthropic (Claude)");
    expect(note).not.toContain("GEMINI_API_KEY");
  });
});
