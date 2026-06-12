// scripts/file-atlas-v2-bbaas-w9-fil.ts
//
// One-shot RMS Phase 3 filing for Atlas's W9 Financial Instrument Language
// (FIL) design paper for the v2 "Bank Backbone as a Service" (BBaaS)
// repositioning. Emits a RecordFiled event so the Documents register holds
// the canonical paper. The body is embedded inline (Phase 4 —
// D-RMS-PHASE-4 — made the content-addressed document store the canonical
// home; no in-tree root render is created). Idempotent — skips if already
// filed.
//
// Authority: D-V2-BBAAS-W9-FIL (CEO-approved 2026-06-12);
// D-RMS-PHASE-3 (active).
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-bbaas-w9-fil:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-v2-bbaas-w9-fil] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 BBaaS — W9 Financial Instrument Language: kernel, facets, standards stance, conformance, migration

**Author:** Atlas (Core banking platform architect, engineering) — Substrate Architect seat,
covering Risk Engineer scope (Rohan, risk engineer, engineering)
**Date:** 2026-06-12
**Authority:** D-V2-BBAAS-W9-FIL (CEO-approved 2026-06-12); builds on the W2 domain map
(record:documents:atlas:v2-bbaas-w2-domain-map:2026-06-12), the W4 model library
(record:documents:rohan:v2-bbaas-w4-model-library:2026-06-12), the W8 agent-learning
architecture (record:documents:atlas:v2-bbaas-w8-agent-learning:2026-06-12), and the
blueprint (record:documents:atlas:v2-bbaas-blueprint:2026-06-12)
**Audience:** Marc (CEO)
**Status:** Analysis only. Nothing here builds the language; §9 names the slices,
§10 names the decisions, and both are Marc's to take or refuse.
**CEO direction taken as given (verbatim, in-session 2026-06-12):** "another key structural
component needs to be a comprehensive Financial Instrument Language that is developed that
all aspects of the application will consistently use (like an object-oriented methodology)."

---

## 1. Why a language, not a data model

(section body below — see full text)

## 2. Gap analysis of v1 — the divergent instrument vocabularies

(section body below — see full text)

## 3. The language design

TBD

## 4. External-standards stance

TBD

## 5. Integration contracts

TBD

## 6. Tenant extension rules (clean-core)

TBD

## 7. FIL-conformance recon

TBD

## 8. Migration path

TBD

## 9. Build slices (named, not built)

TBD

## 10. Open questions + named decisions

TBD
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RMS-PHASE-3", "D-V2-BBAAS-W9-FIL"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 BBaaS — W9 Financial Instrument Language: kernel, facets, standards stance, conformance, migration",
      path: "2026-06-12_atlas_v2-bbaas-w9-fil.md",
      category: "strategy-analysis",
      author: "Atlas (Core banking platform architect, engineering)",
      date: "2026-06-12",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
