// platform/recon/retention-citation-coverage.ts
//
// Continuous-controls pipeline: retention-citation coverage
// (Vera Wave-4 #14 — sister to the Wave-4 #10 agent-spec-cross-link recon).
//
// Atlas (Core banking platform architect) added per-event-type retention
// metadata to `EVENT_TYPE_REGISTRY` in the platform/event-store/registry
// under `D-EVENT-STORE-SCALING` Slice 1 (CEO approved 2026-05-10). The
// metadata is now uniformly populated; this pipeline is the upward-graph
// audit that the *citations* attached to those rows reconcile to either
// the obligations register (`Regulations/_obligations-register.md`) or to
// a structured "register: route to Mira" route-marker that names the
// follow-on. It is the Principle 2 reading of D-EVENT-STORE-SCALING:
// retention is the action; the citation is the source.
//
// What this pipeline asserts, per event-type:
//
//   1. `retention` is present (Atlas's Slice 1 backfill made this true
//      for every registered row; the recon enforces the property
//      ongoing — any new row missing the field surfaces here).
//   2. `retention.citationRef` is non-empty (defence-in-depth; the
//      Slice-1 exit-criterion test already guards this, but a recon-
//      surface keeps the controls signal visible to the audit-committee
//      digest, not buried in a unit test).
//   3. `retention.citationRef` resolves into the obligations register
//      under one of four accepted forms:
//        a. `ORG-<DOMAIN>-<NN>` ID — a register-row ID (Domain A–O).
//        b. External-anchor URN token — `BCBS-<id>`, `JSE-<id>`,
//           `IFRS-<id>`, `IAS-<id>`, `BANKS-ACT-…`, `COMPANIES-ACT-…`,
//           `FIC-ACT-…`, `JOINT-STANDARD-…`, `POPIA-…`, `FATCA-…`,
//           `CRS-…`, `STT-ACT-…`, `FMA-…`, `FSCA-…`, `ICMA-…`, `ISDA-…`.
//        c. URN-form anchor — `urn:obligation:bank:<domain>:…:v<n>` or
//           `urn:policy:bank:<scope>:…:v<n>`. The Domain-RM and Slice-3
//           follow-on rows (`ORG-GV-21`, `ORG-MK-15`, `ORG-RM-01`)
//           expose URN handles in the *Citation* cell of the row rather
//           than as a Domain-N first-cell anchor; the recon resolves
//           those URN handles directly. Case-sensitive (URNs are
//           lower-case by RFC 8141 convention; the substrate emits
//           them that way).
//        d. Route-marker — `[register: route to Mira — ...]`. Tolerated
//           today (Slice 1 prioritised metadata coverage; Mira's URN-
//           population work follows). Surfaced as a finding so the
//           inventory is visible in the Vera digest and an audit-
//           committee row exists for the gap.
//   4. Class-consistency — markets-class trade events must carry a
//      retention floor of ≥ 5 years (JSE Equities Rules + FMA + STT-Act
//      record retention; an `ephemeral` or `runtime` 1-year retention on
//      a markets-class trade is a misclassification). Runtime-class
//      events may carry the conservative 7-year promotion safely; only
//      the under-classification direction is a finding.
//
// Severity policy (matches Wave-4 discipline): every violation is
// emitted at `warn` severity. Today's snapshot will surface the route-
// marker rows (Mira's URN-population follow-on) and any external-anchor
// URNs that aren't yet in the register's Domain N URN table; both are
// expected and tracked. The pipeline lifts to `fail` once the route-
// markers are zero and Mira's URN coverage is complete (Wave-4 #14
// closure step).
//
// Independence note: this pipeline is graph-level. It imports the
// runtime registry (the source-of-truth for what retention metadata
// exists on each row) and reads the obligations register file directly
// to learn the resolution set. No domain-module imports beyond the
// registry surface itself.
//
// P2 — every action carries a citation (the retention assignment is the
//      action; the URN is the source).
// P6 — upward chain (retention metadata → policy / regulation citation
//      → obligations register row). The recon asserts the typed link.
//
// Author: Vera (Internal audit / continuous-assurance engineer) —
// Wave-4 #14, sister to Wave-4 #10 (PR #117).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { EVENT_TYPE_REGISTRY, type EventTypeMetadata } from "../event-store/registry";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// Walk up from this file until we find CLAUDE.md (the canonical repo-
// root marker the other recon pipelines use).
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const OBLIGATIONS_REGISTER = resolve(REPO_ROOT, "Regulations", "_obligations-register.md");

/**
 * Prefix list of recognised external-anchor URN tokens. These are the
 * "Domain N" URN-table entries — they identify regulator instruments and
 * standards directly rather than via an `ORG-*` ID. The registry's
 * retention `citationRef` may use either an `ORG-*` ID (register-row
 * pointer) or one of these external-anchor tokens. The list captures the
 * canonical regulator-instrument prefixes used in the SA banking-law
 * canon as it appears in `_obligations-register.md` Domain N + register
 * citations.
 */
const EXTERNAL_ANCHOR_PREFIXES: readonly string[] = [
  "BCBS-",
  "JSE-",
  "IFRS-",
  "IAS-",
  "BANKS-ACT-",
  "COMPANIES-ACT-",
  "FIC-ACT-",
  "JOINT-STANDARD-",
  "POPIA-",
  "FATCA-",
  "CRS-",
  "STT-ACT-",
  "FMA-",
  "FSCA-",
  "ICMA-",
  "ISDA-",
  "RAS-",
  "SR-",
  "SS-",
  "GOV-FRAMEWORK-",
];

/**
 * Prefix list of recognised URN-form anchors. The Slice-3 follow-on
 * register rows (`ORG-GV-21`, `ORG-MK-15`, `ORG-RM-01`) expose URN
 * handles directly in the row's Citation cell — the recon resolves
 * `urn:obligation:bank:…:v<n>` and `urn:policy:bank:…:v<n>` against
 * those handles rather than against a Domain-N first-cell anchor.
 *
 * Targeted by namespace (not "anything URN-shaped"): only the
 * namespaces the substrate actually emits as `retention.citationRef`
 * values are recognised. New namespaces extend this list explicitly
 * when the substrate begins to emit them.
 *
 * Case-sensitive — RFC 8141 URN convention is lower-case; the
 * substrate emits lower-case; the register stores lower-case in
 * backticks. Avoids the upper-case fold the ORG-* / external-anchor
 * branches use (those are conventionally upper-case tokens).
 */
const URN_ANCHOR_PREFIXES: readonly string[] = [
  "urn:obligation:",
  "urn:policy:",
];

/**
 * Markets-class retention floor — JSE Equities Rules retention norms +
 * FMA s.5/s.6A + STT Act s.2/s.3 record-keeping all read as ≥ 5 years
 * for a trade-record. A markets-class event-type with a floor below this
 * is a class-consistency finding. The floor is conservative on purpose:
 * the inventory of markets event-types is short and the misclassification
 * cost is high (regulator-request reconstruction), so we lean toward a
 * floor that excludes only the clearly-misclassified rows.
 */
const MARKETS_RETENTION_FLOOR_YEARS = 5;

/**
 * Parse the obligations register and return:
 *   - the set of `ORG-*` IDs that appear as register-row keys.
 *   - the set of external-anchor URN tokens that appear as Domain N
 *     URN-table keys (or anywhere as a `\`URN-TOKEN\`` codespan in a
 *     row id position).
 *   - the set of `urn:obligation:*` / `urn:policy:*` URN-form anchors
 *     that appear anywhere in the register as a backtick codespan.
 *     The Slice-3 follow-on rows (`ORG-GV-21`, `ORG-MK-15`,
 *     `ORG-RM-01`) carry their URN handle in the *Citation* cell of
 *     the row rather than as a Domain-N first-cell anchor; the parser
 *     extracts URNs from anywhere they appear so the recon can
 *     resolve `retention.citationRef` URN-form values against them.
 *
 * `orgIds` and `externalAnchors` are returned upper-cased for case-
 * insensitive matching (those tokens are conventionally upper-case);
 * `urnAnchors` is returned lower-cased and matched case-sensitively
 * (URNs are lower-case by RFC 8141 convention).
 *
 * Note: the register today carries some inline `[citation: TBC ...]`
 * placeholders against precise sub-section indices — those are the
 * register's own gap-tracking, distinct from this pipeline's resolution
 * question (we resolve the *URN handle*, not the sub-section detail).
 */
export function parseObligationsRegister(content: string): {
  orgIds: ReadonlySet<string>;
  externalAnchors: ReadonlySet<string>;
  urnAnchors: ReadonlySet<string>;
} {
  const orgIds = new Set<string>();
  const externalAnchors = new Set<string>();
  const urnAnchors = new Set<string>();

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    // ORG-* row ID — first cell of a register table row, e.g.
    //   `| ORG-FC-05 | FIC Act 38/2001 s.22 | ...`
    const orgMatch = line.match(/^\|\s*(ORG-[A-Z0-9-]+)\s*\|/);
    if (orgMatch?.[1]) {
      orgIds.add(orgMatch[1].toUpperCase());
    }
    // External-anchor URN token — `\`<TOKEN>\`` as the first cell of a
    // Domain N URN-table row, e.g.
    //   `| \`BCBS-D457-FRTB-2019\` | \`urn:obligation:...\` | ...`
    const anchorMatch = line.match(/^\|\s*`([A-Z][A-Z0-9-]+)`\s*\|/);
    if (anchorMatch?.[1]) {
      externalAnchors.add(anchorMatch[1].toUpperCase());
    }
  }

  // URN-form anchors — extract every `urn:obligation:*` /
  // `urn:policy:*` codespan from anywhere in the document. The Slice-3
  // follow-on rows expose URN handles in the row's Citation cell or in
  // prose, not always at a fixed cell position. A second pass over the
  // full content (rather than per-line) tolerates URNs that appear in
  // any row column and stays cheap (one regex sweep).
  const urnRegex = /`(urn:(?:obligation|policy):[a-z0-9][a-z0-9:.\-]+)`/g;
  for (const match of content.matchAll(urnRegex)) {
    if (match[1]) urnAnchors.add(match[1]);
  }

  return { orgIds, externalAnchors, urnAnchors };
}

/**
 * Load and parse the obligations register from disk. Returns empty sets
 * if the file is missing (the pipeline tolerates a missing register —
 * every row is then a finding, surfacing the gap rather than crashing).
 */
function loadObligationsRegisterFromDisk(): {
  orgIds: ReadonlySet<string>;
  externalAnchors: ReadonlySet<string>;
  urnAnchors: ReadonlySet<string>;
} {
  if (!existsSync(OBLIGATIONS_REGISTER)) {
    return { orgIds: new Set(), externalAnchors: new Set(), urnAnchors: new Set() };
  }
  return parseObligationsRegister(readFileSync(OBLIGATIONS_REGISTER, "utf8"));
}

/** Whether a citationRef is the structured route-marker form. */
export function isRouteMarker(citationRef: string): boolean {
  return citationRef.startsWith("[register: route to Mira") && citationRef.endsWith("]");
}

/**
 * Whether a citation token starts with one of the recognised external-
 * anchor prefixes. This is a structural check (the *form* is right);
 * the resolution check below confirms the token is in the register.
 */
export function looksLikeExternalAnchor(citationRef: string): boolean {
  return EXTERNAL_ANCHOR_PREFIXES.some((p) => citationRef.startsWith(p));
}

/**
 * Whether a citation token is a URN-form anchor in one of the
 * substrate-emitted namespaces (`urn:obligation:`, `urn:policy:`).
 * Targeted by namespace — does not match arbitrary URN-shaped strings.
 */
export function looksLikeUrnAnchor(citationRef: string): boolean {
  return URN_ANCHOR_PREFIXES.some((p) => citationRef.startsWith(p));
}

/** Whether a citation token is the `ORG-<DOMAIN>-<n>` ID form. */
export function looksLikeOrgId(citationRef: string): boolean {
  return /^ORG-[A-Z0-9-]+$/.test(citationRef);
}

export interface AssertOpts {
  /**
   * Override the registry — used by tests to inject synthetic event-type
   * rows without depending on the live registry contents (which drift).
   */
  registry?: readonly EventTypeMetadata[];
  /**
   * Override the obligations-register resolution sets — used by tests to
   * declare the exact ORG-* IDs and external-anchor URNs that should
   * resolve.
   */
  orgIds?: ReadonlySet<string>;
  /** Override the external-anchor URN set. */
  externalAnchors?: ReadonlySet<string>;
  /** Override the URN-form anchor set (case-sensitive, RFC 8141 lower-case). */
  urnAnchors?: ReadonlySet<string>;
}

/**
 * Assert retention-citation coverage over the registry. Pure function:
 * reads only the registry rows + register sets provided (or, when
 * omitted, the live registry + the on-disk register).
 */
export function assertRetentionCitationCoverage(opts: AssertOpts = {}): ReconResult {
  const result = emptyResult("retention-citation-coverage");
  const violations: ReconViolation[] = [];

  const registry = opts.registry ?? EVENT_TYPE_REGISTRY;
  let orgIds = opts.orgIds;
  let externalAnchors = opts.externalAnchors;
  let urnAnchors = opts.urnAnchors;
  if (orgIds === undefined || externalAnchors === undefined || urnAnchors === undefined) {
    const loaded = loadObligationsRegisterFromDisk();
    orgIds = orgIds ?? loaded.orgIds;
    externalAnchors = externalAnchors ?? loaded.externalAnchors;
    urnAnchors = urnAnchors ?? loaded.urnAnchors;
  }

  for (const row of registry) {
    result.asserted++;
    const subject = `event-type:${row.type}`;

    // 1. retention metadata present (defence-in-depth — Slice-1 unit
    //    test already enforces this, but the recon-surface keeps the
    //    controls signal visible to the AC digest).
    //    The runtime type is `RetentionMetadata` (non-null), so an
    //    absent retention is a TS-level violation; we still defend
    //    against runtime-shaped data slipping through (e.g. a future
    //    JSON-driven registry).
    const retention = row.retention as unknown as
      | undefined
      | { minimumYears?: unknown; archivalTier?: unknown; citationRef?: unknown };
    if (retention === undefined || retention === null) {
      violations.push({
        subject,
        message: `${row.type}: retention metadata is missing. Every event-type row must declare retention { minimumYears, archivalTier, citationRef } per D-EVENT-STORE-SCALING Slice 1 §5. Remediation: add retention to the registry row.`,
        severity: "warn",
      });
      continue;
    }

    // 2. citationRef shape — non-empty string.
    const cite = retention.citationRef;
    if (typeof cite !== "string" || cite.length === 0) {
      violations.push({
        subject,
        message: `${row.type}: retention.citationRef is missing or empty. Every retention floor must trace to either an obligations-register URN, an external-anchor URN, or a structured "[register: route to Mira — …]" marker. Remediation: cite the regulator/policy source for the retention class.`,
        severity: "warn",
      });
      continue;
    }

    // 3. citation resolves into one of: route-marker, ORG-* register
    //    row, or external-anchor URN token.
    if (isRouteMarker(cite)) {
      // Route-marker — Mira's follow-on URN-population work pending.
      // Tolerated today (Slice 1 prioritised metadata coverage); a
      // finding so the inventory is visible in the Vera digest.
      violations.push({
        subject,
        message: `${row.type}: retention.citationRef is a "[register: route to Mira — …]" route-marker. The route-marker is accepted today (D-EVENT-STORE-SCALING Slice 1 prioritised metadata coverage over URN population), but Mira's URN-population follow-on must replace it with a register-resolvable URN before this pipeline lifts to fail-closed. Marker: ${truncate(cite, 120)}.`,
        severity: "warn",
      });
    } else if (looksLikeOrgId(cite)) {
      if (!orgIds.has(cite.toUpperCase())) {
        violations.push({
          subject,
          message: `${row.type}: retention.citationRef "${cite}" looks like an ORG-* register-row ID but does not resolve to a row in Regulations/_obligations-register.md. Remediation: either (a) Mira lands the row, or (b) update the citation to a resolvable URN, or (c) replace with a "[register: route to Mira — …]" marker naming the follow-on.`,
          severity: "warn",
        });
      }
      // resolved ORG-* — no finding.
    } else if (looksLikeExternalAnchor(cite)) {
      if (!externalAnchors.has(cite.toUpperCase())) {
        violations.push({
          subject,
          message: `${row.type}: retention.citationRef "${cite}" looks like an external-anchor URN token (BCBS-/JSE-/IFRS-/Banks-Act-/Companies-Act-/FIC-Act-/Joint-Standard-/POPIA-/FATCA-/CRS-/STT-Act-/FMA-/FSCA-/ICMA-/ISDA-/RAS-/SR-/SS-/GOV-FRAMEWORK-) but does not resolve to a Domain N URN-table row in Regulations/_obligations-register.md. Remediation: either (a) Mira adds the URN to Domain N, or (b) replace with a resolvable ORG-* / external-anchor URN.`,
          severity: "warn",
        });
      }
      // resolved external-anchor — no finding.
    } else if (looksLikeUrnAnchor(cite)) {
      // URN-form anchor (urn:obligation:* / urn:policy:*) — match
      // case-sensitively against URN handles extracted from anywhere
      // in the register. The Slice-3 follow-on rows (`ORG-GV-21`,
      // `ORG-MK-15`, `ORG-RM-01`) expose URN handles in the row's
      // Citation cell rather than as a Domain-N first-cell anchor.
      if (!urnAnchors.has(cite)) {
        violations.push({
          subject,
          message: `${row.type}: retention.citationRef "${cite}" is a urn:obligation: / urn:policy: URN-form anchor but does not resolve to any URN handle in Regulations/_obligations-register.md. Remediation: either (a) Mira lands a register row exposing this URN handle, or (b) update the citation to a resolvable ORG-* / external-anchor / URN-form anchor, or (c) replace with a "[register: route to Mira — …]" marker naming the follow-on.`,
          severity: "warn",
        });
      }
      // resolved URN-form anchor — no finding.
    } else {
      // Doesn't match any recognised form. Surface as a finding so the
      // citation conventions stay coherent (catching typos and ad-hoc
      // tokens that drift outside the URN namespace).
      violations.push({
        subject,
        message: `${row.type}: retention.citationRef "${cite}" does not match any recognised citation form (ORG-* register ID, external-anchor URN with one of the canonical regulator prefixes, urn:obligation:/urn:policy: URN-form anchor, or "[register: route to Mira — …]" marker). Remediation: align the citation with the obligations-register URN namespace defined in Regulations/_obligations-register.md.`,
        severity: "warn",
      });
    }

    // 4. Class-consistency — markets-class trade events must carry a
    //    retention floor of ≥ MARKETS_RETENTION_FLOOR_YEARS. Trade-
    //    record retention norms (JSE Equities Rules + FMA + STT Act
    //    record-keeping) all read at 5y minimum; a 1-year (runtime)
    //    classification on a markets row is a misclassification.
    const minimumYears = retention.minimumYears;
    if (
      row.class === "markets" &&
      typeof minimumYears === "number" &&
      minimumYears < MARKETS_RETENTION_FLOOR_YEARS
    ) {
      violations.push({
        subject,
        message: `${row.type}: markets-class retention floor of ${minimumYears} year(s) is below the MARKETS_RETENTION_FLOOR_YEARS=${MARKETS_RETENTION_FLOOR_YEARS} norm (JSE Equities Rules retention + FMA s.5/s.6A + STT Act record-keeping). Remediation: classify under a markets-appropriate retention class (e.g. RETENTION_JSE_TRADE_7Y, RETENTION_BANKING_5Y, or RETENTION_ACCOUNTING_7Y) rather than a runtime/ephemeral floor.`,
        severity: "warn",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Convenience entry point — runs the assertion over the live registry
 * and the on-disk obligations register. Mirrors the shape of the other
 * recon pipelines (`run(): ReconResult`).
 */
export function run(): ReconResult {
  return assertRetentionCitationCoverage({});
}

if (import.meta.main) {
  const r = run();
  // Roll up the violation breakdown by class for the AC digest header
  // line — surfaces the dominant remediation work without forcing the
  // reader through the full violation list.
  const byKind: Record<string, number> = {};
  for (const v of r.violations) {
    let kind = "other";
    if (v.message.includes("route-marker")) kind = "route-marker-pending";
    else if (v.message.includes("does not resolve")) kind = "unresolved-citation";
    else if (v.message.includes("does not match any recognised")) kind = "malformed-citation";
    else if (v.message.includes("retention floor of")) kind = "class-misclassification";
    else if (v.message.includes("retention metadata is missing")) kind = "missing-metadata";
    else if (v.message.includes("citationRef is missing")) kind = "missing-citation";
    byKind[kind] = (byKind[kind] ?? 0) + 1;
  }
  console.log(
    JSON.stringify({
      level: r.ok ? (r.violations.length ? "warn" : "info") : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? r.violations.length
          ? `Retention-citation-coverage recon: ${r.violations.length} warn(s)`
          : "Retention-citation-coverage recon passed"
        : "Retention-citation-coverage recon FAILED",
      breakdown: byKind,
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
