// platform/accounting/fx-vanilla-ifrs-review-harness.test.ts
//
// Tests for the FX-vanilla IFRS review harness (PROC-FIN-12 executable core).
// The harness is the re-runnable spine the CFO sign-off rests on; these tests
// pin its STRUCTURE (the six premise checks, each citing its IFRS paragraphs),
// its aggregation logic, and its NON-VACUITY behaviour (F5) — without depending
// on a particular store's seed state for the structural assertions. The
// live-store PASS/FAIL run is the PROC's job, not the unit test's.
//
// Author: Camille (Chief Financial Officer, governance); F5/F6/F8 remediation by
//   Vera (Internal-audit engineer, third line) under WS-FX-IFRS-REVIEW-FOUNDATION.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { type FxIfrsPremise, runFxVanillaIfrsReview } from "./fx-vanilla-ifrs-review-harness";

describe("FX-vanilla IFRS review harness — structure (PROC-FIN-12)", () => {
  const verdict = runFxVanillaIfrsReview();

  test("verdict subject is fx-vanilla-ifrs-accounting", () => {
    expect(verdict.subject).toBe("fx-vanilla-ifrs-accounting");
  });

  test("emits exactly the six IFRS premise checks (incl. F6 fair-value hierarchy)", () => {
    const premises = verdict.checks.map((c) => c.premise).sort();
    const expected: FxIfrsPremise[] = [
      "fair-value-hierarchy-ifrs13",
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

  test("the F6 fair-value-hierarchy check cites IFRS 13 §81 and is structural", () => {
    const c = verdict.checks.find((x) => x.premise === "fair-value-hierarchy-ifrs13");
    expect(c).toBeDefined();
    expect(c?.governingParagraphs).toContain("IFRS 13 §81");
    expect(c?.evidenceKind).toBe("structural-declaration");
    // The FV-hierarchy gate derives + asserts → it passes on the live declarations.
    expect(c?.pass).toBe(true);
  });

  test("verdict.pass requires the conjunction of every check AND non-vacuity (F5)", () => {
    const conjunction = verdict.checks.every((c) => c.pass);
    expect(verdict.pass).toBe(conjunction && verdict.nonVacuous);
  });

  test("the store-dependent checks (1–3) are tagged store-fx-activity; structural checks are tagged structural-declaration", () => {
    const byPremise = new Map(verdict.checks.map((c) => [c.premise, c.evidenceKind]));
    expect(byPremise.get("fvtpl-classification-at-market-trade-date-obs")).toBe(
      "store-fx-activity",
    );
    expect(byPremise.get("monetary-closing-rate-retranslation")).toBe("store-fx-activity");
    expect(byPremise.get("fvtpl-and-realised-pnl-to-pnl-only")).toBe("store-fx-activity");
    expect(byPremise.get("fair-value-hierarchy-ifrs13")).toBe("structural-declaration");
    expect(byPremise.get("lifecycle-posting-completeness")).toBe("structural-declaration");
    expect(byPremise.get("tracked-gaps-surfaced")).toBe("structural-declaration");
  });

  test("lifecycle-completeness passes: the FVTPL+IAS-21 rules are registered + IFRS-cited", () => {
    // This check reads the canonical registry, not the store, so it is
    // store-independent: the FX rules must resolve with an IFRS citation
    // regardless of seed state — and it must have asserted ≥1 rule (non-vacuous).
    const c = verdict.checks.find((x) => x.premise === "lifecycle-posting-completeness");
    expect(c?.pass).toBe(true);
    expect(c?.findings).toEqual([]);
    expect(c?.assertedCount).toBeGreaterThan(0);
  });

  test("tracked-gaps check always passes (surfacing, not defect) and lists open gaps", () => {
    const c = verdict.checks.find((x) => x.premise === "tracked-gaps-surfaced");
    expect(c?.pass).toBe(true);
    // openTrackedGaps mirrors the live deferral query — surfaced for the signer.
    expect(Array.isArray(verdict.openTrackedGaps)).toBe(true);
  });

  test("F5 — the harness reports an FX-leg non-vacuity count, and nonVacuous tracks it", () => {
    expect(typeof verdict.assertedFxInstanceCount).toBe("number");
    expect(verdict.assertedFxInstanceCount).toBeGreaterThanOrEqual(0);
    expect(verdict.nonVacuous).toBe(verdict.assertedFxInstanceCount > 0);
    // The store-dependent checks' assertedCount mirrors the fold leg count.
    const c1 = verdict.checks.find(
      (x) => x.premise === "fvtpl-classification-at-market-trade-date-obs",
    );
    expect(c1?.assertedCount).toBe(verdict.assertedFxInstanceCount);
  });

  test("F5 — when the review is non-vacuous, a clean store cannot have produced a vacuous PASS", () => {
    // If the harness reports non-vacuous, the store carried FX legs; if it reports
    // vacuous, pass MUST be false (a review of nothing is RED). Either way, pass ⇒
    // non-vacuous (the implication the F5 guard enforces).
    if (verdict.pass) expect(verdict.nonVacuous).toBe(true);
  });
});

describe("FX-vanilla IFRS review harness — F5 non-vacuity on an EMPTY store", () => {
  // Run the harness CLI against a FRESH, EMPTY store (no FX events). A review of
  // nothing MUST exit non-zero (RED) — the harness must not return a vacuous PASS.
  // The harness reads the global composition store, so we drive it as a subprocess
  // with the store-path envs pointed at empty tmpdirs (the documented CI pins).
  test("the harness exits non-zero (RED) when the store has no FX activity", async () => {
    const emptyDb = join(mkdtempSync(join(tmpdir(), "fx-harness-empty-")), "event.db");
    const anchorDb = join(mkdtempSync(join(tmpdir(), "fx-harness-anchor-")), "anchor.db");
    const cpDb = join(mkdtempSync(join(tmpdir(), "fx-harness-cp-")), "cp.db");
    const proc = Bun.spawn(
      ["bun", "run", "platform/accounting/fx-vanilla-ifrs-review-harness.ts"],
      {
        cwd: join(import.meta.dir, "..", ".."),
        env: {
          ...process.env,
          BANK_EVENT_DB: emptyDb,
          BANK_V2_ANCHOR_DB: anchorDb,
          BANK_V2_CONTROL_PLANE_DB: cpDb,
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    // RED: non-zero exit, the non-vacuity banner, and a FAIL verdict.
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain("Non-vacuity: RED");
    expect(stdout).toContain("FAIL — findings supersede; do NOT sign off");
  }, 30_000);
});
