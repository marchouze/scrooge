// scripts/record-d-fil-framework-unification.ts
//
// Records D-FIL-FRAMEWORK-UNIFICATION — Marc's in-session approval
// (2026-06-12) of consolidating W4 (model library) and W9 (Financial
// Instrument Language) under one framework.
//
// Scope approved:
//   (1) The W4/W9 split was chronological, not architectural: FIL defines
//       the nouns (taxonomy, composition, lifecycle, facet interfaces); the
//       model library defines the verbs (computations over instruments);
//       W9 already specifies model inputs as FIL facet requirements. Two
//       specifications of the same boundary will drift (two versioning
//       schemes, two conformance gates) — the same divergence class the W9
//       gap analysis catalogued in v1.
//   (2) Consolidation: one **FIL Framework** = FIL-Core (taxonomy /
//       composition / lifecycle) + FIL-Facets (the interfaces) + FIL-Models
//       (the model library as versioned, citable facet IMPLEMENTATIONS) +
//       one conformance recon family + one versioning scheme. The pending
//       named decisions D-FIL-KERNEL-V1, D-FIL-CDM-ALIGNMENT-STANCE, and
//       D-MODEL-BINDING-CONTRACT-V1 merge into a single D-FIL-FRAMEWORK-V1
//       (named for CEO approval; not auto-approved by this decision).
//   (3) Governance carve-out: model-RISK management (independent
//       validation, exam sets, change approval) remains a distinct plane —
//       Risk Engineer seat (Rohan, risk engineer, engineering) owns
//       validation/exams; the Substrate Architect seat owns the language;
//       domain seats own implementations.
//   (4) Slice-map consequence: S0 absorbs the framework skeleton; S-FIL-2
//       and S7 merge (facets + first model implementation — SA-CCR — as the
//       first cross-package cutover under the revised repo verdict).
//   (5) Session deliverable: a consolidation-spec paper (Substrate
//       Architect authoring, Risk Engineer scope folded in) filed via
//       RecordFiled and landed by PR; no engine code changes.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording
// instrument (recordedVia: scrooge:session-delegation); Marc is the
// authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-V2-BBAAS-W9-FIL;
// D-V2-BBAAS-W4-W7-DISPATCH; D-V2-REPO-STRATEGY-REEXAMINATION.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-12T17:04:00.000Z";
const APP = "2026-06-12T17:06:00.000Z";

const base = {
  decisionId: "D-FIL-FRAMEWORK-UNIFICATION",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Consolidate W4 (model library) and W9 (Financial Instrument Language) into one FIL Framework — facets as interfaces, models as their versioned citable implementations; model-risk governance stays a distinct plane",
  category: "governance" as const,
  recommendation:
    "Unify the W4 binding-contract spec and the W9 language spec under one FIL Framework: FIL-Core (taxonomy, composition algebra, lifecycle event families) + FIL-Facets (the typed interfaces every layer binds to) + FIL-Models (the model library re-stated as versioned, citable implementations of facets over taxonomy scopes) + one conformance recon family + one versioning scheme. Merge the pending decisions D-FIL-KERNEL-V1, D-FIL-CDM-ALIGNMENT-STANCE, and D-MODEL-BINDING-CONTRACT-V1 into a single D-FIL-FRAMEWORK-V1 named for CEO approval. Update the slice map: S0 absorbs the framework skeleton; S-FIL-2 and S7 merge so the SA-CCR pilot lands as the first FIL model implementing RiskMeasurable and the first cross-package cutover. Keep model-risk governance (independent validation, exam sets, change approval) a separate accountability plane: Risk Engineer seat owns validation; Substrate Architect owns the language; domain seats own implementations. Dispatch a consolidation-spec paper recording the field-by-field contract mapping.",
  rationale:
    "Marc asked why W4 and W9 are separate and whether one framework should house them. Assessment: the split reflects the order the CEO directions arrived in, not the architecture — a facet is an interface and a model is a registered implementation of it, so W4's binding contract and W9's facet interface are two specifications of the same boundary. Kept separate they drift into exactly the multi-vocabulary divergence the W9 gap analysis measured in v1 (ten instrument vocabularies, the same trade described seven ways). Unifying the framework while separating the governance planes mirrors the bank's standing engineering-vs-governance distinction and makes the Wave-2 SA-CCR pilot a single coherent slice.",
  sourceDocHashes: [],
  citations: [
    "D-V2-BBAAS-W9-FIL",
    "D-V2-BBAAS-W4-W7-DISPATCH",
    "D-V2-REPO-STRATEGY-REEXAMINATION",
    "Principles/2-single-graph-discipline.md",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
