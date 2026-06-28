// scripts/decisions/record-d-adc-risk-treasury-audit-seat-upgrade.ts
//
// Records D-ADC-RISK-TREASURY-AUDIT-SEAT-UPGRADE — Marc's in-session approval
// (2026-06-26, "yes") to prioritise populating §18–20 (authoritative knowledge
// base & sources / domain-truth validation / premise-challenge duty) for the
// risk, treasury, ALM and audit seats — binding BCBS standards (Basel III/IV,
// FRTB, SA-CCR, IRRBB, LCR/NSFR, BCBS 239/223/248/319/d365) as domain-truth
// oracles — AHEAD of the recon:agent-spec-domain-competence gate ratcheting
// from `warn` to `fail`.
//
// No new policy: D-AGENT-DOMAIN-COMPETENCE already binds every seat to §18–20.
// Today BCBS is live only in Camille (CFO) and Owen (CoSec) §18; the seats whose
// entire mandate IS Basel (Rohan, Helena, Kai, Ravi, Eitan, Nadia, Thandiwe,
// plus op-resilience/data seats Rashida, Devon, Anya, Atlas) list BCBS only in
// §4 prose, not in the binding oracle layer — so nothing yet forces their work
// to validate against BCBS as domain-truth. This decision sequences the grooming
// of those seats and authorises the dispatches under the no-pause rule.
//
// Idempotent: fixed asOf. NO Date.now() / new Date().
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-ADC-RISK-TREASURY-AUDIT-SEAT-UPGRADE";
const REQUESTED_ASOF = "2026-06-26T13:00:00.000Z";
const ASOF = "2026-06-26T13:01:00.000Z";

const TITLE =
  "Domain-competence §18–20 upgrade — bind BCBS as domain-truth oracle for the risk, treasury, ALM and audit seats ahead of the recon gate ratcheting to fail";

const CITATIONS = [
  "D-AGENT-DOMAIN-COMPETENCE",
  "Procedures/by-policy/agent-domain-competence-framework.md",
  "Team/_agent-spec-template.md",
  "Principles/2-single-graph-discipline.md",
];

const RECOMMENDATION =
  "Commission the risk/treasury/audit cohort of the agent domain-competence grooming: " +
  "populate sections 18 (authoritative knowledge base & sources), 19 (domain-truth " +
  "validation) and 20 (premise-challenge duty) for the seats whose mandate rests on BCBS, " +
  "binding the applicable Basel standards as domain-truth oracles rather than §4 prose. " +
  "Priority seats and their BCBS oracle sets: Rohan (Risk eng. — Basel III/IV, FRTB, SA-CCR, " +
  "IRRBB, LCR, NSFR, CVA); Helena (CRO — Corporate Governance Principles, operational-resilience, " +
  "sound liquidity-risk management); Kai (Trading — FRTB market-risk framework); Ravi (ALM quant — " +
  "BCBS 248 intraday, 319 repricing gap, d365 IRRBB shocks); Eitan (Treasurer — BCBS 248 intraday, " +
  "CFP/EWI); Nadia (Model validation — BCBS 239, Corporate Governance Principles, SS 1/23); " +
  "Thandiwe (CAE — BCBS 223 Internal Audit Function in Banks); plus the operational-resilience / " +
  "risk-data-aggregation tail Rashida (CISO), Devon (COO), Anya (Data), Atlas (Platform — BCBS 239). " +
  "Each seat upgrade carries a citation to the canonical BCBS text and is validated against the " +
  "domain-truth oracle, not internal consistency. Sequence highest-exposure first (Rohan, Helena, " +
  "Ravi, Kai, Eitan) so the Basel-bearing risk stack lands before recon:agent-spec-domain-competence " +
  "lifts from warn to fail. Dispatch under the no-pause rule in isolated worktrees.";

requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: "Opens the decision lifecycle (2026-06-26).",
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
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale:
      "Marc approved in-session 2026-06-26 ('yes') after Scrooge's domain-competence coverage " +
      "check found that BCBS is an eligible §18 oracle under D-AGENT-DOMAIN-COMPETENCE but is " +
      "live in only 2 of 27 seats (Camille CFO, Owen CoSec). The seats whose entire mandate is " +
      "Basel — Rohan, Helena, Kai, Ravi, Eitan, Nadia, Thandiwe and the op-resilience/data tail — " +
      "list BCBS only in §4 prose, not in the binding §18–20 oracle layer, so nothing yet forces " +
      "their work to validate against BCBS as domain-truth. This is the larger exposure given the " +
      "FX-premise failures that motivated the programme. recon:agent-spec-domain-competence asserts " +
      "§18–20 at warn today and ratchets to fail once grooming closes; this decision sequences the " +
      "Basel-bearing cohort to land ahead of that ratchet. No new policy — the framework already " +
      "binds; this tracks the cohort and authorises the dispatches.",
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(`Recorded ${DECISION_ID}: event ${result.eventId}`);
