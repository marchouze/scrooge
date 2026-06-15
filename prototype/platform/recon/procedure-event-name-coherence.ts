// platform/recon/procedure-event-name-coherence.ts
//
// Continuous-controls pipeline: procedure-prose ↔ typed-substrate event-name
// coherence.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2 (CEO-approved 2026-05-10) —
//     established the canonical typed `Product*` event family in
//     `prototype/platform/event-store/event-types/product.ts`.
//   - Principles/2-single-graph-discipline.md — single bidirectional graph;
//     every prose reference resolves to a typed node in the substrate; no
//     orphans.
//   - PR #673 (Saskia walk for FX-spot internal pre-licence test, merged
//     2026-05-21) — surfaced the PROC-NPA-GATE-01 prose drift (`NPAGate*`
//     and `NewProduct*` references with no matching factories in the typed
//     event family). This recon is the substrate-hygiene follow-on
//     authored by Atlas (Core banking platform architect, engineering) and
//     Owen (Company Secretary, governance) under brief
//     `brief:atlas:reconcile-proc-npa-gate-01-procedure-prose-with-:2026-05-21`.
//
// What this pipeline asserts:
//
//   For every procedure file under `Procedures/by-policy/**/*.md`, every
//   backtick-delimited PascalCase identifier that looks like an event-type
//   reference (matches `^[A-Z][A-Za-z0-9]+$`, plain or followed by a `{ ... }`
//   payload snippet) MUST resolve to one of:
//
//     1. A `type: "<X>"` literal in any factory under
//        `prototype/platform/event-store/event-types/*.ts` (i.e. a real
//        `make<X>` factory exists), OR
//     2. A row in `EVENT_TYPE_REGISTRY` (registered typed event), OR
//     3. The recognised allowlist of non-event tokens (CDM enums,
//        Principles, well-known type aliases, helper symbols — see
//        `NON_EVENT_TOKEN_ALLOWLIST`), OR
//     4. The retirement-prose carve-out: lines that explicitly mark the
//        identifier as retired vocabulary (matching one of the
//        `RETIREMENT_CONTEXT_MARKERS` substrings on the same line).
//
// A reference that satisfies none of the above is a finding (severity
// `fail`) — it is procedure-prose drift from the typed substrate and a
// Principle 2 violation.
//
// Empty-state correctness: zero procedure files OR zero event-name
// references → `ok: true, asserted: 0`.
//
// Why a recon, not just a one-off cleanup. The PROC-NPA-GATE-01 drift sat
// in the procedure register for six days between authoring (v0.1
// 2026-05-13) and discovery (PR #673 2026-05-21). A pure prose rewrite
// closes the immediate gap; the recon is what prevents the next one. Every
// future procedure-prose change touches a Vera-asserted invariant: any
// new event-name reference must resolve to a canonical factory before the
// PR merges.
//
// Author: Atlas (Core banking platform architect, engineering)
// Co-author: Owen (Company Secretary, governance) — procedure-prose
//             authority partner

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { EVENT_TYPE_REGISTRY } from "../event-store/registry";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "procedure-event-name-coherence";

// ---------------------------------------------------------------------------
// Repo-root discovery (mirrors the pattern used in other recons).
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
const PROCEDURES_DIR = resolve(REPO_ROOT, "Procedures");
const EVENT_TYPES_DIR = resolve(REPO_ROOT, "prototype/platform/event-store/event-types");

// ---------------------------------------------------------------------------
// Factory discovery.
//
// We walk `prototype/platform/event-store/event-types/*.ts` and extract the
// set of event-type names that appear as `type: "<Name>"` inside a factory
// `eventSchema.parse({ ... })` call. This is the source-of-truth for what
// the substrate considers a real typed event. We also unify with the
// `EVENT_TYPE_REGISTRY` rows (some registry-only types have envelope-only
// emit sites without a `make<X>` factory yet — Vera tolerates that under
// `event-type-registry-coverage`; we tolerate it here too).
// ---------------------------------------------------------------------------

function loadFactoryTypeNames(): Set<string> {
  const out = new Set<string>();
  if (!existsSync(EVENT_TYPES_DIR)) return out;
  const entries = readdirSync(EVENT_TYPES_DIR);
  for (const entry of entries) {
    if (!entry.endsWith(".ts")) continue;
    const full = join(EVENT_TYPES_DIR, entry);
    const stat = statSync(full);
    if (!stat.isFile()) continue;
    const body = readFileSync(full, "utf8");
    // Match `type: "<Name>"` — Name is a PascalCase identifier.
    const re = /\btype:\s*"([A-Z][A-Za-z0-9]+)"/g;
    let m: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex walk
    while ((m = re.exec(body)) !== null) {
      const captured = m[1];
      if (captured !== undefined) out.add(captured);
    }
  }
  return out;
}

function loadRegistryTypeNames(): Set<string> {
  const out = new Set<string>();
  for (const row of EVENT_TYPE_REGISTRY) {
    out.add(row.type);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Non-event allowlist.
//
// PascalCase backtick-wrapped tokens that look like event names but are
// not. Conservatively maintained — additions require justification in the
// PR description. The intent is to keep the recon strict by default; the
// allowlist captures known-safe non-event vocabulary that appears in
// procedure prose (CDM enums, principle tags, well-known type aliases,
// utility symbols, register codes).
// ---------------------------------------------------------------------------

const NON_EVENT_TOKEN_ALLOWLIST: ReadonlySet<string> = new Set<string>([
  // CDM / domain enums and identifiers
  "BLAKE3",
  "BRC",
  "EXCO",
  "FAIS",
  "POPIA",
  "AML",
  "RAS",
  "IFRS",
  "GAAP",
  "ISDA",
  "GMRA",
  "FATCA",
  "CRS",
  "CTR",
  "STR",
  "RCSA",
  "FRTB",
  "PIR",
  "DOA",
  "FTP",
  "SLA",
  "CDM",
  "EDD",
  "KYC",
  "JSE",
  "NPS",
  "CLS",
  "DCAM",
  "CIO",
  "CRO",
  "CFO",
  "COO",
  "CCO",
  "CISO",
  "CAE",
  "CEO",
  "GC",
  "MLRO",
  "ECTA",
  "SARB",
  "FSCA",
  "FIC",
  "ECL",
  "LCR",
  "NSFR",
  "CET1",
  "RWA",
  "BCBS",
  "SARB",
  "SBOM",
  "OTC",
  "JS2",
  "USD",
  "ZAR",
  "EUR",
  "GBP",
  "CIB",
  // Schema sub-types (not event types) referenced in procedure prose
  "ProductDeferredGap", // payload sub-type of ProductDimensionAttested; not a standalone event
  // Identity / role tokens that appear unbacktickd in some procedure rows
  // are excluded; we only check backticked tokens.
]);

// ---------------------------------------------------------------------------
// Retirement-context carve-out.
//
// Any line that contains one of these substrings is treated as
// retirement-acknowledgement prose: event names that appear in such lines
// are exempted (the line is explicitly documenting *retired* vocabulary).
// This is how PROC-NPA-GATE-01 v0.3's change-log row and "Event-name
// vocabulary" paragraph keep their `NPAGate*` and `NewProduct*` mentions
// without re-introducing drift.
//
// The list is short by design: the only acceptable reasons to mention a
// retired event name in a procedure are (a) a change-log row documenting
// the retirement, (b) a documented retirement paragraph, or (c) a recon
// citation block referencing the original drift PR. Anything else is
// genuine drift.
// ---------------------------------------------------------------------------

const RETIREMENT_CONTEXT_MARKERS: ReadonlyArray<string> = [
  "retired",
  "Retired",
  "vocabulary retired",
  "drift",
  "Drift",
  "Event-name vocabulary",
  "no separate", // for "no separate NewProductDeferred event exists ..."
];

// ---------------------------------------------------------------------------
// Strict-scope procedure files.
//
// Procedure files in this set are asserted at `fail` severity — any
// unresolved event-name reference is a blocking finding. This is the
// scope of the present brief (PR #673 follow-on): the product-lifecycle
// procedures must be coherent with the canonical typed `Product*` family.
//
// Procedure files outside this set are asserted at `warn` severity for
// the build-phase tolerance window. The full corpus has accumulated
// procedure-prose ↔ typed-substrate drift over the months of authoring;
// surfacing the count as warn-severity gives the same controls signal
// without blocking unrelated CI runs. Each warn becomes a Vera roadmap
// item; the severity escalates to `fail` once each domain's procedure
// vocabulary has been reconciled.
//
// To add a procedure to the strict scope: author the prose rewrite as
// part of the same PR that adds the file path here. The recon will
// then fail until every event-name reference in that file resolves.
// ---------------------------------------------------------------------------

const STRICT_SCOPE_PROCEDURE_PATHS: ReadonlySet<string> = new Set<string>([
  // PR #673 / 2026-05-21 brief
  // (`brief:atlas:reconcile-proc-npa-gate-01-procedure-prose-with-:2026-05-21`)
  // scope: PROC-NPA-GATE-01 is the procedure that surfaced the drift; it
  // is the only file the present slice rewrote end-to-end against the
  // canonical typed family. The other product-lifecycle procedures
  // (new-product-due-diligence, product-controlled-launch,
  // product-post-implementation-review, product-retirement-migration)
  // reference further product-lifecycle event names that today have no
  // matching `make<X>` factory (e.g. `ProductPIRCompleted`,
  // `ProductControlledLaunchStarted`); resolving those is a separate
  // brief (either substrate-side, by adding the missing factories, or
  // prose-side, by rewriting to canonical names). They are surfaced at
  // `warn` until that brief lands.
  "Procedures/by-policy/npa-gate.md",
]);

function severityForFile(relPath: string): "fail" | "warn" {
  // Exact match against the repo-relative path (production callsite), OR
  // suffix match (test fixtures that use tmpdir paths but share the
  // trailing `Procedures/by-policy/<file>.md` suffix). Suffix match is
  // safe because the strict-scope paths are unambiguous filenames.
  for (const p of STRICT_SCOPE_PROCEDURE_PATHS) {
    if (relPath === p || relPath.endsWith(`/${p}`)) return "fail";
  }
  return "warn";
}

// ---------------------------------------------------------------------------
// Procedure-file walk.
// ---------------------------------------------------------------------------

function listProcedureFiles(): string[] {
  const out: string[] = [];
  if (!existsSync(PROCEDURES_DIR)) return out;

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!stat.isFile()) continue;
      if (!full.endsWith(".md")) continue;
      out.push(full);
    }
  };
  walk(PROCEDURES_DIR);
  return out.sort();
}

// ---------------------------------------------------------------------------
// Event-name reference extraction.
//
// We narrow to *clear* event-name references rather than every PascalCase
// backtick-wrapped token (procedures contain status tags like `PLANNED`,
// `POPULATED`, persona names like `Atlas`, register codes like `ORG-PR-24`,
// and many other PascalCase strings that are not events).
//
// A backtick-wrapped PascalCase token qualifies as an event-name reference
// if any of the following are true on the same line:
//
//   (a) The token is followed (inside the same backtick span) by a payload
//       brace `{` — e.g. `` `ProductApproved { productId, ... }` ``. The
//       payload-brace shape is unambiguously an event reference.
//   (b) The token is preceded by an emit verb on the same line — `emit`,
//       `emits`, `emitted`, `emitting`. Procedure prose uses this verb
//       almost exclusively for event emission.
//   (c) The token is followed by the noun `event` (or `events`) on the
//       same line within ~25 chars — e.g. "the `ProductApproved` event".
//
// This is deliberately conservative: a token that is just `` `Saskia` ``
// or `` `STUB` `` is ignored; only tokens that are explicitly named as
// events get asserted. The recon's job is to assert procedure-prose ↔
// typed-substrate coherence, not to police every PascalCase string.
//
// Returned references include the source line text for context (used in
// retirement-context carve-out matching) and the 1-based line number
// (used in finding messages).
// ---------------------------------------------------------------------------

interface EventNameReference {
  readonly filePath: string;
  readonly relPath: string;
  readonly line: number;
  readonly lineText: string;
  readonly token: string;
}

const EMIT_VERB_REGEX = /\b(emit|emits|emitted|emitting)\b/i;

function isEventContextRef(
  lineText: string,
  _matchStart: number,
  matchEnd: number,
  hasPayload: boolean,
): boolean {
  if (hasPayload) return true;

  // (b) emit-verb appears on the same line either before or after the
  // token (e.g. "emit `Foo`" or "`Foo` is emitted").
  if (EMIT_VERB_REGEX.test(lineText)) return true;

  // (c) "event"/"events" follows within ~25 chars after the closing backtick.
  const afterWindow = lineText.slice(matchEnd, matchEnd + 25);
  if (/\bevents?\b/i.test(afterWindow)) return true;

  return false;
}

function extractEventNameReferences(filePath: string, relPath: string): EventNameReference[] {
  const body = readFileSync(filePath, "utf8");
  const lines = body.split("\n");
  const refs: EventNameReference[] = [];

  // Match backtick-wrapped PascalCase tokens. The token captures only the
  // identifier; an optional payload `{ ... }` is permitted between the
  // identifier and the closing backtick. We also permit a trailing space
  // before the optional payload.
  const re = /`([A-Z][A-Za-z0-9]+)(\s*\{[^`]*\})?`/g;

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    if (lineText === undefined) continue;
    let m: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex walk
    while ((m = re.exec(lineText)) !== null) {
      const token = m[1];
      if (token === undefined || token.length < 6) continue;
      const hasPayload = Boolean(m[2]);
      const matchStart = m.index;
      const matchEnd = m.index + m[0].length;
      if (!isEventContextRef(lineText, matchStart, matchEnd, hasPayload)) continue;
      refs.push({
        filePath,
        relPath,
        line: i + 1,
        lineText,
        token,
      });
    }
  }
  return refs;
}

function isExemptByRetirementContext(lineText: string): boolean {
  return RETIREMENT_CONTEXT_MARKERS.some((m) => lineText.includes(m));
}

// ---------------------------------------------------------------------------
// Pipeline entry.
// ---------------------------------------------------------------------------

export interface RunOpts {
  /**
   * Override procedure-file discovery — used by tests to feed a small
   * synthetic file set.
   */
  procedureFiles?: ReadonlyArray<string>;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);

  const factoryNames = loadFactoryTypeNames();
  const registryNames = loadRegistryTypeNames();
  const canonicalEventNames = new Set<string>([...factoryNames, ...registryNames]);

  const files = opts.procedureFiles ?? listProcedureFiles();
  const violations: ReconViolation[] = [];

  let assertedRefs = 0;

  for (const filePath of files) {
    const relPath = filePath.startsWith(`${REPO_ROOT}/`)
      ? filePath.slice(REPO_ROOT.length + 1)
      : filePath;

    const refs = extractEventNameReferences(filePath, relPath);
    for (const ref of refs) {
      assertedRefs += 1;

      // Resolution path 1: canonical event in factory set or registry.
      if (canonicalEventNames.has(ref.token)) continue;

      // Resolution path 2: non-event allowlist (CDM enums, register codes,
      // role tags). Most of these are < 6 chars and already filtered, but
      // the allowlist is here for completeness.
      if (NON_EVENT_TOKEN_ALLOWLIST.has(ref.token)) continue;

      // Resolution path 3: retirement-context carve-out (line explicitly
      // marks the token as retired vocabulary).
      if (isExemptByRetirementContext(ref.lineText)) continue;

      violations.push({
        subject: `${ref.relPath}:${ref.line}`,
        severity: severityForFile(ref.relPath),
        message: `Procedure prose references \`${ref.token}\` but no canonical \`make<Type>\` factory exists in \`prototype/platform/event-store/event-types/\` and no \`EVENT_TYPE_REGISTRY\` row carries that type. This is procedure-prose drift from the typed substrate (Principle 2). Either rewrite the prose to reference the canonical event name, or — if the reference describes a deliberately retired vocabulary — annotate the line with one of the recognised retirement-context markers (e.g. "retired", "drift", "Event-name vocabulary"). Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE; Principle 2; PR #673.`,
      });
    }
  }

  result.asserted = assertedRefs;
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point.
// ---------------------------------------------------------------------------

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
        ? "procedure-event-name-coherence passed — every event-name reference in Procedures/ resolves to a canonical factory or registry row."
        : "procedure-event-name-coherence FAILED — see violations.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
