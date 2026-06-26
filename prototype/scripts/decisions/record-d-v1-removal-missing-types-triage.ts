// scripts/decisions/record-d-v1-removal-missing-types-triage.ts
//
// Records D-V1-REMOVAL-MISSING-TYPES-TRIAGE — Marc's in-session approval
// (2026-06-26, "yes proceed") to triage the placeholder estate in
// platform/event-store/registry/missing-types.ts and flip the money-free
// subset to V2.
//
// CONTEXT:
//   missing-types.ts is a 2026-05-16 build-phase placeholder file: 143 event
//   types that agent specs referenced in `subscribesTo` but that had no
//   registry row (Vera finding event-type-registry-coverage, F-032). 78 of
//   those rows are still tagged `v1-only`. They sit as one undifferentiated
//   lump but are three different things, and the file is widely assumed to be
//   all-trading — so ~15-20 money-free rows (client/CRM, compliance, risk-
//   process, model-validation) are hiding inside the licence-day-gated count.
//
// DECISION (downstream of D-V1-REMOVAL-STANDING-DIRECTIVE):
//   Triage the 78 v1-only rows in missing-types.ts into three fates, each
//   recorded honestly (Charter cmd 5, no silent deferral):
//     (1) FLIP-NOW — money-free, still-emittable rows (client/CRM, compliance/
//         AML, risk-process, model-validation). Flip v1-only -> v2-replaced via
//         the proven store-tee + MoneyWire-codec-free + byte-clean parity-gate
//         path (same mechanism that closed Bucket C). Ratchet down in the same
//         PR.
//     (2) LICENCE-DAY-GATED — money-bearing `*Minor` rows (FX/markets/trading,
//         ALM/treasury/liquidity, IFRS9 ECL). Un-emittable on main, no real
//         data. Stay v1-only with an explicit per-row reason; flip retired-by-
//         construction when their domain's V2 wave + real data lands.
//     (3) DEAD / SHADOW — rows with no emit-site anywhere, or whose canonical
//         V2 form already flipped elsewhere (e.g. RealisedPnlRecognised,
//         FxPositionRevalued). Flip retired-by-construction or point the row at
//         the real canonical type; prune genuinely-dead placeholders.
//   Target: ratchet 286 -> ~268 (the flip-now subset), with the residual
//   honestly classified rather than left opaque.
//
// Category: engineering build decision (substrate / platform / schema) — CEO
//   authority during the build phase per the decision-authority routing table.
//
// Idempotent: fixed asOf so re-runs dedup on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument, on
// behalf of Marc (CEO).

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-26T00:00:00.000Z";
const ASOF = "2026-06-26T00:01:00.000Z";

const TITLE =
  "Triage missing-types.ts placeholder estate; flip the money-free subset to V2, classify the residual";

const CITATIONS = [
  "D-V1-REMOVAL-STANDING-DIRECTIVE",
  "D-BANK-WIDE-V2-MIGRATION",
  "D-ENGINEERING-INTEGRITY-CHARTER",
  "CLAUDE.md",
];

const RECOMMENDATION =
  "Triage the 78 `v1-only` placeholder rows in " +
  "platform/event-store/registry/missing-types.ts into three fates, each " +
  "recorded honestly: (1) FLIP-NOW — money-free, still-emittable rows " +
  "(client/CRM, compliance/AML, risk-process, model-validation) flip " +
  "v1-only -> v2-replaced via the proven store-tee + byte-clean parity-gate " +
  "path, ratcheting the baseline down in the same PR; (2) LICENCE-DAY-GATED — " +
  "money-bearing `*Minor` rows (FX/markets/trading, ALM/treasury/liquidity, " +
  "IFRS9 ECL) stay v1-only with an explicit per-row reason and flip retired-" +
  "by-construction when their domain V2 wave + real data lands; (3) DEAD / " +
  "SHADOW — rows with no emit-site, or whose canonical V2 form already flipped " +
  "elsewhere, are flipped retired-by-construction / pointed at the real type / " +
  "pruned. Deliver the triage classification as a typed artefact plus the " +
  "flip-now PR (ratchet 286 -> ~268).";

const RATIONALE =
  "missing-types.ts is a 2026-05-16 build-phase placeholder file (Vera finding " +
  "event-type-registry-coverage / F-032): 143 event types referenced in agent " +
  "specs but absent from the registry, registered as envelope-only placeholder " +
  "rows; 78 remain `v1-only`. They are widely assumed to be all-trading data, " +
  "so ~15-20 genuinely money-free rows are hiding inside the licence-day-gated " +
  "count and inflating it. Triaging converts an opaque '78 stuck' into a real " +
  "ratchet drop now plus an honestly-classified residual, and stops the " +
  "placeholder file from misrepresenting the migration floor. Pure downstream " +
  "execution of D-V1-REMOVAL-STANDING-DIRECTIVE ('whenever an agent touches a " +
  "module that still depends on V1 it retires that dependency... flipping " +
  "types v1-only -> v2-parallel -> v2-replaced and ratcheting the baseline " +
  "down in the same PR'). Approved by Marc in-session 2026-06-26 ('yes " +
  "proceed').";

requestDecision(
  {
    decisionId: "D-V1-REMOVAL-MISSING-TYPES-TRIAGE",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale:
      "missing-types.ts triage + money-free flip submitted for CEO approval; opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: "D-V1-REMOVAL-MISSING-TYPES-TRIAGE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(JSON.stringify({ ok: true, result }, null, 2));
