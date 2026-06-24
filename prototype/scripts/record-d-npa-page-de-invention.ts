// scripts/record-d-npa-page-de-invention.ts
//
// Records D-NPA-PAGE-DE-INVENTION — Marc's in-session approval (2026-06-23)
// that the V2 NPA product-detail page must surface only ACTUAL functionality /
// planned behaviour sourced from the real substrate, never hand-maintained
// "invented" static lists, and must honestly highlight gaps.
//
// Trigger: review of http://localhost:3010/v2/governance/npa-product.html
//   ?id=prd:bank:fx:otc-vanilla found the "Lifecycle event journal" section
//   built from a hand-maintained static `POSTING_RULE_INDEX`
//   (dashboard/products-detail.ts:450) — a stale duplicate (incl. a row flagged
//   DEPRECATED 2026-05-20) of the real POSTING_RULE_REGISTRY that the
//   "Accounting treatment" section three sections down already reads correctly.
//   The static map made the page's only gap signal ("no posting rule") untrust-
//   worthy. The product fixtures also still carry the stale V1 entity id
//   LE-BANK-SA (canonical: LE-ZA-HOZ-BANK), surviving PR #1205's event-payload
//   backfill because the fixtures are TS source the recon gate never scans.
//
// Scope approved (full anti-invention — items 1–4), delivered in PR #1521:
//   (1) Delete `POSTING_RULE_INDEX`; rebuild the lifecycle-event journal from the
//       canonical POSTING_RULE_REGISTRY (v2-core/posting-rules/registry.ts) via
//       findEntriesForEventType. Real ruleId / IFRS conditionDetail / lifecycle
//       stage / module; "no posting rule" rendered only when the registry
//       genuinely has no entry. Collapses the two posting-rule descriptions onto
//       one truthful source.
//   (2) Validate DIMENSION_METADATA.triggeredBy / .emits against the real
//       event-type registry; any name that is not a registered event type
//       renders as a flagged gap, not a silent assertion of functionality.
//   (3) Flip the 7 baseline product fixtures + the synthesiseProductFromProposal
//       fallback from LE-BANK-SA to the canonical LE-ZA-HOZ-BANK, sourced from a
//       single exported CANONICAL_LEGAL_ENTITY_ID constant; extend
//       recon:no-legacy-le-identity to scan source trees, not just event payloads.
//   (4) Add recon:npa-page-no-invented-functionality asserting the page asserts
//       no event type / posting rule that is not either real-in-registry or
//       surfaced-as-a-gap — the harden that prevents invented lists regressing.
//
// Out of scope (Marc, 2026-06-23): a real event-sourced per-product timeline.
//
// Idempotent on (decisionId, phase, as_of) with FIXED instants so the
// ci:migrate replay is byte-stable. Scrooge is the recording instrument
// (recordedVia: scrooge:session-delegation); Marc is the authorizing principal.
// Engineering build decision in the build phase → CEO authority, `engineering`
// category (decision-authority-routing table).
//
// Authority: CLAUDE.md §"Session delegation"; D-ENGINEERING-INTEGRITY-CHARTER
//   (cmd 1 root-cause, cmd 4 source-don't-hardcode, cmd 5 no-silent-deferral);
//   D-V2-UI-VISIBILITY-REMEDIATION; D-V2-UI-OVERSIGHT-STANDARD;
//   Principles/1-events-are-truth.md; Principles/2-single-graph-discipline.md.
// Author: Atlas (Core banking platform architect, engineering).
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED = "2026-06-23T14:50:00.000Z";
const APPROVED = "2026-06-23T14:52:00.000Z";

const base = {
  decisionId: "D-NPA-PAGE-DE-INVENTION",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "NPA product-detail page surfaces only real-substrate functionality; no invented static lists; highlight gaps",
  category: "engineering" as const,
  recommendation:
    "Remove all hand-maintained 'invented' static lists from the V2 NPA product-detail page (dashboard/products-detail.ts) and source every functionality claim from the real substrate, honestly flagging gaps. (1) Delete POSTING_RULE_INDEX and rebuild the lifecycle-event journal from the canonical POSTING_RULE_REGISTRY via findEntriesForEventType — real ruleId/IFRS-detail/stage/module, 'no posting rule' only when the registry truly has none. (2) Validate DIMENSION_METADATA.triggeredBy/.emits against the real event-type registry; render any unregistered event-type name as a flagged gap, not a silent claim. (3) Flip the 7 baseline product fixtures + the synthesiseProductFromProposal fallback from LE-BANK-SA to canonical LE-ZA-HOZ-BANK via a single exported CANONICAL_LEGAL_ENTITY_ID constant, and extend recon:no-legacy-le-identity to scan source trees (not only event payloads). (4) Add a recon gate asserting the page asserts no event type or posting rule that is not either real-in-registry or surfaced-as-a-gap. Defer a real event-sourced per-product timeline.",
  rationale:
    "The page is the bank's canonical product-functionality surface, but its 'Lifecycle event journal' was built from POSTING_RULE_INDEX — a hand-authored static map (including a row flagged DEPRECATED 2026-05-20) duplicating the real POSTING_RULE_REGISTRY that the adjacent 'Accounting treatment' section already reads correctly. Describing the same posting rules twice from two sources — one real, one invented — let the page show 'mapped' for rules that may not exist and made its only gap signal ('no posting rule') untrustworthy. Separately, the baseline product fixtures still hardcode the stale V1 entity id LE-BANK-SA; PR #1205's backfill rewrote event payloads only, and recon:no-legacy-le-identity scans payload text only, so the fixtures — TS source compiled straight into the view — surfaced the stale id past both. Sourcing every claim from the real registry/event-type registry/desk register/model declarations (the pattern the lenses and accounting-treatment sections already follow), plus a recon gate that fails on any asserted-but-unbacked event type or rule, makes the page show actual/planned behaviour and prevents invented static lists regressing in. Aligns with the Engineering Charter (root-cause, source-don't-hardcode, no-silent-deferral) and Principle 1 (events/registries are truth; the page is a render).",
  sourceDocHashes: [],
  citations: [
    "D-ENGINEERING-INTEGRITY-CHARTER",
    "D-V2-UI-VISIBILITY-REMEDIATION",
    "Principles/1-events-are-truth.md",
    "Principles/2-single-graph-discipline.md",
  ],
  recordedVia: "scrooge:session-delegation",
};

requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);

console.log(
  JSON.stringify({ ok: true, eventId: r.eventId, decisionId: "D-NPA-PAGE-DE-INVENTION" }, null, 2),
);
