// platform/accounting/fx-vanilla-ifrs-review-harness.test.ts
//
// Tests for the FX-vanilla IFRS review harness (PROC-FIN-12 executable core).
// The harness is the re-runnable spine the CFO sign-off rests on; these tests
// pin its STRUCTURE (the five premise checks, each citing its IFRS paragraphs)
// and its aggregation logic, without depending on a particular store's seed
// state — the live-store run is the PROC's job, not the unit test's.
//
// Author: Camille (Chief Financial Officer, governance).

import { describe, expect, test } from "bun:test";

import {
  type FxIfrsPremise,
  runFxVanillaIfrsReview,
} from "./fx-vanilla-ifrs-review-harness";

describe("FX-vanilla IFRS review harness — structure (PROC-FIN-12)", () => {
  const verdict = runFxVanillaIfrsReview();

  test("verdict subject is fx-vanilla-ifrs-accounting", () => {
    expect(verdict.subject).toBe("fx-vanilla-ifrs-accounting");
  });

  test("emits exactly the five IFRS premise checks", () => {
    const premises = verdict.checks.map((c) => c.premise).sort();
    const expected: FxIfrsPremise[] = [
      "fvtpl-and-realised-pnl-to-pnl-only",
      "fvtpl-classification-at-market-trade-date-obs",
      "lifecycle-posting-completeness",
      "monetary-closing-rate-retranslation",
      "tracked-gaps-surfaced",
    ];
    expect(premises).toEqual(expected);
  });

  test("every premise check names ≥1 governing paragraph (Principle-2 trace)", () => {
    for (const c of verdict.checks) {
      expect(c.governingParagraphs.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("the closing-rate check cites IAS 21 §23 and §28", () => {
    const c = verdict.checks.find((x) => x.premise === "monetary-closing-rate-retranslation");
    expect(c).toBeDefined();
    expect(c?.governingParagraphs).toContain("IAS 21 §23");
    expect(c?.governingParagraphs).toContain("IAS 21 §28");
  });

  test("the P&L-direction check cites IFRS 9 §5.7.1 (FVTPL → P&L)", () => {
    const c = verdict.checks.find((x) => x.premise === "fvtpl-and-realised-pnl-to-pnl-only");
    expect(c?.governingParagraphs).toContain("IFRS 9 §5.7.1");
  });

  test("the trade-date check cites IFRS 9 §5.1.1 and B3.1.2 (initial recognition)", () => {
    const c = verdict.checks.find(
      (x) => x.premise === "fvtpl-classification-at-market-trade-date-obs",
    );
    expect(c?.governingParagraphs).toContain("IFRS 9 §5.1.1");
    expect(c?.governingParagraphs).toContain("IFRS 9 B3.1.2");
  });

  test("verdict.pass is the conjunction of every premise check's pass", () => {
    const conjunction = verdict.checks.every((c) => c.pass);
    expect(verdict.pass).toBe(conjunction);
  });

  test("lifecycle-completeness passes: the FVTPL+IAS-21 rules are registered + IFRS-cited", () => {
    // This check reads the canonical registry, not the store, so it is
    // store-independent: the three on-BS/P&L FX rules must resolve with an
    // IFRS citation regardless of seed state.
    const c = verdict.checks.find((x) => x.premise === "lifecycle-posting-completeness");
    expect(c?.pass).toBe(true);
    expect(c?.findings).toEqual([]);
  });

  test("tracked-gaps check always passes (surfacing, not defect) and lists open gaps", () => {
    const c = verdict.checks.find((x) => x.premise === "tracked-gaps-surfaced");
    expect(c?.pass).toBe(true);
    // openTrackedGaps mirrors the live deferral query — surfaced for the signer.
    expect(Array.isArray(verdict.openTrackedGaps)).toBe(true);
  });
});
