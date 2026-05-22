// runtime/claude.test.ts
//
// Unit tests for the Claude model capability matrix in `runtime/claude.ts`.
//
// Coverage:
//   - MODEL_CAPABILITIES_CUTOFF is set to the date the matrix was last
//     reconciled against Anthropic's `models/overview` docs.
//   - Every target model (the five listed in the brief) has a row.
//   - Capability cells match the docs at the cutoff date.
//   - getModelCapabilities() returns the matrix row for known models, and a
//     conservative fallback (no thinking, no effort) for unknown models.
//
// Source of truth: https://docs.anthropic.com/en/docs/about-claude/models/overview
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { MODEL_CAPABILITIES, MODEL_CAPABILITIES_CUTOFF, getModelCapabilities } from "./claude";

describe("MODEL_CAPABILITIES_CUTOFF", () => {
  it("is pinned to the last reconciliation date", () => {
    // When you refresh the matrix, bump this date.
    expect(MODEL_CAPABILITIES_CUTOFF).toBe("2026-05-22");
  });
});

describe("MODEL_CAPABILITIES matrix shape", () => {
  it("covers the five target models from the brief", () => {
    const ids = Object.keys(MODEL_CAPABILITIES).sort();
    expect(ids).toEqual(
      [
        "claude-haiku-4-5",
        "claude-haiku-4-6",
        "claude-opus-4-7",
        "claude-sonnet-4-5",
        "claude-sonnet-4-6",
      ].sort(),
    );
  });

  it("populates every capability cell on every row", () => {
    for (const [model, cap] of Object.entries(MODEL_CAPABILITIES)) {
      expect(typeof cap.supportsThinking, `${model}.supportsThinking`).toBe("boolean");
      expect(typeof cap.supportsEffort, `${model}.supportsEffort`).toBe("boolean");
      expect(typeof cap.supportsToolUse, `${model}.supportsToolUse`).toBe("boolean");
      expect(typeof cap.supportsVision, `${model}.supportsVision`).toBe("boolean");
      expect(cap.maxOutputTokens, `${model}.maxOutputTokens`).toBeGreaterThan(0);
      expect(cap.inputPer1M, `${model}.inputPer1M`).toBeGreaterThan(0);
      expect(cap.outputPer1M, `${model}.outputPer1M`).toBeGreaterThan(0);
    }
  });
});

describe("MODEL_CAPABILITIES values against Anthropic docs (2026-05-22)", () => {
  it("opus-4-7: adaptive thinking yes, effort yes, 128k output, $5/$25", () => {
    expect(MODEL_CAPABILITIES["claude-opus-4-7"]).toEqual({
      supportsThinking: true,
      supportsEffort: true,
      maxOutputTokens: 128_000,
      supportsToolUse: true,
      supportsVision: true,
      inputPer1M: 5.0,
      outputPer1M: 25.0,
    });
  });

  it("sonnet-4-6: adaptive thinking yes, effort yes, 64k output, $3/$15", () => {
    expect(MODEL_CAPABILITIES["claude-sonnet-4-6"]).toEqual({
      supportsThinking: true,
      supportsEffort: true,
      maxOutputTokens: 64_000,
      supportsToolUse: true,
      supportsVision: true,
      inputPer1M: 3.0,
      outputPer1M: 15.0,
    });
  });

  it("sonnet-4-5 (legacy): no adaptive thinking, no effort, 64k output", () => {
    // Adaptive thinking + output_config.effort are 4.6+ features per the
    // docs `Latest models comparison` table; the legacy Sonnet 4.5 row
    // sits below that table and is conservatively flagged as not
    // supporting either param.
    const cap = MODEL_CAPABILITIES["claude-sonnet-4-5"];
    expect(cap.supportsThinking).toBe(false);
    expect(cap.supportsEffort).toBe(false);
    expect(cap.maxOutputTokens).toBe(64_000);
    expect(cap.supportsToolUse).toBe(true);
    expect(cap.supportsVision).toBe(true);
  });

  it("haiku-4-5: no adaptive thinking, no effort (both 400 on the wire)", () => {
    // Per the docs, Haiku 4.5 supports Extended thinking but not Adaptive
    // thinking; `output_config.effort` is rejected with HTTP 400 (observed
    // 2026-05-22 during Mira's WS-ONTOLOGY-REG-EXTRACTION run, PR #733).
    expect(MODEL_CAPABILITIES["claude-haiku-4-5"]).toEqual({
      supportsThinking: false,
      supportsEffort: false,
      maxOutputTokens: 64_000,
      supportsToolUse: true,
      supportsVision: true,
      inputPer1M: 1.0,
      outputPer1M: 5.0,
    });
  });

  it("haiku-4-6: anticipated; seeded with the haiku-4-5 shape", () => {
    // Haiku 4.6 was not yet listed in the docs `Latest models comparison`
    // table at the 2026-05-22 cutoff. The row is pre-seeded with the
    // Haiku 4.5 capability shape so callers that opt in via
    // BANK_CLAUDE_MODEL don't 400 silently. Refresh this row + the cutoff
    // date once the model appears.
    const cap = MODEL_CAPABILITIES["claude-haiku-4-6"];
    expect(cap.supportsThinking).toBe(false);
    expect(cap.supportsEffort).toBe(false);
    expect(cap.maxOutputTokens).toBe(64_000);
  });
});

describe("getModelCapabilities", () => {
  it("returns the matrix row for a known model", () => {
    const cap = getModelCapabilities("claude-opus-4-7");
    expect(cap).toBe(MODEL_CAPABILITIES["claude-opus-4-7"]);
  });

  it("returns a conservative fallback for an unknown model", () => {
    const cap = getModelCapabilities("claude-someday-99");
    expect(cap.supportsThinking).toBe(false);
    expect(cap.supportsEffort).toBe(false);
    expect(cap.maxOutputTokens).toBeGreaterThan(0);
  });

  it("returns a conservative fallback for a dated alias not in the matrix", () => {
    // The matrix uses dateless API aliases. The dated snapshot id resolves
    // to the same model on the API but is not a key in MODEL_CAPABILITIES;
    // the fallback must keep the runtime safe rather than 400 on push.
    const cap = getModelCapabilities("claude-haiku-4-5-20251001");
    expect(cap.supportsThinking).toBe(false);
    expect(cap.supportsEffort).toBe(false);
  });
});
