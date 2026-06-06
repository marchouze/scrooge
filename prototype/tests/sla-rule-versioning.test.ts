// tests/sla-rule-versioning.test.ts
//
// Phase 4b — rule versioning + temporal reproducibility (D-SLA-ENGINE-RULES-AS-DATA,
// design spec §6). Proves:
//
//   1. supersede() helper: produces an abutting (closed-v1, v2) pair —
//      left-closed/right-open windows, version n+1, supersedes back-reference,
//      no mutation of the original; rejects a cutover at/before the prior start.
//   2. Effective-date selection (spec §2.1 step 3): an event dated BEFORE /
//      WITHIN / AFTER a version's window resolves to the correct version (or
//      rejects-loudly when none is in force).
//   3. Window-integrity analysis: detects gaps, overlaps, open-middle versions,
//      and accepts a clean abutting lineage.
//   4. Temporal reproducibility (spec §6.3): after v2 supersedes v1, replaying a
//      v1-era event through v1 reproduces the v1 posting BYTE-FOR-BYTE.
//   5. The real PR-FX-001-BA v2 supersession exercise: before the cutover → v1
//      (receive-leg NOP); on/after → v2 (pay-leg NOP); v1 still reproducible.
//
// PURE: these tests drive the pure interpreter + versioning helpers; no event
// store, no I/O.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import type { SlaRule } from "../platform/accounting/sla/generated/sla-types";
import { interpret } from "../platform/accounting/sla/interpreter";
import type { InterpreterEvent, ProposedPosting } from "../platform/accounting/sla/interpreter";
import { legsEqual, reproduceAsOf } from "../platform/accounting/sla/reproduce";
import {
  PR_FX_001_BA,
  PR_FX_001_BA_V1_CLOSED,
  PR_FX_001_BA_V2,
} from "../platform/accounting/sla/rules";
import { PR_FX_001_BA_V2_CUTOVER } from "../platform/accounting/sla/rules/pr-fx-001-ba-v2";
import {
  analyzeWindowIntegrity,
  findRuleVersion,
  ruleVersionInForce,
  ruleVersionRef,
  supersede,
  withinEffectiveWindow,
} from "../platform/accounting/sla/versioning";
import type { FxTradeExecutedPayload } from "../platform/markets/cdm/fx";

// ── Fixtures ────────────────────────────────────────────────────────────────

// Buy USD / sell ZAR: pay ZAR 19,000,000.00, receive USD 1,000,000.00 @ 19.0.
function bookingPayload(): FxTradeExecutedPayload {
  return {
    tradeId: { value: "T-VER-001", scheme: "urn:bank:trade-id" },
    productTaxonomy: "FX-spot",
    currencyPair: { base: "USD", quote: "ZAR" },
    side: "buy",
    legs: [
      {
        legKind: "near",
        payCurrency: "ZAR",
        receiveCurrency: "USD",
        notional: { currency: "ZAR", amountMinor: 1_900_000_000 },
        counterNotional: { currency: "USD", amountMinor: 100_000_000 },
        rate: { currency: "ZAR", amount: 19.0 },
        settlementDate: { iso: "2026-06-09", calendar: "JIHCAL" },
      },
    ],
    tradeDate: { iso: "2026-06-06", calendar: "JIHCAL" },
    counterparty: { partyId: "CP-T", name: "T Bank", role: "counterparty", jurisdiction: "ZA" },
    venue: "OTC",
    trader: "t",
    bookId: "FX-SPOT-BOOK",
    bookType: "trading",
    settlementForm: "physical",
    settlementPath: "correspondent",
    clientFlowRef: "sla-versioning",
  } as FxTradeExecutedPayload;
}

function bookingEventAt(asOf: string): InterpreterEvent {
  return {
    type: "FxTradeExecuted",
    entity: "LE-ZA-HOZ-BANK",
    as_of: asOf,
    payload: bookingPayload(),
  };
}

function asPost(results: ReturnType<typeof interpret>, rep: string): ProposedPosting {
  const r = results.find((x) => x.representation === rep);
  if (!r || r.outcome !== "post") {
    throw new Error(`expected post for ${rep}, got ${JSON.stringify(r)}`);
  }
  return r;
}

const SARB = "SARB-BA-RETURN";
const SARB_V2_REGISTRY: readonly SlaRule[] = [PR_FX_001_BA_V1_CLOSED, PR_FX_001_BA_V2];

// ── 1. supersede() helper ──────────────────────────────────────────────────

describe("supersede() — supersede-never-edit convention (spec §6.1)", () => {
  it("produces an abutting (closed-v1, v2) pair without mutating the original", () => {
    const original = PR_FX_001_BA; // version 1, effective_to: null (open)
    const [v1Closed, v2] = supersede(original, {
      effective_from: "2026-07-01",
      effective_to: null,
      applies_to: original.applies_to,
      condition: original.condition,
      lines: original.lines,
      balancing: original.balancing,
      cites: original.cites,
    });

    // Original is untouched (append-only / immutability).
    expect(original.effective_to).toBeNull();
    expect(original.version).toBe(1);

    // v1' closes exactly at v2's effective_from (left-closed / right-open).
    expect(v1Closed.effective_to).toBe("2026-07-01");
    expect(v1Closed.version).toBe(1);

    // v2 is version 2, opens at the cutover, references v1.
    expect(v2.version).toBe(2);
    expect(v2.effective_from).toBe("2026-07-01");
    expect(v2.supersedes).toBe("PR-FX-001-BA@1");
    expect(ruleVersionRef(v2)).toBe("PR-FX-001-BA@2");

    // No gap, no overlap.
    expect(v1Closed.effective_to).toBe(v2.effective_from);
  });

  it("rejects a cutover at or before the prior version's effective_from (loud, never silent)", () => {
    expect(() =>
      supersede(PR_FX_001_BA, {
        effective_from: PR_FX_001_BA.effective_from, // same day — not strictly after
        applies_to: PR_FX_001_BA.applies_to,
        condition: PR_FX_001_BA.condition,
        lines: PR_FX_001_BA.lines,
        balancing: PR_FX_001_BA.balancing,
        cites: PR_FX_001_BA.cites,
      }),
    ).toThrow(/strictly after/);
  });
});

// ── 2. Effective-date selection: before / within / after ────────────────────

describe("effective-date selection — before / within / after a window (spec §2.1 step 3)", () => {
  it("withinEffectiveWindow is left-closed, right-open", () => {
    // v1 window: [2026-01-01, 2026-07-01)
    expect(withinEffectiveWindow(PR_FX_001_BA_V1_CLOSED, "2025-12-31")).toBe(false); // before
    expect(withinEffectiveWindow(PR_FX_001_BA_V1_CLOSED, "2026-01-01")).toBe(true); // left edge IN
    expect(withinEffectiveWindow(PR_FX_001_BA_V1_CLOSED, "2026-06-30")).toBe(true); // within
    expect(withinEffectiveWindow(PR_FX_001_BA_V1_CLOSED, "2026-07-01")).toBe(false); // right edge OUT
  });

  it("an event BEFORE the lineage start has no version in force (rejects loudly)", () => {
    const results = interpret(
      bookingEventAt("2025-06-01T10:00:00Z"),
      SARB_V2_REGISTRY,
      [SARB],
      "2025-06-01",
    );
    const r = results.find((x) => x.representation === SARB);
    expect(r?.outcome).toBe("rejected");
    if (r?.outcome === "rejected") expect(r.reason).toBe("no-eligible-rule");
    expect(ruleVersionInForce(SARB_V2_REGISTRY, SARB, "PR-FX-001-BA", "2025-06-01")).toBeNull();
  });

  it("an event WITHIN v1's window resolves to v1", () => {
    const post = asPost(
      interpret(bookingEventAt("2026-03-15T10:00:00Z"), SARB_V2_REGISTRY, [SARB], "2026-03-15"),
      SARB,
    );
    expect(post.ruleVersion).toBe(1);
    expect(ruleVersionInForce(SARB_V2_REGISTRY, SARB, "PR-FX-001-BA", "2026-03-15")?.version).toBe(
      1,
    );
  });

  it("an event AT/AFTER the cutover resolves to v2", () => {
    const onCut = asPost(
      interpret(
        bookingEventAt(`${PR_FX_001_BA_V2_CUTOVER}T00:00:00Z`),
        SARB_V2_REGISTRY,
        [SARB],
        PR_FX_001_BA_V2_CUTOVER,
      ),
      SARB,
    );
    expect(onCut.ruleVersion).toBe(2); // 2026-07-01 is IN v2 (left-closed)

    const after = asPost(
      interpret(bookingEventAt("2026-09-01T10:00:00Z"), SARB_V2_REGISTRY, [SARB], "2026-09-01"),
      SARB,
    );
    expect(after.ruleVersion).toBe(2);
    expect(ruleVersionInForce(SARB_V2_REGISTRY, SARB, "PR-FX-001-BA", "2026-09-01")?.version).toBe(
      2,
    );
  });
});

// ── 3. Window-integrity analysis ────────────────────────────────────────────

describe("window-integrity analysis (recon engine, spec §6.1)", () => {
  it("accepts a clean abutting lineage", () => {
    expect(analyzeWindowIntegrity(SARB_V2_REGISTRY)).toEqual([]);
  });

  it("detects a GAP between versions", () => {
    const v1: SlaRule = { ...PR_FX_001_BA, version: 1, effective_to: "2026-06-01" };
    const v2: SlaRule = {
      ...PR_FX_001_BA,
      version: 2,
      effective_from: "2026-07-01",
      effective_to: null,
      supersedes: "PR-FX-001-BA@1",
    };
    const defects = analyzeWindowIntegrity([v1, v2]);
    expect(defects.some((d) => d.kind === "gap")).toBe(true);
  });

  it("detects an OVERLAP between versions", () => {
    const v1: SlaRule = { ...PR_FX_001_BA, version: 1, effective_to: "2026-08-01" };
    const v2: SlaRule = {
      ...PR_FX_001_BA,
      version: 2,
      effective_from: "2026-07-01",
      effective_to: null,
      supersedes: "PR-FX-001-BA@1",
    };
    const defects = analyzeWindowIntegrity([v1, v2]);
    expect(defects.some((d) => d.kind === "overlap")).toBe(true);
  });

  it("detects an OPEN non-final version (overlaps everything after)", () => {
    const v1: SlaRule = { ...PR_FX_001_BA, version: 1, effective_to: null }; // open, but superseded
    const v2: SlaRule = {
      ...PR_FX_001_BA,
      version: 2,
      effective_from: "2026-07-01",
      effective_to: null,
      supersedes: "PR-FX-001-BA@1",
    };
    const defects = analyzeWindowIntegrity([v1, v2]);
    expect(defects.some((d) => d.kind === "overlap")).toBe(true);
  });
});

// ── 4 + 5. Temporal reproducibility + the v2 exercise ───────────────────────

describe("temporal reproducibility — v1 posting reproduces from v1 after v2 supersedes (spec §6.3)", () => {
  it("v1 and v2 produce DIFFERENT legs (the supersession is a real basis change)", () => {
    const v1Post = asPost(
      interpret(bookingEventAt("2026-03-15T10:00:00Z"), SARB_V2_REGISTRY, [SARB], "2026-03-15"),
      SARB,
    );
    const v2Post = asPost(
      interpret(bookingEventAt("2026-09-01T10:00:00Z"), SARB_V2_REGISTRY, [SARB], "2026-09-01"),
      SARB,
    );

    // v1 records the NOP on the bought (receive) leg → USD.
    for (const l of v1Post.legs) expect(l.currency).toBe("USD");
    // v2 records the NOP on the sold (pay) leg → ZAR.
    for (const l of v2Post.legs) expect(l.currency).toBe("ZAR");

    expect(legsEqual(v1Post.legs, v2Post.legs)).toBe(false);
  });

  it("replaying a v1-era event through v1 reproduces the v1 posting BYTE-FOR-BYTE — even after v2 exists", () => {
    // Original posting: a trade booked while v1 was in force.
    const originalEvent = bookingEventAt("2026-03-15T10:00:00Z");
    const originalPost = asPost(
      interpret(originalEvent, SARB_V2_REGISTRY, [SARB], "2026-03-15"),
      SARB,
    );
    expect(originalPost.ruleVersion).toBe(1);

    // Reproduce from the EXACT version cited on the posting, using the full
    // registry that NOW also contains v2. The cited v1 still reproduces.
    const repro = reproduceAsOf({
      registry: SARB_V2_REGISTRY,
      event: originalEvent,
      ruleId: originalPost.ruleId,
      ruleVersion: originalPost.ruleVersion,
      representation: SARB,
    });

    expect(repro.kind).toBe("reproduced");
    if (repro.kind !== "reproduced") throw new Error(repro.detail);
    expect(repro.ruleVersion).toBe(1);
    expect(legsEqual(repro.legs, originalPost.legs)).toBe(true);
  });

  it("reproduce reports loudly when the cited version is not in the registry", () => {
    const repro = reproduceAsOf({
      registry: SARB_V2_REGISTRY,
      event: bookingEventAt("2026-03-15T10:00:00Z"),
      ruleId: "PR-FX-001-BA",
      ruleVersion: 99,
      representation: SARB,
    });
    expect(repro.kind).toBe("version-not-found");
  });

  it("the committed registry has v1 closed + v2 open for PR-FX-001-BA", () => {
    expect(findRuleVersion(SARB_V2_REGISTRY, "PR-FX-001-BA", 1, SARB)?.effective_to).toBe(
      PR_FX_001_BA_V2_CUTOVER,
    );
    expect(findRuleVersion(SARB_V2_REGISTRY, "PR-FX-001-BA", 2, SARB)?.effective_to).toBeNull();
  });
});
