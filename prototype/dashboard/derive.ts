// dashboard/derive.ts
//
// Pure derivation of the bank-dashboard state from canonical sources.
//
// Per Principle 1, the dashboard registry is a *cache* — every field on it
// must be reproducible from canonical inputs:
//
//   • CLAUDE.md                                — principles, top-of-house roster
//   • Owner Inbox/2026-05-06_policy-register.md — policies count
//   • Regulations/_obligations-register.md      — obligations count
//   • Regulations/_index.md                     — instruments + analysed counts
//   • Procedures/_index.md                      — procedures populated / planned
//   • event store (CeoDecision events)          — decisionsResolved, ceoDecisionsActioned
//   • event store (WorkstreamStarted events)    — inFlight active state
//   • seeds/dashboard-curated.json              — carry-forward parts that do
//                                                 not yet have an upstream
//                                                 canonical source (declared
//                                                 explicitly so they are
//                                                 visible as a debt to repay).
//
// `deriveState()` is pure and synchronous: given the input paths and an event
// reader, it produces a full DashboardState. The server wraps this in a
// debounced watcher and writes the result to the runtime cache under
// `.local/dashboard-state.json` (gitignored). Per D-EVENT-STORE-SCALING
// Slice 3b (2026-05-10) there is no committed cache file; the recon harness
// runs `deriveState()` at recon time and asserts internal consistency of
// the projection rather than comparing against a stored cache.
//
// Author: Atlas · Anya

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import type { EventStore } from "../platform/event-store/store";
import type { CapitalMetrics } from "../platform/projections/capital-metrics";
import {
  type DecisionsRegister,
  buildDecisionsRegister,
  decisionsSourceFromStore,
} from "../projections/decisions";
import { HANDLERS_METADATA } from "../runtime/handlers-metadata";
import { parsePolicyRegister } from "./policy-register";
import type {
  AgentDeliverable,
  AgentMiniDashboard,
  AgentOpsState,
  DashboardState,
  DecisionCategory,
  DecisionCommentSummary,
  FindingSummary,
  FtpDashboardSummary,
  InFlightItem,
  LimitUtilisationStateSummary,
  OpenDecision,
  OpenSeat,
  Person,
  Policy,
  Principle,
  PrototypeStatus,
  ResolvedDecision,
  RuntimeHandlerInfo,
  StrategicFoundation,
  SubordinateMini,
} from "./types";

// ---------------------------------------------------------------------------
// Source-path configuration. Defaults assume the prototype is run from its
// own directory; tests pass overrides.
// ---------------------------------------------------------------------------

export interface SourcePaths {
  readonly repoRoot: string; // resolves the doc paths below
  readonly claudeMd: string;
  readonly policyRegister: string;
  readonly obligationsRegister: string;
  readonly regulationsIndex: string;
  readonly regulationsRoot: string;
  readonly proceduresIndex: string;
  readonly curated: string;
  readonly teamDir: string; // /Team — persona files
  readonly teamRoster: string; // /Team/_team-roster.json — canonical roster (Principle 2)
  readonly principlesDir: string; // /Principles — one file per principle (Principle 2 single-graph)
  readonly ownerInboxDir: string; // archive/owner-inbox — legacy deliverables (Phase 4 archive)
  readonly bankNameRegister: string; // /Regulations/_bank-name.md — canonical bank-name register
  readonly policiesDir?: string; // /Policies — canonical policy document store (D-POLICY-DOCUMENT-HOME)
}

export interface WorkstreamStartedEventSummary {
  readonly workstreamId: string;
  readonly asOf: string;
}

export interface WorkstreamCompletedEventSummary {
  readonly workstreamId: string;
  readonly asOf: string;
  readonly outcomeDoc?: string;
  readonly outcomeNote?: string;
}

export interface WorkstreamRegisteredEventSummary {
  readonly workstreamId: string;
  readonly title: string;
  readonly owner: string;
  readonly status: "planned" | "in-flight" | "blocked";
  readonly summary: string;
  readonly scopedBy?: string;
  readonly asOf: string;
}

export interface AgentEscalationEventSummary {
  readonly escalationId: string;
  readonly raisedBy: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly blockedBy: string;
  readonly severity: "low" | "medium" | "high" | "blocking";
  readonly routedTo: string;
  readonly deadline?: string;
  readonly asOf: string;
}

export interface AuditFindingEventSummary {
  readonly findingId: string;
  readonly source: string;
  readonly severity: string; // "low" | "medium" | "high" | "critical" — string for forward-compat
  readonly principle?: string;
  readonly description: string;
  readonly asOf: string;
}

export interface DecisionCommentEventSummary {
  readonly eventId: string;
  readonly decisionId: string;
  readonly author: string;
  readonly actorType: "human" | "service" | "system";
  readonly actorId: string;
  readonly body: string;
  readonly inReplyToEventId?: string;
  readonly asOf: string;
}

export interface EventSource {
  workstreamStarts(): WorkstreamStartedEventSummary[];
  workstreamCompletions(): WorkstreamCompletedEventSummary[];
  workstreamRegistrations(): WorkstreamRegisteredEventSummary[];
  agentEscalations(): AgentEscalationEventSummary[];
  auditFindings(): AuditFindingEventSummary[];
  decisionComments(): DecisionCommentEventSummary[];
  // D-DECISIONS-FRAMEWORK-REDESIGN Slice A — read the events-only
  // decisions register directly. The dashboard switches to this in lieu
  // of the prior three-source fusion (curated JSON + Owner Inbox FS scan
  // + CeoDecision events). Returns null when the caller has not wired
  // the source (test fixtures that don't care about decisions); the
  // derive falls back to the legacy CeoDecision-event reduce in that
  // case to keep test fixtures green during the transition.
  decisionsRegister?(): DecisionsRegister | null;
  // RMS Phase 2 — agent recent deliverables from RecordFiled events.
  // When provided, replaces the Owner Inbox FS scan in agent mini-dashboards.
  // Optional for backwards compat with test fixtures that don't wire this.
  recentDeliverables?(agentName: string, limit?: number): AgentDeliverable[];
}

export interface DeriveOpts {
  readonly sources: SourcePaths;
  readonly events: EventSource;
  readonly now?: () => string;
  /**
   * Slice 5 — pre-built LimitUtilisation rows. Optional: if omitted the
   * dashboard state carries an empty array (caller is responsible for
   * re-building the projection and injecting the result).
   */
  readonly limitUtilisations?: readonly LimitUtilisationStateSummary[];
  /**
   * AgentOps tile — pre-built AgentOps state from the agent-ops projection.
   * Optional: if omitted the dashboard state carries the default zero-value.
   */
  readonly agentOps?: AgentOpsState;
  /**
   * FTP portfolio summary — pre-built from FtpAttributionRecorded +
   * FtpCurvePublished events via buildFtpPortfolio(). Optional: if
   * omitted the dashboard state carries null (graceful build-phase default).
   */
  readonly ftp?: FtpDashboardSummary | null;
  /**
   * Capital position — pre-built from computeCapitalMetrics() against the
   * event store. Optional: if omitted the dashboard state carries null.
   */
  readonly capitalPositions?: CapitalMetrics | null;
  /**
   * Liquidity metrics — LCR / NSFR ratios from ALM position snapshot.
   * Optional: if omitted the dashboard state carries null.
   */
  readonly liquidityMetrics?: {
    lcr: number | null;
    nsfr: number | null;
    lcrStatus: string;
    nsfrStatus: string;
  } | null;
}

export function defaultSourcePaths(repoRoot: string): SourcePaths {
  return {
    repoRoot,
    claudeMd: join(repoRoot, "CLAUDE.md"),
    policyRegister: join(repoRoot, "archive", "owner-inbox", "2026-05-06_policy-register.md"),
    obligationsRegister: join(repoRoot, "Regulations", "_obligations-register.md"),
    regulationsIndex: join(repoRoot, "Regulations", "_index.md"),
    regulationsRoot: join(repoRoot, "Regulations"),
    proceduresIndex: join(repoRoot, "Procedures", "_index.md"),
    curated: join(repoRoot, "prototype", "seeds", "dashboard-curated.json"),
    teamDir: join(repoRoot, "Team"),
    teamRoster: join(repoRoot, "Team", "_team-roster.json"),
    principlesDir: join(repoRoot, "Principles"),
    ownerInboxDir: join(repoRoot, "archive", "owner-inbox"),
    bankNameRegister: join(repoRoot, "Regulations", "_bank-name.md"),
    policiesDir: join(repoRoot, "Policies"),
  };
}

// source: /Regulations/_bank-name.md table — `| **Bank name** | <value> |`
// row. Canonical register per D-BANK-NAME-SELECTION; surfaced as
// `state.bankName` so client pages don't hard-code the name.
export function readBankNameFromRegister(path: string): string | null {
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\|\s*\*\*Bank name\*\*\s*\|\s*([^|]+?)\s*\|/);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

// Bridge a real EventStore to the EventSource interface used here.
export function eventSourceFromStore(store: EventStore): EventSource {
  return {
    workstreamStarts(): WorkstreamStartedEventSummary[] {
      const out: WorkstreamStartedEventSummary[] = [];
      for (const e of store.replay({ type: "WorkstreamStarted" })) {
        const p = e.payload as Record<string, unknown>;
        out.push({ workstreamId: String(p.workstreamId ?? ""), asOf: e.as_of });
      }
      return out;
    },
    workstreamCompletions(): WorkstreamCompletedEventSummary[] {
      const out: WorkstreamCompletedEventSummary[] = [];
      for (const e of store.replay({ type: "WorkstreamCompleted" })) {
        const p = e.payload as Record<string, unknown>;
        out.push({
          workstreamId: String(p.workstreamId ?? ""),
          asOf: e.as_of,
          ...(typeof p.outcomeDoc === "string" ? { outcomeDoc: p.outcomeDoc } : {}),
          ...(typeof p.outcomeNote === "string" ? { outcomeNote: p.outcomeNote } : {}),
        });
      }
      return out;
    },
    workstreamRegistrations(): WorkstreamRegisteredEventSummary[] {
      const out: WorkstreamRegisteredEventSummary[] = [];
      for (const e of store.replay({ type: "WorkstreamRegistered" })) {
        const p = e.payload as Record<string, unknown>;
        const status = String(p.status ?? "planned");
        const safeStatus: WorkstreamRegisteredEventSummary["status"] =
          status === "in-flight" || status === "blocked" ? status : "planned";
        out.push({
          workstreamId: String(p.workstreamId ?? ""),
          title: String(p.title ?? ""),
          owner: String(p.owner ?? ""),
          status: safeStatus,
          summary: String(p.summary ?? ""),
          asOf: e.as_of,
          ...(typeof p.scopedBy === "string" ? { scopedBy: p.scopedBy } : {}),
        });
      }
      return out;
    },
    agentEscalations(): AgentEscalationEventSummary[] {
      const out: AgentEscalationEventSummary[] = [];
      for (const e of store.replay({ type: "AgentEscalation" })) {
        const p = e.payload as Record<string, unknown>;
        const sev = String(p.severity ?? "medium");
        const safeSev: AgentEscalationEventSummary["severity"] =
          sev === "low" || sev === "medium" || sev === "high" || sev === "blocking"
            ? sev
            : "medium";
        out.push({
          escalationId: String(p.escalationId ?? ""),
          raisedBy: String(p.raisedBy ?? ""),
          question: String(p.question ?? ""),
          options: Array.isArray(p.options) ? (p.options as string[]) : [],
          blockedBy: String(p.blockedBy ?? ""),
          severity: safeSev,
          routedTo: String(p.routedTo ?? ""),
          asOf: e.as_of,
          ...(typeof p.deadline === "string" ? { deadline: p.deadline } : {}),
        });
      }
      return out;
    },
    decisionComments(): DecisionCommentEventSummary[] {
      const out: DecisionCommentEventSummary[] = [];
      for (const e of store.replay({ type: "DecisionComment" })) {
        const p = e.payload as Record<string, unknown>;
        const at = e.actor.type;
        const safeActorType: DecisionCommentEventSummary["actorType"] =
          at === "human" || at === "service" || at === "system" ? at : "service";
        out.push({
          eventId: e.event_id,
          decisionId: String(p.decisionId ?? ""),
          author: String(p.author ?? ""),
          actorType: safeActorType,
          actorId: e.actor.id,
          body: String(p.body ?? ""),
          asOf: e.as_of,
          ...(typeof p.inReplyToEventId === "string"
            ? { inReplyToEventId: p.inReplyToEventId }
            : {}),
        });
      }
      return out;
    },
    decisionsRegister(): DecisionsRegister {
      // D-DECISIONS-FRAMEWORK-REDESIGN Slice A — events-only projection.
      // No I/O happens until the register builder iterates; the store's
      // `replay` is itself a generator. Both `Decision` and (transition)
      // `CeoDecision` events feed in.
      return buildDecisionsRegister(decisionsSourceFromStore(store));
    },
    recentDeliverables(agentName: string, limit = 5): AgentDeliverable[] {
      // RMS Phase 2 — read RecordFiled events authored by this agent.
      // Replaces the Owner Inbox FS scan (Principle 1: events are truth).
      const lower = agentName.toLowerCase();
      const out: AgentDeliverable[] = [];
      for (const e of store.replay({ type: "RecordFiled" })) {
        const p = e.payload as Record<string, unknown>;
        const meta = p.metadata as Record<string, unknown> | undefined;
        if (!meta) continue;
        const author = String(meta.author ?? "").toLowerCase();
        if (!author.includes(lower)) continue;
        out.push({
          date: String(meta.date ?? e.as_of).slice(0, 10),
          path: String(meta.path ?? ""),
          title: String(meta.title ?? ""),
        });
      }
      out.sort((a, b) => (a.date < b.date ? 1 : -1));
      return out.slice(0, limit);
    },
    auditFindings(): AuditFindingEventSummary[] {
      // Accept three payload shapes:
      // (a) Canonical AuditFinding (platform/event-store/event-types/audit.ts):
      //     { findingId, severity, category, addressedTo, agentId, raisedBy,
      //       summary, detail?, sourceRef?, citations }
      //     — `summary` is required by the Zod schema; `description` does
      //     not exist on this shape. This is what Vera's overnight-recon
      //     and the codebase-quality-review runner emit.
      // (b) Mira/citation-gate legacy: { findingId, source, severity, principle, description }
      // (c) Vera/recon legacy:         { pipeline, subject, message, severity (info|warn|fail) }
      // Map (c)'s severity onto the canonical scale.
      const sevMap: Record<string, string> = {
        fail: "high",
        warn: "medium",
        info: "low",
      };
      const out: AuditFindingEventSummary[] = [];
      for (const e of store.replay({ type: "AuditFinding" })) {
        const p = e.payload as Record<string, unknown>;
        const rawSev = String(p.severity ?? "medium");
        const severity = sevMap[rawSev] ?? rawSev;
        // Prefer canonical `summary` (shape a); fall back to legacy
        // `description` (shape b) then `message` (shape c).
        const description =
          (typeof p.summary === "string" && p.summary) ||
          (typeof p.description === "string" && p.description) ||
          (typeof p.message === "string" && p.message) ||
          "";
        const principle =
          (typeof p.principle === "string" && p.principle) ||
          (typeof p.sourceRef === "string" && p.sourceRef) ||
          (typeof p.subject === "string" && p.subject) ||
          (typeof p.pipeline === "string" && `pipeline: ${p.pipeline}`) ||
          undefined;
        // Canonical shape (a) carries `raisedBy`; legacy shapes carry
        // `source`. Fall back to the actor id on the event envelope.
        const source = String(p.source ?? p.raisedBy ?? e.actor.id);
        out.push({
          findingId: String(p.findingId ?? e.event_id),
          source,
          severity,
          description: description || "(no description)",
          asOf: e.as_of,
          ...(principle ? { principle } : {}),
        });
      }
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// Curated carry-forward shape
// ---------------------------------------------------------------------------

interface Curated {
  readonly bank: {
    readonly name: string;
    readonly operatingPosture: string;
    readonly cloudTarget: string;
    readonly strategicFoundation: StrategicFoundation;
  };
  readonly decisionsOpen: readonly OpenDecision[];
  readonly decisionsResolvedSeed: readonly ResolvedDecision[];
  readonly inFlight: readonly InFlightItem[];
  readonly prototype: PrototypeStatus;
  readonly risks: readonly string[];
}

function readCurated(path: string): Curated {
  if (!existsSync(path)) {
    throw new Error(`Curated carry-forward not found at ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as Curated;
}

// ---------------------------------------------------------------------------
// Parsers — small, deliberately conservative readers over the canonical docs.
// ---------------------------------------------------------------------------

const TABLE_ROW = /^\|(.+)\|$/;
const PRINCIPLE_FILENAME = /^(\d+)-([^.]+)\.md$/;
const PRINCIPLE_TITLE_HEADING = /^#\s+Principle\s+(\d+)\s+—\s+(.+)$/;

function readLines(path: string): string[] {
  return readFileSync(path, "utf8").split(/\r?\n/);
}

// source: /Principles/<n>-<slug>.md — one file per principle. The file's
// `# Principle N — <title>` heading carries the canonical title; the first
// non-empty paragraph below the heading is the summary. The Principles
// directory is the single source of truth (Principle 2 single-graph
// discipline); CLAUDE.md renders pointers but does not own the text.
function parsePrinciples(principlesDir: string): readonly Principle[] {
  if (!existsSync(principlesDir)) return [];
  const out: Principle[] = [];
  for (const filename of readdirSync(principlesDir)) {
    const fm = filename.match(PRINCIPLE_FILENAME);
    if (!fm || !fm[1]) continue;
    const path = join(principlesDir, filename);
    const lines = readLines(path);
    let title = "";
    let summary = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const m = line.match(PRINCIPLE_TITLE_HEADING);
      if (!m || !m[2]) continue;
      title = m[2].trim();
      for (let j = i + 1; j < lines.length && j < i + 12; j++) {
        const next = lines[j]?.trim() ?? "";
        if (next === "") continue;
        if (next.startsWith(">") || next.startsWith("#")) continue;
        summary = next;
        break;
      }
      break;
    }
    if (!title) continue;
    out.push({ n: Number(fm[1]), title, summary });
  }
  return out.sort((a, b) => a.n - b.n);
}

// Table rows whose cell count >= cells.min get returned as cell arrays.
function tableRows(lines: string[], min = 2): string[][] {
  const out: string[][] = [];
  for (const line of lines) {
    const m = line.match(TABLE_ROW);
    if (!m) continue;
    const cells = (m[1] ?? "").split("|").map((c) => c.trim());
    if (cells.length < min) continue;
    // Skip header/separator rows ( "---" cells, or first cell exactly "Policy" / "Instrument" etc.)
    if (cells.every((c) => /^-+$|^:?-+:?$/.test(c) || c === "")) continue;
    out.push(cells);
  }
  return out;
}

function isHeaderRow(cells: string[], headerKeywords: readonly string[]): boolean {
  const first = (cells[0] ?? "").toLowerCase();
  return headerKeywords.some((k) => first === k.toLowerCase());
}

// Note: policy-row counting / parsing now lives in `dashboard/policy-register.ts`
// (`parsePolicyRegister`). The count flows from `policies.length` in
// deriveState — single source of truth.

// source: Regulations/_obligations-register.md — count of register rows.
function countObligations(obligationsRegister: string): number {
  const rows = tableRows(readLines(obligationsRegister));
  let n = 0;
  for (const row of rows) {
    if (!row[0]) continue;
    // Obligations table (v1.13+): ID | URN | Citation | Requirement | Fulfilment policy | Owner | Status | Entity scope | Applies-at
    if (row.length < 9) continue;
    if (isHeaderRow(row, ["ID"])) continue;
    if (!/^ORG-/i.test(row[0])) continue;
    n++;
  }
  return n;
}

interface RegStats {
  total: number;
  populated: number;
}

// source: Regulations/_index.md — instrument totals and POPULATED count
function regulationStats(regulationsIndex: string): RegStats {
  const rows = tableRows(readLines(regulationsIndex));
  let total = 0;
  let populated = 0;
  for (const row of rows) {
    if (row.length < 4) continue;
    const status = row[2] ?? "";
    if (!status) continue;
    if (isHeaderRow(row, ["Instrument"])) continue;
    if (
      !["POPULATED", "STUB", "PLANNED", "**POPULATED**", "**STUB**", "**PLANNED**", "n/a"].some(
        (s) => status.includes(s),
      )
    ) {
      continue;
    }
    total++;
    if (status.includes("POPULATED")) populated++;
  }
  return { total, populated };
}

interface ProcStats {
  populated: number;
  planned: number;
}

// source: Procedures/_index.md — POPULATED and PLANNED row counts
function procedureStats(proceduresIndex: string): ProcStats {
  const rows = tableRows(readLines(proceduresIndex));
  let populated = 0;
  let planned = 0;
  for (const row of rows) {
    if (row.length < 4) continue;
    const status = row[3] ?? "";
    if (isHeaderRow(row, ["Policy"])) continue;
    if (status.includes("POPULATED")) populated++;
    else if (status.includes("PLANNED")) planned++;
    // STUB and others are not counted in either bucket (matches the registry's
    // current convention; the dashboard tracks the two endpoints).
  }
  return { populated, planned };
}

// source: Team/_team-roster.json `topOfHouse` block. The roster JSON is
// the single source of truth (Principle 2 single-graph discipline);
// CLAUDE.md narrates around it but does not own the data. CLAUDE.md text
// is also read for `openSeatStatusFor` to surface per-seat status notes.
function parseTopOfHouse(
  teamRoster: string,
  claudeMd: string,
): { directReports: Person[]; openSeats: OpenSeat[] } {
  const directReports: Person[] = [];
  const openSeats: OpenSeat[] = [];
  if (!existsSync(teamRoster)) return { directReports, openSeats };

  interface RosterShape {
    topOfHouse?: {
      ceoDirectReports?: readonly string[];
      futureDirectReportsAsHired?: readonly string[];
    };
  }
  const raw = readFileSync(teamRoster, "utf8");
  const data = JSON.parse(raw) as RosterShape;
  const top = data.topOfHouse;
  if (!top) return { directReports, openSeats };

  for (const item of top.ceoDirectReports ?? []) {
    const trimmed = item.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    const m = trimmed.match(/^([A-Za-z]+)\s*\(([^)]+)\)/);
    if (!m || !m[1] || !m[2]) continue;
    const name = m[1];
    const parens = m[2];
    const role = parens.split(/[,—;]/)[0]?.trim() ?? "";
    const type: Person["type"] = name === "Scrooge" ? "Functional" : "Governance";
    directReports.push({ name, role: expandRole(role), type });
  }

  const claudeText = existsSync(claudeMd) ? readFileSync(claudeMd, "utf8") : "";
  for (const seat of top.futureDirectReportsAsHired ?? []) {
    const cleaned = seat.trim();
    if (!cleaned) continue;
    openSeats.push({ role: cleaned, status: openSeatStatusFor(cleaned, claudeText) });
  }

  return { directReports, openSeats };
}

const ROLE_EXPANSIONS: Record<string, string> = {
  CoS: "Chief of Staff",
  CRO: "CRO",
  COO: "COO",
  CFO: "CFO",
  Treasurer: "Treasurer",
  CoSec: "Company Secretary",
  CCO: "CCO",
  IO: "Information Officer",
  CAE: "CAE",
};

function expandRole(role: string): string {
  return ROLE_EXPANSIONS[role] ?? role;
}

function openSeatStatusFor(seat: string, claudeText: string): string {
  // Scan for a hint near the persona files; default empty if nothing found.
  const lower = claudeText.toLowerCase();
  const idx = lower.indexOf(`${seat.toLowerCase()} `);
  if (idx >= 0) {
    // Walk forward to next sentence boundary.
    const slice = claudeText.slice(idx, idx + 200);
    const period = slice.indexOf(".");
    if (period > 0) return slice.slice(0, period).trim();
  }
  return "Sequenced; PAX brief / Nolan recruit pending";
}

// ---------------------------------------------------------------------------
// Event reductions
// ---------------------------------------------------------------------------

/**
 * D-DECISIONS-FRAMEWORK-REDESIGN Slice A — adapt the events-only
 * `DecisionsRegister` to the dashboard's existing `OpenDecision` /
 * `ResolvedDecision` shapes. Pure mapping; no reads.
 *
 * The dashboard's `DecisionCategory` enum (pacing / near-term / ...) is
 * distinct from the unified payload's `category` (governance / risk /
 * ...) — Slice A maps every projected row to `near-term` so the queue
 * is visible without inventing presentation semantics. Slice B will
 * either reconcile the two enums or carry presentation hints on the
 * `Decision` payload directly.
 */
function adaptDecisionsRegister(register: DecisionsRegister): {
  resolved: ResolvedDecision[];
  remainingOpen: OpenDecision[];
  reopenedFromEvents: OpenDecision[];
} {
  const open: OpenDecision[] = register.open.map((row) => ({
    id: row.decisionId,
    title: row.title,
    category: "near-term",
    domainCategory: row.category,
    authority: row.authority,
    owner: row.authorityRef,
    trigger: `Decision event (authority: ${row.authority}, phase: requested)`,
    decisionForCEO: row.recommendation,
    sourceDocs: [],
    ...(row.recommendation
      ? {
          recommendation: {
            stance: row.recommendation,
            reasoning: row.rationale,
          },
        }
      : {}),
  }));
  const resolved: ResolvedDecision[] = register.resolved.map((row) => ({
    id: row.decisionId,
    title: row.title,
    actionedAt: row.resolvedAt ?? row.asOf,
    outcome: row.recommendation,
    sourceDoc: "",
    domainCategory: row.category,
    ...(row.recordedVia ? { actionedBy: row.authorityRef } : {}),
  }));
  return { resolved, remainingOpen: open, reopenedFromEvents: [] };
}

function reduceInFlight(
  base: readonly InFlightItem[],
  starts: readonly WorkstreamStartedEventSummary[],
  completions: readonly WorkstreamCompletedEventSummary[],
  registrations: readonly WorkstreamRegisteredEventSummary[] = [],
): InFlightItem[] {
  const startMap = new Map<string, string>();
  for (const s of starts) {
    const prev = startMap.get(s.workstreamId);
    // First start wins for `startedAt` (matches the registry semantic).
    if (!prev || prev > s.asOf) startMap.set(s.workstreamId, s.asOf);
  }
  // Latest completion wins for `completedAt` and outcome metadata
  // (handles re-completion / correction events).
  const completionMap = new Map<string, WorkstreamCompletedEventSummary>();
  for (const c of completions) {
    const prev = completionMap.get(c.workstreamId);
    if (!prev || prev.asOf <= c.asOf) completionMap.set(c.workstreamId, c);
  }
  // Index registrations by workstreamId — also feeds workstreams that are
  // not in the curated base into inFlight for the first time.
  const registrationMap = new Map<string, WorkstreamRegisteredEventSummary>();
  for (const r of registrations) {
    const prev = registrationMap.get(r.workstreamId);
    if (!prev || prev.asOf <= r.asOf) registrationMap.set(r.workstreamId, r);
  }

  // Any workstreamId present in the event registry is canonical — the
  // static seed entry for the same ID is suppressed to avoid duplicates.
  // Event data (title, owner, status) wins over the curated carry-forward.
  const registeredIds = new Set(registrationMap.keys());

  const folded: InFlightItem[] = [];
  for (const item of base) {
    // Suppress seed entries whose ID is covered by a WorkstreamRegistered event.
    // The event-derived item is emitted below in `newFromRegistrations`.
    if (registeredIds.has(item.id)) continue;

    let next: InFlightItem = item;
    const eventStart = startMap.get(item.id);
    if (eventStart) {
      next = { ...next, active: true, startedAt: eventStart.slice(0, 10) };
    }
    const completion = completionMap.get(item.id);
    if (completion) {
      next = {
        ...next,
        active: false,
        completedAt: completion.asOf.slice(0, 10),
        ...(completion.outcomeDoc ? { outcomeDoc: completion.outcomeDoc } : {}),
        ...(completion.outcomeNote ? { outcomeNote: completion.outcomeNote } : {}),
      };
    }
    folded.push(next);
  }

  // All registered workstreams appear here as canonical items, whether or not
  // a matching seed entry existed. Started/completed events apply normally.
  const newFromRegistrations: InFlightItem[] = [];
  for (const [id, reg] of registrationMap) {
    const eventStart = startMap.get(id);
    const completion = completionMap.get(id);
    const item: InFlightItem = {
      id,
      what: reg.title || reg.summary || id,
      owner: reg.owner || "—",
      due: "",
      active: completion ? false : reg.status !== "blocked",
      ...(eventStart ? { startedAt: eventStart.slice(0, 10) } : {}),
      ...(completion ? { completedAt: completion.asOf.slice(0, 10) } : {}),
      ...(completion?.outcomeDoc ? { outcomeDoc: completion.outcomeDoc } : {}),
      ...(completion?.outcomeNote ? { outcomeNote: completion.outcomeNote } : {}),
      ...(reg.scopedBy ? { briefDoc: reg.scopedBy } : {}),
    };
    newFromRegistrations.push(item);
  }

  return [...folded, ...newFromRegistrations];
}

// ---------------------------------------------------------------------------
// Per-agent mini-dashboard derivation
// ---------------------------------------------------------------------------

// Heading patterns that indicate the persona file has been upgraded from a
// character-sheet to an agent operating-spec. Per the autonomous-agent rule
// (CLAUDE.md, 2026-05-07): every persona must specify cadence, triggers,
// inputs, decisions in scope, decisions that escalate, outputs, and the
// system capabilities it calls. Any one of these is sufficient evidence —
// the template files use them all.
const OPERATING_SPEC_HEADINGS: readonly RegExp[] = [
  /^##\s+(?:\d+\.\s+)?Cadence\s*$/i,
  /^##\s+(?:\d+\.\s+)?Triggers\s*$/i,
  /^##\s+(?:\d+\.\s+)?Decisions in scope\s*$/i,
  /^##\s+Operating spec\b/i,
];

const MANDATE_HEADING = /^##\s+(?:\d+\.\s+)?Mandate\s*$/i;
const ANY_H2 = /^##\s+/;

function readPersonaFile(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  return readFileSync(path, "utf8");
}

// Extract the first non-empty paragraph after the Mandate heading, in plain
// text (markdown links flattened to their visible label, soft-wrapped). The
// mandate is a one-paragraph statement of role authority.
function parseMandate(content: string): string {
  const lines = content.split(/\r?\n/);
  let inMandate = false;
  const collected: string[] = [];
  for (const line of lines) {
    if (!inMandate) {
      if (MANDATE_HEADING.test(line)) {
        inMandate = true;
      }
      continue;
    }
    if (ANY_H2.test(line)) break;
    if (line.trim() === "" && collected.length > 0) break; // first paragraph
    if (line.trim() === "") continue; // skip leading blanks
    collected.push(line.trim());
  }
  // Flatten basic markdown link syntax `[label](url)` → `label`
  return collected.join(" ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

function detectOperatingSpec(content: string): boolean {
  for (const line of content.split(/\r?\n/)) {
    for (const re of OPERATING_SPEC_HEADINGS) {
      if (re.test(line)) return true;
    }
  }
  return false;
}

// Owner-string matching. Workstream / decision owner fields can be a single
// name ("Saskia") or a compound ("Helena + Camille + Eitan", "Atlas + Anya
// + Bea", "Domain leads"). Match by case-insensitive whole-word presence —
// avoid substring traps (e.g. "Niko" inside "Nikolai").
function ownerMatches(owner: string | undefined, name: string): boolean {
  if (!owner) return false;
  const re = new RegExp(`\\b${name}\\b`, "i");
  return re.test(owner);
}

// Extract a `YYYY-MM-DD` date prefix from an Owner Inbox filename if present.
// The filename convention (CLAUDE.md, "Deliverables") is `YYYY-MM-DD_<slug>`.
function fileDate(filename: string): string | undefined {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})_/);
  return m?.[1];
}

// Build a humanised title from a slug (filename minus date prefix and .md).
function humaniseSlug(filename: string): string {
  const stripped = filename.replace(/^\d{4}-\d{2}-\d{2}_/, "").replace(/\.md$|\.html$|\.pdf$/i, "");
  return stripped.replace(/_/g, " · ").replace(/-/g, " ");
}

// Owner Inbox files attributed to an agent. Three matching paths so an agent
// gets credit for the work the canonical sources actually attribute to them
// (not just files whose filename happens to start with their name):
//   1. Filename prefix `YYYY-MM-DD_<lowercased-name>_*.md` (e.g. `_atlas_runtime-spec.md`).
//   2. Frontmatter `author:` line containing the name as a whole word.
//   3. Body `**Author:**` line containing the name as a whole word.
// Multi-author files (e.g. `Vera · Scrooge`) credit every named author.
// Returns most-recent first, capped.
function recentDeliverablesFor(ownerInboxDir: string, name: string, limit = 5): AgentDeliverable[] {
  if (!existsSync(ownerInboxDir)) return [];
  const lower = name.toLowerCase();
  const wholeWord = new RegExp(`\\b${name}\\b`, "i");
  const out: AgentDeliverable[] = [];
  for (const filename of readdirSync(ownerInboxDir)) {
    if (filename.startsWith(".") || filename.startsWith("_")) continue;
    const lc = filename.toLowerCase();
    if (!lc.endsWith(".md")) continue;
    const date = fileDate(filename);
    if (!date) continue;

    let matched = lc.match(new RegExp(`^\\d{4}-\\d{2}-\\d{2}_${lower}_`)) !== null;

    if (!matched) {
      const full = join(ownerInboxDir, filename);
      try {
        if (!statSync(full).isFile()) continue;
      } catch {
        continue;
      }
      const content = readFileSync(full, "utf8");
      // Frontmatter author line.
      const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
      if (fm?.[1]) {
        const authorLine = fm[1].split(/\r?\n/).find((l) => /^author\s*:/i.test(l));
        if (authorLine && wholeWord.test(authorLine)) matched = true;
      }
      // Body **Author:** line.
      if (!matched) {
        const bodyAuthor = content.match(/^\*\*Authors?:\*\*\s+(.+)$/im);
        if (bodyAuthor?.[1] && wholeWord.test(bodyAuthor[1])) matched = true;
      }
    }

    if (!matched) continue;
    out.push({
      date,
      path: `archive/owner-inbox/${filename}`,
      title: humaniseSlug(filename),
    });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out.slice(0, limit);
}

// Build an owner-by-decision-id map so resolved decisions can be attributed
// back to the agent who owned them. Combines the curated open list and any
// Owner-Inbox-lifted decisions so both sources reconcile.
function ownerByDecisionId(
  curatedOpen: readonly OpenDecision[],
  ownerInboxOpen: readonly OpenDecision[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of curatedOpen) map.set(d.id, d.owner);
  for (const d of ownerInboxOpen) map.set(d.id, d.owner); // owner-inbox wins on conflict
  return map;
}

function resolvedDecisionsForAgent(
  resolved: readonly ResolvedDecision[],
  ownerById: Map<string, string>,
  name: string,
  limit = 3,
): ResolvedDecision[] {
  return resolved.filter((r) => ownerMatches(ownerById.get(r.id), name)).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Agent roster — walks /Team/*.md so engineering agents (not just CEO direct
// reports) appear on the agents page. Per Principle 2 (presentations derive
// from data), the page renders whatever the canonical /Team/ directory holds;
// the directReports list from CLAUDE.md is used to flag governance seats.
// ---------------------------------------------------------------------------

const PERSONA_H1_RE = /^#\s+([A-Za-z]+)\s+—\s+(.+?)\s*$/;

interface RosterEntry {
  name: string;
  role: string;
  type: "Functional" | "Governance";
  isDirectReport: boolean;
  personaPath: string; // absolute
  content?: string;
}

export function parseAgentRoster(teamDir: string, directReports: readonly Person[]): RosterEntry[] {
  const directByName = new Map(directReports.map((p) => [p.name, p]));
  const out: RosterEntry[] = [];

  if (existsSync(teamDir)) {
    for (const filename of readdirSync(teamDir)) {
      if (filename.startsWith(".") || filename.startsWith("_")) continue;
      if (!filename.endsWith(".md")) continue;
      const personaPath = join(teamDir, filename);
      let content: string;
      try {
        if (!statSync(personaPath).isFile()) continue;
        content = readFileSync(personaPath, "utf8");
      } catch {
        continue;
      }
      // Default name from filename (without .md); H1 overrides.
      let name = filename.replace(/\.md$/i, "");
      let role = "";
      for (const line of content.split(/\r?\n/)) {
        const m = line.match(PERSONA_H1_RE);
        if (m?.[1] && m[2]) {
          name = m[1].trim();
          role = m[2].trim();
          break;
        }
      }
      const direct = directByName.get(name);
      const isDirectReport = direct !== undefined;
      // Engineering personas not in direct reports default to Functional;
      // governance personas always come through directReports per the
      // top-of-house structure.
      const type: "Functional" | "Governance" = direct?.type ?? "Functional";
      // Direct-report role from CLAUDE.md wins where present (it carries the
      // canonical title; the persona H1 may be more verbose).
      out.push({
        name,
        role: direct?.role ?? role,
        type,
        isDirectReport,
        personaPath,
        content,
      });
    }
  }

  // Surface direct reports that have no /Team/ file (e.g. Scrooge lives in
  // CLAUDE.md, not /Team/) so the agents page still renders them.
  const seen = new Set(out.map((r) => r.name));
  for (const dr of directReports) {
    if (seen.has(dr.name)) continue;
    out.push({
      name: dr.name,
      role: dr.role,
      type: dr.type,
      isDirectReport: true,
      personaPath: join(teamDir, `${dr.name}.md`),
    });
  }

  return out;
}

function maxDate(...candidates: (string | undefined)[]): string | undefined {
  let max: string | undefined;
  for (const c of candidates) {
    if (!c) continue;
    if (!max || c > max) max = c;
  }
  return max;
}

interface DeriveAgentsInput {
  readonly directReports: readonly Person[];
  readonly inFlight: readonly InFlightItem[];
  readonly decisionsOpen: readonly OpenDecision[];
  readonly decisionsResolved: readonly ResolvedDecision[];
  readonly teamDir: string;
  readonly ownerInboxDir: string;
  readonly claudeMd: string;
  // Map of decision-id → owner, for attributing resolved decisions back to
  // their owning agent. Built from the curated open list + Owner-Inbox-lifted
  // open decisions before resolution removes them.
  readonly ownerByDecisionId?: Map<string, string>;
  // RMS Phase 2 — when provided, recent deliverables come from RecordFiled
  // events instead of the Owner Inbox FS scan. Optional for backwards compat.
  readonly eventSource?: Pick<EventSource, "recentDeliverables">;
}

// ---------------------------------------------------------------------------
// Reports-to mapping — parsed from CLAUDE.md "Engineering vs governance"
// paragraph + the Vera CAE-line statement. Per Principle 6 (autonomous
// agents) and the CEO directive of 2026-05-07: every direct-report rolls up
// the duties of those reporting to them.
// ---------------------------------------------------------------------------

// Mapping from CLAUDE.md prose like:
//   "Rohan → Helena (CRO); Mira → Zara (CCO); Bea, Yael → Camille (CFO); ..."
// Returns: governance-head name → list of engineer names.
function parseReportsTo(claudeMd: string): Map<string, string[]> {
  const out = new Map<string, string[]>();

  // Read from Team/_team-roster.json — the canonical source for reporting lines
  // per CLAUDE.md ("Engineering-to-governance reporting is encoded in the
  // roster JSON reportsTo field"). The previous CLAUDE.md text-parsing approach
  // never matched because the → arrows in CLAUDE.md are principle citations,
  // not reporting-line entries. Root cause of ghost-warns on Atlas-owned
  // workstreams (Vera dashboard-derivation 2026-05-16).
  const rosterPath = join(dirname(claudeMd), "Team", "_team-roster.json");
  if (existsSync(rosterPath)) {
    try {
      const roster = JSON.parse(readFileSync(rosterPath, "utf8")) as {
        personas?: Array<{ name: string; reportsTo?: string }>;
      };
      for (const p of roster.personas ?? []) {
        if (!p.name || !p.reportsTo) continue;
        const list = out.get(p.reportsTo) ?? [];
        if (!list.includes(p.name)) list.push(p.name);
        out.set(p.reportsTo, list);
      }
    } catch {
      // Fail open — validator emits warns rather than crash.
    }
  }

  return out;
}

function buildSubordinate(
  name: string,
  teamDir: string,
  ownerInboxDir: string,
  inFlight: readonly InFlightItem[],
  decisionsOpen: readonly OpenDecision[],
  eventSource?: Pick<EventSource, "recentDeliverables">,
): SubordinateMini {
  const personaPath = join(teamDir, `${name}.md`);
  const content = readPersonaFile(personaPath);
  const hasOperatingSpec = content ? detectOperatingSpec(content) : false;
  // Read a synthetic "role" line — first non-empty line beginning with "Role:"
  // in the persona file, or the file's H1 minus the name. Best-effort.
  let role = "";
  if (content) {
    const m = content.match(/\*\*Role:\*\*\s*([^\n]+)/);
    if (m?.[1]) role = m[1].trim();
  }
  const activeWorkstreams = inFlight.filter((i) => i.active && ownerMatches(i.owner, name));
  const recentlyCompletedWorkstreams = inFlight
    .filter((i) => i.completedAt && ownerMatches(i.owner, name))
    .slice()
    .sort((a, b) => ((a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1))
    .slice(0, 3);
  const openDecisionsOwned = decisionsOpen.filter((d) => ownerMatches(d.owner, name));
  const recentDeliverables = eventSource?.recentDeliverables
    ? eventSource.recentDeliverables(name, 5)
    : recentDeliverablesFor(ownerInboxDir, name, 5);
  const lastActivityAt = maxDate(
    recentlyCompletedWorkstreams[0]?.completedAt,
    recentDeliverables[0]?.date,
  );
  return {
    name,
    role,
    hasOperatingSpec,
    activeWorkstreams,
    recentlyCompletedWorkstreams,
    openDecisionsOwned,
    recentDeliverables,
    ...(lastActivityAt ? { lastActivityAt } : {}),
  };
}

export function deriveAgents(input: DeriveAgentsInput): AgentMiniDashboard[] {
  const reportsTo = parseReportsTo(input.claudeMd);

  const out: AgentMiniDashboard[] = [];
  for (const person of input.directReports) {
    const personaPath = join(input.teamDir, `${person.name}.md`);
    const content = readPersonaFile(personaPath);
    const mandate = content ? parseMandate(content) : "";
    const hasOperatingSpec = content ? detectOperatingSpec(content) : false;

    const activeWorkstreams = input.inFlight.filter(
      (i) => i.active && ownerMatches(i.owner, person.name),
    );
    const recentlyCompletedWorkstreams = input.inFlight
      .filter((i) => i.completedAt && ownerMatches(i.owner, person.name))
      .slice()
      .sort((a, b) => ((a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1))
      .slice(0, 3);

    const openDecisionsOwned = input.decisionsOpen.filter((d) =>
      ownerMatches(d.owner, person.name),
    );

    // Resolved decisions: attribute back to owner via the
    // ownerByDecisionId map (decisions lose their owner field on resolution,
    // so we lookup the owner from the pre-resolution set).
    const recentlyResolvedDecisions = input.ownerByDecisionId
      ? resolvedDecisionsForAgent(input.decisionsResolved, input.ownerByDecisionId, person.name, 3)
      : [];

    const recentDeliverables = input.eventSource?.recentDeliverables
      ? input.eventSource.recentDeliverables(person.name)
      : recentDeliverablesFor(input.ownerInboxDir, person.name);

    // Build subordinates per the parsed reports-to mapping.
    const subordinateNames = reportsTo.get(person.name) ?? [];
    const subordinates: SubordinateMini[] = subordinateNames.map((n) =>
      buildSubordinate(
        n,
        input.teamDir,
        input.ownerInboxDir,
        input.inFlight,
        input.decisionsOpen,
        input.eventSource,
      ),
    );

    // Aggregate totals — own + subordinates.
    const totalActive =
      activeWorkstreams.length + subordinates.reduce((s, x) => s + x.activeWorkstreams.length, 0);
    const totalRecentlyCompleted =
      recentlyCompletedWorkstreams.length +
      subordinates.reduce((s, x) => s + x.recentlyCompletedWorkstreams.length, 0);
    const totalOpenDecisions =
      openDecisionsOwned.length + subordinates.reduce((s, x) => s + x.openDecisionsOwned.length, 0);
    const totalRecentDeliverables =
      recentDeliverables.length + subordinates.reduce((s, x) => s + x.recentDeliverables.length, 0);

    const lastActivityAt = maxDate(
      recentlyCompletedWorkstreams[0]?.completedAt,
      recentDeliverables[0]?.date,
      ...subordinates.map((s) => s.lastActivityAt),
    );

    out.push({
      name: person.name,
      role: person.role,
      type: person.type,
      isDirectReport: true,
      personaPath: `Team/${person.name}.md`,
      mandate,
      hasOperatingSpec,
      activeWorkstreams,
      recentlyCompletedWorkstreams,
      openDecisionsOwned,
      recentlyResolvedDecisions,
      recentDeliverables,
      ...(lastActivityAt ? { lastActivityAt } : {}),
      subordinates,
      totalActive,
      totalRecentlyCompleted,
      totalOpenDecisions,
      totalRecentDeliverables,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function deriveState(opts: DeriveOpts): DashboardState {
  const now = opts.now ?? (() => new Date().toISOString()); // wall-clock: default; inject opts.now for deterministic scenarios
  const curated = readCurated(opts.sources.curated);

  const principles = parsePrinciples(opts.sources.principlesDir);
  // P1: parse the policy register into typed Policy[] entries on every tick.
  // The count flows into bank.metrics.policies; the array surfaces as the
  // top-level `policies` field for the policies-library page.
  const policies: readonly Policy[] = parsePolicyRegister({
    path: opts.sources.policyRegister,
    obligationsRegister: opts.sources.obligationsRegister,
    ...(opts.sources.policiesDir !== undefined ? { policiesDir: opts.sources.policiesDir } : {}),
  });
  const obligations = countObligations(opts.sources.obligationsRegister);
  const regs = regulationStats(opts.sources.regulationsIndex);
  const procs = procedureStats(opts.sources.proceduresIndex);
  const { directReports, openSeats } = parseTopOfHouse(
    opts.sources.teamRoster,
    opts.sources.claudeMd,
  );

  const wsStarts = opts.events.workstreamStarts();
  const wsCompletions = opts.events.workstreamCompletions();
  const wsRegistrations = opts.events.workstreamRegistrations();
  const escalations = opts.events.agentEscalations();
  const findings = opts.events.auditFindings();
  const decisionCommentEvents = opts.events.decisionComments();

  // Group comments by decisionId, sorted oldest-first per thread.
  const commentsByDecisionId: Record<string, DecisionCommentSummary[]> = {};
  for (const c of decisionCommentEvents) {
    const arr = commentsByDecisionId[c.decisionId] ?? [];
    arr.push({
      eventId: c.eventId,
      decisionId: c.decisionId,
      author: c.author,
      actorType: c.actorType,
      actorId: c.actorId,
      body: c.body,
      asOf: c.asOf,
      ...(c.inReplyToEventId ? { inReplyToEventId: c.inReplyToEventId } : {}),
    });
    commentsByDecisionId[c.decisionId] = arr;
  }
  for (const k of Object.keys(commentsByDecisionId)) {
    const arr = commentsByDecisionId[k];
    if (arr) arr.sort((a, b) => (a.asOf < b.asOf ? -1 : 1));
  }

  // D-DECISIONS-FRAMEWORK-REDESIGN — read the unified decisions register
  // directly from the events-only projection. The Owner Inbox markdown scan
  // and the curated `decisionsOpen` / `decisionsResolvedSeed` fusion are gone
  // from the decisions path: markdown is now pure render.
  const registerProvided = opts.events.decisionsRegister?.() ?? null;
  const { resolved, remainingOpen, reopenedFromEvents } = registerProvided
    ? adaptDecisionsRegister(registerProvided)
    : { resolved: [], remainingOpen: [], reopenedFromEvents: [] };
  const inFlight = reduceInFlight(curated.inFlight, wsStarts, wsCompletions, wsRegistrations);

  // D-RMS-PHASE-4 (approved 2026-05-18): Owner Inbox markdown parser retired.
  // ownerInboxFeed has been removed from DashboardState. Decisions are now
  // sourced exclusively from the events-only projection (Decision events).
  const resolvedIds = new Set(resolved.map((r) => r.id));

  // D-DECISIONS-FRAMEWORK-REDESIGN — Owner Inbox markdown is retired as an
  // authoring channel. ownerInboxOpenDecisions is always empty; kept for the
  // ownerByDecisionId call which preserves owner attribution for resolved
  // decisions sourced from the curated seed.
  const ownerInboxOpenDecisions: OpenDecision[] = [];

  // Lift AgentEscalation events into open decisions (Atlas substrate-gap
  // closure 2026-05-07). An escalation is "resolved" when a CeoDecision
  // event with the same decisionId as the escalationId exists. Latest
  // escalation per escalationId wins to allow correction / superseding.
  const latestEscalations = new Map<string, AgentEscalationEventSummary>();
  for (const e of escalations) {
    const prev = latestEscalations.get(e.escalationId);
    if (!prev || prev.asOf <= e.asOf) latestEscalations.set(e.escalationId, e);
  }
  const escalationOpenDecisions: OpenDecision[] = [];
  for (const e of latestEscalations.values()) {
    if (resolvedIds.has(e.escalationId)) continue;
    const sevToCategory: Record<typeof e.severity, DecisionCategory> = {
      blocking: "near-term",
      high: "near-term",
      medium: "near-term",
      low: "second-order",
    };
    escalationOpenDecisions.push({
      id: e.escalationId,
      title: e.question.length > 120 ? `${e.question.slice(0, 117)}...` : e.question,
      category: sevToCategory[e.severity],
      owner: e.raisedBy,
      trigger: `AgentEscalation event (severity: ${e.severity})`,
      decisionForCEO: e.question,
      sourceDocs: [],
      ...(e.blockedBy ? { note: `Blocked by: ${e.blockedBy}` } : {}),
    });
  }

  // Dedupe: prefer curated open entries over the event-synthesized fallback
  // (the latter has no human-authored `decisionForCEO` / `recommendation`).
  // D-DECISIONS-FRAMEWORK-REDESIGN — Owner Inbox `decision-required: true`
  // is retired as a decision-authoring channel; `ownerInboxOpenDecisions` is
  // always empty (the variable is kept for the ownerByDecisionId call below
  // which preserves owner attribution for resolved decisions).
  const knownOpenIds = new Set<string>([...remainingOpen.map((d) => d.id)]);
  const reopenedFallback = reopenedFromEvents.filter((d) => !knownOpenIds.has(d.id));

  const decisionsOpenAll = [...remainingOpen, ...reopenedFallback, ...escalationOpenDecisions];

  const ownerById = ownerByDecisionId(curated.decisionsOpen, ownerInboxOpenDecisions);

  const agents = deriveAgents({
    directReports,
    inFlight,
    decisionsOpen: decisionsOpenAll,
    decisionsResolved: resolved,
    teamDir: opts.sources.teamDir,
    ownerInboxDir: opts.sources.ownerInboxDir,
    claudeMd: opts.sources.claudeMd,
    ownerByDecisionId: ownerById,
    // RMS Phase 2 — use event-based deliverables when the source supports it.
    ...(opts.events.recentDeliverables ? { eventSource: opts.events } : {}),
  });

  // Recent open findings — Vera's overnight recon and Mira's citation gate
  // emit AuditFinding events. Roll the latest 50 by asOf into the dashboard
  // so the CEO sees them at a glance rather than only inside Vera's
  // deliverable.
  const findingsSorted: FindingSummary[] = findings
    .map(
      (f): FindingSummary => ({
        id: f.findingId,
        source: f.source,
        severity: f.severity,
        ...(f.principle ? { principle: f.principle } : {}),
        description: f.description,
        asOf: f.asOf,
      }),
    )
    .sort((a, b) => (a.asOf < b.asOf ? 1 : -1))
    .slice(0, 50);

  // Canonical bank-name register (Principle 2 downward derivation): prefer
  // /Regulations/_bank-name.md; fall through to the curated seed if the
  // register is unreadable. Drift between the two is a Vera Wave-4 #16
  // prose-duplication finding.
  const bankNameFromRegister = readBankNameFromRegister(opts.sources.bankNameRegister);
  const bankName = bankNameFromRegister ?? curated.bank.name;

  return {
    asOf: now(),
    bankName,
    bank: {
      name: curated.bank.name,
      operatingPosture: curated.bank.operatingPosture,
      strategicFoundation: curated.bank.strategicFoundation,
      cloudTarget: curated.bank.cloudTarget,
      metrics: {
        principles: principles.length,
        policies: policies.length,
        obligations,
        instruments: regs.total,
        instrumentsAnalysed: regs.populated,
        proceduresPopulated: procs.populated,
        proceduresPlanned: procs.planned,
        ceoDecisionsActioned: resolved.length,
        directReports: directReports.length,
        openGovernanceSeats: openSeats.length,
      },
    },
    directReports,
    openSeats,
    principles,
    decisionsOpen: decisionsOpenAll,
    decisionsResolved: resolved,
    inFlight,
    agents,
    policies,
    prototype: curated.prototype,
    risks: curated.risks,
    findings: findingsSorted,
    runtimeHandlers: RUNTIME_HANDLERS,
    decisionComments: commentsByDecisionId,
    limitUtilisations: opts.limitUtilisations ?? [],
    agentOps: opts.agentOps ?? {
      totalTokens7d: 0,
      totalTokens30d: 0,
      estimatedCost7d: 0,
      estimatedCost30d: 0,
      byAgent: [],
      recentAdvisories: [],
      recentOptimisations: [],
      efficiencyTrend: "stable",
      lastUpdated: "2026-05-15T00:00:00.000Z",
    },
    ftp: opts.ftp ?? null,
    capitalPositions: opts.capitalPositions ?? null,
    liquidityMetrics: opts.liquidityMetrics ?? null,
  };
}

// ---------------------------------------------------------------------------
// Runtime handler registry — derived from the canonical
// `runtime/handlers-metadata.ts` (A1 consolidation, 2026-05-07). The
// dashboard imports only the metadata array (no runtime side-effects /
// no EventStore dependency); the handler callables stay in
// `runtime/run.ts`. Adding a new handler: edit handlers-metadata.ts +
// run.ts; this view recomputes automatically.
// ---------------------------------------------------------------------------

const RUNTIME_HANDLERS: readonly RuntimeHandlerInfo[] = HANDLERS_METADATA.map(
  (h): RuntimeHandlerInfo => ({
    agent: h.agent,
    trigger: h.trigger,
    kind: h.kind,
    ...(h.cadenceHours !== undefined ? { cadenceHours: h.cadenceHours } : {}),
    ...(h.subscribesTo !== undefined ? { subscribesTo: h.subscribesTo } : {}),
  }),
);

// ---------------------------------------------------------------------------
// Watch-target paths — the set of canonical inputs the server should fs.watch.
// ---------------------------------------------------------------------------

export function watchTargets(s: SourcePaths): string[] {
  const out = [
    s.claudeMd,
    s.policyRegister,
    s.obligationsRegister,
    s.regulationsIndex,
    s.proceduresIndex,
    s.curated,
    s.bankNameRegister, // re-derive `state.bankName` if the canonical register is edited
  ];
  // Walking entire /Regulations/ would be noisy; the index is the
  // single source for instrument counts. Same for Procedures/_index.md.
  return out.filter((p) => existsSync(p));
}

// Used by tests + diagnostics: report any source path that does not exist.
export function missingSources(s: SourcePaths): string[] {
  return [
    s.claudeMd,
    s.policyRegister,
    s.obligationsRegister,
    s.regulationsIndex,
    s.proceduresIndex,
    s.curated,
  ].filter((p) => !existsSync(p));
}

// Reachability helper used by recon: how many regulator instrument folders exist.
export function regulationsFolderInventory(regulationsRoot: string): string[] {
  if (!existsSync(regulationsRoot)) return [];
  return readdirSync(regulationsRoot)
    .filter((name) => !name.startsWith("_") && !name.startsWith("."))
    .filter((name) => {
      try {
        return statSync(join(regulationsRoot, name)).isDirectory();
      } catch {
        return false;
      }
    });
}
