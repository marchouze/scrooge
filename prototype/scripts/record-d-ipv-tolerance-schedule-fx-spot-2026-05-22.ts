// scripts/record-d-ipv-tolerance-schedule-fx-spot-2026-05-22.ts
//
// One-shot:
//   1. File the Helena IPV tolerance recalibration recommendation document
//      (2026-05-22) into the documents register via RecordFiled
//      (RMS Phase 3 — D-RMS-PHASE-3 active).
//   2. Emit Decision{phase:"requested"} for
//      D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22 — CRO-authority calibration
//      card requesting CEO concurrence to approve the tiered FX-spot IPV
//      tolerance schedule appropriate for the build-phase delayed-intraday
//      secondary source environment.
//
// Authority chain:
//   - D-RAS (CEO-approved 2026-05-06) — RAS framework includes IPV as a
//     B-cluster continuous control.
//   - D-BRC-INTERIM-MR-1-FX (CEO-approved 2026-05-21) — interim CEO-authority
//     substitute for BRC tabling during the build phase.
//   - D-MR-1-FX-IPV-TOLERANCES-V2 (approved 2026-05-21) — flat 0.75% /
//     ZAR 200k baseline this recommendation refines with tier structure.
//   - CLAUDE.md decision-authority routing — risk-appetite calibration is
//     CRO authority (Helena).
//
// This card is phase `requested`. Marc's session decision (approve / defer /
// modify) emits the subsequent terminal event via the close-out path.
//
// Author: Helena (Chief Risk Officer, governance) — via Scrooge dispatch

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "docs/2026-05-22_helena_ipv-tolerance-recalibration-recommendation.md",
);
const DECISION_ID = "D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22";
const RECORD_ID = "record:documents:helena:ipv-tolerance-recalibration-recommendation:2026-05-22";

const body = readFileSync(DOC_PATH, "utf8");
const asOf = clock.now();

// ---------------------------------------------------------------------------
// 1. RecordFiled — file the recommendation document into the documents register.
//    Idempotent via content-addressed document store — same bytes = same hash.
// ---------------------------------------------------------------------------

const filedResult = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "WS-MARKETS-MR-1-FX",
      "brief:helena:ipv-tolerance-recalibration-fx-spot-shadow-mode-:2026-05-22",
      "D-BRC-INTERIM-MR-1-FX",
      "D-MR-1-FX-IPV-TOLERANCES-V2",
      "D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21",
      "D-RAS",
      "Policies/pricing-policy-v1.md",
      "Policies/market-risk-policy-v1.md",
      "Policies/valuation-policy-v1.md",
    ],
    actor: {
      type: "service",
      id: "agent:helena:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Helena — IPV tolerance recalibration recommendation, 2026-05-22",
      path: "docs/2026-05-22_helena_ipv-tolerance-recalibration-recommendation.md",
      category: "cro-calibration-analysis",
      author: "Helena (Chief Risk Officer, governance)",
      date: "2026-05-22",
    },
  },
  asOf,
);

const documentHash = filedResult.documentHash;

// ---------------------------------------------------------------------------
// 2. Decision{phase:"requested"} — open the calibration card.
//    Idempotent via decisionsRegister check on existing phases.
// ---------------------------------------------------------------------------

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));

function hasPhase(id: string, phase: string): boolean {
  const h = register.byId.get(id);
  if (!h) return false;
  return h.events.some((e) => e.phase === phase);
}

let decisionEventId: string | null = null;
let decisionSkipped = false;

if (hasPhase(DECISION_ID, "requested")) {
  decisionSkipped = true;
  console.log(
    JSON.stringify({
      level: "info",
      msg: `${DECISION_ID}: decision already requested — skipping Decision emit`,
    }),
  );
} else {
  const result = recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "requested",
      authority: "CRO",
      authorityRef: "agent:helena",
      title: "IPV tolerance schedule — FX spot, delayed-data secondary source",
      category: "risk",
      recommendation: [
        "Approve the tiered IPV tolerance schedule for the build-phase FX spot book:",
        "Tier 1 (USD/ZAR, ZAR/USD, EUR/ZAR, ZAR/EUR, GBP/ZAR, ZAR/GBP): 0.75% relative, ZAR 200,000 absolute.",
        "Tier 2 (all other pairs, default): 1.00% relative, ZAR 200,000 absolute.",
        "At commencement of trading / WS-MTM-PROD-FX-FEED live: tighten to 0.10–0.20% (Tier 1) and 0.25% (Tier 2) using",
        "real-time Bloomberg/Reuters feeds as primary source.",
        "This schedule supersedes the flat 0.75% in D-MR-1-FX-IPV-TOLERANCES-V2 for documentation purposes;",
        "the 0.75% numeric ceiling is preserved for Tier 1 pairs.",
      ].join(" "),
      rationale: [
        "Observed FX spot IPV divergences on 2026-05-21 (USD/ZAR 0.38%, GBP/ZAR 0.23%) are consistent with",
        "the natural noise floor of the two free-tier delayed-intraday sources in use (open-er-api and twelve-data,",
        "hourly bars, different contributor sets, 0–60 minute timing skew between primary asOf and secondary fetch).",
        "BCBS FRTB and standard market practice support ±0.40–0.75% for delayed-intraday sources on liquid EM FX pairs.",
        "The observed max divergence (0.38%) gives a 2× headroom factor under the 0.75% ceiling — appropriate for a",
        "shallow build-phase sample. The tiered structure (Tier 1 major pairs vs Tier 2 default) adds governance clarity",
        "beyond the flat band in D-MR-1-FX-IPV-TOLERANCES-V2, and explicitly documents the tightening trajectory when",
        "real-time feeds land. All 6 breaching positions fall comfortably within 0.75%; the breaches reflect that the",
        "worktree code has not yet been updated to D-MR-1-FX-IPV-TOLERANCES-V2 (PR #718 on main). No desk mismark,",
        "data-quality finding, or process failure is implicated. CRO authority per CLAUDE.md decision-authority routing;",
        "CEO concurrence sought to set build-phase precedent for IPV recalibrations under interim CEO authority",
        "in the absence of a constituted Board Risk Committee.",
      ].join(" "),
      sourceDocHashes: [documentHash],
      citations: [
        "D-RAS",
        "D-BRC-INTERIM-MR-1-FX",
        "D-MR-1-FX-IPV-TOLERANCES-V2",
        "D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21",
        "Policies/pricing-policy-v1.md",
        "Policies/market-risk-policy-v1.md",
        "Policies/valuation-policy-v1.md",
        "prototype/platform/markets/ipv-tolerance.ts",
        "brief:helena:ipv-tolerance-recalibration-fx-spot-shadow-mode-:2026-05-22",
        RECORD_ID,
      ],
      recordedVia: "agent:autonomous",
    },
    asOf,
  );
  decisionEventId = result.eventId;
}

console.log(
  JSON.stringify(
    {
      ok: true,
      filedEventId: filedResult.eventId,
      documentHash,
      isNewDocument: filedResult.isNewDocument,
      decisionEventId,
      decisionSkipped,
    },
    null,
    2,
  ),
);
