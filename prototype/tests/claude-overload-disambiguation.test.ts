// tests/claude-overload-disambiguation.test.ts
//
// Unit tests for the credit-exhausted-vs-overload disambiguation logic
// in `runtime/claude.ts` (GAP-OVERLOADED-VS-CREDIT-EXHAUSTED, Mira's
// Phase 1 outcome card 2026-05-22). Haiku surfaces credit-exhausted as
// `overloaded_error` indistinguishable from a genuine capacity overload;
// after N consecutive overloads the runtime probes a cheap call against
// a different model to disambiguate.
//
// The tests target the pure-ish `_handleClaudeError` helper with stub
// probe callables, sidestepping the streaming SDK surface.

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import Anthropic from "@anthropic-ai/sdk";

import {
  ClaudeCreditExhaustedError,
  _getOverloadCounterForTests,
  _handleClaudeError,
  _resetOverloadCounterForTests,
} from "../runtime/claude";

function makeApiError(status: number, type: string, message: string) {
  return new Anthropic.APIError(
    status as unknown as undefined,
    { error: { type, message } } as unknown as undefined,
    message,
    undefined as unknown as undefined,
    type as unknown as null,
  );
}

function makeOverloadError() {
  return makeApiError(529, "overloaded_error", "Overloaded");
}

function makeCreditError() {
  return makeApiError(400, "billing_error", "Your credit balance is too low to access the API");
}

describe("_handleClaudeError — disambiguation behaviour", () => {
  beforeEach(() => {
    _resetOverloadCounterForTests();
  });

  afterEach(() => {
    _resetOverloadCounterForTests();
  });

  it("rethrows non-overload, non-credit errors untouched", async () => {
    const e = makeApiError(401, "authentication_error", "bad key");
    await expect(_handleClaudeError(e, { probe: async () => undefined })).rejects.toBe(e);
    expect(_getOverloadCounterForTests()).toBe(0);
  });

  it("re-raises overload below threshold without probing", async () => {
    let probeCalled = false;
    const e = makeOverloadError();
    await expect(
      _handleClaudeError(e, {
        probe: async () => {
          probeCalled = true;
        },
        threshold: 3,
      }),
    ).rejects.toBe(e);
    expect(_getOverloadCounterForTests()).toBe(1);
    expect(probeCalled).toBe(false);
  });

  it("probes once threshold reached; on probe success re-raises original overload and resets counter", async () => {
    let probeCalls = 0;
    const deps = {
      probe: async () => {
        probeCalls += 1;
      },
      threshold: 3,
    };
    // First two: no probe.
    await expect(_handleClaudeError(makeOverloadError(), deps)).rejects.toBeInstanceOf(
      Anthropic.APIError,
    );
    await expect(_handleClaudeError(makeOverloadError(), deps)).rejects.toBeInstanceOf(
      Anthropic.APIError,
    );
    expect(probeCalls).toBe(0);
    // Third: probes, succeeds, re-raises overload (NOT credit-exhausted).
    const third = makeOverloadError();
    await expect(_handleClaudeError(third, deps)).rejects.toBe(third);
    expect(probeCalls).toBe(1);
    // Counter resets — next failure starts the count again.
    expect(_getOverloadCounterForTests()).toBe(0);
  });

  it("raises ClaudeCreditExhaustedError when probe fails with billing_error", async () => {
    const deps = {
      probe: async () => {
        throw makeCreditError();
      },
      threshold: 3,
    };
    await expect(_handleClaudeError(makeOverloadError(), deps)).rejects.toBeInstanceOf(
      Anthropic.APIError,
    );
    await expect(_handleClaudeError(makeOverloadError(), deps)).rejects.toBeInstanceOf(
      Anthropic.APIError,
    );
    let caught: unknown = null;
    try {
      await _handleClaudeError(makeOverloadError(), deps);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ClaudeCreditExhaustedError);
    expect((caught as ClaudeCreditExhaustedError).message).toMatch(
      /credit balance exhausted.*probe/i,
    );
    expect((caught as ClaudeCreditExhaustedError).originalError).toBeInstanceOf(Anthropic.APIError);
    expect(_getOverloadCounterForTests()).toBe(0);
  });

  it("detects credit_too_low via message body when type is not billing_error", async () => {
    const probeErr = makeApiError(
      400,
      "invalid_request_error",
      "Your credit balance is too low to access the API. Please go to Plans & Billing to upgrade.",
    );
    const deps = {
      probe: async () => {
        throw probeErr;
      },
      threshold: 2,
    };
    await expect(_handleClaudeError(makeOverloadError(), deps)).rejects.toBeInstanceOf(
      Anthropic.APIError,
    );
    await expect(_handleClaudeError(makeOverloadError(), deps)).rejects.toBeInstanceOf(
      ClaudeCreditExhaustedError,
    );
  });

  it("surfaces original overload when probe fails for an unrelated reason", async () => {
    const deps = {
      probe: async () => {
        throw makeApiError(500, "api_error", "internal server error");
      },
      threshold: 2,
    };
    await expect(_handleClaudeError(makeOverloadError(), deps)).rejects.toBeInstanceOf(
      Anthropic.APIError,
    );
    const third = makeOverloadError();
    await expect(_handleClaudeError(third, deps)).rejects.toBe(third);
  });

  it("raises ClaudeCreditExhaustedError directly when primary call returns billing_error", async () => {
    const direct = makeCreditError();
    let probeCalled = false;
    let caught: unknown = null;
    try {
      await _handleClaudeError(direct, {
        probe: async () => {
          probeCalled = true;
        },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ClaudeCreditExhaustedError);
    expect(probeCalled).toBe(false);
    expect((caught as ClaudeCreditExhaustedError).originalError).toBe(direct);
    expect(_getOverloadCounterForTests()).toBe(0);
  });

  it("respects disambiguateEnabled=false (feature-flag opt-out)", async () => {
    let probeCalled = false;
    const deps = {
      probe: async () => {
        probeCalled = true;
      },
      threshold: 2,
      disambiguateEnabled: false,
    };
    await expect(_handleClaudeError(makeOverloadError(), deps)).rejects.toBeInstanceOf(
      Anthropic.APIError,
    );
    await expect(_handleClaudeError(makeOverloadError(), deps)).rejects.toBeInstanceOf(
      Anthropic.APIError,
    );
    await expect(_handleClaudeError(makeOverloadError(), deps)).rejects.toBeInstanceOf(
      Anthropic.APIError,
    );
    expect(probeCalled).toBe(false);
  });

  it("BANK_CLAUDE_DISAMBIGUATE_OVERLOAD=false disables disambiguation by default", async () => {
    const prior = process.env.BANK_CLAUDE_DISAMBIGUATE_OVERLOAD;
    process.env.BANK_CLAUDE_DISAMBIGUATE_OVERLOAD = "false";
    try {
      let probeCalled = false;
      const deps = {
        probe: async () => {
          probeCalled = true;
        },
        threshold: 2,
      };
      await expect(_handleClaudeError(makeOverloadError(), deps)).rejects.toBeInstanceOf(
        Anthropic.APIError,
      );
      await expect(_handleClaudeError(makeOverloadError(), deps)).rejects.toBeInstanceOf(
        Anthropic.APIError,
      );
      await expect(_handleClaudeError(makeOverloadError(), deps)).rejects.toBeInstanceOf(
        Anthropic.APIError,
      );
      expect(probeCalled).toBe(false);
    } finally {
      if (prior === undefined) {
        (process.env as Record<string, string | undefined>).BANK_CLAUDE_DISAMBIGUATE_OVERLOAD =
          undefined;
      } else {
        process.env.BANK_CLAUDE_DISAMBIGUATE_OVERLOAD = prior;
      }
    }
  });
});
