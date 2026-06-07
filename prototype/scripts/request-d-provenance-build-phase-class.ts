// scripts/request-d-provenance-build-phase-class.ts
//
// File a Decision(requested) for D-PROVENANCE-BUILD-PHASE-CLASS — the
// proposed third provenance class `build-phase-fixture` that lets real
// build-phase events flow through production projections (BA-110, BA-350,
// BA-100, dashboard reporting tiles) without polluting the `simulated`
// class reserved for scenario / rehearsal / counterfactual data.
//
// Brief:    brief:atlas:d-provenance-build-phase-class-decision-card-sco:2026-05-22
// Run:      run:atlas:2026-05-22T07-03-45-966Z
// Authority: D-DATA-PROVENANCE-SUBSTRATE · D-PROVENANCE-FILTER-ENFORCEMENT ·
//            Principles/1-events-are-truth.md · Principles/6-autonomous-by-default.md
// Trigger:   Eitan (Treasurer, governance) BA-110 first end-to-end validation
//            report 2026-05-22 — gap G-1 (CRITICAL — blocks M2).
// Author:    Atlas (Core banking platform architect, engineering — substrate)

import { requestDecision } from "../runtime/decisions/record";

const result = requestDecision({
  decisionId: "D-PROVENANCE-BUILD-PHASE-CLASS",
  authority: "CEO",
  authorityRef: "marc@tgv.co.za",
  title:
    "Establish a third provenance class `build-phase-fixture` so real build-phase data flows through production projections",
  category: "engineering",
  recommendation:
    "Option A — introduce a third ProvenanceKind value `build-phase-fixture`, distinct from `simulated`. " +
    "Production projections (BA-110, every M2 return, dashboard reporting tiles) accept `production` AND " +
    "`build-phase-fixture` events during the build phase; a one-shot operator command " +
    "(`bun run provenance:commence-trading`) flips to `production`-only at commencement-of-trading and " +
    "re-emits surviving rows under `production` via typed `ProvenanceReclassified` events. The currently-" +
    "overloaded `simulated` class is preserved for scenario / rehearsal / counterfactual fixtures that must " +
    "NEVER flow into production projections. Refines (does not loosen) D-PROVENANCE-FILTER-ENFORCEMENT.",
  rationale:
    "Eitan's BA-110 first end-to-end validation (2026-05-22, blake3:ea05a7cacda07b3f9432e0177cbb622160d4d3150ce5475068f0db10b61fcd1d) " +
    "found that all 386 build-phase events (SubLedgerPostingEmitted, FxSettlementInstructed) are tagged " +
    "`provenance.kind = simulated` and excluded by the production-grade BA-110 filter, producing a " +
    "structurally empty return (totalStockHqlaMinor = 0, lcrRatio = infinity). The same gap blocks every " +
    "M2 return, not just BA-110. Three options analysed in the scoping card; Option A chosen because " +
    "(1) it aligns with the operating-model semantics (simulated for scenarios; build-phase-fixture for real " +
    "data substituted during the build phase; production for post-licence-day real data — three classes, " +
    "three meanings, no overload), (2) it preserves the strong audit-integrity property that scenarios stay " +
    "quarantined, (3) the default filter remains production-only (the build-phase relaxation is opt-in by " +
    "lifecycle env, not by per-CLI flag — no drift), and (4) it refines D-PROVENANCE-FILTER-ENFORCEMENT " +
    "cleanly rather than repealing it (Option B) or hollowing it out (Options C and D). Implementation " +
    "scope ~25–35 files across 8 substrate seams, gated in 5 slices with a recon-asserted commencement " +
    "migration; full detail in the scoping card at " +
    "2026-05-22_atlas_d-provenance-build-phase-class_decision-card.md.",
  citations: [
    "D-DATA-PROVENANCE-SUBSTRATE",
    "D-PROVENANCE-FILTER-ENFORCEMENT",
    "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
    "Principles/1-events-are-truth.md",
    "Principles/6-autonomous-by-default.md",
    "docs/2026-05-22_eitan_ba-110-first-end-to-end-validation.md",
  ],
  followOnDispatch: [
    {
      route: "agent:atlas",
      note: "On approval: implement Slices 1–3 (substrate types + Zod + filter + recon updates + emitter retag + backfill). Coordinate with Anya on filter-runtime touchpoints.",
    },
    {
      route: "agent:anya",
      note: "On approval: review filter-runtime changes (Slice 4 lifecycle-aware defaultProvenanceMode) and snapshot-key digest invariants.",
    },
    {
      route: "agent:vera",
      note: "On approval: audit the build-phase source-lineage allowlist before the backfill runs; stand up the new `recon:provenance-commencement-readiness` pipeline.",
    },
    {
      route: "agent:saskia",
      note: "On approval: add `recon:provenance-commencement-readiness` to the commencement-of-trading readiness gate list (Slice 5 dependency).",
    },
  ],
  recordedVia: "scrooge:session-delegation:propose-decision",
});

console.log(
  JSON.stringify(
    {
      ok: true,
      decisionId: "D-PROVENANCE-BUILD-PHASE-CLASS",
      eventId: result.eventId,
      phase: "requested",
    },
    null,
    2,
  ),
);
