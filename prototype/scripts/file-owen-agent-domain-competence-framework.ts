// scripts/file-owen-agent-domain-competence-framework.ts
//
// One-shot RMS Phase 3 filing for Owen's agent domain-competence framework
// procedure (PROC-GOV-ADC-01). Emits a RecordFiled event so the Documents
// register holds a canonical reference to the governance procedure
// (events-first; no markdown-without-event — the procedure markdown is the
// render, the event is the record).
//
// Idempotent: skips if a RecordFiled with this recordId already exists.
//
// Authority: D-AGENT-DOMAIN-COMPETENCE (CEO-approved 2026-06-25);
//            D-RMS-PHASE-3 (active).
// Author: Owen (Company Secretary, governance)

import "../platform/event-store/resolve-event-db-boot";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:owen:agent-domain-competence-framework:2026-06-25";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-agent-domain-competence-framework] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

/** Walk up from this module to the repo root (CLAUDE.md anchor). */
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("file-agent-domain-competence-framework: cannot locate repo root (CLAUDE.md not found)");
}

const DOC_PATH = "Procedures/by-policy/agent-domain-competence-framework.md";
const absPath = resolve(findRepoRoot(import.meta.dir), DOC_PATH);
if (!existsSync(absPath)) {
  console.error(`[file-agent-domain-competence-framework] ${DOC_PATH} not found at ${absPath}.`);
  process.exit(1);
}
const body = readFileSync(absPath, "utf8");

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      // Governance / procedure records — director-decision-grade retention.
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-AGENT-DOMAIN-COMPETENCE", "D-RMS-PHASE-3"],
    actor: {
      type: "service",
      id: "agent:owen:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "Agent domain-competence framework (PROC-GOV-ADC-01)",
      path: DOC_PATH,
      category: "procedure",
      author: "Owen (Company Secretary, governance)",
      date: "2026-06-25",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      recordId: RECORD_ID,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
