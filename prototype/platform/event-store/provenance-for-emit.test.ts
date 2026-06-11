// platform/event-store/provenance-for-emit.test.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE — PR6 (incremental-adoption tail).
//
// Two suites:
//   (1) `provenanceForEmit` contract — category-policy routing, scenario
//       discipline, lineage defaults, pinned-policy behaviour.
//   (2) Per-batch IDENTITY MEASUREMENTS — for every migrated call-site the
//       helper's output is asserted BYTE-IDENTICAL (JSON.stringify) to the
//       exact explicit tag the call-site passed before the migration. The
//       "before" figures are pinned literals in this file, so a future change
//       to the helper or the category taxonomy that would flip a migrated
//       emitter's provenance fails here first — no silent provenance flips.
//
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, describe, expect, it } from "bun:test";

import { makeRasLineCalibrated } from "./event-types/risk";
import {
  PRODUCTION_CARVE_OUTS,
  defaultProvenanceFor,
  productionTag,
  provenanceForEmit,
  setActiveCategoryPolicy,
  simulatedTag,
} from "./provenance";

afterEach(() => {
  // Never leak a pinned policy into other test files.
  setActiveCategoryPolicy(undefined);
});

// ---------------------------------------------------------------------------
// (1) Contract
// ---------------------------------------------------------------------------

describe("provenanceForEmit — category-policy routing", () => {
  it("production category + explicit lineage → production tag", () => {
    expect(provenanceForEmit("BankModePolicySet", { sourceLineage: "bank-mode-policy" })).toEqual({
      kind: "production",
      sourceLineage: "bank-mode-policy",
    });
  });

  it("production carve-out type without lineage → registered carve-out lineage", () => {
    expect(provenanceForEmit("Decision")).toEqual({
      kind: "production",
      sourceLineage: "decision-record",
    });
    expect(provenanceForEmit("CeoDecision")).toEqual({
      kind: "production",
      sourceLineage: "ceo-decision-record",
    });
    expect(provenanceForEmit("AgentBriefIssued")).toEqual({
      kind: "production",
      sourceLineage: "agent-brief",
    });
  });

  it("production-mapped type without carve-out or lineage → category:<category> (matches defaultProvenanceFor)", () => {
    expect(provenanceForEmit("RecordFiled")).toEqual({
      kind: "production",
      sourceLineage: "category:governance",
    });
    expect(provenanceForEmit("RecordFiled")).toEqual(defaultProvenanceFor("RecordFiled"));
  });

  it("simulated-resolved type requires a scenario (fail loud)", () => {
    // Unmapped type → simulated under the default policy.
    expect(() => provenanceForEmit("FxSettlementInstructed")).toThrow(/scenario is required/);
    // Mapped simulated category (trading) too.
    expect(() => provenanceForEmit("FxTradeExecuted", { sourceLineage: "x" })).toThrow(
      /scenario is required/,
    );
  });

  it("simulated-resolved type with scenario → scenario-bound simulated tag", () => {
    expect(
      provenanceForEmit("FxTradeExecuted", {
        scenario: "rehearsal-x",
        sourceLineage: "scenario-runner:x",
      }),
    ).toEqual({
      kind: "simulated",
      scenario: "rehearsal-x",
      sourceLineage: "scenario-runner:x",
    });
  });

  it("production-resolved type with a scenario → throws (production is not scenario-bound)", () => {
    expect(() => provenanceForEmit("Decision", { scenario: "rehearsal-x" })).toThrow(
      /must not be supplied/,
    );
  });

  it("variant + tags pass through on both kinds", () => {
    expect(provenanceForEmit("Decision", { variant: "uat", tags: ["a", "b"] })).toEqual({
      kind: "production",
      sourceLineage: "decision-record",
      variant: "uat",
      tags: ["a", "b"],
    });
    expect(
      provenanceForEmit("FxTradeExecuted", {
        scenario: "s1",
        sourceLineage: "l1",
        variant: "uat",
        tags: ["a"],
      }),
    ).toEqual({
      kind: "simulated",
      scenario: "s1",
      sourceLineage: "l1",
      variant: "uat",
      tags: ["a"],
    });
  });

  it("simulated lineage defaults to category:<category|uncategorised>", () => {
    expect(provenanceForEmit("FxTradeExecuted", { scenario: "s1" }).sourceLineage).toBe(
      "category:trading",
    );
    expect(provenanceForEmit("TotallyUnmappedType", { scenario: "s1" }).sourceLineage).toBe(
      "category:uncategorised",
    );
  });

  it("respects the PINNED active policy, not just the static default", () => {
    setActiveCategoryPolicy({
      governance: "simulated",
      build: "production",
      trading: "production",
      accounting: "simulated",
      counterparty: "simulated",
      messaging: "simulated",
      settlement: "simulated",
      "market-data": "simulated",
    });
    // governance flipped to simulated → Decision now needs a scenario…
    expect(() => provenanceForEmit("Decision")).toThrow(/scenario is required/);
    // …and trading flipped to production → no scenario allowed.
    expect(provenanceForEmit("FxTradeExecuted", { sourceLineage: "fx-gw" })).toEqual({
      kind: "production",
      sourceLineage: "fx-gw",
    });
  });
});

// ---------------------------------------------------------------------------
// (2) Per-batch identity measurements (figure-measured migration)
// ---------------------------------------------------------------------------

describe("PR6 batch A identity — governance emitters (byte-identical before/after)", () => {
  // runtime/decisions/record.ts (Decision) — before:
  //   provenance: PRODUCTION_CARVE_OUTS.Decision
  it("Decision: provenanceForEmit('Decision') ≡ PRODUCTION_CARVE_OUTS.Decision", () => {
    const before = { kind: "production", sourceLineage: "decision-record" };
    const after = provenanceForEmit("Decision");
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    expect(JSON.stringify(after)).toBe(JSON.stringify(PRODUCTION_CARVE_OUTS.Decision));
  });

  // runtime/decisions/record.ts (DecisionComment) — before:
  //   provenance: PRODUCTION_CARVE_OUTS.Decision   (Decision-family lineage)
  it("DecisionComment: explicit 'decision-record' lineage ≡ legacy tag", () => {
    const before = { kind: "production", sourceLineage: "decision-record" };
    const after = provenanceForEmit("DecisionComment", { sourceLineage: "decision-record" });
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });

  // runtime/bank-mode/record.ts (BankModePolicySet) — before:
  //   provenance: productionTag({ sourceLineage: "bank-mode-policy" })
  it("BankModePolicySet: helper output ≡ legacy productionTag call", () => {
    const before = productionTag({ sourceLineage: "bank-mode-policy" });
    const after = provenanceForEmit("BankModePolicySet", { sourceLineage: "bank-mode-policy" });
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });

  // Sanity: the helper composes through the same constructors, so simulated
  // shapes also match the legacy constructor byte-for-byte.
  it("simulated shape ≡ legacy simulatedTag call", () => {
    const before = simulatedTag({ scenario: "s1", sourceLineage: "l1" });
    const after = provenanceForEmit("FxTradeExecuted", { scenario: "s1", sourceLineage: "l1" });
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });
});

describe("PR6 batch B identity — dead provenance? param removal (no provenance flip)", () => {
  // Before the removal, NO production caller passed `provenance` to these
  // factories (proven by full-project tsc: removing the param produced zero
  // dangling-caller errors). The emitted events therefore carried no explicit
  // tag before AND after — classification stays on the category-policy default
  // path (store soft-tagger / defaultProvenanceFor). Pin both halves.
  it("factory output carries no explicit provenance field (e.g. makeRasLineCalibrated)", () => {
    const ev = makeRasLineCalibrated({
      asOf: "2026-06-11T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "system", id: "agent:helena:ras" },
      citations: ["urn:test:pr6-identity"],
      payload: {
        lineId: "B-TEST",
        rasSection: "B",
        calibrationDescription: "PR6 identity fixture",
        calibrationCitations: ["urn:test:pr6-identity"],
        calibrationSource: "test",
        standingAuthority: "CRO",
        obligationRowId: "OBL-TEST",
      },
    });
    expect("provenance" in ev).toBe(false);
  });

  it("store-default classification for the affected types is unchanged (pinned figures)", () => {
    // Governance-mapped → production, category lineage.
    expect(defaultProvenanceFor("RasLineCalibrated")).toEqual({
      kind: "production",
      sourceLineage: "category:governance",
    });
    // Unmapped operational types → build-phase simulated backfill tag.
    for (const type of [
      "SlaRulePublished",
      "SlaRuleApproved",
      "SlaRuleWithheld",
      "BalanceSheetSubstantiationCompleted",
    ]) {
      expect(defaultProvenanceFor(type)).toEqual({
        kind: "simulated",
        scenario: "pre-substrate-build-phase",
        sourceLineage: "pre-substrate-backfill",
      });
    }
  });
});
