// scripts/record-d-regulatory-verbatim-rendering.ts
//
// Records D-REGULATORY-VERBATIM-RENDERING-V1 — Marc's in-session approval
// (2026-06-18) of the rendering posture for verbatim regulatory-source text in
// the reader / regulations UIs, including copyright (`applicabilityStatus:
// "transposed"`) instruments such as IFRS 9 / IFRS 7 / IFRS 13.
//
// Context: PR #1428 extracted IFRS 9/7/13 into structured docs (1,107 verbatim
// paragraphs) so their provisions are citable and linkable. The extraction
// itself publishes nothing, but once these provisions are seeded into the
// provision graph the reader surfaces (dashboard/regulation-reader-view.ts and
// the V2 reader dashboard/v2-regulations-view.ts) would render their full
// verbatim text with no copyright gate.
//
// Decision (the fork Marc was asked): for `transposed` (copyright) instruments,
// render FULL VERBATIM uniformly — same as any other source — rather than
// gating to paragraph-ids + obligation-summaries, and rather than deferring the
// graph-seed step. No copyright render-gate is added; the seed/render step for
// IFRS (and other transposed instruments) is unblocked.
//
// IP NOTE (recorded, not suppressed): IFRS content is copyright IFRS Foundation.
// This posture republishes full standard text on a user-facing surface with no
// fair-dealing gate. It is a build-phase decision; Legal (Imani — Legal counsel,
// contracts & legal-entity) should re-confirm the fair-dealing / licensing
// posture before licence-day, when the regulations UI may face external users.
// Captured here as the standing authorisation; revisit at the licence gate.
//
// Idempotent on (decisionId, phase, as_of) with FIXED instants. Scrooge is the
// recording instrument (recordedVia: scrooge:session-delegation); Marc is the
// authorizing principal. Build-phase platform-rendering decision → CEO authority,
// `engineering` category (decision-authority-routing table; build-phase norm).
//
// Authority: CLAUDE.md §"Session delegation"; D-ENGINEERING-INTEGRITY-CHARTER;
//   Principles/2-single-graph-discipline.md. Related: PR #1428 (IFRS extraction),
//   recon:regulatory-source-extract-quality.
// Author: Scrooge (Chief of Staff / orchestrator).
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

// Fixed instants so any replay is byte-stable. The decision-symmetry recon gate
// requires a `requested` phase before the terminal phase — emit both.
const REQUESTED = "2026-06-18T09:55:00.000Z";
const APPROVED = "2026-06-18T10:00:00.000Z";

const base = {
  decisionId: "D-REGULATORY-VERBATIM-RENDERING-V1",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Reader UIs render full verbatim regulatory-source text for all instruments, including copyright (transposed) ones (IFRS 9/7/13)",
  category: "engineering" as const,
  recommendation:
    "The reader / regulations UIs (dashboard/regulation-reader-view.ts and the V2 reader dashboard/v2-regulations-view.ts) render full verbatim section/provision text uniformly for every regulatory source, with NO copyright render-gate keyed on applicabilityStatus. Copyright (transposed) instruments — IFRS 9, IFRS 7, IFRS 13, and any future transposed source — are rendered the same as nationally-adopted instruments. The provision-graph seed step for the newly-extracted IFRS structured docs is therefore unblocked: seeding and verbatim rendering may proceed without a fair-dealing gate.",
  rationale:
    "Marc, asked directly to choose between (a) gating copyright instruments to paragraph-ids + obligation-summaries, (b) rendering full verbatim for all, or (c) deferring the IFRS graph-seed until counsel settles the posture, chose (b): full verbatim for all. The structured extraction already exists internally for traceability and provision-linking; gating the reader would split the rendering path by instrument and reduce the internal utility of the single citable graph (Principle 2). The IP exposure is acknowledged and recorded rather than suppressed: IFRS text is copyright IFRS Foundation and this posture republishes it on a user-facing surface without a fair-dealing gate. As a build-phase decision (no external users yet, no licence), the exposure is bounded; Legal (Imani) re-confirms the fair-dealing/licensing posture before licence-day, when the regulations UI may face external parties.",
  sourceDocHashes: [],
  citations: ["D-ENGINEERING-INTEGRITY-CHARTER", "Principles/2-single-graph-discipline.md"],
  recordedVia: "scrooge:session-delegation",
};

// Symmetric phase chain: requested → approved (idempotent on the fixed instants).
requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);

console.log(
  JSON.stringify(
    { ok: true, eventId: r.eventId, decisionId: "D-REGULATORY-VERBATIM-RENDERING-V1" },
    null,
    2,
  ),
);
