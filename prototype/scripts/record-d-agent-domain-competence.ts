// scripts/record-d-agent-domain-competence.ts
//
// Records one CEO decision approved by Marc in-session 2026-06-25 via Scrooge
// session-delegation (Marc is the authorising principal; Scrooge is the recording
// instrument — recordedVia: scrooge:session-delegation).
//
//   D-AGENT-DOMAIN-COMPETENCE — Stand up a standing programme to make every agent
//   genuinely expert in its domain, so the bank stops shipping consistent-but-wrong
//   work (e.g. the FX accounting errors: structural recons passed; the accounting
//   MODEL was wrong, and a wrong premise propagated down the dispatch chain
//   unchallenged). Six defence-in-depth layers; accounting (Bea) is the pilot seat.
//
// Idempotent — skips if already approved.

import "../platform/event-store/resolve-event-db-boot";
import { eventStore } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

const APP_AT = "2026-06-25T00:00:00.000Z";
const D = "D-AGENT-DOMAIN-COMPETENCE";

function alreadyApproved(decisionId: string): boolean {
  return [...eventStore.replay({ type: "Decision" })].some((e) => {
    const p = e.payload as { decisionId?: string; phase?: string };
    return p.decisionId === decisionId && p.phase === "approved";
  });
}

if (alreadyApproved(D)) {
  console.log(`[record] ${D} already approved — skipping.`);
} else {
  const r = recordDecision(
    {
      decisionId: D,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      category: "engineering",
      title:
        "Agent domain-competence programme — knowledge bases, domain-truth oracles, model-before-code, adversarial domain review + premise-challenge duty, lessons-to-gates, calibration",
      recommendation:
        "Approved as a standing programme. Diagnosis: the FX accounting errors were not engineering failures (code compiled, balanced, passed every structural recon) — they were DOMAIN-MODEL failures (the wrong accounting concept faithfully implemented), and a wrong premise propagated unchallenged down the dispatch chain (the settlement-realisation error originated in the orchestrator's brief, not the executing agent). Structural gates validate internal consistency, not domain truth; no layer held authoritative domain knowledge to check against; no agent had the duty/standing to reject a wrong premise. Six defence-in-depth layers: (1) AUTHORITATIVE KNOWLEDGE BASES per seat — extend the D-REGULATORY-LIBRARY-V1 acquire/structure/citable-graph pattern from regulations to domain STANDARDS + curated worked examples + decision frameworks (IFRS/IAS for accounting, Basel SA-CCR/FRTB for risk, ISDA/CDM for legal, ACI FX conventions for the desk), bound into each persona spec (sections 7/13) and retrievable by the dispatched agent. (2) DOMAIN-TRUTH ORACLES — alongside structural recons, add domain-invariant gates that encode 'an expert would never do X' (e.g. settling a still-open position cannot realise P&L; FX trade-date legs span >=2 currencies; a realised-P&L account is functional-currency only) plus a golden worked-example library the engines must reproduce (catches consistent-but-wrong). (3) MODEL-BEFORE-CODE — standardise cited domain-analysis -> recorded Decision -> implementation; the MODEL is the reviewed artifact, derived from authoritative sources with worked examples + stated invariants. (4) ADVERSARIAL DOMAIN REVIEW + PREMISE-CHALLENGE DUTY — a reviewer-class run that attacks the model against the standards (distinct from code review); and an explicit duty in every spec that an agent must validate a brief's domain premise and push back when wrong — on domain questions the seat's authority OUTRANKS the brief, including a brief from the orchestrator. (5) LESSONS-TO-GATES — every caught domain error becomes a golden oracle case + a domain-invariant recon + a knowledge-base note, so it cannot recur (harden-only ratchet for knowledge). (6) CALIBRATION — periodic competency exams of worked cases per seat; a seat that fails is improved before it is trusted with that scope. Reuse: the regulatory-library acquisition pipeline, the recon harness, the Principle-2 single graph, the persona-spec template, the reviewer->decider sync primitive, and Vera's third-line remit (extended from process assurance to domain-correctness assurance). Sequencing: (a) framework first — persona-spec-template additions (knowledge-base binding, premise-challenge duty, domain-truth validation) + the golden-oracle/domain-invariant-gate harness pattern; (b) accounting PILOT — Bea's IFRS/IAS knowledge base (principles + decision frameworks + worked examples, clause-cited) + the accounting domain-invariant gates + golden oracle, seeded from the now-corrected FX model (D-FX-TRADE-DATE-FVTPL-OBS + D-FX-PNL-FCY-EXPOSURE-REVALUATION), dispatched once that fix lands; (c) generalise to the other expertise seats + stand up calibration. The pilot must be the piece that would have caught all three FX errors.",
      rationale:
        "Decided interactively 2026-06-25. As an AI-native bank the workforce is autonomous agents (Principle 6); competence in each domain is therefore an institutional capability that must be engineered into the substrate, not assumed from a persona blurb. The FX accounting episode showed the failure mode precisely: faithful engineering of an incorrect domain model, undetected because our gates prove consistency not correctness, and a wrong premise carried unchallenged from the orchestrator. The human analogue is hiring qualified professionals with professional skepticism + audit; the AI-native analogue is encoding the qualification (knowledge bases + frameworks), the skepticism (premise-challenge duty + adversarial domain review), the invariants (domain-truth oracles/gates), and the institutional learning loop (lessons-to-gates + calibration). This sits under the Engineering Charter and Principle 2 (single citable graph) and extends Vera's third line to domain-correctness assurance.",
      citations: [],
      sourceDocHashes: [],
      recordedVia: "scrooge:session-delegation",
    },
    APP_AT,
  );
  console.log(`[record] ${D} approved — ${r.eventId}`);
}

const stillOpen = [...eventStore.replay({ type: "Decision" })].some((e) => {
  const p = e.payload as { decisionId?: string; phase?: string };
  return p.decisionId === D && p.phase === "requested";
});
console.log(`[verify] ${D} open(requested) present: ${stillOpen}`);
