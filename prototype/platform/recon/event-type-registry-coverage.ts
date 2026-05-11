// platform/recon/event-type-registry-coverage.ts
//
// Continuous-controls pipeline: event-type registry coverage (F-032).
//
// The substrate has four canonical surfaces where event types appear:
//
//   1. The Zod payload-schema declarations (functions producing the
//      objects bound to `payloadSchema:` rows in `registry.ts`; today
//      lifted out into per-domain `_schemas/` modules and `event-types.ts`).
//   2. The `make<Type>` factory functions in
//      `prototype/platform/event-store/event-types.ts`.
//   3. The canonical metadata rows in `prototype/platform/event-store/
//      registry.ts` (`EVENT_TYPE_REGISTRY`).
//   4. The runtime `subscribesTo` arrays in `prototype/runtime/handlers-
//      metadata.ts`.
//   5. The `eventStore.append({ type: "X", ... })` call sites scattered
//      across `prototype/`.
//
// Drift between these surfaces is silent — handlers can subscribe to event
// types that don't exist (P0: deterministic miss); factories can be
// retired without their registry row going with them; the registry can
// gain a row for a type nothing emits. F-020 (god file) means this state
// is hard to inspect by eye. This recon makes it audit-checkable.
//
// Tally rules (recorded in the recon's header — change here = change in
// behaviour):
//
//   - **warn (build-phase tolerance for type-not-in-registry).** Event
//     type referenced by a handler in `subscribesTo` OR by an
//     `eventStore.append({ type: "X" })` call site, but absent from
//     `EVENT_TYPE_REGISTRY`. The registry today is intentionally
//     fail-open for unknown types (registry.ts §"What it does NOT do":
//     "Type not in registry → no-op (build-phase forward compat). Will
//     tighten to fail-closed once Vera's #11 / #12 pipelines assert the
//     registry is complete"). This recon makes the surface
//     audit-checkable so the registry can be completed and the tally
//     escalated to **fail** in a future slice. Current corpus: 22 such
//     types (see PR body for the full list).
//   - **warn.** Registry row whose `type` has no `make<Type>` factory
//     in `event-types.ts`. Producers are appending raw envelopes; the
//     typed factory contract (return-type discipline, citation hint
//     wiring) is not exercised. Surfaced as warn because envelope-only
//     is a build-phase tolerance per registry.ts header.
//   - **warn.** `make<Type>` factory exported but no registry row. The
//     factory exists but is not part of the canonical surface — adds to
//     the dead-surface count if not consumed.
//   - **info.** `make<Type>` factory exported but no consumer (no
//     internal import, no append site referencing it). Tracked for
//     dead-code hygiene, not blocking.
//
// Future escalation (post-tail-completion): the type-not-in-registry
// case moves from warn to fail when the 22 known gaps are closed.
// Tracked as a follow-on under F-032.
//
// Discovery surfaces:
//
//   - Registry rows: walked via the in-process `EVENT_TYPE_REGISTRY` array.
//   - Factories: regex over `event-types.ts` for `^export function make<X>`.
//   - subscribesTo: walked via the in-process `HANDLERS_METADATA` array.
//   - append sites: regex over `prototype/**/*.ts` for
//     `eventStore.append(\{[\\s\\S]*?type:\\s*"<X>"`. Multi-line append calls
//     that interpolate the type from a constant are not detected — those
//     are tracked separately (see SUPPRESSED_DYNAMIC_APPEND_FILES below;
//     additions there require justification in the recon's header).
//
// P2 — citation discipline. Findings carry typed citations:
//   - `P1-EVENTS-AS-TRUTH` (Principle 1)
//   - `P6-SINGLE-GRAPH-DISCIPLINE` (Principle 2)
//   - `Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md` (A0 freeze)
//   - `Owner Inbox/2026-05-10_vera_codebase-quality-review.md` (F-032)
//
// Author: Vera (Internal audit engineer, third-line)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { lookupEventType } from "../event-store/registry";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const CITATIONS = [
  "P1-EVENTS-AS-TRUTH",
  "P6-SINGLE-GRAPH-DISCIPLINE",
  "Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md",
  "Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032)",
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
const PROTOTYPE_DIR = resolve(REPO_ROOT, "prototype");

// Files known to construct events programmatically (e.g. via a `type` from
// a constant or a switch). The recon would surface false positives from
// these; they are exempt from append-site scanning. Adding a file here
// requires a comment-justified citation in the same commit.
const SUPPRESSED_DYNAMIC_APPEND_FILES: ReadonlySet<string> = new Set([
  // Recon harness emits ReconSynthetic for round-trip tests; not a
  // production event type and not in the registry on purpose.
  "platform/recon/harness.ts",
]);

// Event type names appearing in tests as fixtures-only and never emitted
// in production. They will likely never gain a registry row; the recon
// excludes them from the P0 append-site assertion.
const FIXTURE_ONLY_EVENT_TYPES: ReadonlySet<string> = new Set([
  "ReconSynthetic", // recon harness
  "Alpha", // legacy test stream — also in LEGACY_PRE_A1_EVENT_TYPES
  "Beta",
  "TestEvent",
  "FollowOnTest",
]);

export interface RunOpts {
  /** Override prototype dir for tests. */
  prototypeDir?: string;
  /** Override registry types for tests. */
  registryTypes?: ReadonlySet<string>;
  /** Override factory names for tests. */
  factoryTypes?: ReadonlySet<string>;
  /** Override subscribesTo references for tests. */
  subscribedTypes?: ReadonlySet<string>;
  /** Override append-site references for tests. */
  appendedTypes?: ReadonlySet<string>;
  /** Override factory consumers for tests. */
  factoryConsumers?: ReadonlySet<string>;
}

function listTsFiles(dir: string, base: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".local" || name.startsWith(".")) continue;
    const full = join(dir, name);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      listTsFiles(full, base, out);
    } else if (stat.isFile() && (name.endsWith(".ts") || name.endsWith(".tsx"))) {
      out.push(full.startsWith(base) ? full.slice(base.length + 1) : full);
    }
  }
}

function readFactoryNames(prototypeDir: string): Set<string> {
  // F-020 split: factories were originally all in `event-types.ts`. As that
  // file is broken up by domain (Atlas, post-F-020), factories may live in
  // any sibling `event-types-*.ts` under `platform/event-store/` or in
  // domain-local modules such as `platform/markets/cdm/equity.ts`. The
  // recon scans both surfaces so a moved-but-not-deleted factory is still
  // discoverable.
  const out = new Set<string>();
  const re = /^export\s+function\s+make([A-Z][A-Za-z0-9]*)\s*\(/gm;
  const scanPaths: string[] = [];
  const eventStoreDir = resolve(prototypeDir, "platform/event-store");
  if (existsSync(eventStoreDir)) {
    for (const name of readdirSync(eventStoreDir)) {
      if (name === "event-types.ts" || name.startsWith("event-types-")) {
        if (name.endsWith(".ts")) scanPaths.push(resolve(eventStoreDir, name));
      }
    }
  }
  // Markets-CDM factories (per-domain home for equity payloads).
  const cdmDir = resolve(prototypeDir, "platform/markets/cdm");
  if (existsSync(cdmDir)) {
    for (const name of readdirSync(cdmDir)) {
      if (name.endsWith(".ts")) scanPaths.push(resolve(cdmDir, name));
    }
  }
  // Domain-local factories (per-domain home for new event families).
  // Today: `domains/party/factories.ts` (D-PARTY-REGISTER PR 1, 2026-05-11).
  // Pattern matches the existing F-020 split intent — `make<Type>` factories
  // may live in any sibling `event-types-*.ts` under `platform/event-store/`
  // OR in domain-local modules.
  const domainsDir = resolve(prototypeDir, "domains");
  if (existsSync(domainsDir)) {
    for (const domain of readdirSync(domainsDir)) {
      const domainSub = resolve(domainsDir, domain);
      let domainStat: ReturnType<typeof statSync>;
      try {
        domainStat = statSync(domainSub);
      } catch {
        continue;
      }
      if (!domainStat.isDirectory()) continue;
      for (const name of readdirSync(domainSub)) {
        if (name.endsWith(".ts")) scanPaths.push(resolve(domainSub, name));
      }
    }
  }
  for (const path of scanPaths) {
    let source: string;
    try {
      source = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    for (const match of source.matchAll(re)) {
      if (match[1]) out.add(match[1]);
    }
  }
  return out;
}

function readAppendSiteTypes(prototypeDir: string): Set<string> {
  const files: string[] = [];
  listTsFiles(prototypeDir, prototypeDir, files);
  // Match `.append(` followed (within a few lines) by `type: "X"` —
  // captures both `eventStore.append({...})` and `store.append({...})`.
  // We accept multi-line whitespace and interleaved keys via a lazy
  // [\s\S]*? section bounded by 1024 chars to avoid runaway matches.
  const re = /\.append\s*\(\s*\{[\s\S]{0,1024}?type:\s*"([A-Z][A-Za-z0-9]*)"/g;
  const out = new Set<string>();
  for (const rel of files) {
    if (SUPPRESSED_DYNAMIC_APPEND_FILES.has(rel)) continue;
    if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
    // The recon module itself contains documentation strings with
    // placeholder `type: "X"` patterns; skip to avoid self-matching.
    if (rel === "platform/recon/event-type-registry-coverage.ts") continue;
    if (rel === "platform/recon/permission-gate-default.ts") continue;
    let content: string;
    try {
      content = readFileSync(resolve(prototypeDir, rel), "utf8");
    } catch {
      continue;
    }
    for (const match of content.matchAll(re)) {
      if (match[1]) out.add(match[1]);
    }
  }
  return out;
}

function readFactoryConsumers(prototypeDir: string, factories: ReadonlySet<string>): Set<string> {
  const files: string[] = [];
  listTsFiles(prototypeDir, prototypeDir, files);
  const out = new Set<string>();
  // For each factory `makeX`, look for `makeX(` references anywhere outside
  // the defining file.
  const namePattern = [...factories].map((n) => `make${n}`).join("|");
  if (namePattern.length === 0) return out;
  const re = new RegExp(`\\b(${namePattern})\\s*\\(`, "g");
  // Files that *define* factories must be skipped to avoid self-counting
  // their own definitions as consumers. Post-F-020 the split spans
  // `event-types.ts` plus any sibling `event-types-*.ts` plus the markets
  // CDM module that hosts equity factories.
  const isFactoryDefiningFile = (rel: string): boolean => {
    if (rel === "platform/event-store/event-types.ts") return true;
    if (
      rel.startsWith("platform/event-store/event-types-") &&
      (rel.endsWith(".ts") || rel.endsWith(".tsx"))
    )
      return true;
    if (rel.startsWith("platform/markets/cdm/") && (rel.endsWith(".ts") || rel.endsWith(".tsx")))
      return true;
    // Domain-local factory homes (D-PARTY-REGISTER PR 1; mirrors the
    // markets-cdm exclusion above so factory definitions in
    // `domains/<x>/factories.ts` don't self-count as consumers). Scoped
    // to `factories.ts` files only — other files under `domains/<x>/`
    // (e.g. projections, README, wrappers) remain consumer-eligible.
    if (rel.startsWith("domains/") && rel.endsWith("/factories.ts")) return true;
    return false;
  };
  for (const rel of files) {
    if (isFactoryDefiningFile(rel)) continue;
    let content: string;
    try {
      content = readFileSync(resolve(prototypeDir, rel), "utf8");
    } catch {
      continue;
    }
    for (const match of content.matchAll(re)) {
      const name = match[1];
      if (name?.startsWith("make")) {
        out.add(name.slice(4));
      }
    }
  }
  return out;
}

function gatherRegistryTypes(): Set<string> {
  // Iterate every type in the registry by probing lookupEventType on a
  // candidate set. The cleanest path is to import EVENT_TYPE_REGISTRY
  // directly, but the registry exports `lookupEventType` only. We import
  // the const here as a minor exception to keep the recon decoupled from
  // the file's row layout.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reg = require("../event-store/registry") as {
    EVENT_TYPE_REGISTRY?: ReadonlyArray<{ type: string }>;
  };
  const arr = reg.EVENT_TYPE_REGISTRY ?? [];
  return new Set(arr.map((r) => r.type));
}

function gatherSubscribedTypes(): Set<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const meta = require("../../runtime/handlers-metadata") as {
    HANDLERS_METADATA: ReadonlyArray<{ subscribesTo?: readonly string[] }>;
  };
  const out = new Set<string>();
  for (const row of meta.HANDLERS_METADATA) {
    for (const t of row.subscribesTo ?? []) {
      out.add(t);
    }
  }
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult("event-type-registry-coverage");
  const violations: ReconViolation[] = [];
  const prototypeDir = opts.prototypeDir ?? PROTOTYPE_DIR;
  const registry = opts.registryTypes ?? gatherRegistryTypes();
  const factories = opts.factoryTypes ?? readFactoryNames(prototypeDir);
  const subscribed = opts.subscribedTypes ?? gatherSubscribedTypes();
  const appended = opts.appendedTypes ?? readAppendSiteTypes(prototypeDir);
  const consumers = opts.factoryConsumers ?? readFactoryConsumers(prototypeDir, factories);

  // ---------------------------------------------------------------------
  // warn — every subscribesTo / append-site type has a registry row.
  // (Build-phase tolerance: surfaced as warn today. Escalates to fail
  // once the 22 known gaps are closed; see recon header.)
  // ---------------------------------------------------------------------
  const observedEmissions = new Set<string>([...subscribed, ...appended]);
  for (const type of observedEmissions) {
    if (FIXTURE_ONLY_EVENT_TYPES.has(type)) continue;
    result.asserted++;
    if (!registry.has(type)) {
      const sources: string[] = [];
      if (subscribed.has(type)) sources.push("subscribesTo");
      if (appended.has(type)) sources.push("eventStore.append");
      violations.push({
        subject: `event-type:${type}`,
        message: `Event type \`${type}\` is referenced by ${sources.join(" + ")} but has no row in EVENT_TYPE_REGISTRY (\`platform/event-store/registry.ts\`). Today the registry is fail-open for unknown types (build-phase tolerance per registry.ts header); subscribers will silently miss; appended events flow through the envelope-only path with no schema enforcement. Add a registry row. Citations: ${CITATIONS.join(", ")}.`,
        severity: "warn",
      });
    }
  }

  // ---------------------------------------------------------------------
  // P1 — every registry row has a make<Type> factory in event-types.ts.
  // Surfaced as warn (envelope-only is build-phase tolerated per
  // registry.ts header).
  // ---------------------------------------------------------------------
  for (const type of registry) {
    result.asserted++;
    if (!factories.has(type)) {
      const meta = lookupEventType(type);
      const isEnvelopeOnly = meta && meta.payloadSchema === undefined;
      // Envelope-only types have no schema and no factory by design at
      // this stage. Surface as info, not warn.
      violations.push({
        subject: `event-type:${type}`,
        message: isEnvelopeOnly
          ? `Registry row for \`${type}\` is envelope-only (no payloadSchema, no make${type} factory). Build-phase tolerated per \`registry.ts\` header. Track for follow-on schema authoring.`
          : `Registry row for \`${type}\` has a payloadSchema but no \`make${type}\` factory in \`platform/event-store/event-types.ts\`. Add the factory or mark the row envelope-only. Citations: ${CITATIONS.join(", ")}.`,
        severity: isEnvelopeOnly ? "info" : "warn",
      });
    }
  }

  // ---------------------------------------------------------------------
  // P2 — every factory has a registry row.
  // ---------------------------------------------------------------------
  for (const type of factories) {
    result.asserted++;
    if (!registry.has(type)) {
      violations.push({
        subject: `event-type:${type}`,
        message: `\`make${type}\` factory exported in \`event-types.ts\` but no row in EVENT_TYPE_REGISTRY. The factory's payload schema is not enforced at append-time and the type is not on Atlas's permission-policy generator surface. Add a registry row. Citations: ${CITATIONS.join(", ")}.`,
        severity: "warn",
      });
    }
  }

  // ---------------------------------------------------------------------
  // P3 — factories with no consumers (dead-code hygiene).
  // ---------------------------------------------------------------------
  for (const type of factories) {
    result.asserted++;
    if (!consumers.has(type)) {
      violations.push({
        subject: `event-type:${type}`,
        message: `\`make${type}\` factory exported in \`event-types.ts\` but no consumer found via grep. Either dead code (remove) or the consumer is dynamic / out-of-tree (annotate the factory with \`/* @consumed-by: <module> */\`). Citations: ${CITATIONS.join(", ")}.`,
        severity: "info",
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
        ? "Event-type registry coverage passed"
        : "Event-type registry coverage FAILED — silent drift between handlers, factories, and the typed registry",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
