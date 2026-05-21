// scripts/approve-d-brc-interim-mr-1-fx.ts
//
// Scrooge session-delegation — record CEO approval of D-BRC-INTERIM-MR-1-FX
// Option A (CEO interim-authority approval of Helena's MR-1-FX limit
// framework).
//
// Triggered by Marc (CEO)'s explicit in-session approval of Owen (Company
// Secretary, governance)'s decision card (PR #678, merged) at 2026-05-21T09:50Z
// via Scrooge's AskUserQuestion presentation. Per CLAUDE.md "Session
// delegation": Marc's choice in-session constitutes CEO authorization; Scrooge
// emits Decision{phase:"approved"}.
//
// Effect: PROC-MK-PLG-01 Condition 2 (NPA-fx-spot-risk-limits-set) flips
// Open -> Satisfied on next rehearsal. Successor card
// D-BRC-INTERIM-MR-1-FX-RETABLE will open separately for licence-day
// re-tabling.
//
// Authority: CLAUDE.md "Decision authority routing" — risk-appetite calibration
// is CRO category; Helena governs, Marc (CEO) holds interim approval authority
// in the build phase per Policies/market-risk-policy-v1.md (CEO interim)
// provisions and consistent with D-NPA-FX-SPOT-INTERNAL-TEST + board-notification
// pattern (PR #674).
//
// Author: Scrooge (Chief of Staff, orchestrator) — recording instrument for the CEO.

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-BRC-INTERIM-MR-1-FX";

const result = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "CEO interim-authority approval of MR-1-FX limit framework (D-BRC-INTERIM-MR-1-FX Option A)",
    category: "risk",
    recommendation:
      "Approve Helena (Chief Risk Officer, governance)'s MR-1-FX limit framework (PR #634) under CEO interim authority as the build-phase substitute for Board Risk Committee tabling. Framework: 1-day 99% VaR ZAR 350,000; EOD position cap USD 1m; intraday peak USD 1.5m; per-counterparty notional cap USD 500k/day; 8 lift-to-live trigger criteria. Open successor card D-BRC-INTERIM-MR-1-FX-RETABLE for mandatory re-tabling at Board constitution (pinned to PROC-MK-PLG-01 firing).",
    rationale:
      "No Board Risk Committee exists today (build-phase per CLAUDE.md operating model: real human directors only at licence-day). Policies/market-risk-policy-v1.md §3 / §3.1 / §6 contains explicit (CEO interim) provisions for the pre-BRC governance posture. Owen's card (PR #678) recommends Option A as the natural parallel to D-NPA-FX-SPOT-INTERNAL-TEST + board-notification (PR #674) — both substitute CEO acknowledgment for absent statutory bodies. Approval clears Devon's PROC-MK-PLG-01 Condition 2 (NPA-fx-spot-risk-limits-set) Open blocker on next rehearsal run. Re-tabling at Board constitution is mandatory and explicitly opened as successor decision.",
    sourceDocHashes: ["blake3:ac08974c343bb3fd4ebc3dce1df61d51bee4c55f7ae5114da312464b1a499d81"],
    citations: [
      "PR #678",
      "PR #634",
      "PR #667",
      "PR #674",
      "Policies/market-risk-policy-v1.md",
      "CLAUDE.md#decision-authority-routing",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);

console.log(JSON.stringify({ ok: true, decisionId: DECISION_ID, result }, null, 2));
