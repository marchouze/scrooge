// scripts/record-d-completeness-audit-workstream.ts
//
// Records D-COMPLETENESS-AUDIT-WORKSTREAM — Marc's in-session approval
// (2026-06-08, "yes do that") to stand up a standing third-line
// completeness-audit / continuous-assurance function, commissioned first to
// produce a spec (docs/2026-06-08_vera_completeness-audit-workstream-spec.md).
//
// Originating insight (FX functionality review,
// docs/2026-06-08_fx-functionality-domain-review.md):
//   The review surfaced real long-standing gaps — per-currency CoA legs
//   silently routing to suspense ACC-2100-007; the BA-310 FX-NOP return built
//   but inert (never wired into runtime); the VaR/MR-1-FX measure unscheduled
//   and able to go stale. Marc asked: why weren't these closed before a human
//   asked for a report?
//
//   Root cause: our monitoring catches things that BREAK (red recon gates,
//   failed handlers, findings) but is BLIND to things SILENTLY INCOMPLETE
//   behind a working fallback. A supported-currency leg in suspense still
//   balances; an inert module breaks nothing; an unscheduled measure just
//   ages. None emit a trigger/finding/red-gate, so no goal-loop picks them up
//   — and the autonomous self-audit that would proactively surface latent gaps
//   isn't built. The FX report was a one-off MANUAL stand-in for a missing
//   STANDING function. WS-COMPLETENESS-AUDIT specs that function.
//
// Session-delegation: Marc (CEO) approved in-session 2026-06-08; Scrooge
// (Chief of Staff) is the recording instrument (recordedVia:
// scrooge:session-delegation). Governance category — standing third-line
// assurance mandate. Owned by Vera (Internal audit / continuous-assurance
// engineer; functional reporting line → Thandiwe, Chief Audit Executive).
//
// The decision lifecycle is opened `requested` then closed `approved` with
// FIXED ISO asOf timestamps so recon:decision-symmetry sees a symmetric chain
// and the script is idempotent across the home store + the CI fresh-store
// backfill (dedup on (decisionId, phase, as_of)).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-08T16:00:00.000Z";
const ASOF = "2026-06-08T16:01:00.000Z";

const DECISION_ID = "D-COMPLETENESS-AUDIT-WORKSTREAM";

const TITLE =
  "Establish the continuous completeness-audit workstream (standing third-line assurance against silent incompleteness)";

const CITATIONS = [
  // The originating evidence — the FX functionality cross-domain review that
  // surfaced silent-incompleteness gaps (per-ccy CoA → suspense; inert BA-310;
  // unscheduled VaR) no monitoring caught.
  "docs/2026-06-08_fx-functionality-domain-review.md",
  // Third-line independence + autonomous-by-default framing.
  "Principles/6-autonomous-by-default.md",
];

const RECOMMENDATION =
  "Stand up a standing completeness-audit / continuous-assurance function owned " +
  "by third-line (Vera, Internal audit / continuous-assurance engineer; functional " +
  "reporting line → Thandiwe, Chief Audit Executive), commissioned first to produce " +
  "a spec. The function periodically sweeps domains for silent incompleteness — " +
  "built-but-inert modules, fallback-masked gaps, un-gated risk surfaces, stale " +
  "scheduled runs, specified-not-built deferrals, citation/graph drift — and raises " +
  "tracked findings, complementing the existing breakage-recon substrate with " +
  "completeness-assertions. Interim: Vera runs a central periodic cross-domain " +
  "sweep; steady-state (Principle 6): each seat self-audits its own domain and " +
  "self-raises. The spec defines the taxonomy, a recon:completeness:* gate family, " +
  "the findings lifecycle (reusing AuditFinding / SubstrateGap), cadence/home, and " +
  "a prioritized initial backlog seeded from the FX review gaps.";

const RATIONALE =
  "The FX functionality review (docs/2026-06-08_fx-functionality-domain-review.md) " +
  "surfaced real long-standing gaps that no monitoring had caught: supported-currency " +
  "CoA legs (EUR/GBP/JPY/CHF/AUD) silently routing to the unresolved-currency suspense " +
  "account ACC-2100-007 (G2.1); the BA-310 market-risk / FX-NOP period-close subscriber " +
  "built and tested but with zero runtime importer — inert, no SARB submission path " +
  "(G5.1); and the VaR/MR-1-FX MarketRiskMeasureComputed emitter present but in no cron " +
  "metadata, able to silently age (G3.1). Marc (CEO) asked why these were not closed " +
  "before a human commissioned a report. Root cause: the bank's monitoring catches what " +
  "BREAKS (red recon gates, failed handlers, AuditFindings) but is blind to what is " +
  "SILENTLY INCOMPLETE behind a working fallback — a balanced suspense posting, an " +
  "unimported module, an unscheduled measure all break nothing, emit no trigger/finding/" +
  "red-gate, and so no goal-loop picks them up. The proactive autonomous self-audit that " +
  "would surface such latent gaps is not built; the FX review was a one-off MANUAL " +
  "stand-in for a missing STANDING third-line function. Establishing WS-COMPLETENESS-AUDIT " +
  "closes that structural blind spot. Approved by Marc (CEO) in-session 2026-06-08; " +
  "Scrooge is the recording instrument.";

// Open the decision lifecycle with a `requested` phase so the
// recon:decision-symmetry gate sees a symmetric chain (requested -> approved).
requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale:
      "Commissioning of the continuous completeness-audit workstream proposed to " +
      "the CEO; opens the decision lifecycle ahead of in-session approval.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    citations: CITATIONS,
    followOnDispatch: [
      {
        route: "WS-COMPLETENESS-AUDIT spec authoring (Vera)",
        note:
          "Author docs/2026-06-08_vera_completeness-audit-workstream-spec.md: " +
          "problem statement, taxonomy of silent incompleteness, detection " +
          "mechanisms per taxon (recon:completeness:* family), cadence/home, " +
          "findings lifecycle, relationship to existing recon, autonomy endgame " +
          "(central sweep -> per-seat self-audit), prioritized initial backlog.",
      },
      {
        route: "First completeness gate — recon:completeness:inert-module-detection",
        note:
          "Build a generalizable gate flagging modules under a watched set " +
          "(platform/returns/**) that are tested but have zero non-test runtime " +
          "importer — the BA-310 class. Seed green on main via an explicit " +
          "known-inert-pending-wiring allowlist (each entry a tracked finding).",
      },
    ],
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(
  JSON.stringify({ ok: true, eventId: result.eventId, decisionId: DECISION_ID }, null, 2),
);
