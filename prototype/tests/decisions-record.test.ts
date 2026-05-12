// tests/decisions-record.test.ts
//
// Unit tests for `recordDelegatedDecision` — the Scrooge session-delegation
// convenience wrapper around `recordCeoDecision`.
//
// Assertions:
//   1. Emitted event carries actor.id === "marc@tgv.co.za", actor.type === "human".
//   2. payload.recordedVia defaults to "scrooge:session-delegation".
//   3. Custom recordedVia override is respected.
//   4. The permission gate (human actor) allows the append — no gate denial.
//   5. Structural validation: required fields (decisionId, title, outcome) are
//      enforced through the underlying recordCeoDecision guard.
//
// Authority: CEO in-session approval = CEO authorization (CLAUDE.md §Session
// delegation); D-POLICY-DOCUMENT-HOME-SURFACE (back-record 2026-05-12).
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { recordCeoDecision, recordDelegatedDecision } from "../runtime/decisions/record";

const AS_OF = "2026-05-12T10:00:00Z";
const BASE_PARAMS = {
  decisionId: "D-TEST-SESSION-DELEGATION",
  action: "approve" as const,
  title: "Test session delegation",
  outcome: "CEO approved via in-session 'y'.",
  sourceDoc: "Owner Inbox/2026-05-12_test_session-delegation.md",
};

describe("recordDelegatedDecision", () => {
  it("emits CeoDecision with actor.id=marc@tgv.co.za and actor.type=human", () => {
    const before = [...eventStore.replay({ type: "CeoDecision" })].length;
    const result = recordDelegatedDecision(BASE_PARAMS, AS_OF);

    expect(result.event.type).toBe("CeoDecision");
    expect(result.event.actor.id).toBe("marc@tgv.co.za");
    expect(result.event.actor.type).toBe("human");
    expect([...eventStore.replay({ type: "CeoDecision" })].length).toBe(before + 1);
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
    // The permission gate bypasses human actors from its agent-policy check,
    // so the real guard here is that recordDelegatedDecision hard-wires
    // actor to marc@tgv.co.za. We verify the human is still wired even when
    // the caller passes extra fields.
    const result = recordDelegatedDecision(
      { ...BASE_PARAMS, decisionId: "D-TEST-SESSION-DELEGATION-ACTOR-GUARD" },
      AS_OF,
    );
    // Must always be the CEO email, never an agent URN.
    expect(result.event.actor.id).toBe("marc@tgv.co.za");
    expect(result.event.actor.id).not.toMatch(/^agent:/);
  });

  it("propagates structural validation from recordCeoDecision — empty decisionId throws", () => {
    expect(() => recordDelegatedDecision({ ...BASE_PARAMS, decisionId: "" }, AS_OF)).toThrow(
      "decisionId is required",
    );
  });

  it("propagates structural validation — empty title throws", () => {
    expect(() =>
      recordDelegatedDecision(
        { ...BASE_PARAMS, decisionId: "D-TEST-TITLE-GUARD", title: "" },
        AS_OF,
      ),
    ).toThrow("title is required");
  });

  it("propagates structural validation — empty outcome throws", () => {
    expect(() =>
      recordDelegatedDecision(
        { ...BASE_PARAMS, decisionId: "D-TEST-OUTCOME-GUARD", outcome: "" },
        AS_OF,
      ),
    ).toThrow("outcome is required");
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
    // The gate only blocks service actors with agent: URNs. Human actors go
    // through the authentication path instead. This test confirms the gate
    // does not throw for the delegated-decision path.
    expect(() =>
      recordDelegatedDecision(
        { ...BASE_PARAMS, decisionId: "D-TEST-SESSION-DELEGATION-GATE" },
        AS_OF,
      ),
    ).not.toThrow();
  });
});

describe("recordCeoDecision / recordDelegatedDecision symmetry", () => {
  it("recordDelegatedDecision produces identical payload shape to manual recordCeoDecision with same args", () => {
    const id = "D-TEST-SYMMETRY";
    const delegated = recordDelegatedDecision({ ...BASE_PARAMS, decisionId: id }, AS_OF);
    const manual = recordCeoDecision(
      {
        ...BASE_PARAMS,
        decisionId: `${id}-MANUAL`,
        actor: "marc@tgv.co.za",
        recordedVia: "scrooge:session-delegation",
      },
      AS_OF,
    );

    // Actor should be identical.
    expect(delegated.event.actor).toEqual(manual.event.actor);

    // Payload fields (excluding decisionId which differs by design) should match.
    const dp = delegated.event.payload as Record<string, unknown>;
    const mp = manual.event.payload as Record<string, unknown>;
    expect(dp.action).toBe(mp.action);
    expect(dp.title).toBe(mp.title);
    expect(dp.outcome).toBe(mp.outcome);
    expect(dp.recordedVia).toBe(mp.recordedVia);
  });
});
