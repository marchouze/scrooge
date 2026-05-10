// scenarios/04-rms-phase-1-roundtrip.ts
//
// D-RMS-PHASE-1 Slice 5 — runnable end-to-end round-trip demo.
//
// Spec: Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md
//   §13 Slice 5; acceptance criterion §7.1 #6.
// Standing authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09); slice
// authorisation D-RMS-PHASE-1-SLICE-5 under the no-pause rule.
//
// Demonstrates the full RMS chain end-to-end:
//
//   T0  AgentBriefIssued    — Scrooge dispatches a brief to Mira
//   T1  AgentRunStarted     — Mira picks up the brief
//   T2  AgentRunCompleted   — Mira finishes; deliverable in document store
//   T3  DecisionRequested   — Mira requests CEO sign-off on the cadence shift
//   T4  CeoDecision         — CEO approves
//   T5  RecordFiled (auto)  — auto-archive handler moves source card +
//                              emits typed RecordFiled
//
// The runner uses an isolated event-store DB, an isolated document-store
// root, and an isolated repo root for the auto-archiver — so the script
// is fully deterministic across repeat runs and never touches real
// `Owner Inbox/` or `Team Inbox/` directories.
//
// IMPORTANT: this file sets `BANK_EVENT_DB` and `BANK_DOCUMENT_STORE_PATH`
// before any imports that resolve the singleton event store / document
// store, so the run-isolation is total. The `bun test` path uses
// `tests/_setup.ts` for the same purpose.
//
// Run:
//   bun run scenarios/04-rms-phase-1-roundtrip.ts
//   bun run scenario:rms-roundtrip
//
// Author: Anya (Data / analytics engineer, engineering — projection-runtime
//          + dashboard derivation curator)
//          · Owen (Company Secretary, governance — records-lifecycle
//          semantics consult)

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Set isolation env vars BEFORE any platform / runtime imports — the
// composition module reads BANK_EVENT_DB at import time. Same pattern
// `tests/_setup.ts` uses to keep the test event store off the canonical
// `.local/event.db`.
const ISOLATED_EVENT_DB_DIR = mkdtempSync(join(tmpdir(), "rms-roundtrip-eventdb-"));
const ISOLATED_DOC_STORE_DIR = mkdtempSync(join(tmpdir(), "rms-roundtrip-docs-"));
process.env.BANK_EVENT_DB = join(ISOLATED_EVENT_DB_DIR, "event.db");
process.env.BANK_DOCUMENT_STORE_PATH = ISOLATED_DOC_STORE_DIR;

// Now safe to import — the singletons resolve to the isolated paths.
import { eventStore } from "../platform/composition";
import { LocalFsDocumentStore } from "../platform/document-store";
import { logger } from "../platform/observability/logger";
import { LocalProjector } from "../platform/projections";
import {
  recordAgentRunCompleted,
  recordAgentRunStarted,
  recordBriefIssued,
  recordDecisionRequested,
} from "../platform/records";
import {
  agentRunsRegisterProjection,
  agentRunsRegisterRows,
  briefsRegisterProjection,
  briefsRegisterRows,
  decisionsRegisterProjection,
  decisionsRegisterRows,
  documentRegisterProjection,
  documentRegisterRows,
} from "../platform/rms-registers";
import scroogeOwnerInboxArchiver from "../runtime/agents/scrooge-owner-inbox-archiver";
import { recordCeoDecision } from "../runtime/decisions/record";
import type { AgentRunContext } from "../runtime/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCENARIO_ID = "rms-phase-1-roundtrip-2026-05-10";
export const SOURCE_LINEAGE = "scenario-runner:04-rms-phase-1-roundtrip";

const SCROOGE_REF = {
  name: "Scrooge",
  position: "Chief of Staff / Orchestrator",
};
const MIRA_REF = {
  name: "Mira",
  position: "Compliance / RegTech engineer",
};

const ENTITY = "BANK-ZA-001";
const SCROOGE_ACTOR = { type: "service" as const, id: "agent:scrooge" };
const MIRA_ACTOR = { type: "service" as const, id: "agent:mira" };

const ENVELOPE_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "D-RMS-PHASE-1"];
const BRIEF_CITATIONS = ["FIC-S42", "MIRA-OBLIGATIONS-REGISTER-V1"];

const BRIEF_ID = "brief:mira:obligations-refresh-roundtrip";
const RUN_ID = "run:mira:obligations-refresh-roundtrip";
const DECISION_ID = "D-RMS-SLICE-5-OBLIGATION-CADENCE-DEMO";
const SOURCE_CARD_FILENAME = "2026-05-10_mira_slice-5-roundtrip-demo.md";

const BRIEF_BODY = [
  "# Brief — refresh FIC obligations cadence (round-trip demo)",
  "",
  "Refresh the FIC obligations register entry for s.42 reporting cadence; the FIC has",
  "issued GN7 update raising cadence from quarterly to monthly. Surface the change as",
  "a CEO-decision card per the standing obligations-register-update workflow.",
  "",
].join("\n");

const DELIVERABLE_BODY = [
  "# Mira — obligations register refresh: FIC s.42 cadence",
  "",
  "Per FIC GN7 update, refresh the cadence cell on the FIC s.42 obligation row from",
  "`quarterly` to `monthly`. Recommend CEO sign-off before the cadence flip lands in",
  "the obligations register.",
  "",
].join("\n");

const RECOMMENDATION_BODY = [
  "# Decision recommendation — D-RMS-SLICE-5-OBLIGATION-CADENCE-DEMO",
  "",
  "Approve cadence shift to monthly per FIC GN7 update.",
  "",
].join("\n");

function decisionCardBody(): string {
  return [
    "---",
    "title: D-RMS-SLICE-5-OBLIGATION-CADENCE-DEMO — round-trip demo card",
    "author: Mira (Compliance / RegTech engineer)",
    "date: 2026-05-10",
    "summary: Slice-5 round-trip demo source card.",
    "decision-required: true",
    `decision-id: ${DECISION_ID}`,
    "decision-category: near-term",
    "decision-for-ceo: Approve cadence shift to monthly per FIC GN7 update.",
    "decision-recommendation: Approve as drafted.",
    "decision-owner: Mira (Compliance / RegTech engineer)",
    "---",
    "",
    "# Round-trip demo source card",
    "",
    "Slice-5 demo body — exists only to exercise the auto-archive handler.",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Step recorders — pure-ish: each emits the typed event + returns a
// summary object for the runner's report.
// ---------------------------------------------------------------------------

export interface StepReport {
  readonly step: string;
  readonly eventType: string;
  readonly eventId: string;
  readonly note: string;
}

function step1AgentBriefIssued(asOf: string, ds: LocalFsDocumentStore): StepReport {
  const r = recordBriefIssued(
    {
      briefId: BRIEF_ID,
      issuedTo: MIRA_REF,
      issuedBy: SCROOGE_REF,
      title: "Refresh FIC obligations cadence (s.42 → monthly)",
      directiveBody: BRIEF_BODY,
      priority: "now",
      expectedOutputs: [
        {
          kind: "decision-card",
          description: "DecisionRequested + CEO sign-off via Decisions Desk",
        },
      ],
      citations: [...ENVELOPE_CITATIONS, ...BRIEF_CITATIONS],
      actor: SCROOGE_ACTOR,
      entity: ENTITY,
    },
    asOf,
    { documentStore: ds },
  );
  return {
    step: "T0",
    eventType: "AgentBriefIssued",
    eventId: r.eventId,
    note: `directiveDocumentHash=${r.documentHash}`,
  };
}

function step2AgentRunStarted(asOf: string, worktree: string): StepReport {
  const r = recordAgentRunStarted(
    {
      runId: RUN_ID,
      briefId: BRIEF_ID,
      agent: MIRA_REF,
      startedAt: asOf,
      substrate: "scrooge-coordinated-in-session",
      worktree,
      citations: [...ENVELOPE_CITATIONS],
      actor: MIRA_ACTOR,
      entity: ENTITY,
    },
    asOf,
  );
  return {
    step: "T1",
    eventType: "AgentRunStarted",
    eventId: r.eventId,
    note: `runId=${RUN_ID}`,
  };
}

function step3AgentRunCompleted(asOf: string, ds: LocalFsDocumentStore): StepReport {
  const r = recordAgentRunCompleted(
    {
      runId: RUN_ID,
      briefId: BRIEF_ID,
      agent: MIRA_REF,
      completedAt: asOf,
      outcome: "delivered",
      deliverableBodies: [DELIVERABLE_BODY],
      substrateGapsSurfaced: [
        "Auto-router for AgentRunCompleted.followOnRoutes → DecisionRequested not yet built (Phase 2 / S8).",
      ],
      deliverableCitations: [...BRIEF_CITATIONS],
      followOnRoutes: [
        {
          kind: "decision",
          target: DECISION_ID,
          directive: "refresh requires CEO sign-off on cadence change",
        },
      ],
      citations: [...ENVELOPE_CITATIONS],
      actor: MIRA_ACTOR,
      entity: ENTITY,
    },
    asOf,
    { documentStore: ds },
  );
  return {
    step: "T2",
    eventType: "AgentRunCompleted",
    eventId: r.eventId,
    note: `deliverableHashes=${r.deliverableDocumentHashes.length}`,
  };
}

function step4DecisionRequested(asOf: string, ds: LocalFsDocumentStore): StepReport {
  const r = recordDecisionRequested(
    {
      decisionId: DECISION_ID,
      title: "Refresh FIC s.42 cadence to monthly",
      category: "near-term",
      owner: MIRA_REF,
      forActor: "CEO",
      decisionForActor: "Approve cadence shift to monthly per FIC GN7.",
      recommendation: {
        stance: "approve",
        reasoning: "FIC GN7 update lifts the cadence floor; monthly is least-effort compliant.",
      },
      sourceDocumentBodies: [RECOMMENDATION_BODY],
      decisionCitations: [...BRIEF_CITATIONS],
      citations: [...ENVELOPE_CITATIONS, ...BRIEF_CITATIONS],
      actor: MIRA_ACTOR,
      entity: ENTITY,
    },
    asOf,
    { documentStore: ds },
  );
  return {
    step: "T3",
    eventType: "DecisionRequested",
    eventId: r.eventId,
    note: `decisionId=${DECISION_ID} forActor=CEO`,
  };
}

function step5CeoDecision(asOf: string, sourceDocRel: string): StepReport {
  const r = recordCeoDecision(
    {
      decisionId: DECISION_ID,
      action: "approve",
      title: "Refresh FIC s.42 cadence to monthly",
      outcome:
        "Approved per Mira's recommendation; cadence shift lands at next FIC reporting tick.",
      actor: "marc@tgv.co.za",
      comment: "downstream dispatch from D-RMS-PHASE-1; cadence change low-risk",
      sourceDoc: sourceDocRel,
      recordedVia: "scenario:04-rms-phase-1-roundtrip",
    },
    asOf,
  );
  return {
    step: "T4",
    eventType: "CeoDecision",
    eventId: r.eventId,
    note: "action=approve",
  };
}

async function step6AutoArchive(
  asOf: string,
  repoRoot: string,
  ownerInboxDir: string,
  ceoEvent: { type: string; payload: Record<string, unknown> },
): Promise<StepReport> {
  const ctx: AgentRunContext = {
    agent: "Scrooge",
    trigger: {
      kind: "event-driven",
      id: "owner-inbox-archiver",
      // Cast through unknown — the scenario synthesises the CeoDecision
      // event shape and the archiver handler operates on the public Event
      // contract; the cast keeps the scenario file from depending on the
      // internal Event-envelope structure.
      triggeringEvents: [ceoEvent as unknown as import("../platform/event-store/types").Event],
    },
    asOf,
    repoRoot,
    ownerInboxDir,
    dryRun: false,
  };
  const r = await scroogeOwnerInboxArchiver(ctx);
  return {
    step: "T5",
    eventType: "RecordFiled",
    eventId: "(auto-archive)",
    note: r.summary,
  };
}

// ---------------------------------------------------------------------------
// Runner — orchestrates the six steps + asserts the acceptance criteria.
// ---------------------------------------------------------------------------

export interface RoundtripResult {
  readonly ok: boolean;
  readonly steps: ReadonlyArray<StepReport>;
  readonly counts: {
    readonly AgentBriefIssued: number;
    readonly AgentRunStarted: number;
    readonly AgentRunCompleted: number;
    readonly DecisionRequested: number;
    readonly CeoDecision: number;
    readonly RecordFiled: number;
  };
  readonly registers: {
    readonly briefs: number;
    readonly runs: number;
    readonly decisionsResolved: number;
    readonly documents: number;
  };
  readonly inboxDelta: {
    readonly ownerInboxRoot: number;
    readonly teamInboxRoot: number;
    readonly actioned: number;
  };
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .sort();
}

export async function runRoundtrip(opts: {
  cleanup: boolean;
}): Promise<RoundtripResult> {
  const asOf = "2026-05-10T15:00:00.000Z";
  const repoRoot = mkdtempSync(join(tmpdir(), "rms-roundtrip-repo-"));
  const ownerInboxDir = resolve(repoRoot, "Owner Inbox");
  const actionedDir = resolve(ownerInboxDir, "actioned");
  const teamInboxDir = resolve(repoRoot, "Team Inbox");
  mkdirSync(actionedDir, { recursive: true });
  mkdirSync(teamInboxDir, { recursive: true });

  const documentStore = new LocalFsDocumentStore({ root: ISOLATED_DOC_STORE_DIR });

  const steps: StepReport[] = [];
  steps.push(step1AgentBriefIssued(asOf, documentStore));
  steps.push(step2AgentRunStarted(asOf, repoRoot));
  steps.push(step3AgentRunCompleted(asOf, documentStore));
  steps.push(step4DecisionRequested(asOf, documentStore));

  // Pre-step-5 fixture: write the source-decision-card so the auto-
  // archive handler has something to move. Scaffolding for the bridge
  // between today's source-card workflow and the steady-state RMS-only
  // flow.
  const sourceCardPath = resolve(ownerInboxDir, SOURCE_CARD_FILENAME);
  writeFileSync(sourceCardPath, decisionCardBody(), "utf8");

  const ceoStep = step5CeoDecision(asOf, `Owner Inbox/${SOURCE_CARD_FILENAME}`);
  steps.push(ceoStep);

  // Find the CeoDecision event we just emitted (last one with our
  // decisionId) — the scenario uses the singleton store.
  let ceoEvent: { type: string; payload: Record<string, unknown> } | undefined;
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const payload = e.payload as Record<string, unknown>;
    if (payload.decisionId === DECISION_ID) {
      ceoEvent = { type: e.type, payload };
    }
  }
  if (!ceoEvent) throw new Error("CeoDecision event not in store after T4");

  steps.push(await step6AutoArchive(asOf, repoRoot, ownerInboxDir, ceoEvent));

  // Counts
  const counts = {
    AgentBriefIssued: 0,
    AgentRunStarted: 0,
    AgentRunCompleted: 0,
    DecisionRequested: 0,
    CeoDecision: 0,
    RecordFiled: 0,
  };
  const countsMap = counts as Record<string, number>;
  for (const e of eventStore.replay()) {
    if (e.type in countsMap) {
      countsMap[e.type] = (countsMap[e.type] ?? 0) + 1;
    }
  }

  // Register projections
  const projector = new LocalProjector(eventStore);
  const briefs = briefsRegisterRows(projector.build(briefsRegisterProjection));
  const runs = agentRunsRegisterRows(projector.build(agentRunsRegisterProjection));
  const decisions = decisionsRegisterRows(projector.build(decisionsRegisterProjection));
  const documents = documentRegisterRows(projector.build(documentRegisterProjection));

  // Inbox deltas
  const ownerInboxRoot = listFiles(ownerInboxDir);
  const teamInboxRoot = listFiles(teamInboxDir);
  const actionedFiles = listFiles(actionedDir);

  const ok =
    counts.AgentBriefIssued >= 1 &&
    counts.AgentRunStarted >= 1 &&
    counts.AgentRunCompleted >= 1 &&
    counts.DecisionRequested >= 1 &&
    counts.CeoDecision >= 1 &&
    counts.RecordFiled >= 1 &&
    // Acceptance: substrate added zero new files at the inbox root.
    ownerInboxRoot.length === 0 &&
    teamInboxRoot.length === 0 &&
    // Fixture card moved (not duplicated) into actioned/.
    actionedFiles.includes(SOURCE_CARD_FILENAME);

  if (opts.cleanup) {
    eventStore.close();
    rmSync(repoRoot, { recursive: true, force: true });
    rmSync(ISOLATED_EVENT_DB_DIR, { recursive: true, force: true });
    rmSync(ISOLATED_DOC_STORE_DIR, { recursive: true, force: true });
  }

  return {
    ok,
    steps,
    counts,
    registers: {
      briefs: briefs.length,
      runs: runs.length,
      decisionsResolved: decisions.filter((r) => r.status === "resolved").length,
      documents: documents.length,
    },
    inboxDelta: {
      ownerInboxRoot: ownerInboxRoot.length,
      teamInboxRoot: teamInboxRoot.length,
      actioned: actionedFiles.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Top-level invocation. Bun executes the file body; gate on import.meta.main
// so the test can import constants without firing the runner.
// ---------------------------------------------------------------------------

if (import.meta.main) {
  logger.info(
    {
      scenario: SCENARIO_ID,
      sourceLineage: SOURCE_LINEAGE,
      isolated: { eventDb: process.env.BANK_EVENT_DB, docStore: ISOLATED_DOC_STORE_DIR },
    },
    "scenario 04 — RMS Phase 1 round-trip — starting",
  );

  runRoundtrip({ cleanup: true })
    .then((result) => {
      for (const s of result.steps) {
        logger.info(
          { step: s.step, type: s.eventType, eventId: s.eventId },
          `${s.step} ${s.eventType} — ${s.note}`,
        );
      }
      logger.info(
        {
          ok: result.ok,
          counts: result.counts,
          registers: result.registers,
          inboxDelta: result.inboxDelta,
        },
        result.ok ? "Round-trip passed — Phase 1 substantively complete" : "Round-trip failed",
      );
      process.exit(result.ok ? 0 : 1);
    })
    .catch((err) => {
      logger.error({ err: (err as Error).message }, "Round-trip threw");
      process.exit(2);
    });
}
