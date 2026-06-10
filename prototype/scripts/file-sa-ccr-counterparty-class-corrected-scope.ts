// scripts/file-sa-ccr-counterparty-class-corrected-scope.ts
//
// RMS Phase 3 filing for the grounded correction of backlog task_4edabfa7
// (SA-CCR per-counterparty-class). SA-CCR EAD is correctly class-agnostic
// (CRE52); the real gaps are (A) FX/IRS SA-CCR EAD not wired into CreditRWA and
// (B) no authoritative counterparty Basel-classification — a CRO methodology +
// data decision, not improvised.
//
// Run: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/file-sa-ccr-counterparty-class-corrected-scope.ts
// Authority: D-RMS-PHASE-3; D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL.
// Author: Scrooge-coordinated session for marc@tgv.co.za.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";
import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const DOC = resolve(
  import.meta.dir,
  "../../2026-06-10_scrooge_sa-ccr-counterparty-class-corrected-scope.md",
);
const result = recordFiled(
  {
    recordId: "record:documents:scrooge:sa-ccr-counterparty-class-corrected-scope:2026-06-10",
    registerKey: "documents",
    body: readFileSync(DOC, "utf8"),
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RMS-PHASE-3", "D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL", "BCBS-SA-CCR-CRE52"],
    actor: { type: "service", id: "agent:scrooge:chief-of-staff" },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "SA-CCR per-counterparty-class — corrected scope",
      path: "2026-06-10_scrooge_sa-ccr-counterparty-class-corrected-scope.md",
      category: "risk-methodology-finding",
      author: "Scrooge (Chief of Staff)",
      date: "2026-06-10",
    },
  },
  clock.now(),
);
console.log(
  JSON.stringify({ ok: true, eventId: result.eventId, hash: result.documentHash }, null, 2),
);
