// scripts/record-d-v2-bbaas-w4-w7-dispatch.ts
//
// Records D-V2-BBAAS-W4-W7-DISPATCH — Marc's in-session approval (2026-06-12,
// "continue W4-7") of dispatching the four remaining workstreams of the
// chartered WS-V2-BBAAS analysis map in parallel:
//   - W4 — model-library extraction: binding-contract spec for tenant-agnostic
//     citable computational models (RWA, IRRBB, Leverage, LCR/NSFR, SA-CCR,
//     CVA, ECL); survey of the existing v1 engines with extraction-readiness
//     assessment; pilot extraction DESIGN (candidate: SA-CCR or LCR) — the
//     pilot build itself is a named follow-on decision, not built here.
//     Seat: Risk Engineer (Rohan, risk engineer, engineering).
//   - W5 — SAP/Salesforce platform-model research: clean-core governance
//     mechanics, metadata-driven multi-tenancy internals, governor-limit
//     analogues, editions/tiers, ISV/extension ecosystems, cautionary cases;
//     each mapped to a concrete BBaaS design implication.
//     Seat: Research (PAX, role researcher).
//   - W6 — commercial/market analysis: tier/pricing hypotheses (per-domain /
//     per-seat / per-recon-coverage), competitor landscape (core-banking SaaS
//     and RegTech), packaging against the W2 25-domain map, candidate market
//     entry sequencing. Seat: Research (PAX, role researcher).
//   - W7 — regulatory perimeter of the vendor: how a compliance/backbone-SaaS
//     provider sits under subscriber-bank outsourcing regulation (PA
//     directives/guidance on material outsourcing and cloud/offshoring,
//     Joint Standards), platform-entity structure options, what subscriber
//     regulators will demand (audit rights, residency, exit plans),
//     competition-law and POPIA bounds on cross-tenant learning.
//     Seats: Company Secretary (Owen, governance) + Legal scope (Imani).
// All four deliver analysis papers via RecordFiled, landed by PR; no builds.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording
// instrument (recordedVia: scrooge:session-delegation); Marc is the
// authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-V2-BBAAS-W1-DECISION-
// DISTILLATION (map charter); D-V2-BBAAS-ANALYSIS-LAUNCH.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-12T11:13:00.000Z";
const APP = "2026-06-12T11:14:00.000Z";

const base = {
  decisionId: "D-V2-BBAAS-W4-W7-DISPATCH",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "WS-V2-BBAAS: dispatch the four remaining chartered workstreams in parallel — W4 model-library extraction (Risk Engineer), W5 SAP/Salesforce platform research (Research), W6 commercial/market analysis (Research), W7 vendor regulatory perimeter (CoSec + Legal)",
  category: "governance" as const,
  recommendation:
    "Dispatch W4-W7 in parallel, completing the chartered analysis map: W4 delivers the model binding-contract spec (consumed events + reference data, implemented provisions with graph citations, emitted events), an extraction-readiness survey of the existing v1 engines (RWA, IRRBB, Leverage, LCR/NSFR, SA-CCR, CVA, ECL), and a pilot extraction design with the build as a named follow-on decision; W5 delivers the SAP clean-core / Salesforce metadata-tenancy deep-dive with each finding mapped to a concrete BBaaS design implication; W6 delivers tier/pricing hypotheses against the W2 25-domain map, the competitor landscape across core-banking SaaS and RegTech, and market-entry sequencing; W7 delivers the vendor-perimeter analysis — subscriber-bank outsourcing obligations, platform-entity structure options, subscriber-regulator demands, and competition-law/POPIA bounds on cross-tenant learning. All four are analysis papers filed via RecordFiled and landed by PR; no platform builds under this decision.",
  rationale:
    "W1-W3 and W8 are complete: the decision corpus is distilled (259 classifications, coverage recon enforcing), the 25-domain map and tenancy recommendation stand, and the agent-learning architecture is recorded. The remaining four workstreams are mutually disjoint research/analysis tracks the session-1 paper sequenced to run in parallel after the structural pair. Completing them closes the chartered map and assembles the full input set for the v2 blueprint decisions (tenancy, repo strategy, slice-1 builds, commercial posture). Marc's 'continue W4-7' adopts this sequencing.",
  sourceDocHashes: [],
  citations: [
    "D-V2-BBAAS-ANALYSIS-LAUNCH",
    "D-V2-BBAAS-W1-DECISION-DISTILLATION",
    "D-V2-BBAAS-W2-W3-DISPATCH",
    "D-V2-BBAAS-W8-AGENT-LEARNING",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
