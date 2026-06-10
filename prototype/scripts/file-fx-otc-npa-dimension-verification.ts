// scripts/file-fx-otc-npa-dimension-verification.ts
//
// RMS Phase 3 filing for the FX OTC umbrella NPA per-dimension verification pass.
// Records the grounded finding that the FX pre-trade gateway enforces only
// counterparty-eligibility (the other 6 checks are approve-always stubs), so no
// further dimensions were promoted to implementation-attested this pass.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/file-fx-otc-npa-dimension-verification.ts
//
// Authority: D-RMS-PHASE-3 (active); D-FX-OTC-NPA-SCOPE-EXPANSION.
// Author: Scrooge-coordinated session for marc@tgv.co.za.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(WORKTREE_ROOT, "2026-06-10_scrooge_fx-otc-npa-dimension-verification.md");

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:scrooge:fx-otc-npa-dimension-verification:2026-06-10",
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RMS-PHASE-3", "D-FX-OTC-NPA-SCOPE-EXPANSION", "D-NEW-PRODUCT-APPROVAL-POLICY"],
    actor: { type: "service", id: "agent:scrooge:chief-of-staff" },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "FX OTC umbrella NPA — per-dimension verification pass",
      path: "2026-06-10_scrooge_fx-otc-npa-dimension-verification.md",
      category: "npa-dimension-verification",
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
      isNew: result.isNewDocument,
    },
    null,
    2,
  ),
);
