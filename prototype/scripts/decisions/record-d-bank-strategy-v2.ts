// scripts/decisions/record-d-bank-strategy-v2.ts
//
// Records D-BANK-STRATEGY-V2 — Marc's in-session approval (2026-06-11) of
// Hoz Bank Institutional Strategy v2 (Policies/bank-strategy-v2.md) as the
// bank's operative strategy.
//
// LINEAGE:
//   - v1 (Policies/bank-strategy-v1.md, 2026-05-22) was DRAFT only;
//     D-BANK-STRATEGY-V1 was never recorded. v2 supersedes it.
//   - v2 authored via PR #1236 (Owen, Company Secretary, governance —
//     brief:owen:bank-strategy-v2-refresh-typed-scope-appendix:2026-06-11):
//     refresh to 2026-06-11 substrate state + new §13 machine-extractable
//     typed-scope appendix (ACT-* mandated activities, per-desk product
//     permissions, SEG-* client segments, EXCL-* exclusions, jurisdictions,
//     STERM-* defined terms).
//   - CEO review pass (Marc, in-session 2026-06-11): "remove JSE Cash equity,
//     remove trading mandate forward cap" — applied via PR #1239 (Owen,
//     brief:owen:bank-strategy-v2-ceo-revisions-remove-jse-cash-e:2026-06-11):
//     JSE cash equity removed from scope (EXCL-LISTED-EQUITY; Hoz Securities
//     pathway deferred; ORG-MK-09 closure suspended; Trading Mandate v1.1
//     aligned) and FX forward tenor cap removed (tenor governed by typed
//     product scope T+2..T+N + RAS market-risk lines).
//   - Approved by Marc in-session 2026-06-11 ("approve strategy").
//
// Companion: D-STRATEGY-GRAPH-LAYER (approved 2026-06-11) authorises the
// strategy-layer ontology extension; the WS-STRATEGY-TRACEABILITY engineering
// train (typed register + StrategyVersionAdopted event anchored to THIS
// decision) is held pending Marc's go ("stop and do nothing further" after
// approval).
//
// Category: strategic / CEO-reserved (strategy document approval).
//
// Idempotent: fixed asOf so re-runs dedup on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument, on
// behalf of Marc (CEO).

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-11T12:40:00.000Z";
const ASOF = "2026-06-11T12:41:00.000Z";

const TITLE =
  "Hoz Bank Institutional Strategy v2 — operative strategy with machine-extractable typed-scope appendix (JSE cash equity removed; FX forward tenor cap removed)";

const CITATIONS = [
  "Policies/bank-strategy-v2.md",
  "Policies/trading-mandate-v1.md",
  "D-STRATEGY-GRAPH-LAYER",
  "D-RAS-STRUCTURED-REGISTER",
  "D-REGULATORY-LIBRARY-V1",
  "D-FX-OTC-NPA-SCOPE-EXPANSION",
  "urn:reg:za:banks-act-94-1990",
];

const RECOMMENDATION =
  "Approve Policies/bank-strategy-v2.md as the bank's operative institutional " +
  "strategy, superseding the never-approved v1 DRAFT. v2 brings the strategy " +
  "current to 2026-06-11 (typed OTC vanilla FX umbrella scope, 17-line structured " +
  "RAS register, Treasurer governance substrate, regulatory library v1 with 15/15 " +
  "active sources and 6 regulator objective layers, live LCR/NSFR and RWA engines) " +
  "and adds the §13 machine-extractable typed-scope appendix: 8 mandated business " +
  "activities (ACT-TRADE-FX/BOND/OTC-IRD, ACT-CLIENT-ONBOARD/CATEGORISE, " +
  "ACT-BANK-DEPOSIT wholesale-only/PAYMENT/NOSTRO), per-desk product permissions, " +
  "4 institutional client segments (SEG-INST-ASSET-MANAGER, SEG-CORP-TREASURY, " +
  "SEG-BANK-BROKER-DEALER, SEG-INTL-INSTITUTIONAL), 10 exclusions (incl. " +
  "EXCL-RETAIL-CLIENT, EXCL-PROP-TRADING, EXCL-NPS-DIRECT, EXCL-FX-OPTION, " +
  "EXCL-LISTED-EQUITY), ZA-only jurisdiction, and 18 STERM-* defined terms. " +
  "Per CEO review (2026-06-11): JSE cash equity is removed from scope " +
  "(ACT-TRADE-EQUITY not mandated; listed-equity family reserved with zero " +
  "permissions; Hoz Securities Limited JSE-membership pathway deferred; ORG-MK-09 " +
  "closure suspended; Trading Mandate aligned at v1.1) and the FX outright-forward " +
  "tenor cap is removed (tenor governed by the typed product scope T+2..T+N and " +
  "RAS market-risk appetite lines). §13 is the source the typed strategy register " +
  "(prototype/platform/strategy/register.ts, follow-on PR under " +
  "WS-STRATEGY-TRACEABILITY) encodes 1:1.";

const RATIONALE =
  "The bank operated without an approved strategy: v1 remained DRAFT from " +
  "2026-05-22 and predated three weeks of substrate and governance progress. " +
  "Marc's directive (2026-06-11): the business plan defines what the business " +
  "intends to do and must drive regulation applicability, policy requirements, " +
  "and NPA flow, traceable through definitive defined terms, with client base " +
  "and activities defining the scope of regulations, NPAs, policies, and " +
  "procedures. v2 makes the strategy's scope machine-extractable (§13) so the " +
  "strategy can head the Principle-2 chain as a typed, queryable artefact. " +
  "Approved by Marc in-session 2026-06-11 after a CEO review pass whose two " +
  "revisions (JSE cash equity removal; FX forward tenor-cap removal) were " +
  "applied in PR #1239 and verified at diff level.";

requestDecision(
  {
    decisionId: "D-BANK-STRATEGY-V2",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale: "Strategy v2 submitted for CEO approval; opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: "D-BANK-STRATEGY-V2",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(JSON.stringify({ ok: true, result }, null, 2));
