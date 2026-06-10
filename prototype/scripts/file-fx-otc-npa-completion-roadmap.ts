// scripts/file-fx-otc-npa-completion-roadmap.ts
//
// One-shot RMS Phase 3 filing for the FX OTC umbrella NPA attestation completion
// roadmap (Part D of D-FX-OTC-NPA-SCOPE-EXPANSION). Emits a RecordFiled event so
// the Documents register holds a canonical reference to the deliverable.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/file-fx-otc-npa-completion-roadmap.ts
//
// Authority: D-RMS-PHASE-3 (active); D-FX-OTC-NPA-SCOPE-EXPANSION (2026-06-10).
// Author: Scrooge-coordinated session for marc@tgv.co.za.

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { readRootRenderOrExit } from "./lib/root-render-filing-guard";

const body = readRootRenderOrExit({
  scriptTag: "file-fx-otc-npa-completion-roadmap",
  docName: "2026-06-10_scrooge_fx-otc-npa-attestation-completion-roadmap.md",
  recordId: "record:documents:scrooge:fx-otc-npa-attestation-completion-roadmap:2026-06-10",
  documentHash: "blake3:da580e2385545770706af36f59335baecfe9e1c34a152f6cc435c5377d42fd53",
});

const result = recordFiled(
  {
    recordId: "record:documents:scrooge:fx-otc-npa-attestation-completion-roadmap:2026-06-10",
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RMS-PHASE-3", "D-FX-OTC-NPA-SCOPE-EXPANSION", "D-NEW-PRODUCT-APPROVAL-POLICY"],
    actor: {
      type: "service",
      id: "agent:scrooge:chief-of-staff",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "FX OTC umbrella NPA — attestation completion roadmap",
      path: "2026-06-10_scrooge_fx-otc-npa-attestation-completion-roadmap.md",
      category: "npa-completion-roadmap",
      author: "Scrooge (Chief of Staff)",
      date: "2026-06-10",
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
