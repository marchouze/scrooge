// scripts/record-d-v2-bbaas-w9-fil.ts
//
// Records D-V2-BBAAS-W9-FIL — Marc's in-session approval (2026-06-12) of
// adding W9 (Financial Instrument Language) to the WS-V2-BBAAS analysis and
// dispatching its design paper.
//
// Scope approved:
//   (1) A comprehensive Financial Instrument Language (FIL) is a key
//       structural component of v2: one formal, versioned language for
//       financial instruments that ALL aspects of the application use
//       consistently — in the manner of an object-oriented core library.
//       Taxonomy and composition, lifecycle, and the typed interfaces every
//       layer binds to: valuation, accounting treatment, regulatory
//       classification, risk measures, posture conditioning (W8), returns
//       cells, and the obligations graph.
//   (2) FIL is the keystone the completed workstreams implicitly assume:
//       W2 binds domains to FINOS CDM / FIBO / ISO 20022; W4's model
//       binding contracts declare consumed instrument data; W8 conditions
//       applicability on products held — none defines the shared instrument
//       type system. v1 half-speaks CDM on the markets side while the GL,
//       returns, risk engines, and obligations layers each use their own
//       instrument vocabulary; FIL unifies them.
//   (3) Session deliverable: the W9 design paper (Substrate Architect seat
//       authoring, Risk Engineer scope included), filed via RecordFiled and
//       landed by PR. Build slices are named in the paper, not built.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording
// instrument (recordedVia: scrooge:session-delegation); Marc is the
// authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-V2-BBAAS-ANALYSIS-LAUNCH;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-12T14:59:00.000Z";
const APP = "2026-06-12T15:01:00.000Z";

const base = {
  decisionId: "D-V2-BBAAS-W9-FIL",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "WS-V2-BBAAS: charter W9 — a comprehensive Financial Instrument Language (FIL) used consistently by every layer — and dispatch its design paper",
  category: "governance" as const,
  recommendation:
    "Add W9 to the analysis and dispatch its design paper: one formal, versioned Financial Instrument Language — instrument taxonomy and composition (building on the FINOS CDM layer v1 already uses for product composition), lifecycle event families, and the typed interfaces every application layer binds to (valuation, accounting treatment / IFRS classification, regulatory classification incl. Basel asset classes, risk-measure production, W8 posture conditioning, returns-cell mapping, obligations-graph linkage). FIL plays the role of an object-oriented core library: every domain speaks instruments in FIL or not at all, enforced by recon. The paper covers: gap analysis of v1's fragmented instrument vocabularies; the language design (kernel vs facets); the external-standards stance (CDM as composition backbone, FIBO for semantics, ISO 20022 for messages — adopt/extend/diverge per area with rationale); how FIL slots into the W2 domain map, W4 model contracts, and W8 posture register; tenant extension rules (clean-core: tenants instantiate and configure instruments, never fork the language); migration path for v1's existing products/positions; build slices and named decisions.",
  rationale:
    "Marc identified FIL as a key structural component: without one instrument language, every layer re-describes instruments and consistency depends on convention rather than types. The completed workstreams each assume such a language exists (W2 ontology bindings, W4 consumed-data contracts, W8 products-held posture facts); defining it once, versioned and recon-enforced, is what makes the domain boundaries real contracts and the model library composable across tenants. v1's CDM product-composition layer proves the approach and seeds the kernel.",
  sourceDocHashes: [],
  citations: [
    "D-V2-BBAAS-ANALYSIS-LAUNCH",
    "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
    "D-V2-BBAAS-W2-W3-DISPATCH",
    "Principles/2-single-graph-discipline.md",
    "Principles/5-multi-currency-entity-country.md",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
