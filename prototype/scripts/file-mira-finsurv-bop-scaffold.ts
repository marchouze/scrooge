// scripts/file-mira-finsurv-bop-scaffold.ts
//
// Events-first filing for the FinSurv BoP-category reporting scaffold
// (D-FX-OTC-CLOSURE-BACKLOG Phase C10):
//
//   1. RecordFiled — files PROC-FINSURV-BOP-01
//      (Procedures/by-policy/finsurv-reporting.md) into the Documents register,
//      so the procedure markdown is a RENDER of a typed event, never
//      markdown-without-event (Principle 1 / RMS Phase 3).
//
//   2. SubstrateAlert — the licence-day binding gap: the LIVE per-transaction
//      SARB FinSurv submission (BOPCUS/BOPDIR) is NOT built in the build phase.
//      Recorded as a typed, tracked gap (named trigger = licence-day) rather
//      than a hidden TODO (Engineering Charter #3 no-concealment, #5
//      no-silent-deferral).
//
// Idempotent: skips the RecordFiled if this recordId is already filed; skips the
// SubstrateAlert if this alertId is already emitted.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (Phase C10); D-FX-AD-STATUS; D-RMS-PHASE-3.
// Author: Mira (Compliance / RegTech engineer, engineering).
//   Governance owner: Zara (Chief Compliance Officer, governance).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { makeSubstrateAlert } from "../platform/event-store/event-types/platform";
import type { EventStore } from "../platform/event-store/store";
import { recordFiled } from "../platform/records";

const store = eventStore as unknown as EventStore;

// ---------------------------------------------------------------------------
// 1. File PROC-FINSURV-BOP-01 (RecordFiled)
// ---------------------------------------------------------------------------

const RECORD_ID = "record:documents:mira:proc-finsurv-bop-01-finsurv-reporting:2026-06-19";

const alreadyFiled = [...store.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-finsurv-bop-scaffold] ${RECORD_ID} already filed — skipping RecordFiled.`);
} else {
  const WORKTREE_ROOT = resolve(import.meta.dir, "../../");
  const DOC_PATH = resolve(WORKTREE_ROOT, "Procedures/by-policy/finsurv-reporting.md");
  const body = readFileSync(DOC_PATH, "utf8");

  const result = recordFiled(
    {
      recordId: RECORD_ID,
      registerKey: "documents",
      body,
      classification: "governance-seat",
      retention: {
        citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
        minimumYears: 7,
        archivalTier: "hot" as const,
      },
      citations: [
        "D-FX-OTC-CLOSURE-BACKLOG",
        "D-FX-AD-STATUS",
        "D-M4-FX-SUB-DECISIONS",
        "D-RMS-PHASE-3",
        "ORG-FX-FIN-01",
        "ORG-FX-FIN-08",
      ],
      actor: {
        type: "service",
        id: "agent:mira:compliance",
      },
      entity: "LE-ZA-HOZ-BANK",
      metadata: {
        title: "PROC-FINSURV-BOP-01 — SARB FinSurv per-transaction BoP-category reporting",
        path: "Procedures/by-policy/finsurv-reporting.md",
        category: "operating-procedure",
        author: "Mira (Compliance / RegTech engineer, engineering)",
        date: "2026-06-19",
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
}

// ---------------------------------------------------------------------------
// 2. Track the licence-day binding gap (SubstrateAlert)
// ---------------------------------------------------------------------------

const ALERT_ID = "alert:integrity:finsurv-bopcus-live-submission-licence-day";

const alreadyAlerted = [...store.replay({ type: "SubstrateAlert" })].some(
  (e) => (e.payload as { alertId?: string }).alertId === ALERT_ID,
);

if (alreadyAlerted) {
  console.log(`[file-finsurv-bop-scaffold] ${ALERT_ID} already emitted — skipping SubstrateAlert.`);
} else {
  const alert = makeSubstrateAlert({
    asOf: clock.now(),
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:mira:compliance" },
    citations: ["D-FX-OTC-CLOSURE-BACKLOG", "D-FX-AD-STATUS", "PROC-FINSURV-BOP-01"],
    payload: {
      alertId: ALERT_ID,
      alertClass: "integrity",
      agentUrn: "agent:mira",
      severity: "medium",
      details:
        "FinSurv BoP-category reporting (PROC-FINSURV-BOP-01, D-FX-OTC-CLOSURE-BACKLOG Phase C10) is BUILD-PHASE scaffold only. The tagging hook (v2-core/finsurv/bop-category.ts) tags each cross-border FX settlement / NDF-fixing flow with its BoP economic class (ORG-FX-FIN-01..09; Wave-2 10..14 fail-closed) and the read-side projection (platform/markets/regulatory/finsurv-bop-projection.ts) surfaces the reportable rows. NOT built (licence-day-binding): (1) the LIVE per-transaction submission of each reportable row to the SARB FinSurv Reporting System (BOPCUS/BOPDIR) — capability @regulatory/sarb-finsurv-bopcus; trigger = licence-day (Authorised Dealer activation + SARB FinSurv technical onboarding); owner = Mira (Compliance / RegTech engineer, engineering). (2) the precise BOPCUS/BOPDIR numeric category CODE per class — today null on every tag; trigger = external-counsel ratification at the licence gate (blocked-pending-counsel); owner = Imani (Legal-as-code engineer, engineering) + external counsel. This alert is the tracked record of that gap (Engineering-Charter.md #3 no-green-by-concealment, #5 no-silent-deferral) — NOT a hidden TODO.",
    },
  });

  store.append(alert);

  console.log(
    JSON.stringify(
      {
        ok: true,
        alertId: ALERT_ID,
        eventId: alert.event_id,
        alertClass: "integrity",
        severity: "medium",
      },
      null,
      2,
    ),
  );
}
