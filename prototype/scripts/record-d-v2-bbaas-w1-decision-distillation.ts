// scripts/record-d-v2-bbaas-w1-decision-distillation.ts
//
// Records D-V2-BBAAS-W1-DECISION-DISTILLATION — Marc's in-session approval
// (2026-06-12, "continue next" on the session-1 ideas paper) of session 2 of
// the WS-V2-BBAAS analysis:
//   (1) The seven-workstream analysis map proposed in the session-1 ideas
//       paper §10 (record:documents:atlas:v2-bbaas-initial-ideas-paper:
//       2026-06-12) is chartered as the working plan: W1 decision
//       distillation; W2 domain/BIAN mapping + data-store ownership; W3
//       tenancy architecture; W4 model-library extraction; W5 SAP/Salesforce
//       platform-model research; W6 commercial/market analysis; W7 regulatory
//       perimeter of the vendor. Workstreams dispatch sequentially as the
//       analysis matures; only W1 is dispatched under this decision.
//   (2) W1 (decision distillation) is approved and dispatched: classify every
//       approved Decision event in the canonical log (~256 as of 2026-06-12)
//       as foundational (defines the backbone, holds for any tenant) vs
//       directional (this bank's choices) vs obsolete (superseded/overtaken),
//       via a new typed event `DecisionDistilled` { decisionId, class,
//       rationale, citations }, folding into a projection-derived
//       core-knowledge-base register, with a coverage recon gate
//       (advisory until the pass is complete, then enforcing).
//   (3) Authority: the register is Company Secretary (CoSec) territory per
//       the decision-authority routing table; the Company Secretary seat
//       (Owen, governance) owns the classification content, with the
//       substrate (event type, projection, recon) built in the same run.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording
// instrument (recordedVia: scrooge:session-delegation); Marc is the
// authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-V2-BBAAS-ANALYSIS-LAUNCH;
// D-DECISIONS-FRAMEWORK-REDESIGN.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-12T08:54:00.000Z";
const APP = "2026-06-12T08:56:00.000Z";

const base = {
  decisionId: "D-V2-BBAAS-W1-DECISION-DISTILLATION",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "WS-V2-BBAAS session 2: charter the W1–W7 analysis map; dispatch W1 decision distillation (DecisionDistilled event + core-knowledge-base register)",
  category: "governance" as const,
  recommendation:
    "Charter the seven-workstream analysis map from the session-1 ideas paper (W1 decision distillation; W2 domain/BIAN mapping; W3 tenancy architecture; W4 model-library extraction; W5 SAP/Salesforce platform research; W6 commercial/market; W7 vendor regulatory perimeter) and dispatch W1 now: classify all approved Decision events (~256) as foundational vs directional vs obsolete via a new DecisionDistilled typed event, fold into a projection-derived core-knowledge-base register owned by the Company Secretary seat (Owen, governance), and stand up a recon:decision-distillation-coverage gate (advisory until the pass completes, then enforcing). W2+ dispatch sequentially as the analysis matures; none are dispatched under this decision.",
  rationale:
    "Marc's 'continue next' on the session-1 ideas paper adopts its recommended sequencing: W1 is cheap, read-only against the decision history, parallelisable, and its output — the platform's distilled 'constitution + case law' — sharpens every other workstream's understanding of what the shared core actually is. The classification seam (foundational vs directional) is the same seam the whole BBaaS proposition rests on (shared core vs tenant-specific), so distilling it first de-risks W2/W3. The register is CoSec authority per the decision-authority routing table.",
  sourceDocHashes: [],
  citations: [
    "D-V2-BBAAS-ANALYSIS-LAUNCH",
    "D-RMS-PHASE-3",
    "Principles/1-events-are-truth.md",
    "Principles/2-single-graph-discipline.md",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
