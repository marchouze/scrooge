// scripts/file-imani-g9-isda-vs-bilateral-fx.ts
//
// One-shot RMS Phase 3 filing for Imani's G-9 close decision on
// ISDA vs bilateral FX Master Agreement for FX-spot-only counterparties.
// Emits a RecordFiled event into the event store so the Documents register
// holds a canonical reference to the deliverable.
//
// Authority: D-RMS-PHASE-3 (active); WS-MARKET-RISK-PROCEDURES;
//            brief:imani:g-9-close-isda-vs-bilateral-fx-master-for-fx-spo:2026-05-20
// Author:    Imani (Chief Legal Counsel, governance / legal-entity &
//            clause-library agent)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
const DOC_PATH = resolve(
  WORKTREE_ROOT,
  "2026-05-20_imani_g9-isda-vs-bilateral-fx-master-for-spot.md",
);

const body = readFileSync(DOC_PATH, "utf8");

const result = recordFiled(
  {
    recordId: "record:documents:imani:g9-isda-vs-bilateral-fx-master-for-spot:2026-05-20",
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "WS-MARKET-RISK-PROCEDURES",
      "brief:imani:g-9-close-isda-vs-bilateral-fx-master-for-fx-spo:2026-05-20",
    ],
    actor: {
      type: "service",
      id: "agent:imani:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "G-9 Close — ISDA vs Bilateral FX Master Agreement for FX-Spot-Only Counterparties (Controlled-Launch)",
      path: "2026-05-20_imani_g9-isda-vs-bilateral-fx-master-for-spot.md",
      category: "chief-legal-counsel-decision",
      author: "Imani (Chief Legal Counsel, governance / legal-entity & clause-library agent)",
      date: "2026-05-20",
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
