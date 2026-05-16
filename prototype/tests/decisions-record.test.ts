// tests/decisions-record.test.ts
//
// Unit tests for `recordDelegatedDecision` — the Scrooge session-delegation
// convenience wrapper over `recordDecision`.
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice C: `recordCeoDecision` removed;
// tests updated to assert against unified `Decision` events only.
//
// Assertions:
//   1. Emitted event is type "Decision" with actor.id === "marc@tgv.co.za".
//   2. payload.recordedVia defaults to "scrooge:session-delegation".
//   3. Custom recordedVia override is respected.
//   4. actor.id is always marc@tgv.co.za (non-negotiable for session delegation).
//   5. Structural validation: required fields (decisionId, title, outcome) enforced.
//
// Authority: CEO in-session approval = CEO authorization (CLAUDE.md §Session
// delegation); D-DECISIONS-FRAMEWORK-REDESIGN (CEO-approved 2026-05-16).
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { recordDelegatedDecision } from "../runtime/decisions/record";

const AS_OF = "2026-05-12T10:00:00Z";
const BASE_PARAMS = {
  decisionId: "D-TEST-SESSION-DELEGATION",
  title: "Test session delegation",
  outcome: "CEO approved via in-session 'y'.",
  sourceDoc: "Owner Inbox/2026-05-12_test_session-delegation.md",
};

describe("recordDelegatedDecision", () => {
  it("emits Decision with actor.id=marc@tgv.co.za and actor.type=human", () => {
    const before = [...eventStore.replay({ type: "Decision" })].length;
    const result = recordDelegatedDecision(BASE_PARAMS, AS_OF);

    expect(result.event.type).toBe("Decision");
    expect(result.event.actor.id).toBe("marc@tgv.co.za");
    expect(result.event.actor.type).toBe("human");
    expect([...eventStore.replay({ type: "Decision" })].length).toBe(before + 1);
  });

  it("sets recordedVia to scrooge:session-delegation by default", () => {
    const result = recordDelegatedDecision(
      { ...BASE_PARAMS, decisionId: "D-TEST-SESSION-DELEGATION-DEFAULT-VIA" },
      AS_OF,
    );

    expect((result.event.payload as { recordedVia: string }).recordedVia).toBe(
      "scrooge:session-delegation",
    );
  });

  it("respects a custom recordedVia override", () => {
    const result = recordDelegatedDecision(
      {
        ...BASE_PARAMS,
        decisionId: "D-TEST-SESSION-DELEGATION-CUSTOM-VIA",
        recordedVia: "scrooge:session-delegation:cli",
      },
      AS_OF,
    );

    expect((result.event.payload as { recordedVia: string }).recordedVia).toBe(
      "scrooge:session-delegation:cli",
    );
  });

  it("does NOT accept agent: URN as the actor — human actor is non-negotiable", () => {
    const result = recordDelegatedDecision(
      { ...BASE_PARAMS, decisionId: "D-TEST-SESSION-DELEGATION-ACTOR-GUARD" },
      AS_OF,
    );
    // Must always be the CEO email, never an agent URN.
    expect(result.event.actor.id).toBe("marc@tgv.co.za");
    expect(result.event.actor.id).not.toMatch(/^agent:/);
  });

  it("emits Decision with authority='CEO' and phase='approved'", () => {
    const result = recordDelegatedDecision(
      { ...BASE_PARAMS, decisionId: "D-TEST-SESSION-AUTHORITY-CHECK" },
      AS_OF,
    );
    const payload = result.event.payload as { authority: string; phase: string };
    expect(payload.authority).toBe("CEO");
    expect(payload.phase).toBe("approved");
  });

  it("propagates structural validation — empty decisionId throws", () => {
    expect(() => recordDelegatedDecision({ ...BASE_PARAMS, decisionId: "" }, AS_OF)).toThrow();
  });

  it("propagates structural validation — empty title throws", () => {
    expect(() =>
      recordDelegatedDecision(
        { ...BASE_PARAMS, decisionId: "D-TEST-TITLE-GUARD", title: "" },
        AS_OF,
      ),
    ).toThrow();
  });

  it("propagates structural validation — empty outcome throws", () => {
    expect(() =>
      recordDelegatedDecision(
        { ...BASE_PARAMS, decisionId: "D-TEST-OUTCOME-GUARD", outcome: "" },
        AS_OF,
      ),
    ).toThrow();
  });

  it("uses current ISO timestamp when asOf is omitted", () => {
    const before = new Date().toISOString();
    const result = recordDelegatedDecision({
      ...BASE_PARAMS,
      decisionId: "D-TEST-SESSION-DELEGATION-NO-ASOF",
    });
    const after = new Date().toISOString();

    const asOf = result.event.as_of;
    expect(asOf >= before).toBe(true);
    expect(asOf <= after).toBe(true);
  });

  it("permission gate allows human actor (marc@tgv.co.za) through without policy check", () => {
    expect(() =>
      recordDelegatedDecision(
        { ...BASE_PARAMS, decisionId: "D-TEST-SESSION-DELEGATION-GATE" },
        AS_OF,
      ),
    ).not.toThrow();
  });
});
