// tests/decisions-record-slice-b.test.ts
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice B + Slice C — unit tests covering:
//   - `recordDecision` happy path + Zod rejection of malformed payloads;
//   - `requestDecision` / `resolveDecision` convenience wrappers;
//   - `recordDelegatedDecision` unified-Decision emission (Slice C);
//   - slug minting + validation via `mintDecisionId` / `validateDecisionSlug`.
//
// Slice C update: dual-emit tests from Slice B (recordCeoDecision) removed;
// `recordCeoDecision` was deleted in Slice C. `recordDelegatedDecision` now
// emits only a unified `Decision` event.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import {
  recordDecision,
  recordDelegatedDecision,
  requestDecision,
  resolveDecision,
} from "../runtime/decisions/record";
import { mintDecisionId, validateDecisionSlug } from "../runtime/decisions/registry";

const AS_OF = "2026-05-16T13:00:00Z";

function baseDecisionInput(overrides: Record<string, unknown> = {}) {
  return {
    decisionId: "D-SLICE-B-TEST-RECORD",
    phase: "approved" as const,
    authority: "CEO" as const,
    authorityRef: "marc@tgv.co.za",
    title: "Slice B test",
    category: "governance" as const,
    recommendation: "Approve.",
    rationale: "Test rationale.",
    sourceDocHashes: [],
    citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
    recordedVia: "authoring-ui" as const,
    ...overrides,
  };
}

describe("recordDecision (Slice B)", () => {
  it("emits exactly one Decision event with the unified payload shape", () => {
    const before = [...eventStore.replay({ type: "Decision" })].length;
    const result = recordDecision(baseDecisionInput(), AS_OF);
    expect(result.event.type).toBe("Decision");
    const after = [...eventStore.replay({ type: "Decision" })].length;
    expect(after).toBe(before + 1);
  });

  it("rejects an invalid slug at the registry guard before Zod sees it", () => {
    expect(() => recordDecision(baseDecisionInput({ decisionId: "D-XXX" }), AS_OF)).toThrow(
      /placeholder/,
    );
  });

  it("rejects payloads where required fields are missing (Zod)", () => {
    expect(() => recordDecision(baseDecisionInput({ title: "" }), AS_OF)).toThrow();
  });

  it("rejects an authority outside the canonical set", () => {
    expect(() =>
      recordDecision(
        baseDecisionInput({ decisionId: "D-SLICE-B-TEST-BAD-AUTHORITY", authority: "Wizard" }),
        AS_OF,
      ),
    ).toThrow();
  });
});

describe("requestDecision / resolveDecision", () => {
  it("requestDecision sets phase=requested", () => {
    const result = requestDecision(
      baseDecisionInput({ decisionId: "D-SLICE-B-TEST-REQUEST" }) as never,
      AS_OF,
    );
    expect((result.event.payload as { phase: string }).phase).toBe("requested");
  });

  it("resolveDecision accepts a terminal phase", () => {
    const result = resolveDecision(
      baseDecisionInput({
        decisionId: "D-SLICE-B-TEST-RESOLVE",
        phase: "rejected" as const,
      }) as never,
      AS_OF,
    );
    expect((result.event.payload as { phase: string }).phase).toBe("rejected");
  });
});

describe("recordDelegatedDecision (Slice C — unified Decision only)", () => {
  it("emits a Decision event (no CeoDecision) for the delegated path", () => {
    const beforeUnified = [...eventStore.replay({ type: "Decision" })].length;
    const beforeCeo = [...eventStore.replay({ type: "CeoDecision" })].length;
    recordDelegatedDecision(
      {
        decisionId: "D-SLICE-B-DELEGATED-EMIT",
        title: "Delegated session approval smoke test",
        outcome: "Only unified Decision event emitted.",
      },
      AS_OF,
    );
    const afterUnified = [...eventStore.replay({ type: "Decision" })].length;
    const afterCeo = [...eventStore.replay({ type: "CeoDecision" })].length;
    expect(afterUnified).toBe(beforeUnified + 1);
    // Slice C: no legacy CeoDecision emitted.
    expect(afterCeo).toBe(beforeCeo);
  });

  it("delegated Decision event carries recordedVia=scrooge:session-delegation", () => {
    recordDelegatedDecision(
      {
        decisionId: "D-SLICE-B-DELEGATED-VIA",
        title: "Session delegation via test",
        outcome: "Recorded via scrooge.",
      },
      AS_OF,
    );
    const unified = [...eventStore.replay({ type: "Decision" })].find(
      (e) => (e.payload as { decisionId: string }).decisionId === "D-SLICE-B-DELEGATED-VIA",
    );
    expect(unified).toBeDefined();
    expect((unified?.payload as { recordedVia: string }).recordedVia).toBe(
      "scrooge:session-delegation",
    );
  });
});

describe("validateDecisionSlug", () => {
  it("accepts a canonical slug", () => {
    expect(validateDecisionSlug("D-RMS-PHASE-1").ok).toBe(true);
  });

  it("rejects placeholders", () => {
    for (const id of ["D-XXX", "D-IN", "D-FX-", "D-TBD", "D-TODO", "D-01", "D-99"]) {
      expect(validateDecisionSlug(id).ok).toBe(false);
    }
  });

  it("rejects slugs over 60 chars", () => {
    const long = `D-${"A".repeat(60)}`;
    expect(validateDecisionSlug(long).ok).toBe(false);
  });

  it("rejects lowercase / trailing-hyphen / leading-digit", () => {
    expect(validateDecisionSlug("d-rms-phase-1").ok).toBe(false);
    expect(validateDecisionSlug("D-FOO-").ok).toBe(false);
    expect(validateDecisionSlug("D-1FOO").ok).toBe(false);
  });
});

describe("mintDecisionId", () => {
  it("returns a slug derived from the title when the universe is empty", () => {
    const { id, alternatives } = mintDecisionId("Hire a new compliance lead", {
      knownIds: new Set(),
    });
    expect(id.startsWith("D-")).toBe(true);
    expect(id).toMatch(/HIRE/);
    expect(id).toMatch(/COMPLIANCE/);
    expect(Array.isArray(alternatives)).toBe(true);
  });

  it("avoids exact-collision against known ids", () => {
    const known = new Set(["D-HIRE-NEW-COMPLIANCE-LEAD"]);
    const { id } = mintDecisionId("Hire a new compliance lead", { knownIds: known });
    expect(id).not.toBe("D-HIRE-NEW-COMPLIANCE-LEAD");
  });

  it("avoids prefix-shadows in both directions", () => {
    const known = new Set(["D-PARTY-REGISTER-CORRECTION"]);
    const { id } = mintDecisionId("Party register", { knownIds: known });
    // Either it picks a non-shadowing form or falls back to -V2/etc.
    expect(known.has(id)).toBe(false);
    expect(id.startsWith("D-PARTY-REGISTER-") || id.startsWith("D-PARTY-")).toBe(true);
  });

  it("throws on an empty title", () => {
    expect(() => mintDecisionId("   ")).toThrow();
  });
});
