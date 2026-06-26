// scripts/file-ias-21-licensing-flag.ts
//
// WS-FX-IFRS-REVIEW-FOUNDATION — licensing flag for the build-phase ingestion of
// IFRS-Foundation © standard text (D-FX-IFRS-REVIEW-FOUNDATION, CEO-approved
// 2026-06-26; Engineering Charter cmd 5 — no silent deferral).
//
// The IAS 21 / IFRS 9 / IFRS 13 paragraph text the FX domain-truth oracle
// ingests is © IFRS Foundation. Build-phase ingestion is permitted (Marc
// approved fuller ingestion in-session) but carries a LICENCE-DAY PROCUREMENT
// OBLIGATION: before the bank operates as a licensed institution it must hold a
// valid IFRS Foundation licence / subscription for the standard text it
// reproduces. That obligation is recorded HERE as a typed, content-addressed
// register row (RMS Document register, category `substrate-gap`) — events-first,
// not a code comment — so it is a tracked item Vera can audit and the licence-day
// readiness gate can assert, never a silent deferral.
//
// Idempotent on a stable recordId (re-filing the same body is a no-op on hash).
// Replay-safe; wired into ci:migrate so a clean CI store carries the flag.
//
// Authority: D-FX-IFRS-REVIEW-FOUNDATION (CEO-approved 2026-06-26);
//   D-REGULATORY-LIBRARY-V1; Engineering Charter cmd 5. Principle 1; Principle 2.
// Author: Bea (Accounting & financial reporting engineer, engineering).

// D-CROSS-WORKTREE-EVENT-STORE-SYNC — import FIRST so the shared-store resolver
// mutates BANK_EVENT_DB / BANK_DOCUMENT_STORE before composition resolves paths.
import "./dispatch/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const ENTITY = "LE-ZA-HOZ-BANK";
const RECORD_ID = "substrate-gap:ifrs-foundation-text-licence-day-procurement";

const BODY = `# SUBSTRATE GAP — IFRS Foundation standard-text licence (licence-day procurement)

**Tracked under:** D-FX-IFRS-REVIEW-FOUNDATION (CEO-approved 2026-06-26)
**Owner:** Bea (Accounting & financial-reporting engineer, engineering)
**Governance overseer:** Camille (Chief Financial Officer, governance)
**Status:** OPEN — build-phase permitted; licence-day blocking
**Charter command:** 5 (no silent deferral)

## What was deferred

The IFRS domain-truth oracle (the \`*-structured.json\` source-docs under
\`Regulations/INTL/IASB/source-docs/\` — IAS 21, IFRS 9, IFRS 13, IFRS 7) ingests
verbatim paragraph text that is © IFRS Foundation. Build-phase ingestion is
approved for engineering use (Marc, in-session, 2026-06-26) so the FX-vanilla
NPA accounting review can validate against IFRS truth rather than mere internal
consistency.

## Licence-day obligation

Before the bank operates as a SARB-licensed institution it MUST hold a valid
IFRS Foundation licence / subscription covering the reproduction and internal
use of the standard text it ingests, OR replace verbatim text with a licensed
copy / official summary. This is a procurement + legal obligation, not an
engineering task; it is gated to licence-day (consistent with the operating
model — no real external counsel / procurement spend until required).

## Resolution criteria

- An IFRS Foundation licence / subscription is procured and recorded; OR
- The ingested verbatim text is replaced by licensed text under that subscription.

Until then this register row remains OPEN. It is an input to the pre-licence
go-live readiness gate (Saskia's substrate) and is auditable by Vera.
`;

function main(): void {
  const result = recordFiled(
    {
      recordId: RECORD_ID,
      registerKey: "documents",
      body: BODY,
      classification: "engineering-seat",
      retention: {
        citationRef: "D-FX-IFRS-REVIEW-FOUNDATION",
        minimumYears: 7,
        archivalTier: "archive",
      },
      metadata: {
        title: "Substrate gap — IFRS Foundation standard-text licence (licence-day procurement)",
        path: "Regulations/INTL/IASB/source-docs/",
        category: "substrate-gap",
        author: "Bea (Accounting & financial-reporting engineer, engineering)",
        date: "2026-06-26",
      },
      citations: ["D-FX-IFRS-REVIEW-FOUNDATION", "D-REGULATORY-LIBRARY-V1"],
      actor: { type: "service", id: "agent:bea" },
      entity: ENTITY,
    },
    clock.now(),
  );

  console.log(
    JSON.stringify({
      ok: true,
      script: "file-ias-21-licensing-flag",
      recordId: RECORD_ID,
      eventId: result.eventId,
      documentHash: result.documentHash,
      filed: result.isNewDocument,
    }),
  );
}

main();
