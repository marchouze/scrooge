// scripts/file-scrooge-v2-ui-visibility-audit.ts
//
// One-shot RMS Phase 3 filing for Scrooge's V2 UI visibility audit against
// D-V2-UI-OVERSIGHT-STANDARD. Emits a RecordFiled event so the Documents
// register holds the canonical finding: 44 of 59 V2 pages are prose/skeleton
// while the backing projections already compute — a systemic breach of the
// human-oversight standard. Backs the remediation workstream commissioned by
// D-V2-UI-VISIBILITY-REMEDIATION.
//
// Idempotent: fixed asOf. NO Date.now() / new Date().
// Authority: D-V2-UI-OVERSIGHT-STANDARD; D-RMS-PHASE-3.
// Author: Scrooge (Chief of Staff / Orchestrator).

import "../platform/event-store/resolve-event-db-boot";

import { recordFiled } from "../platform/records";

const RECORD_ID = "record:scrooge:v2-ui-visibility-audit:2026-06-22";
const ASOF = "2026-06-22T08:00:00.000Z";

const body = `# V2 UI visibility audit — gaps vs D-V2-UI-OVERSIGHT-STANDARD

**Author:** Scrooge (Chief of Staff / Orchestrator)
**Date:** 2026-06-22
**Authority:** D-V2-UI-OVERSIGHT-STANDARD (CEO 2026-06-17); D-RMS-PHASE-3
**Trigger:** CEO instruction (2026-06-22) — "look at all v2 pages and surface gaps
where existing functionality is not being displayed."

## Headline

Of **59** V2 pages, only **15** are wired to data. **44 are prose/skeleton
mockups** — and for most the backing projection already computes. The standard
("every surface gives the human visibility into the AI function behind it … no
silent gaps") is met for the **governance / compliance / operations-schema**
clusters and effectively unbuilt across **finance, treasury, markets, risk,
audit, security, data, commercial**. The financial/regulatory oversight core is a
static shell on top of live projections.

The 15 wired pages: the governance register cluster (decisions, policies,
procedures, npa + detail pages), compliance (regulations, obligations + detail),
and operations (schemas, schema, substrate).

## The pointed case — capital (D-CAPITAL-ASSET-CLASS-V1)

The Capital FIL + BA-700 capital-composition fold (merged #1491) computes
**CET1 = Tier 1 = own funds = R300m**. The page meant to show it,
\`finance/capital.html\`, declares \`data-provenance-content="none"\` and makes
zero fetch calls. The capital injection is invisible in the UI, and the standard
explicitly lists "capital / CET-1 … with formula + constituents" as a required
slice — so the very decision and the very work just merged are in breach.

## Gaps by class

### Class A — backend + API already served + page exists, just not wired
- \`markets/fx.html\` — the whole \`/api/v2/markets/fx/*\` suite (summary, risk, VaR,
  blotter, counterparties, npa, rejections, headroom — 7 served endpoints)
  returns data; the page is empty. Pure wiring.

### Class B — backend computes + V2 page exists, but no /api/v2 route and not wired (~25 pages)
- finance/capital.html → capital-metrics.ts + ba700-capital-composition.ts (R300m)
- finance/pnl.html → daily-pnl-v2.ts; finance/gl.html → gl-projection-v2.ts
  (trial balance, accounts); finance/returns.html → BA-700/BA-320 generators
  (no in-UI report viewer)
- treasury/lcr.html → computeLCR; treasury/nsfr.html → computeNSFR;
  treasury/alm.html → alm-positions-v2.ts
- risk/market.html → market-risk-measure + fx/var; risk/credit.html → SA-CCR /
  CCR-EAD; risk/operational.html → op-loss/RWA; risk/appetite.html → RAS
  limit-utilisation; risk/validation.html → model-tier-discipline
- audit/recon.html → recon inventory; audit/findings.html → risk register
- operations/agents.html → agent register/runs; operations/evals.html →
  agent-performance
- governance/briefs.html + workstreams.html, data/register.html + dsars.html,
  commercial/*, security/posture.html + threats.html, compliance/returns.html +
  applicability.html

### Class C — backend computes but no page and no route (fully hidden)
- Leverage ratio, RWA decomposition, IRRBB (EVE / NII / repricing gap),
  collateral inventory, FTP portfolio
- Period-close returns generated but never viewable: BA-100, BA-300, BA-330,
  BA-400, climate / CMS / conduct
- Full multi-cluster limit utilisation (only B3/FX exposed), obligation/regulation
  provision tree
- RMS registers stuck on the V1 boundary (/api/rms?registerKey=…): correspondence,
  agent-runs, documents, feedback — no /api/v2 lift
- Escalations / fleet / autonomy — V1 routes only

## Remediation sequence (each its own PR, built to the standard)

1. **Capital slice** — /api/v2/finance/capital (composition fold + formula +
   constituents) → wire finance/capital.html. Closes the loop on the merged work.
2. **FX wiring** (Class A) — API already served; page-wiring only, near-zero risk.
3. **Financial-metrics sweep** — LCR/NSFR/ALM, market/credit/op risk, GL/P&L.
4. **Reports viewer + Registers + Errors/Decision-Required** — remaining standard
   slices.

Commissioned as WS-V2-UI-VISIBILITY-REMEDIATION under D-V2-UI-VISIBILITY-REMEDIATION.
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "ceo-only",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-V2-UI-OVERSIGHT-STANDARD", "D-RMS-PHASE-3", "D-CAPITAL-ASSET-CLASS-V1"],
    actor: {
      type: "service",
      id: "agent:scrooge:chief-of-staff",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 UI visibility audit — gaps vs D-V2-UI-OVERSIGHT-STANDARD",
      path: "scrooge/v2-ui-visibility-audit-2026-06-22.md",
      category: "engineering-finding",
      author: "Scrooge (Chief of Staff / Orchestrator)",
      date: "2026-06-22",
    },
  },
  ASOF,
);

console.log(`Filed ${RECORD_ID}: event ${result.eventId} doc ${result.documentHash}`);
