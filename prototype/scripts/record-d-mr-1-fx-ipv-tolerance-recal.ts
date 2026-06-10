// scripts/record-d-mr-1-fx-ipv-tolerance-recal.ts
//
// One-shot:
//   1. Emit Decision{phase:"requested"} for D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21
//      — Helena (Chief Risk Officer, governance)'s recalibration of the
//      build-phase IPV tolerance bands on the FX-spot book after the PR
//      #694 inverse-pair direction sanity-check exposed inter-source
//      dispersion at the free-tier feed quality.
//   2. File the supporting analysis markdown into the documents register
//      via RecordFiled (RMS Phase 3 — D-RMS-PHASE-3 active).
//
// Authority chain:
//   - D-RAS (CEO-approved 2026-05-06) — RAS framework includes IPV as a
//     B-cluster continuous control.
//   - D-BRC-INTERIM-MR-1-FX (CEO-approved 2026-05-21, event
//     3e3d35ff-741d-4a81-b84c-dd34ab82e2ee) — interim CEO-authority
//     approval of the MR-1-FX limit framework as build-phase substitute
//     for BRC tabling. This recalibration is a calibration item within
//     that framework.
//   - CLAUDE.md decision-authority routing — risk-appetite calibration is
//     CRO authority. CEO concurrence requested to set the precedent for
//     IPV recalibrations during the build-phase BRC-absent period.
//
// This is NOT a session-delegated approval. The card is OPENED with
// phase `requested`. Marc's session decision (approve / defer / modify)
// emits the subsequent terminal event via the close-out path.
//
// Author: Helena (Chief Risk Officer, governance) — via Scrooge dispatch

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";
import { readRootRenderBody } from "./lib/root-render-filing-guard";

const DECISION_ID = "D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21";
const RECORD_ID = "record:documents:helena:mr-1-fx-ipv-tolerance-recalibration:2026-05-21";

const body = readRootRenderBody({
  scriptTag: "record-d-mr-1-fx-ipv-tolerance-recal",
  docName: "2026-05-21_helena_mr-1-fx-ipv-tolerance-recalibration.md",
  recordId: "record:documents:helena:mr-1-fx-ipv-tolerance-recalibration:2026-05-21",
  documentHash: "blake3:aefbda6792c30638b0a081b030da8a6a87794b80d5e3b280fb76a747ec45e22f",
});
const asOf = clock.now();

// ---------------------------------------------------------------------------
// 1. RecordFiled — file the analysis document into the documents register.
//    Idempotent via the (registerKey, recordId) pair — if the record already
//    exists the helper returns the existing eventId without re-emit.
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
      "brief:helena:mr-1-fx-ipv-tolerance-recalibration-after-pr-694:2026-05-21",
      "D-BRC-INTERIM-MR-1-FX",
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
      title:
        "MR-1-FX IPV Tolerance Recalibration after PR #694 (inverse-pair direction sanity-check)",
      path: "2026-05-21_helena_mr-1-fx-ipv-tolerance-recalibration.md",
      category: "cro-calibration-analysis",
      author: "Helena (Chief Risk Officer, governance)",
      date: "2026-05-21",
    },
  },
  asOf,
);

const documentHash = filedResult.documentHash;

// ---------------------------------------------------------------------------
// 2. Decision{phase:"requested"} — open the recalibration card.
//    Idempotent via buildDecisionsRegister check.
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
      title: "IPV tolerance recalibration on MR-1-FX FX-spot book after PR #694 inverse-pair fix",
      category: "risk",
      recommendation:
        "Move the IPV pct tolerance from a flat 0.25% to per-pair bands: USD/ZAR 0.55%, ZAR/USD 0.55% (mirror), GBP/ZAR 0.40%, EUR/ZAR 0.40%, ZAR/EUR 0.40%, ZAR/GBP 0.40%, all other pairs 0.40% (default). Keep the ZAR 50,000 absolute threshold unchanged. Enter a 10-trading-day shadow window before the new bands become binding for limit purposes. CEO concurrence sought to set the build-phase precedent for IPV recalibrations under interim CEO authority in the absence of a constituted Board Risk Committee. The MR-1-FX RAS schedule values are unchanged — IPV is a measurement-quality enabler, not a standalone RAS line. Five substrate gaps surfaced (G-IPV-1 through G-IPV-5) and carried as roadmap items, not blockers.",
      rationale:
        "PR #694 (fix(accounting): inverse-pair direction sanity-check on settlement-rate lookup) closed a latent inversion bug in post-trade-lifecycle.ts and the realised-P&L backfill (ZAR +201m of bogus realised P&L corrected down to ZAR +7.65m; net P&L now ZAR -1.06m). The downstream consequence for the IPV recon pipeline is that primary (open-er-api) and secondary (twelve-data) feeds are now compared on the corrected directional basis; before PR #694, both feeds passed through the same buggy inverse path so the spread between them was systematically compressed by the shared error. After PR #694, 17 IpvExceptionRaised events fired in a single day across USD/ZAR (4), GBP/ZAR (4), and ZAR/USD (9 — inverse-quote duplicates of USD/ZAR). Per-pair driver attribution: USD/ZAR observed 37.9 bps; GBP/ZAR 22.5 bps; ZAR/USD 37.8 bps (mirror). Driver split: (a) genuine free-tier-feed dispersion ~20-25 bps dominant; (b) overnight-primary-to-intraday-secondary timing skew ~5-15 bps; (c) tolerance band calibrated for tier-1 feeds (Reuters WM-Fix / Bloomberg BFIX) we do not yet have. None of the 17 exceptions reflects a desk mismark, data-quality finding, or process failure. Recalibration uses empirical p95 (n=17) plus a 15 bps (breaching pairs) or 10 bps (default) engineering buffer to absorb sampling error and timing-skew residual. Per-pair structure rather than flat-band preserves IPV sensitivity on pairs where the data supports tighter bands. The 10-day shadow window guards against over-aggressive recalibration. Auto-revisit triggers: WS-MTM-PROD-FX-FEED landing (tier-1 feeds), BRC constitution, any RAS Tier-1 MR-1-FX breach traced to IPV.",
      sourceDocHashes: [documentHash],
      citations: [
        "D-RAS",
        "D-BRC-INTERIM-MR-1-FX",
        "Policies/pricing-policy-v1.md",
        "Policies/market-risk-policy-v1.md",
        "Policies/valuation-policy-v1.md",
        "prototype/platform/markets/ipv-tolerance.ts",
        "brief:helena:mr-1-fx-ipv-tolerance-recalibration-after-pr-694:2026-05-21",
        RECORD_ID,
      ],
      recordedVia: "scrooge:session-delegation",
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
