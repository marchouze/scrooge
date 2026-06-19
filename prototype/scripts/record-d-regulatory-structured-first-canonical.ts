// scripts/record-d-regulatory-structured-first-canonical.ts
//
// Records D-REGULATORY-STRUCTURED-FIRST-CANONICAL — Marc's in-session approval
// (2026-06-18, via plan approval) that the structured document
// (`Regulations/<Regulator>/source-docs/<slug>-structured.json`) is the CANONICAL
// content of record for every regulatory source, and the golden-source PDF (where
// present) is PROVENANCE only — not the content of record.
//
// Context: investigating sourceless obligations surfaced rrb-structured.json as a
// "blocked stub awaiting a PDF". That framing was wrong: rrb is real hand-authored
// structured content (same artefact class as popia/fic-act/cs-1/2/3-2018/excon —
// 16 docs with no PDF at all). The library is already structured-first; this
// decision makes it explicit and canonical, and authorises a unified storage +
// display model that (1) collapses the divergent V1/V2 text-assembly paths onto a
// single normalizer, (2) surfaces per-section content completeness honestly, and
// (3) drives summary-only / heading-only sections toward full verbatim via a
// ratcheting backfill (summary-only is a gap to close, not a permanent tier).
//
// No gate requires a PDF; structured-first is not gate-blocked. Builds on
// D-REGULATORY-LIBRARY-V1 (storage/traceability) and D-REGULATORY-VERBATIM-
// RENDERING-V1 (full verbatim for all, no rendering gate).
//
// Idempotent on (decisionId, phase, as_of) with FIXED instants. Scrooge is the
// recording instrument (recordedVia: scrooge:session-delegation); Marc is the
// authorizing principal. Build-phase platform/schema decision → CEO authority,
// `engineering` category (decision-authority-routing table; build-phase norm).
//
// Authority: CLAUDE.md §"Session delegation"; D-ENGINEERING-INTEGRITY-CHARTER;
//   D-REGULATORY-LIBRARY-V1; D-REGULATORY-VERBATIM-RENDERING-V1;
//   Principles/1-events-are-truth.md; Principles/2-single-graph-discipline.md.
// Author: Scrooge (Chief of Staff / orchestrator).
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED = "2026-06-18T11:55:00.000Z";
const APPROVED = "2026-06-18T12:00:00.000Z";

const base = {
  decisionId: "D-REGULATORY-STRUCTURED-FIRST-CANONICAL",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Structured document is the canonical content of record for regulatory sources; PDF is provenance only; unified store + display model",
  category: "engineering" as const,
  recommendation:
    "Adopt structured-first as canonical: the per-source `<slug>-structured.json` is the content of record for every regulatory source; the golden-source PDF (when present) is provenance only and is never required by any gate. Authorise a unified storage + display model: (1) one canonical provision-tree normalizer in platform/regulatory/structured-doc-loader.ts (NormalizedProvision with a single verbatimText + textSource + completeness tier) consumed by both the V1 reader and the V2 regulations views, replacing the divergent collectText (V1) and flattenSubsections (V2) assemblies and the duplicated BCBS enrichment — provision ids from ensureProvisionIds preserved byte-for-byte; (2) per-section content completeness (verbatim | summary | heading-only | enriched) surfaced in the reader and aggregated per-source in _source-coverage.json (derived authoringPath + contentCompleteness, no new authored schema state beyond typing the on-disk `summary?` field); (3) a ratcheting advisory `summary-only-sections` detector on recon:regulatory-source-extract-quality whose allowlist only ever shrinks as backfill replaces summary content with full verbatim. Summary-only / heading-only sections are a gap to close (backfill to full verbatim where a real source exists), not a permanent accepted tier.",
  rationale:
    "The library is already structured-first in practice (16 docs have no PDF at all; rrb is hand-authored content with a later-stamped provenance hash) but this was implicit, producing two defects: a real display-divergence bug (the same provision renders differently via V1 vs V2 because two text-assembly paths fold the tree differently) and summary-blindness (the on-disk `summary` field is typed/read by no code, so rrb's 31 summary sections render blank while the char-floor quality gate passes — false confidence). Making structured-first canonical and unifying on one normalizer fixes the divergence the same way PR #1429 fixed the section-ref normalizers, and a per-section completeness model makes the rrb-class gap visible and drives it to closure rather than hiding it. No event-store state changes except this decision; the model is pure read-side (Principle 1) over a single citable graph (Principle 2).",
  sourceDocHashes: [],
  citations: [
    "D-ENGINEERING-INTEGRITY-CHARTER",
    "D-REGULATORY-LIBRARY-V1",
    "D-REGULATORY-VERBATIM-RENDERING-V1",
    "Principles/1-events-are-truth.md",
    "Principles/2-single-graph-discipline.md",
  ],
  recordedVia: "scrooge:session-delegation",
};

requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);

console.log(
  JSON.stringify(
    { ok: true, eventId: r.eventId, decisionId: "D-REGULATORY-STRUCTURED-FIRST-CANONICAL" },
    null,
    2,
  ),
);
