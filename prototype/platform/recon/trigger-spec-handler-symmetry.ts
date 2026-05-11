// platform/recon/trigger-spec-handler-symmetry.ts
//
// Continuous-controls pipeline: trigger-spec ↔ handler-metadata symmetry
// (D-AGENT-AUTONOMY-OPERATIONAL Slice 2 — closes Gap 3).
//
// Each `/Team/<Name>.md` persona-spec declares the agent's triggers in
// its `## 7. Triggers` table — the typed events it consumes, the
// scheduled wake-ups it expects, the on-request invocations it accepts.
// `prototype/runtime/handlers-metadata.ts` is the canonical runtime
// surface — the (agent, trigger) pairs the substrate actually wires.
//
// Per Atlas's 2026-05-11 status brief
// (`Owner Inbox/2026-05-11_atlas_agent-autonomy-operational-status-and-
// delta-brief.md` §3 Gap 3): 110 triggers declared across 29 specs vs
// 37 in `HANDLERS_METADATA` — ≈73 missing-handler findings + a handful
// of handler-without-spec findings. Permission policies derived from
// spec triggers authorise things that can never fire (the bus has no
// consumer); handlers that fire have no audit-trail entry in the
// canonical mandate (the spec says nothing about them).
//
// This pipeline makes the gap visible and recon-enforced. It is
// **fail-tolerant** in build phase: pipeline returns `ok: true`
// regardless of finding count. The recon's job here is **visibility**,
// not enforcement — the per-persona stub-handler remediation batch (Slice
// 2b, sequenced per `feedback_handlers_metadata_three_way_clash`) is what
// closes the findings.
//
// What this pipeline asserts:
//
//   1. Every event-type declared in a persona's §7 table (typed-event
//      row, recognised by a backticked `EventName` token) has a
//      `HANDLERS_METADATA` entry whose `agent` matches the persona AND
//      whose `subscribesTo` contains that event.
//      → **warn** when missing (spec authorises an event-driven trigger
//      with no consumer).
//
//   2. Every scheduled-cadence row in a persona's §7 table (recognised
//      by cadence keywords — "Scheduled", "Daily", "Weekly", "Monthly",
//      "Quarterly", "Annual", "Quarter-end", "Year-end", "wake-up",
//      "UTC", numeric time-of-day) maps to at least one
//      `HANDLERS_METADATA` entry whose `agent` matches the persona AND
//      whose `kind === "scheduled"`. The spec is coarser than the
//      metadata (one row may describe multiple cadences); we de-dupe
//      to one finding per persona for the "scheduled-coverage" axis.
//      → **warn** when missing.
//
//   3. Every event-type subscription in `HANDLERS_METADATA` (each row's
//      `subscribesTo` array) is declared by the agent's §7 table.
//      → **info** when missing — handler fires for an event the spec
//      doesn't authorise; spec is the principle-7 mandate, so a handler
//      without a spec row is a documentation drift, not a substrate
//      failure (the handler still runs).
//
//   4. Every scheduled `HANDLERS_METADATA` entry has at least one
//      scheduled-cadence row in the agent's §7 table.
//      → **info** when missing — handler ticks on a cadence the spec
//      doesn't promise; observable but not blocking.
//
// Build-phase tolerance: `ok: true` regardless of finding count.
// Future escalation: warn → fail once Slice 2b remediation closes ≥80%
// of the gap (per brief §4 Slice 2 acceptance criterion 4).
//
// Output shape mirrors `event-type-registry-coverage.ts` — `ReconResult`
// + JSON `{level, time, service, pipeline, asserted, violations, ok,
// msg, breakdown, detail}`.
//
// P6 — single-graph discipline: persona §7 spec, runtime metadata, and
// permission-policy derivation must reconcile to one trigger-set per
// agent. P7 — autonomous-by-default: every standing agent's mandate (its
// `Team/<Name>.md`) MUST be the canonical declaration of what fires it.
//
// Author: Atlas (Core banking platform architect; substrate)
// Reviewer: Vera (Internal audit / continuous-assurance engineer)

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { HANDLERS_METADATA, type HandlerMetadata } from "../../runtime/handlers-metadata";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const CITATIONS = [
  "P6-SINGLE-GRAPH-DISCIPLINE",
  "P7-AUTONOMOUS-BY-DEFAULT",
  "Owner Inbox/2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md (§3 Gap 3)",
  "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-agent-autonomy-operational.md",
];

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const DEFAULT_TEAM_DIR = resolve(REPO_ROOT, "Team");

// ---------------------------------------------------------------------
// Spec-row classification
// ---------------------------------------------------------------------

export type SpecRowKind = "event-driven" | "scheduled" | "other";

export interface SpecTrigger {
  /** Persona name as it appears in the file path (e.g. "Vera"). */
  readonly persona: string;
  /** The raw first-cell text of the §7 row, trimmed. */
  readonly rawTrigger: string;
  /** Classification — drives the diff axis. */
  readonly kind: SpecRowKind;
  /**
   * For event-driven rows: the typed-event names extracted from
   * backticks. A single row may declare multiple events (e.g.
   * `` `WorkstreamRegistered` / `WorkstreamCompleted` events ``).
   */
  readonly eventTypes: readonly string[];
}

/**
 * Cadence keywords that mark a row as scheduled. Match is
 * case-insensitive and word-boundary-anchored. Any one keyword presence
 * in the row's first cell promotes it to `scheduled`.
 */
const SCHEDULED_KEYWORDS: readonly string[] = [
  "scheduled",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
  "annually",
  "quarter-end",
  "year-end",
  "month-end",
  "wake-up",
  "wake up",
];

/**
 * Time-of-day patterns that ALSO mark a row as scheduled (e.g.
 * "06:00 UTC"). Used as a fallback when the cadence keywords miss.
 */
const TIME_OF_DAY_RE = /\b\d{1,2}:\d{2}\s*UTC\b/i;

/**
 * Typed-event name pattern: `EventTypeName` (PascalCase, alphanum,
 * length ≥ 3). Match is anchored at backtick boundaries — we explicitly
 * skip backticked tokens that look like handler keys (contain `:` or
 * `-` after a lowercased prefix), npm scripts (start with `agent:`),
 * file paths, etc.
 */
const BACKTICK_TOKEN_RE = /`([^`]+)`/g;

function classifyRow(firstCell: string): {
  kind: SpecRowKind;
  eventTypes: readonly string[];
} {
  const events = extractEventTypes(firstCell);
  if (events.length > 0) {
    return { kind: "event-driven", eventTypes: events };
  }
  const lower = firstCell.toLowerCase();
  for (const kw of SCHEDULED_KEYWORDS) {
    if (lower.includes(kw)) return { kind: "scheduled", eventTypes: [] };
  }
  if (TIME_OF_DAY_RE.test(firstCell)) {
    return { kind: "scheduled", eventTypes: [] };
  }
  return { kind: "other", eventTypes: [] };
}

/**
 * Extract typed-event names from the row's first cell. Filters
 * backticked tokens to those that look like PascalCase event types
 * (`[A-Z][A-Za-z0-9]+`, ≥ 3 chars). Tokens with non-alphanumeric chars
 * (e.g. handler keys `agent:trigger`, file paths, kebab-case ids) are
 * rejected.
 */
export function extractEventTypes(text: string): readonly string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(BACKTICK_TOKEN_RE)) {
    const raw = match[1];
    if (!raw) continue;
    // Reject anything that is clearly not a typed event:
    //   - contains `:` (handler key like `agent:trigger`)
    //   - contains `/`, `\\` (file path)
    //   - contains `-` (kebab-case id, npm script tail, etc.)
    //   - contains `.` (file extension)
    //   - starts with lowercase (npm script, function name)
    if (/[:\/\\\-\.]/.test(raw)) continue;
    if (!/^[A-Z][A-Za-z0-9]{2,}$/.test(raw)) continue;
    out.add(raw);
  }
  return [...out];
}

// ---------------------------------------------------------------------
// §7 table parser
// ---------------------------------------------------------------------

/**
 * Parse the §7 Triggers table from a persona-spec markdown body.
 *
 * Tolerates both `## 7. Triggers` and `## 7 Triggers` (with or without
 * the dot). Returns the list of classified rows; an empty array means
 * no §7 section was found OR the table was empty.
 */
export function parseTriggersSection(persona: string, body: string): readonly SpecTrigger[] {
  const lines = body.split(/\r?\n/);
  // Locate the section heading.
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^##\s+7\.?\s+Triggers\s*$/.test(line)) {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx < 0) return [];
  // Walk until the next `## ` heading (or EOF).
  let endIdx = lines.length;
  for (let i = startIdx; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i] ?? "")) {
      endIdx = i;
      break;
    }
  }
  // Within the section, parse markdown table rows. The header is
  // `| Trigger | Source | Response SLA |`; the separator is `|---|---|---|`.
  // Skip those; collect data rows.
  const out: SpecTrigger[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    const line = (lines[i] ?? "").trim();
    if (!line.startsWith("|")) continue;
    // Skip header (mentions "Trigger" verbatim) and separator (`---`).
    if (/^\|[\s-]*\|/.test(line) && line.includes("---")) continue;
    if (/^\|\s*Trigger\s*\|/i.test(line)) continue;
    const cells = splitTableRow(line);
    if (cells.length === 0) continue;
    const firstCell = cells[0]?.trim() ?? "";
    if (firstCell.length === 0) continue;
    const { kind, eventTypes } = classifyRow(firstCell);
    out.push({ persona, rawTrigger: firstCell, kind, eventTypes });
  }
  return out;
}

/**
 * Split a markdown table row on unescaped pipes. Returns the cell texts
 * (without leading/trailing pipes). Preserves backtick content
 * (backticks are not pipe boundaries).
 */
function splitTableRow(line: string): string[] {
  const cells: string[] = [];
  let buf = "";
  let inBacktick = false;
  // Strip leading pipe.
  let s = line;
  if (s.startsWith("|")) s = s.slice(1);
  // Strip trailing pipe (and any trailing whitespace).
  s = s.replace(/\s*\|\s*$/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "`") {
      inBacktick = !inBacktick;
      buf += c;
    } else if (c === "|" && !inBacktick) {
      cells.push(buf);
      buf = "";
    } else {
      buf += c;
    }
  }
  cells.push(buf);
  return cells;
}

// ---------------------------------------------------------------------
// Persona-spec walker
// ---------------------------------------------------------------------

/**
 * Walk `Team/*.md` (skipping `_*` template files) and parse each
 * persona's §7 table. Returns a flat list of classified spec triggers.
 */
export function loadAllSpecTriggers(teamDir: string): readonly SpecTrigger[] {
  if (!existsSync(teamDir)) return [];
  const out: SpecTrigger[] = [];
  for (const name of readdirSync(teamDir).sort()) {
    if (name.startsWith("_")) continue;
    if (!name.endsWith(".md")) continue;
    const persona = name.slice(0, -".md".length);
    let body: string;
    try {
      body = readFileSync(resolve(teamDir, name), "utf8");
    } catch {
      continue;
    }
    out.push(...parseTriggersSection(persona, body));
  }
  return out;
}

// ---------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------

export interface RunOpts {
  /** Override Team dir for tests. */
  teamDir?: string;
  /** Override the spec triggers (synthetic-test seam). */
  specTriggers?: readonly SpecTrigger[];
  /** Override the handler metadata (synthetic-test seam). */
  handlersMetadata?: readonly HandlerMetadata[];
}

export interface SymmetryBreakdown {
  /** §7 rows whose declared event / cadence has no handler. */
  readonly specWithoutHandler: number;
  /** Handler-metadata entries whose declaration has no §7 row. */
  readonly handlerWithoutSpec: number;
  /** Sum of the above. */
  readonly total: number;
  /** Per-persona breakdown of `specWithoutHandler` — sortable by callers. */
  readonly perPersonaSpecWithoutHandler: Readonly<Record<string, number>>;
}

/**
 * Per-persona index of HANDLERS_METADATA — captures the scheduled-handler
 * count and the union of `subscribesTo` events.
 */
interface PersonaHandlerIndex {
  readonly scheduledCount: number;
  readonly subscribedEvents: ReadonlySet<string>;
  readonly handlers: readonly HandlerMetadata[];
}

function indexHandlersByPersona(
  metadata: readonly HandlerMetadata[],
): ReadonlyMap<string, PersonaHandlerIndex> {
  const out = new Map<
    string,
    {
      scheduledCount: number;
      subscribedEvents: Set<string>;
      handlers: HandlerMetadata[];
    }
  >();
  for (const h of metadata) {
    let agg = out.get(h.agent);
    if (!agg) {
      agg = { scheduledCount: 0, subscribedEvents: new Set<string>(), handlers: [] };
      out.set(h.agent, agg);
    }
    agg.handlers.push(h);
    if (h.kind === "scheduled") agg.scheduledCount++;
    for (const t of h.subscribesTo ?? []) agg.subscribedEvents.add(t);
  }
  return out;
}

interface PersonaSpecIndex {
  readonly hasScheduledRow: boolean;
  readonly declaredEvents: ReadonlySet<string>;
  readonly rows: readonly SpecTrigger[];
}

function indexSpecByPersona(
  triggers: readonly SpecTrigger[],
): ReadonlyMap<string, PersonaSpecIndex> {
  const out = new Map<
    string,
    { hasScheduledRow: boolean; declaredEvents: Set<string>; rows: SpecTrigger[] }
  >();
  for (const t of triggers) {
    let agg = out.get(t.persona);
    if (!agg) {
      agg = { hasScheduledRow: false, declaredEvents: new Set<string>(), rows: [] };
      out.set(t.persona, agg);
    }
    agg.rows.push(t);
    if (t.kind === "scheduled") agg.hasScheduledRow = true;
    for (const e of t.eventTypes) agg.declaredEvents.add(e);
  }
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("trigger-spec-handler-symmetry");
  const violations: ReconViolation[] = [];

  const teamDir = opts.teamDir ?? DEFAULT_TEAM_DIR;
  const specTriggers = opts.specTriggers ?? loadAllSpecTriggers(teamDir);
  const handlers = opts.handlersMetadata ?? HANDLERS_METADATA;

  const handlerIndex = indexHandlersByPersona(handlers);
  const specIndex = indexSpecByPersona(specTriggers);

  // Universe of personas to walk = union of both surfaces. A persona
  // present in metadata but absent from /Team/ is itself a finding (the
  // handler has no operating spec — Principle 7 violation), but
  // `recon:runtime-handler-sync` already asserts that, so we don't
  // double-emit here.
  const personas = new Set<string>();
  for (const p of specIndex.keys()) personas.add(p);
  for (const p of handlerIndex.keys()) personas.add(p);

  let specWithoutHandler = 0;
  let handlerWithoutSpec = 0;
  const perPersonaSpecWithoutHandler: Record<string, number> = {};

  // ---------------------------------------------------------------------
  // Direction 1 — spec → handler.
  // ---------------------------------------------------------------------
  for (const persona of [...personas].sort()) {
    const spec = specIndex.get(persona);
    const idx = handlerIndex.get(persona);
    if (!spec) continue;

    // Direction 1a — every declared event-type has a subscribing handler.
    for (const row of spec.rows) {
      if (row.kind !== "event-driven") continue;
      for (const eventType of row.eventTypes) {
        result.asserted++;
        const subscribed = idx?.subscribedEvents.has(eventType) ?? false;
        if (!subscribed) {
          specWithoutHandler++;
          perPersonaSpecWithoutHandler[persona] =
            (perPersonaSpecWithoutHandler[persona] ?? 0) + 1;
          violations.push({
            subject: `${persona}:event-driven:${eventType}`,
            message: `Persona ${persona}'s §7 declares event-driven trigger \`${eventType}\` but no \`HANDLERS_METADATA\` row for agent "${persona}" subscribes to it. Permission-policy derivation will authorise an eventSubscribeAllowList row with no consumer; the bus has nothing to dispatch to. Add a handler in \`runtime/handlers-metadata.ts\` (kind: "event-driven", subscribesTo includes "${eventType}") or downgrade the spec row to \`[deferred]\`. Citations: ${CITATIONS.join(", ")}.`,
            severity: "warn",
          });
        }
      }
    }

    // Direction 1b — every persona with a scheduled-cadence §7 row has at
    // least one scheduled handler. De-duped to one finding per persona
    // (the spec is coarser than the metadata; a single row may describe
    // multiple cadences and there's no clean 1:1 mapping).
    if (spec.hasScheduledRow) {
      result.asserted++;
      const hasScheduled = (idx?.scheduledCount ?? 0) > 0;
      if (!hasScheduled) {
        specWithoutHandler++;
        perPersonaSpecWithoutHandler[persona] =
          (perPersonaSpecWithoutHandler[persona] ?? 0) + 1;
        const scheduledRowsPreview = spec.rows
          .filter((r) => r.kind === "scheduled")
          .slice(0, 3)
          .map((r) => `"${r.rawTrigger}"`)
          .join(", ");
        violations.push({
          subject: `${persona}:scheduled-coverage`,
          message: `Persona ${persona}'s §7 declares ≥1 scheduled-cadence trigger (${scheduledRowsPreview}) but \`HANDLERS_METADATA\` has no \`kind: "scheduled"\` row for agent "${persona}". The substrate has no cron-driven entry-point for this agent. Add a scheduled handler in \`runtime/handlers-metadata.ts\` with a \`cronExpression\`, or downgrade the spec rows to \`[deferred]\`. Citations: ${CITATIONS.join(", ")}.`,
          severity: "warn",
        });
      }
    }
  }

  // ---------------------------------------------------------------------
  // Direction 2 — handler → spec.
  // ---------------------------------------------------------------------
  for (const persona of [...personas].sort()) {
    const spec = specIndex.get(persona);
    const idx = handlerIndex.get(persona);
    if (!idx) continue;

    // Direction 2a — every subscribesTo event has a §7 row that declares it.
    for (const handler of idx.handlers) {
      for (const eventType of handler.subscribesTo ?? []) {
        result.asserted++;
        const declared = spec?.declaredEvents.has(eventType) ?? false;
        if (!declared) {
          handlerWithoutSpec++;
          violations.push({
            subject: `${persona}:handler:${handler.trigger}:${eventType}`,
            message: `Handler ${handler.key} (kind: "${handler.kind}") subscribes to \`${eventType}\` but persona ${persona}'s §7 table declares no row for it. The handler fires on an event the agent's mandate doesn't authorise — Principle 7 documentation drift. Either add a §7 row OR retire the subscription. Citations: ${CITATIONS.join(", ")}.`,
            severity: "info",
          });
        }
      }
    }

    // Direction 2b — every scheduled handler has at least one scheduled §7
    // row. De-duped to one finding per persona, mirroring Direction 1b.
    if (idx.scheduledCount > 0) {
      result.asserted++;
      if (!spec?.hasScheduledRow) {
        handlerWithoutSpec++;
        const handlersPreview = idx.handlers
          .filter((h) => h.kind === "scheduled")
          .slice(0, 3)
          .map((h) => h.key)
          .join(", ");
        violations.push({
          subject: `${persona}:scheduled-handler-without-spec`,
          message: `Persona ${persona} has ≥1 scheduled handler in \`HANDLERS_METADATA\` (${handlersPreview}) but the §7 table declares no scheduled-cadence row. The cron fires on a cadence the agent's mandate doesn't promise. Either add a scheduled §7 row OR retire the handler. Citations: ${CITATIONS.join(", ")}.`,
          severity: "info",
        });
      }
    }
  }

  result.violations = violations;
  // Build-phase tolerance — the recon's job is visibility, not enforcement.
  // No violations are fail-severity; pipeline returns ok regardless of
  // count. Future escalation: warn → fail post-Slice-2b remediation.
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

export function buildBreakdown(result: ReconResult): SymmetryBreakdown {
  let specWithoutHandler = 0;
  let handlerWithoutSpec = 0;
  const perPersona: Record<string, number> = {};
  for (const v of result.violations) {
    if (v.severity === "warn") {
      specWithoutHandler++;
      const persona = v.subject.split(":")[0];
      if (persona) perPersona[persona] = (perPersona[persona] ?? 0) + 1;
    } else if (v.severity === "info") {
      handlerWithoutSpec++;
    }
  }
  return {
    specWithoutHandler,
    handlerWithoutSpec,
    total: specWithoutHandler + handlerWithoutSpec,
    perPersonaSpecWithoutHandler: perPersona,
  };
}

if (import.meta.main) {
  const r = run();
  const breakdown = buildBreakdown(r);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? `Trigger-spec ↔ handler-metadata symmetry surfaced (build-phase tolerance: ok regardless of count). specWithoutHandler=${breakdown.specWithoutHandler}, handlerWithoutSpec=${breakdown.handlerWithoutSpec}.`
        : "Trigger-spec ↔ handler-metadata symmetry FAILED — fail-severity finding present (unexpected in build-phase tolerance mode).",
      breakdown,
      detail: r.violations,
    }),
  );
  // Build-phase: exit 0 unless a fail-severity finding present (none today).
  process.exit(r.ok ? 0 : 1);
}
