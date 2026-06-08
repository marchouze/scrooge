// platform/recon/posting-engine-single-subscriber.ts
//
// Continuous-controls pipeline: posting-engine single-subscriber integrity
// (WS-SLA-FULL-RETIREMENT). Authority: D-SLA-ENGINE-RULES-AS-DATA.
//
// ─── THE DEFECT THIS GUARDS ─────────────────────────────────────────────────
// PR #1095 retired the redundant `bea:fx-posting-engine` callable, which had
// been co-invoked with `bea:gl-posting-engine` (`Promise.all([...])`) over the
// SAME four FX event types — a latent DOUBLE-POSTING path. Two production
// callables both emitting `SubLedgerPostingEmitted` for the same source-event
// type produced two GL postings; it survived only because both engines
// coincidentally produced identical `postingType` strings + bare IFRS
// idempotency keys (`${sourceEventId}:${postingType}`) → accidental cross-dedup,
// first-wins. There was NO automated guard asserting single-production-ownership
// of a posting type, so the hazard was invisible to recon.
//
// The SAME class runs the other way: deleting one of two paired engines can
// silently ORPHAN a `postingType` arm the other relied on (the cancel-time
// MTM-undo bug caught in #1095 review — the retired engine owned the MTM-undo
// `reversal` posting while the surviving engine owned the booking-leg reversal;
// the split is what stranded accumulated unrealised P&L on deletion).
//
// ─── WHAT THIS PIPELINE ASSERTS ─────────────────────────────────────────────
// Statically, over the REGISTERED PRODUCTION agent callables
// (`runtime/agents/callables/*.ts` → `HANDLER_CALLABLES`) and their handler
// metadata subscriptions (`runtime/agents/metadata/*.ts` → `HANDLERS_METADATA`):
//
//   (1) SINGLE EMITTER PER SUBSCRIBED EVENT TYPE (stronger form, SHIPPED):
//       No two distinct GL-posting-emitter callables both subscribe to the same
//       source event type. A GL-posting emitter is a callable whose handler
//       module (or its bounded transitive local imports under runtime/agents/)
//       statically calls `makeSubLedgerPostingEmitted`. Two emitters sharing a
//       subscribed event type ⇒ double-posting hazard ⇒ FAIL.
//
//   (2) SINGLE OWNER PER (sourceEventType → postingType) (SHIPPED, refinement):
//       Where a handler module declares a static event-type → postingType map
//       (the `*_POSTING_TYPE` const objects the cutover modules export), no two
//       distinct emitter callables claim the same (sourceEventType, postingType)
//       pair. Subsumed by (1) for the subscribed-type axis, but stated
//       explicitly so the gate's contract names the precise idempotency-key
//       component (`postingType`) that the accidental cross-dedup keyed on.
//
// ─── SOURCE OF TRUTH ────────────────────────────────────────────────────────
// Declared handler metadata (`subscribesTo`) is authoritative for WHICH event
// types a callable consumes. Whether a callable EMITS postings is only
// discoverable from code, so a controlled, scoped static scan classifies
// emitters. The scan reads ONLY the handler modules of REGISTERED PRODUCTION
// callables (and their local runtime/agents/ imports), so the dead legacy
// surface is structurally out of scope. It additionally excludes, by path:
//   - `*.test.ts`                              — tests are not production wiring.
//   - `platform/accounting/posting-rules/*`    — leg-construction helpers
//                                                (e.g. fx-spot.ts); pure
//                                                functions, never registered
//                                                callables that emit postings.
//   - `platform/accounting/sla/*`              — the pure interpreter returns
//                                                proposed postings; it never emits
//                                                `SubLedgerPostingEmitted`.
// A shallow gate that false-positived on that dead legacy surface would be worse
// than none (Bea's TODO scope note); these exclusions keep it false-positive-free.
//
// P6 — upward chain. Reads files + pure metadata imports only; no runtime boot.
//
// Author: Atlas (Core Banking Platform Architect, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { HANDLER_CALLABLES } from "../../runtime/handler-callables";
import { HANDLERS_METADATA } from "../../runtime/handlers-metadata";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// Repo layout
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const AGENTS_DIR = resolve(REPO_ROOT, "prototype/runtime/agents");

/** The emission call that defines a GL-posting engine. */
const EMIT_CALL = "makeSubLedgerPostingEmitted";

// ---------------------------------------------------------------------------
// Inputs (overridable for tests)
// ---------------------------------------------------------------------------

export interface MetadataInput {
  readonly key: string;
  readonly agent: string;
  readonly trigger: string;
  readonly subscribesTo?: readonly string[];
}

export interface RunOpts {
  /** Override metadata source for tests. */
  metadata?: ReadonlyArray<MetadataInput>;
  /** Override registered callable keys for tests. */
  callableKeys?: ReadonlyArray<string>;
  /**
   * Override the emitter classifier for tests. Given a metadata key
   * (`agent:trigger`), returns true if that callable emits postings. When
   * omitted, the real bounded static scan over the handler module is used.
   */
  emits?: (key: string) => boolean;
  /**
   * Override the (sourceEventType → postingType) extractor for tests. Given a
   * metadata key, returns the declared map (or {} if none discoverable). When
   * omitted, the real static `*_POSTING_TYPE` extractor is used.
   */
  postingTypeMap?: (key: string) => Readonly<Record<string, string>>;
  /** Override the agents dir for tests. */
  agentsDir?: string;
}

// ---------------------------------------------------------------------------
// Static module scan — emitter classification + postingType extraction
// ---------------------------------------------------------------------------

/**
 * Resolve the handler module path for a metadata key. Convention (asserted by
 * `recon:runtime-handler-sync` for the callable/metadata sides):
 * `agent:trigger` → `runtime/agents/<agent>-<trigger>.ts`.
 */
function handlerModulePath(key: string, agentsDir: string): string {
  const agent = key.slice(0, key.indexOf(":"));
  const trigger = key.slice(key.indexOf(":") + 1);
  return resolve(agentsDir, `${agent}-${trigger}.ts`);
}

/** Read a file or return "" if it does not exist (caller treats as no-emit). */
function readOrEmpty(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

/**
 * Collect the LOCAL `runtime/agents/` modules a handler module imports, one hop
 * deep. Posting emission may be centralised in the handler module or factored
 * into a sibling cutover/bridge module it imports (e.g.
 * `bea-gl-fx-interpreter-cutover`). A bounded one-hop transitive scan catches a
 * future split-out emitter without an unbounded crawl. Excludes `.test` siblings.
 */
function localAgentImports(source: string, agentsDir: string): string[] {
  const paths: string[] = [];
  // Matches: import ... from "../<name>"  and  import ... from "./<name>"
  // i.e. sibling runtime/agents modules (one directory level, relative).
  const re = /from\s+["'](\.\.?\/[A-Za-z0-9_-]+)["']/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop.
  while ((m = re.exec(source)) !== null) {
    const rel = m[1];
    if (rel === undefined) continue;
    const base = rel.replace(/^\.\.?\//, "");
    if (base.endsWith(".test")) continue;
    const candidate = resolve(agentsDir, `${base}.ts`);
    if (existsSync(candidate)) paths.push(candidate);
  }
  return paths;
}

/**
 * Does the production callable for `key` emit `SubLedgerPostingEmitted`?
 * True iff the handler module — or one of its one-hop local runtime/agents
 * imports — statically calls `makeSubLedgerPostingEmitted`. Scoped to the
 * registered production callable's own module graph, so the deprecated
 * parity-reference / test-only surfaces are never read.
 */
function emitsPostings(key: string, agentsDir: string): boolean {
  const modulePath = handlerModulePath(key, agentsDir);
  const source = readOrEmpty(modulePath);
  if (source.length === 0) return false;
  if (source.includes(EMIT_CALL)) return true;
  for (const imp of localAgentImports(source, agentsDir)) {
    if (readOrEmpty(imp).includes(EMIT_CALL)) return true;
  }
  return false;
}

/**
 * Extract declared (sourceEventType → postingType) maps from a handler module
 * and its one-hop local imports. Recognises the `*_POSTING_TYPE` const-object
 * idiom the cutover modules export, e.g.:
 *
 *   const FX_POSTING_TYPE: Readonly<Record<string, FxPostingType>> = {
 *     FxTradeExecuted: "trade-booking",
 *     FxPositionRevalued: "revaluation",
 *     ...
 *   };
 *
 * Returns the merged { eventType: postingType } map. A best-effort static read:
 * if a module wires postingType inline (no declared map) the map is simply
 * empty for that module and Check (2) relies on Check (1) for that callable.
 */
function extractPostingTypeMap(key: string, agentsDir: string): Readonly<Record<string, string>> {
  const merged: Record<string, string> = {};
  const modulePath = handlerModulePath(key, agentsDir);
  const handlerSource = readOrEmpty(modulePath);
  const sources = [handlerSource];
  for (const imp of localAgentImports(handlerSource, agentsDir)) {
    sources.push(readOrEmpty(imp));
  }
  // Match `_POSTING_TYPE ... = { ... };` blocks, then key: "value" pairs inside.
  const blockRe = /_POSTING_TYPE[^=]*=\s*\{([\s\S]*?)\}/g;
  const pairRe = /([A-Za-z][A-Za-z0-9]*)\s*:\s*"([A-Za-z0-9-]+)"/g;
  for (const source of sources) {
    let block: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop.
    while ((block = blockRe.exec(source)) !== null) {
      const body = block[1];
      if (body === undefined) continue;
      let pair: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop.
      while ((pair = pairRe.exec(body)) !== null) {
        const eventType = pair[1];
        const postingType = pair[2];
        if (eventType === undefined || postingType === undefined) continue;
        merged[eventType] = postingType;
      }
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("posting-engine-single-subscriber");
  const violations: ReconViolation[] = [];

  const agentsDir = opts.agentsDir ?? AGENTS_DIR;

  const metadata: ReadonlyArray<MetadataInput> =
    opts.metadata ??
    HANDLERS_METADATA.map((m) => ({
      key: m.key,
      agent: m.agent,
      trigger: m.trigger,
      ...(m.subscribesTo !== undefined ? { subscribesTo: m.subscribesTo } : {}),
    }));

  const registeredKeys = new Set(opts.callableKeys ?? Object.keys(HANDLER_CALLABLES));

  const emits = opts.emits ?? ((key: string) => emitsPostings(key, agentsDir));
  const postingTypeMap =
    opts.postingTypeMap ?? ((key: string) => extractPostingTypeMap(key, agentsDir));

  // Only registered production callables are in scope.
  const emitterRows = metadata.filter((m) => registeredKeys.has(m.key) && emits(m.key));

  // -----------------------------------------------------------------------
  // Check (1): single emitter per subscribed source event type.
  // -----------------------------------------------------------------------
  const eventToEmitters = new Map<string, string[]>();
  for (const row of emitterRows) {
    for (const eventType of row.subscribesTo ?? []) {
      const owners = eventToEmitters.get(eventType) ?? [];
      owners.push(row.key);
      eventToEmitters.set(eventType, owners);
    }
  }

  for (const [eventType, owners] of [...eventToEmitters.entries()].sort()) {
    result.asserted++;
    const distinct = [...new Set(owners)].sort();
    if (distinct.length > 1) {
      violations.push({
        subject: eventType,
        message: [
          `Source event type "${eventType}" is subscribed by ${distinct.length} GL-posting`,
          `callables: ${distinct.join(", ")}.`,
          "Two production callables emitting SubLedgerPostingEmitted for the same event type",
          "is a DOUBLE-POSTING hazard (the retired bea:fx-posting-engine defect, PR #1095).",
          "Exactly one callable must own posting for each event type — retire the redundant",
          "subscriber or partition the event types.",
        ].join(" "),
        severity: "fail",
      });
    }
  }

  // -----------------------------------------------------------------------
  // Check (2): single owner per (sourceEventType → postingType) pair.
  // Refinement of (1) that names the exact idempotency-key component.
  // -----------------------------------------------------------------------
  const pairToOwners = new Map<string, string[]>();
  for (const row of emitterRows) {
    const map = postingTypeMap(row.key);
    for (const eventType of row.subscribesTo ?? []) {
      const postingType = map[eventType];
      if (!postingType) continue; // no declared map for this event on this callable
      const pairKey = `${eventType} → ${postingType}`;
      const owners = pairToOwners.get(pairKey) ?? [];
      owners.push(row.key);
      pairToOwners.set(pairKey, owners);
    }
  }

  for (const [pairKey, owners] of [...pairToOwners.entries()].sort()) {
    result.asserted++;
    const distinct = [...new Set(owners)].sort();
    if (distinct.length > 1) {
      violations.push({
        subject: pairKey,
        message: [
          `(sourceEventType → postingType) "${pairKey}" is emitted by ${distinct.length}`,
          `callables: ${distinct.join(", ")}.`,
          "The idempotency key is `${sourceEventId}:${postingType}`, so two callables on the",
          "same pair accidentally cross-dedup (first-wins) and mask a double-posting path.",
          "Exactly one callable must own each (event, postingType) pair.",
        ].join(" "),
        severity: "fail",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
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
        ? "Posting-engine single-subscriber integrity passed — exactly one production callable owns each posting event type / (event, postingType) pair"
        : "Posting-engine single-subscriber integrity FAILED — a posting event type / pair is owned by more than one production callable (double-posting hazard)",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
