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
import { join } from "node:path";

import type { EventStore } from "../platform/event-store/store";
import { HANDLERS_METADATA } from "../runtime/handlers-metadata";
import { parsePolicyRegister } from "./policy-register";
import type {
  AgentDeliverable,
  AgentMiniDashboard,
  DashboardState,
  DecisionAction,
  DecisionCategory,
  DecisionCommentSummary,
  DecisionRecommendation,
  FindingSummary,
  InFlightItem,
  OpenDecision,
  OpenSeat,
  OwnerInboxGroup,
  OwnerInboxItem,
  OwnerInboxKind,
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
  readonly teamRoster: string; // /Team/_team-roster.json — canonical roster (Principle 6)
  readonly principlesDir: string; // /Principles — one file per principle (Principle 6 single-graph)
  readonly ownerInboxDir: string; // /Owner Inbox — deliverables
  readonly bankNameRegister: string; // /Regulations/_bank-name.md — canonical bank-name register
}

export interface CeoDecisionEventSummary {
  readonly decisionId: string;
  readonly title: string;
  readonly action: DecisionAction;
  readonly outcome: string;
  readonly comment?: string;
  readonly actor: string;
  readonly asOf: string;
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
  ceoDecisions(): CeoDecisionEventSummary[];
  workstreamStarts(): WorkstreamStartedEventSummary[];
  workstreamCompletions(): WorkstreamCompletedEventSummary[];
  workstreamRegistrations(): WorkstreamRegisteredEventSummary[];
  agentEscalations(): AgentEscalationEventSummary[];
  auditFindings(): AuditFindingEventSummary[];
  decisionComments(): DecisionCommentEventSummary[];
}

export interface DeriveOpts {
  readonly sources: SourcePaths;
  readonly events: EventSource;
  readonly now?: () => string;
}

export function defaultSourcePaths(repoRoot: string): SourcePaths {
  return {
    repoRoot,
    claudeMd: join(repoRoot, "CLAUDE.md"),
    policyRegister: join(repoRoot, "Owner Inbox", "2026-05-06_policy-register.md"),
    obligationsRegister: join(repoRoot, "Regulations", "_obligations-register.md"),
    regulationsIndex: join(repoRoot, "Regulations", "_index.md"),
    regulationsRoot: join(repoRoot, "Regulations"),
    proceduresIndex: join(repoRoot, "Procedures", "_index.md"),
    curated: join(repoRoot, "prototype", "seeds", "dashboard-curated.json"),
    teamDir: join(repoRoot, "Team"),
    teamRoster: join(repoRoot, "Team", "_team-roster.json"),
    principlesDir: join(repoRoot, "Principles"),
    ownerInboxDir: join(repoRoot, "Owner Inbox"),
    bankNameRegister: join(repoRoot, "Regulations", "_bank-name.md"),
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
    ceoDecisions(): CeoDecisionEventSummary[] {
      const out: CeoDecisionEventSummary[] = [];
      for (const e of store.replay({ type: "CeoDecision" })) {
        const p = e.payload as Record<string, unknown>;
        const summary: CeoDecisionEventSummary = {
          decisionId: String(p.decisionId ?? ""),
          title: String(p.title ?? ""),
          action: String(p.action ?? "approve") as DecisionAction,
          outcome: String(p.outcome ?? ""),
          actor: e.actor.id,
          asOf: e.as_of,
          ...(typeof p.comment === "string" ? { comment: p.comment } : {}),
        };
        out.push(summary);
      }
      return out;
    },
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
    auditFindings(): AuditFindingEventSummary[] {
      // Accept two payload shapes:
      // (a) Mira/citation-gate shape: { findingId, source, severity, principle, description }
      // (b) Vera/recon shape:         { pipeline, subject, message, severity (info|warn|fail) }
      // Map (b)'s severity onto the canonical scale.
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
        const description =
          (typeof p.description === "string" && p.description) ||
          (typeof p.message === "string" && p.message) ||
          "";
        const principle =
          (typeof p.principle === "string" && p.principle) ||
          (typeof p.subject === "string" && p.subject) ||
          (typeof p.pipeline === "string" && `pipeline: ${p.pipeline}`) ||
          undefined;
        out.push({
          findingId: String(p.findingId ?? e.event_id),
          source: String(p.source ?? e.actor.id),
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
// directory is the single source of truth (Principle 6 single-graph
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
// the single source of truth (Principle 6 single-graph discipline);
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

function reduceCeoDecisions(
  events: readonly CeoDecisionEventSummary[],
  open: readonly OpenDecision[],
  seed: readonly ResolvedDecision[],
): { resolved: ResolvedDecision[]; remainingOpen: OpenDecision[] } {
  // Latest event per decisionId wins (handles re-action / correction).
  const latest = new Map<string, CeoDecisionEventSummary>();
  for (const e of events) {
    const prev = latest.get(e.decisionId);
    if (!prev || prev.asOf <= e.asOf) latest.set(e.decisionId, e);
  }

  const resolvedFromEvents: ResolvedDecision[] = [];
  // Decision IDs whose latest CeoDecision is `request-revision` are
  // explicitly NOT resolved — the action communicates "send back / I'm
  // not ready / Scrooge defaulted in error". The decision returns to
  // open in the dashboard. The corresponding CeoDecision event still
  // lives in the audit log.
  const reopenedIds = new Set<string>();
  for (const e of latest.values()) {
    if (e.action === "request-revision") {
      reopenedIds.add(e.decisionId);
      continue;
    }
    const original = open.find((d) => d.id === e.decisionId);
    const sourceDoc = original?.sourceDocs[0] ?? "(unsourced)";
    resolvedFromEvents.push({
      id: e.decisionId,
      title: e.title || (original?.title ?? e.decisionId),
      actionedAt: e.asOf,
      outcome: e.outcome,
      sourceDoc,
      action: e.action,
      actionedBy: e.actor,
      ...(e.comment ? { comment: e.comment } : {}),
    });
  }

  // Newest first; events sorted by asOf desc, then seed appended (older).
  resolvedFromEvents.sort((a, b) => (a.actionedAt < b.actionedAt ? 1 : -1));

  const eventIds = new Set(resolvedFromEvents.map((r) => r.id));
  const seedKept = seed.filter((s) => !eventIds.has(s.id) && !reopenedIds.has(s.id));
  const resolved = [...resolvedFromEvents, ...seedKept];

  const resolvedIds = new Set(resolved.map((r) => r.id));
  const remainingOpen = open.filter((d) => !resolvedIds.has(d.id));
  return { resolved, remainingOpen };
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

  const baseIds = new Set(base.map((b) => b.id));

  const folded = base.map((item) => {
    let next: InFlightItem = item;
    const reg = registrationMap.get(item.id);
    if (reg) {
      // Registered status overlays the base description; the curated seed
      // is the human-readable carry-forward, the event payload is the
      // authoritative latest.
      next = {
        ...next,
        what: reg.title || next.what,
        owner: reg.owner || next.owner,
        active: reg.status !== "blocked",
        ...(reg.scopedBy ? { briefDoc: reg.scopedBy } : {}),
      };
    }
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
    return next;
  });

  // Registrations that aren't in the curated base appear here as new
  // inFlight items. Started/completed events for them apply normally.
  const newFromRegistrations: InFlightItem[] = [];
  for (const [id, reg] of registrationMap) {
    if (baseIds.has(id)) continue;
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
// Owner Inbox feed
//
// Default action (Marc, 2026-05-07): every deliverable saved to /Owner Inbox/
// surfaces in the dashboard feed; items declaring `decision-required: true`
// in their YAML frontmatter are also lifted into `decisionsOpen`.
//
// Frontmatter shape (all single-line values):
//   ---
//   title: <one-line title>
//   author: <author or comma-separated authors>
//   date: YYYY-MM-DD
//   summary: <one-or-two-sentence summary>
//   decision-required: <true|false>
//   # When decision-required: true (all optional except decision-id):
//   decision-id: D-<SLUG>
//   decision-category: <pacing|near-term|second-order|medium-term|long-horizon>
//   decision-for-ceo: <one-line decision the CEO must make>
//   decision-recommendation: <one-line stance + reasoning>
//   decision-owner: <person/team driving the decision; defaults to author>
//   ---
//
// Files without frontmatter still appear in the feed — title from first H1,
// author from `**Author:**` line, date from filename. Only `decision-required:
// true` is treated as authoritative — there is no "implicit" decision lift.
// ---------------------------------------------------------------------------

interface OwnerInboxFrontmatter {
  title?: string;
  author?: string;
  date?: string;
  summary?: string;
  decisionRequired?: boolean;
  decisionId?: string;
  decisionCategory?: DecisionCategory;
  decisionForCEO?: string;
  decisionRecommendation?: string;
  decisionOwner?: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const DECISION_CATEGORIES: readonly DecisionCategory[] = [
  "pacing",
  "near-term",
  "second-order",
  "medium-term",
  "long-horizon",
];

function parseFrontmatter(content: string): { fm: OwnerInboxFrontmatter; body: string } {
  const m = content.match(FRONTMATTER_RE);
  if (!m || !m[1]) return { fm: {}, body: content };
  const fm: OwnerInboxFrontmatter = {};
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    let value = line.slice(colon + 1).trim();
    // Strip optional surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    switch (key) {
      case "title":
        fm.title = value;
        break;
      case "author":
        fm.author = value;
        break;
      case "date":
        fm.date = value;
        break;
      case "summary":
        fm.summary = value;
        break;
      case "decision-required":
        fm.decisionRequired = value.toLowerCase() === "true";
        break;
      case "decision-id":
        fm.decisionId = value;
        break;
      case "decision-category":
        if (DECISION_CATEGORIES.includes(value as DecisionCategory)) {
          fm.decisionCategory = value as DecisionCategory;
        }
        break;
      case "decision-for-ceo":
        fm.decisionForCEO = value;
        break;
      case "decision-recommendation":
        fm.decisionRecommendation = value;
        break;
      case "decision-owner":
        fm.decisionOwner = value;
        break;
      default:
        // Unknown key — ignored. Keeps the parser tolerant of forward-extension.
        break;
    }
  }
  return { fm, body: content.slice(m[0].length) };
}

const H1_RE = /^#\s+(.+)$/;
const AUTHOR_LINE_RE = /^\*\*Authors?:\*\*\s+(.+?)\s*$/i;

function fallbackTitle(body: string, filename: string): string {
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(H1_RE);
    if (m?.[1]) return m[1].trim();
  }
  return humaniseSlug(filename);
}

function fallbackAuthor(body: string): string | undefined {
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(AUTHOR_LINE_RE);
    if (m?.[1]) {
      // Strip parenthetical role suffixes — "Vera (Internal audit ...)" → "Vera".
      return m[1].replace(/\s*\([^)]*\)\s*$/, "").trim();
    }
  }
  return undefined;
}

// Metadata-style lines like `**Author:** Atlas` or `**Date:** 2026-05-07` —
// to be skipped when extracting the summary fallback.
const METADATA_LINE_RE = /^\*\*[^*]+:\*\*/;

function fallbackSummary(body: string): string | undefined {
  // First non-empty paragraph after the first H1, skipping bold metadata
  // lines (Author/Date/etc) and blockquotes. A run of metadata lines does
  // *not* count as the paragraph terminator — keep scanning until a real
  // paragraph appears.
  const lines = body.split(/\r?\n/);
  let pastH1 = false;
  const collected: string[] = [];
  for (const line of lines) {
    if (!pastH1) {
      if (H1_RE.test(line)) pastH1 = true;
      continue;
    }
    const trimmed = line.trim();
    if (trimmed === "") {
      if (collected.length > 0) break;
      continue;
    }
    if (METADATA_LINE_RE.test(trimmed)) continue;
    if (trimmed.startsWith("**") && trimmed.endsWith("**")) continue;
    if (trimmed.startsWith(">")) continue;
    if (trimmed.startsWith("---")) break;
    if (trimmed.startsWith("##")) break;
    collected.push(trimmed);
    if (collected.join(" ").length > 240) break;
  }
  if (collected.length === 0) return undefined;
  const joined = collected.join(" ").replace(/\s+/g, " ");
  return joined.length > 240 ? `${joined.slice(0, 237).trimEnd()}…` : joined;
}

function decisionIdFromFilename(filename: string): string {
  const slug = filename.replace(/^\d{4}-\d{2}-\d{2}_/, "").replace(/\.md$/i, "");
  return `D-OI-${slug
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

// Filename-based classification. Used by the renderer for grouping and by
// `displayTitleFor` for title cleanup. See `OwnerInboxKind` in types.ts.
export function ownerInboxKindFromFilename(filename: string): OwnerInboxKind {
  // `*_ceo-decision-record_*.md` (any agent prefix)
  if (/_ceo-decision-record[_-]/i.test(filename)) return "decision-record";
  // `*_ceo-decision-pack_*.md` (any agent prefix)
  if (/_ceo-decision-pack[_-]/i.test(filename)) return "decision-pack";
  return "deliverable";
}

// Extract the decision id (D-XXX) from a decision-record / decision-pack
// filename. Returns null if no D-XXX slug is present. Used by
// `displayTitleFor` to build short titles like "Decision record · D-FOO".
function decisionIdFromRecordFilename(filename: string): string | null {
  // Examples:
  //   2026-05-10_scrooge_ceo-decision-record_d-product-construction-substrate.md
  //   2026-05-10_scrooge_ceo-decision-pack_d-hire-six-seats.md
  const m = filename.match(/_(d-[a-z0-9-]+?)(?:\.md|_)/i);
  if (!m || !m[1]) return null;
  return m[1].toUpperCase();
}

// Like `decisionIdFromRecordFilename` but also recognises sessional ids
// such as `..._ceo-decision-record_s7.md` → `S7`. Used by the resolved-set
// synthesiser, which needs to mark sessional decisions resolved too. Kept
// separate from the display-title helper so existing presentation tests
// don't shift.
function resolutionIdFromRecordFilename(filename: string): string | null {
  const dPath = decisionIdFromRecordFilename(filename);
  if (dPath) return dPath;
  const m = filename.match(/_ceo-decision-record_(s\d+)\.md$/i);
  return m?.[1] ? m[1].toUpperCase() : null;
}

// Parse on-disk Owner-Inbox decision records into CeoDecision-event-shaped
// summaries. Used by `runtime/decisions/backfill-from-records.ts` to emit
// any events that are missing from the local store at boot — the local
// sqlite store is gitignored and per-worktree (memory
// `feedback_cache_in_commit_graph_anti_pattern`), so a fresh worktree
// reads zero CeoDecision events even though 30+ records sit on disk.
// Backfilling at boot keeps Principle 1 intact: the event store remains
// the single canonical source the dashboard derivation reads from.
//
// Parses three body shapes:
//   - Single-id record:   `- **Decision ID:** \`D-XXX\``
//   - Multi-id record:    `- **Decision IDs resolved:** \`D-A\` + \`D-B\` + ...`
//   - Title-only fallback (filename slug used when both lines are absent).
const RECORD_FILENAME_RE = /_ceo-decision-record_/i;
const DECISION_ID_LINE_RE = /\*\*Decision ID(?:s resolved)?:\*\*\s*(.+?)\s*$/i;
const ALL_DIDS_RE = /`((?:D|S)-[A-Z0-9][A-Z0-9-]*)`/g;
const ACTION_LINE_RE = /\*\*Action:\*\*\s*(.+?)\s*$/i;
const TITLE_LINE_RE = /\*\*Title:\*\*\s*(.+?)\s*$/i;
const OUTCOME_LINE_RE = /\*\*Outcome:\*\*\s*(.+?)\s*$/i;
const ACTOR_LINE_RE = /\*\*Actor:\*\*\s*`?([^`(]+)`?/i;
const COMMENT_LINE_RE = /\*\*Comment:\*\*\s*(.+?)\s*$/i;
const ASOF_FRONTMATTER_RE = /^asOf:\s*(.+?)\s*$/im;

function parseAction(raw: string): DecisionAction {
  const lower = raw.toLowerCase();
  if (lower.includes("request-revision") || lower.includes("revise")) return "request-revision";
  if (lower.startsWith("defer")) return "defer";
  if (lower.startsWith("modify")) return "modify";
  return "approve"; // "approve as drafted", "approve all 3", bare "approve", or unknown
}

export function synthesizeCeoDecisionsFromRecords(
  ownerInboxDir: string,
): CeoDecisionEventSummary[] {
  if (!existsSync(ownerInboxDir)) return [];
  const out: CeoDecisionEventSummary[] = [];
  const dirs = [ownerInboxDir, join(ownerInboxDir, "actioned")];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const filename of readdirSync(dir)) {
      if (!RECORD_FILENAME_RE.test(filename)) continue;
      if (!filename.toLowerCase().endsWith(".md")) continue;
      const full = join(dir, filename);
      try {
        if (!statSync(full).isFile()) continue;
      } catch {
        continue;
      }
      const content = readFileSync(full, "utf8");
      const fmMatch = content.match(FRONTMATTER_RE);
      const body = fmMatch ? content.slice(fmMatch[0].length) : content;
      const fmBlock = fmMatch?.[1] ?? "";

      // Collect decision-ids: prefer the explicit `Decision IDs resolved`
      // line (multi-id case); fall back to the filename-derived id.
      const ids = new Set<string>();
      for (const line of body.split(/\r?\n/)) {
        const m = line.match(DECISION_ID_LINE_RE);
        if (!m?.[1]) continue;
        for (const idMatch of m[1].matchAll(ALL_DIDS_RE)) {
          if (idMatch[1]) ids.add(idMatch[1].toUpperCase());
        }
      }
      if (ids.size === 0) {
        const idFromFilename = resolutionIdFromRecordFilename(filename);
        if (idFromFilename) ids.add(idFromFilename);
      }
      if (ids.size === 0) continue;

      // Pull metadata from the record body.
      let action: DecisionAction = "approve";
      let title = "";
      let outcome = "";
      let actor = "marc@tgv.co.za";
      let comment: string | undefined;
      for (const line of body.split(/\r?\n/)) {
        const a = line.match(ACTION_LINE_RE);
        if (a?.[1]) action = parseAction(a[1]);
        const t = line.match(TITLE_LINE_RE);
        if (t?.[1]) title = t[1].replace(/`/g, "").trim();
        const o = line.match(OUTCOME_LINE_RE);
        if (o?.[1]) outcome = o[1].trim();
        const ac = line.match(ACTOR_LINE_RE);
        if (ac?.[1]) actor = ac[1].trim();
        const c = line.match(COMMENT_LINE_RE);
        if (c?.[1]) comment = c[1].replace(/^["']|["']$/g, "").trim();
      }
      const asOfFm = fmBlock.match(ASOF_FRONTMATTER_RE);
      const date = fileDate(filename);
      const asOf = asOfFm?.[1]?.trim() ?? (date ? `${date}T12:00:00.000Z` : "");
      if (!asOf) continue;

      for (const id of ids) {
        out.push({
          decisionId: id,
          title: title || id,
          action,
          outcome,
          actor,
          asOf,
          ...(comment ? { comment } : {}),
        });
      }
    }
  }
  return out;
}

// Build a short, scannable title for the Owner Inbox feed. Verbose
// agent-prefixed titles like
//   "Scrooge (Chief of Staff / Orchestrator) — CEO decision record:
//    D-PRODUCT-CONSTRUCTION-SUBSTRATE, 2026-05-10"
// collapse to "Decision record · D-PRODUCT-CONSTRUCTION-SUBSTRATE".
// Returns the original title when no rule applies.
export function displayTitleFor(title: string, filename: string, kind: OwnerInboxKind): string {
  if (kind === "decision-record") {
    const id = decisionIdFromRecordFilename(filename);
    if (id) return `Decision record · ${id}`;
    // Fallback: try to extract the id out of the title itself.
    const m = title.match(/(D-[A-Z0-9][A-Z0-9-]+)/);
    if (m?.[1]) return `Decision record · ${m[1]}`;
    return "Decision record";
  }
  if (kind === "decision-pack") {
    const id = decisionIdFromRecordFilename(filename);
    if (id) return `Decision pack · ${id}`;
    const m = title.match(/(D-[A-Z0-9][A-Z0-9-]+)/);
    if (m?.[1]) return `Decision pack · ${m[1]}`;
  }
  return title;
}

export function parseOwnerInboxFile(filename: string, content: string): OwnerInboxItem {
  const { fm, body } = parseFrontmatter(content);
  const date = fm.date ?? fileDate(filename) ?? "";
  const title = fm.title ?? fallbackTitle(body, filename);
  const author = fm.author ?? fallbackAuthor(body);
  const summary = fm.summary ?? fallbackSummary(body);
  const decisionRequired = fm.decisionRequired ?? false;
  const kind = ownerInboxKindFromFilename(filename);
  const displayTitle = displayTitleFor(title, filename, kind);
  // `group` is computed conservatively here — `decision-open` if
  // `decisionRequired` is set, otherwise `informational`. `deriveState`
  // upgrades this to `decision-resolved` once it has the CeoDecision
  // event set for the run.
  const group: OwnerInboxGroup = decisionRequired ? "decision-open" : "informational";
  const item: OwnerInboxItem = {
    filename,
    path: `Owner Inbox/${filename}`,
    date,
    title,
    displayTitle,
    kind,
    decisionRequired,
    group,
    ...(author ? { author } : {}),
    ...(summary ? { summary } : {}),
  };
  if (decisionRequired) {
    item.decisionId = fm.decisionId ?? decisionIdFromFilename(filename);
    if (fm.decisionCategory) item.decisionCategory = fm.decisionCategory;
    if (fm.decisionForCEO) item.decisionForCEO = fm.decisionForCEO;
    if (fm.decisionRecommendation) item.decisionRecommendation = fm.decisionRecommendation;
    if (fm.decisionOwner) item.decisionOwner = fm.decisionOwner;
  }
  return item;
}

// Read /Owner Inbox/, return items most-recent-first (cap retains tidy UI).
export function parseOwnerInbox(dir: string, limit = 25): OwnerInboxItem[] {
  if (!existsSync(dir)) return [];
  const items: OwnerInboxItem[] = [];
  for (const filename of readdirSync(dir)) {
    if (filename.startsWith(".") || filename.startsWith("_")) continue;
    if (!filename.toLowerCase().endsWith(".md")) continue;
    const full = join(dir, filename);
    try {
      if (!statSync(full).isFile()) continue;
    } catch {
      continue;
    }
    const content = readFileSync(full, "utf8");
    items.push(parseOwnerInboxFile(filename, content));
  }
  items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.filename < b.filename ? 1 : -1;
  });
  return items.slice(0, limit);
}

// Split a free-form `decision-recommendation:` string into the structured
// `{ stance, reasoning }` shape consumed by `OpenDecision.recommendation`
// and the `decision-recommendation` recon pipeline. The first sentence is
// the stance; remaining sentences are the reasoning. Strings without a
// sentence break go entirely into stance with empty reasoning.
function splitRecommendation(text: string): DecisionRecommendation {
  const trimmed = text.trim();
  const idx = trimmed.indexOf(". ");
  if (idx === -1) return { stance: trimmed, reasoning: "" };
  return {
    stance: trimmed.slice(0, idx + 1),
    reasoning: trimmed.slice(idx + 2).trim(),
  };
}

// Comparator for the rendered Owner Inbox feed. Groups items into three
// buckets — open decisions first, informational second, resolved last —
// and within each group orders most-recent-first (date desc, then filename
// desc for stability within a date).
//
// Rationale (Anya + Atlas, 2026-05-10): pure date-sort interleaves open
// decisions with informational records and resolved items, which makes the
// "what does the CEO need to action?" queue hard to scan. Grouping puts
// open work at the top and demotes resolved noise to the bottom without
// hiding it (audit trail intact).
const GROUP_ORDER: Record<OwnerInboxGroup, number> = {
  "decision-open": 0,
  informational: 1,
  "decision-resolved": 2,
};
export function ownerInboxFeedSort(a: OwnerInboxItem, b: OwnerInboxItem): number {
  const ag = GROUP_ORDER[a.group];
  const bg = GROUP_ORDER[b.group];
  if (ag !== bg) return ag - bg;
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.filename < b.filename ? 1 : -1;
}

// Lift Owner-Inbox decision-required items into OpenDecision shape so they
// merge into the same `decisionsOpen` list as the curated decisions. Items
// already resolved via a CeoDecision event are excluded by the caller.
export function ownerInboxToOpenDecisions(
  items: readonly OwnerInboxItem[],
  resolvedIds: ReadonlySet<string>,
): OpenDecision[] {
  const out: OpenDecision[] = [];
  for (const item of items) {
    if (!item.decisionRequired || !item.decisionId) continue;
    if (resolvedIds.has(item.decisionId)) continue;
    out.push({
      id: item.decisionId,
      title: item.title,
      category: item.decisionCategory ?? "near-term",
      owner: item.decisionOwner ?? item.author ?? "(unassigned)",
      trigger: item.summary ?? `Deliverable: ${item.path}`,
      decisionForCEO: item.decisionForCEO ?? `See ${item.path}`,
      sourceDocs: [item.path],
      ...(item.decisionRecommendation
        ? { recommendation: splitRecommendation(item.decisionRecommendation) }
        : {}),
    });
  }
  return out;
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
      path: `Owner Inbox/${filename}`,
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
// reports) appear on the agents page. Per Principle 6 (presentations derive
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
}

// ---------------------------------------------------------------------------
// Reports-to mapping — parsed from CLAUDE.md "Engineering vs governance"
// paragraph + the Vera CAE-line statement. Per Principle 7 (autonomous
// agents) and the CEO directive of 2026-05-07: every direct-report rolls up
// the duties of those reporting to them.
// ---------------------------------------------------------------------------

// Mapping from CLAUDE.md prose like:
//   "Rohan → Helena (CRO); Mira → Zara (CCO); Bea, Yael → Camille (CFO); ..."
// Returns: governance-head name → list of engineer names.
function parseReportsTo(claudeMd: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!existsSync(claudeMd)) return out;
  const text = readFileSync(claudeMd, "utf8");

  // Find the Engineering-vs-governance reporting paragraph. The paragraph
  // contains semicolon-separated entries of the form "<engineer-list> →
  // <head> (<role>)". Use a tolerant regex that survives paragraph
  // rewrites.
  const pattern =
    /([A-Z][A-Za-z]+(?:\s*,\s*[A-Z][A-Za-z]+(?:\s*\([^)]*\))?)*)\s*→\s*([A-Z][A-Za-z]+)\s*\(/g;
  for (const m of text.matchAll(pattern)) {
    const engineers = (m[1] ?? "")
      .split(/\s*,\s*/)
      .map((s) => s.replace(/\s*\([^)]*\)/, "").trim())
      .filter((s) => /^[A-Z][A-Za-z]+$/.test(s));
    const head = (m[2] ?? "").trim();
    if (!head || engineers.length === 0) continue;
    const list = out.get(head) ?? [];
    for (const e of engineers) if (!list.includes(e)) list.push(e);
    out.set(head, list);
  }

  // Static mappings the CLAUDE.md paragraph doesn't enumerate cleanly:
  // Vera (CAE-line) and PAX/Nolan (under Scrooge). We add these conservatively.
  const veraSet = out.get("Thandiwe") ?? [];
  if (!veraSet.includes("Vera")) veraSet.push("Vera");
  out.set("Thandiwe", veraSet);

  const scroogeSet = out.get("Scrooge") ?? [];
  for (const s of ["PAX", "Nolan"]) if (!scroogeSet.includes(s)) scroogeSet.push(s);
  out.set("Scrooge", scroogeSet);

  return out;
}

function buildSubordinate(
  name: string,
  teamDir: string,
  ownerInboxDir: string,
  inFlight: readonly InFlightItem[],
  decisionsOpen: readonly OpenDecision[],
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
  const recentDeliverables = recentDeliverablesFor(ownerInboxDir, name, 5);
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

    const recentDeliverables = recentDeliverablesFor(input.ownerInboxDir, person.name);

    // Build subordinates per the parsed reports-to mapping.
    const subordinateNames = reportsTo.get(person.name) ?? [];
    const subordinates: SubordinateMini[] = subordinateNames.map((n) =>
      buildSubordinate(n, input.teamDir, input.ownerInboxDir, input.inFlight, input.decisionsOpen),
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
  const now = opts.now ?? (() => new Date().toISOString());
  const curated = readCurated(opts.sources.curated);

  const principles = parsePrinciples(opts.sources.principlesDir);
  // P1: parse the policy register into typed Policy[] entries on every tick.
  // The count flows into bank.metrics.policies; the array surfaces as the
  // top-level `policies` field for the policies-library page.
  const policies: readonly Policy[] = parsePolicyRegister({
    path: opts.sources.policyRegister,
    obligationsRegister: opts.sources.obligationsRegister,
  });
  const obligations = countObligations(opts.sources.obligationsRegister);
  const regs = regulationStats(opts.sources.regulationsIndex);
  const procs = procedureStats(opts.sources.proceduresIndex);
  const { directReports, openSeats } = parseTopOfHouse(
    opts.sources.teamRoster,
    opts.sources.claudeMd,
  );

  const ceoEvents = opts.events.ceoDecisions();
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

  const { resolved, remainingOpen } = reduceCeoDecisions(
    ceoEvents,
    curated.decisionsOpen,
    curated.decisionsResolvedSeed,
  );
  const inFlight = reduceInFlight(curated.inFlight, wsStarts, wsCompletions, wsRegistrations);

  // Owner Inbox feed (Marc, 2026-05-07): every deliverable in /Owner Inbox/
  // surfaces in the dashboard, and `decision-required: true` items are lifted
  // into decisionsOpen alongside the curated set. Resolved status is read off
  // the CeoDecision event stream.
  //
  // Presentation grouping (Anya + Atlas, 2026-05-10): the rendered feed
  // groups items into three buckets — open decisions first, informational
  // second, resolved decisions last — and within each group sorts most-
  // recent-first. This replaces the prior pure date-sort which interleaved
  // open / resolved / informational and made the queue hard to scan.
  const resolvedIds = new Set(resolved.map((r) => r.id));
  // Cap at 200 (was 25 default). Autonomous agent runs now produce dozens of
  // deliverables per scheduler tick (per S8 Tier 1 substrate, PRs #185-#190);
  // 25 dropped legitimate items within a single tick. The renderer adds
  // "Show older" pagination on top of this cap so the visual feed stays
  // scannable without losing audit-trail items.
  const rawOwnerInbox = parseOwnerInbox(opts.sources.ownerInboxDir, 200);
  const ownerInboxFeed: OwnerInboxItem[] = rawOwnerInbox
    .map((item): OwnerInboxItem => {
      if (!item.decisionRequired || !item.decisionId) return item;
      const isResolved = resolvedIds.has(item.decisionId);
      const decisionStatus: "open" | "resolved" = isResolved ? "resolved" : "open";
      const group: OwnerInboxGroup = isResolved ? "decision-resolved" : "decision-open";
      return { ...item, decisionStatus, group };
    })
    .sort(ownerInboxFeedSort);
  const ownerInboxOpenDecisions = ownerInboxToOpenDecisions(ownerInboxFeed, resolvedIds);

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

  const decisionsOpenAll = [
    ...remainingOpen,
    ...ownerInboxOpenDecisions,
    ...escalationOpenDecisions,
  ];

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

  // Canonical bank-name register (Principle 6 downward derivation): prefer
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
    ownerInboxFeed,
    policies,
    prototype: curated.prototype,
    risks: curated.risks,
    findings: findingsSorted,
    runtimeHandlers: RUNTIME_HANDLERS,
    decisionComments: commentsByDecisionId,
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
    s.ownerInboxDir, // fires on any deliverable add/change so the feed stays live
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
