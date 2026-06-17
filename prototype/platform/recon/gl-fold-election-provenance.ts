// platform/recon/gl-fold-election-provenance.ts
//
// recon:gl-fold-election-provenance — ADVISORY election-provenance gate (FX3).
//
// The product treatment is the DEFAULT for every FX instance. The only
// legitimate reason a folded instance's treatment DEVIATES from that default is
// a genuine per-instance accounting election the law leaves open (FVOCI election
// IFRS 9 §5.7.5, hedge designation, business-model override) — and every such
// election is a RECORDED DECISION carrying a statutory citation.
//
// This gate asserts the invariant: EVERY folded instance whose treatment
// deviates from the product default (`FxFoldResult.deviations`) has a backing
// recorded election with at least one citation. A deviation without a citation
// would be a silent, un-sourced treatment change — a Charter cmd-4 (source,
// don't hardcode) / cmd-5 (no silent deferral) violation. The fold already
// fail-closes a citation-less election at the SCHEMA level (the parse throws),
// so on a clean store this gate is the standing CONTINUOUS assertion that the
// invariant still holds across the operating book.
//
// ADVISORY: deviations are a legitimate, expected accounting outcome — the gate
// SURFACES them (with their citations) for audit visibility and FAILS only if a
// deviation is found WITHOUT a backing citation (which the schema should already
// prevent — so a fail here means the schema invariant was bypassed). Vacuous-pass
// on a store with no FX elections (the build-phase norm).
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST. Engineering Charter (source
//   don't hardcode; no silent deferral).
// Author: Atlas (Substrate Architect, engineering).

import { foldFxContributionLegs } from "../accounting/posting-rules-v2/fx-fold";
import { eventStore } from "../composition";
import { V2_PERIOD_END, V2_PERIOD_START } from "../projections/v2-read-window";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "gl-fold-election-provenance";

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  try {
    const fold = foldFxContributionLegs({
      eventStore,
      periodStart: V2_PERIOD_START,
      periodEnd: V2_PERIOD_END,
    });

    // Every deviation must carry ≥1 backing citation. A deviation is only ever
    // produced from a recorded election (the fold reads the election register),
    // and the election schema requires `cites` ≥ 1 — so a citation-less deviation
    // here means the schema invariant was bypassed (fail-closed → fail).
    for (const dev of fold.deviations) {
      result.asserted += 1;
      if (dev.cites.length === 0) {
        violations.push({
          subject: `${PIPELINE}:uncited-deviation:${dev.instance}`,
          message: `FX instance ${dev.instance} deviates from the product default (${dev.facet}: ${dev.detail}) WITHOUT a backing citation. A treatment deviation must be a recorded election with a statutory citation (IFRS 9 §5.7.5 etc.). Source, don't hardcode (Charter cmd 4). Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.`,
          severity: "fail",
        });
      } else {
        // Surface the (correctly cited) deviation for audit visibility.
        violations.push({
          subject: `${PIPELINE}:cited-deviation:${dev.instance}`,
          message: `FX instance ${dev.instance} treatment deviates from product default via a recorded election (${dev.facet}: ${dev.detail}); backing citations: [${dev.cites.join(", ")}]. Legitimate per-instance election.`,
          severity: "info",
        });
      }
    }

    result.asOf = `${PIPELINE}: ${fold.deviations.length} folded FX deviation(s) from product default, ${
      fold.deviations.filter((d) => d.cites.length === 0).length
    } uncited. ${violations.some((v) => v.severity === "fail") ? "UNCITED DEVIATION" : "all deviations backed by cited elections"}.`;
  } catch (err) {
    violations.push({
      subject: `${PIPELINE}:fold-error`,
      message: `Election-provenance fold threw: ${err instanceof Error ? err.message : String(err)}. (A citation-less election is rejected at the schema level — this may be a malformed election event.)`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(`\nrecon:${PIPELINE} ${r.ok ? "OK" : "FAIL"}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
