// platform/recon/product-approval-attestation-integrity.ts
//
// Vera recon: product-approval-attestation-integrity — backward-looking
// approval integrity gate.
//
// SUPERSESSION-AWARE (D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION, CEO-approved
// 2026-06-18). The gate judges each product's CURRENT EFFECTIVE approval — the
// latest `ProductApproved` for a productId that is NOT itself superseded by a
// later `ProductWithheld`, `ProductRetired`, or a later clean `ProductApproved`
// for the same productId — rather than re-judging every dead historical
// approval. A superseded / withdrawn / retired approval is not the product's
// approved state; re-failing it would be auditing a state that no longer holds.
//
// This is a CORRECTNESS fix, NOT a weakening. The core assertion is preserved
// in full: a product whose CURRENT EFFECTIVE approval is non-compliant STILL
// fails. Supersession only removes from scope approvals that a later event has
// already overridden — it never lets a currently-effective non-compliant
// approval pass. See `runOnEvents` for the per-product resolution.
//
// For the resolved effective approval, the gate asserts:
//   1. At least 15 distinct `ProductDimensionAttested` dimensions exist for the
//      same `productId` with `as_of` ≤ effective `ProductApproved.as_of`
//      (14 original + data-quality). If fewer → severity:"fail".
//   2. Using the LATEST attestation per dimension as-of the approval (mirrors
//      the production register fold in product-register.ts), none has
//      `result:"failed"`. If one does → severity:"fail" (governance bypass).
//   3. No dimension is `design-attested` with no tracked deferred gaps
//      (blocked under D-NPA-GATE-POLICY-REDESIGN).
//   4. Info-level summary per product when assertions pass; a per-product info
//      row when an approval is skipped because it has been superseded.
//
// Empty store / no `ProductApproved` events → 0 asserted, OK.
// (Forward-looking stage-gate lives in npa-gate-integrity.ts.)
//
// Mode: blocking (non-zero exit on any failure). Wired into
//       `bun run ci:recon:domain` via `bun run recon:product-approval-attestation-integrity`.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10) Slice 8
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//   - D-NPA-GATE-POLICY-REDESIGN (CEO-approved 2026-06-15)
//   - D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION (CEO-approved 2026-06-18)
//
// Author: Vera (Internal audit engineer); supersession refinement co-authored
//         by Saskia (Head of Global Markets) under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "product-approval-attestation-integrity";
const REQUIRED_ATTESTATIONS = 15; // 14 original + data-quality (D-NPA-POST-APPROVAL-FINDING-REVIEW, 2026-06-15)

// Under D-NPA-GATE-POLICY-REDESIGN (CEO 2026-06-15): design-attested with no
// tracked deferred gaps is blocked at approval. A design-attested dimension
// with at least one deferredGaps entry is allowed (approved-with-conditions).
const NPA_GATE_POLICY_REDESIGN = "D-NPA-GATE-POLICY-REDESIGN";

interface MinimalEvent {
  readonly event_id: string;
  readonly type: string;
  readonly as_of: string;
  readonly payload: Record<string, unknown>;
}

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  /** Path to the SQLite event store. Defaults to BANK_EVENT_DB env or repo fallback. */
  dbPath?: string;
  /**
   * Override event inputs for unit tests (bypasses the SQLite store entirely).
   * When provided, `dbPath` is ignored.
   */
  approvedEvents?: Iterable<MinimalEvent>;
  attestedEvents?: Iterable<MinimalEvent>;
  /**
   * Supersession events (`ProductWithheld`, `ProductRetired`) for unit tests.
   * When `approvedEvents` or `attestedEvents` is supplied, this completes the
   * lifecycle picture so the gate can resolve each product's current effective
   * approval. Absent ⇒ treated as no supersessions (back-compat).
   */
  supersessionEvents?: Iterable<MinimalEvent>;
}

function safeString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Resolve, per productId, whether the CURRENT EFFECTIVE lifecycle state is an
 * approval — and if so, which `ProductApproved` event is effective.
 *
 * Effective state = the latest lifecycle event across `ProductApproved`,
 * `ProductWithheld`, and `ProductRetired` for the product, ordered by `as_of`
 * (ties broken by event_id for determinism). If that latest event is a
 * `ProductApproved`, the product is currently approved and that approval is the
 * one the gate judges. If it is a `ProductWithheld` or `ProductRetired`, the
 * product's approval has been superseded and is out of scope — there is no
 * effective approval to judge.
 *
 * Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION (CEO-approved 2026-06-18).
 */
function resolveEffectiveApprovals(
  approvedEvents: MinimalEvent[],
  supersessionEvents: MinimalEvent[],
): {
  /** Products whose current effective state is an approval → the approval to judge. */
  effective: Map<string, MinimalEvent>;
  /** Products whose latest approval has been superseded (withheld/retired). */
  superseded: Map<string, { type: string; as_of: string }>;
} {
  // Group every lifecycle event (approve / withhold / retire) by productId.
  const lifecycleByProduct = new Map<string, MinimalEvent[]>();
  for (const ev of [...approvedEvents, ...supersessionEvents]) {
    const productId = safeString(ev.payload.productId);
    if (!productId) continue;
    let list = lifecycleByProduct.get(productId);
    if (!list) {
      list = [];
      lifecycleByProduct.set(productId, list);
    }
    list.push(ev);
  }

  const effective = new Map<string, MinimalEvent>();
  const superseded = new Map<string, { type: string; as_of: string }>();

  for (const [productId, events] of lifecycleByProduct) {
    // Deterministic latest-wins: order by as_of, then event_id.
    const latest = events.reduce((acc, ev) => {
      if (ev.as_of > acc.as_of) return ev;
      if (ev.as_of === acc.as_of && ev.event_id > acc.event_id) return ev;
      return acc;
    });

    if (latest.type === "ProductApproved") {
      effective.set(productId, latest);
    } else {
      // Latest lifecycle event is a withhold or retire → approval superseded.
      superseded.set(productId, { type: latest.type, as_of: latest.as_of });
    }
  }

  return { effective, superseded };
}

/**
 * Core assertion logic — operates on pre-loaded event arrays so unit tests
 * can pass synthetic in-memory fixtures without touching the file system.
 *
 * Supersession-aware (D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION): only the current
 * EFFECTIVE approval per product is judged. The third parameter carries the
 * `ProductWithheld` / `ProductRetired` events that may supersede an approval.
 */
export function runOnEvents(
  approvedEvents: MinimalEvent[],
  attestedEvents: MinimalEvent[],
  supersessionEvents: MinimalEvent[] = [],
): ReconResult {
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  if (approvedEvents.length === 0) {
    // Nothing to assert — gate is correct: returns ok with 0 asserted.
    return result;
  }

  // Index attestations by productId for O(1) lookup per approval.
  const attestedByProduct = new Map<string, MinimalEvent[]>();
  for (const ev of attestedEvents) {
    const productId = safeString(ev.payload.productId);
    if (!productId) continue;
    let list = attestedByProduct.get(productId);
    if (!list) {
      list = [];
      attestedByProduct.set(productId, list);
    }
    list.push(ev);
  }

  // Resolve the current effective approval per product. Superseded / withdrawn /
  // retired approvals are not re-judged — but a currently-effective approval is
  // judged in full, so a non-compliant effective approval STILL fails.
  const { effective, superseded } = resolveEffectiveApprovals(approvedEvents, supersessionEvents);

  // Record an info row for each product whose approval has been superseded — the
  // skip is transparent, not silent (Engineering Charter: no green by concealment).
  for (const [productId, sup] of [...superseded].sort((a, b) => a[0].localeCompare(b[0]))) {
    violations.push({
      subject: productId,
      message: `ProductApproved for \`${productId}\` superseded by ${sup.type} at ${sup.as_of} — not the product's effective approved state; skipped (authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION)`,
      severity: "info",
    });
  }

  for (const [productId, approved] of [...effective].sort((a, b) => a[0].localeCompare(b[0]))) {
    result.asserted++;
    const approvedAsOf = approved.as_of;

    // Collect attestations for this product that pre-date or match the approval,
    // then reduce to the LATEST attestation per dimension as-of the approval.
    // This mirrors the production register fold (product-register.ts), which
    // takes the most-recent attestation per dimension — so the gate judges the
    // same effective attestation state the NPA gate itself acted on, rather than
    // tripping on a stale earlier-cycle attestation that a later one replaced.
    const prior = (attestedByProduct.get(productId) ?? []).filter(
      (att) => att.as_of <= approvedAsOf,
    );

    const latestByDimension = new Map<string, MinimalEvent>();
    for (const att of prior) {
      const dimension = safeString(att.payload.dimension);
      if (!dimension) continue;
      const existing = latestByDimension.get(dimension);
      if (
        !existing ||
        att.as_of > existing.as_of ||
        (att.as_of === existing.as_of && att.event_id > existing.event_id)
      ) {
        latestByDimension.set(dimension, att);
      }
    }

    const effectiveAttestations = [...latestByDimension.values()];
    const count = latestByDimension.size; // distinct dimensions

    if (count < REQUIRED_ATTESTATIONS) {
      violations.push({
        subject: productId,
        message: `ProductApproved for \`${productId}\` at ${approvedAsOf} is preceded by only ${count}/${REQUIRED_ATTESTATIONS} attested dimensions — audit integrity violation (authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 8)`,
        severity: "fail",
      });
      continue; // Skip failed-dimension check when count is already insufficient.
    }

    // Check for any dimension whose effective attestation has result:"failed".
    const failedDimension = effectiveAttestations.find(
      (att) => safeString(att.payload.result) === "failed",
    );
    if (failedDimension) {
      const dim = safeString(failedDimension.payload.dimension) ?? "<unknown>";
      violations.push({
        subject: productId,
        message: `ProductApproved for \`${productId}\` contains a failed dimension attestation: ${dim} — governance bypass (authority: D-NEW-PRODUCT-APPROVAL-POLICY)`,
        severity: "fail",
      });
      continue;
    }

    // D-NPA-GATE-POLICY-REDESIGN: design-attested with no tracked deferred gaps
    // is blocked — the approval was issued under the old policy.
    const designAttestedNoConds = effectiveAttestations.filter((att) => {
      if (safeString(att.payload.result) !== "design-attested") return false;
      const gaps = att.payload.deferredGaps;
      return !Array.isArray(gaps) || gaps.length === 0;
    });
    if (designAttestedNoConds.length > 0) {
      const dims = designAttestedNoConds
        .map((att) => safeString(att.payload.dimension) ?? "<unknown>")
        .join(", ");
      violations.push({
        subject: productId,
        message: `ProductApproved for \`${productId}\` contains ${designAttestedNoConds.length} design-attested dimension(s) with no tracked deferred gaps: ${dims} — blocked under D-NPA-GATE-POLICY-REDESIGN (authority: ${NPA_GATE_POLICY_REDESIGN})`,
        severity: "fail",
      });
      continue;
    }

    // All good — emit info summary.
    violations.push({
      subject: productId,
      message: `ProductApproved for \`${productId}\` — ${count}/${REQUIRED_ATTESTATIONS} attestations present (ok)`,
      severity: "info",
    });
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.ok = failCount === 0;
  result.violations = violations;

  return result;
}

export function run(opts: RunOpts = {}): ReconResult {
  // When callers supply event overrides (unit tests), skip the store entirely.
  if (
    opts.approvedEvents !== undefined ||
    opts.attestedEvents !== undefined ||
    opts.supersessionEvents !== undefined
  ) {
    return runOnEvents(
      [...(opts.approvedEvents ?? [])],
      [...(opts.attestedEvents ?? [])],
      [...(opts.supersessionEvents ?? [])],
    );
  }

  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");

  if (!existsSync(dbPath)) {
    // No event store — nothing to assert. Return ok.
    return emptyResult(PIPELINE);
  }

  const store = new EventStore(dbPath);

  const approvedEvents: MinimalEvent[] = [];
  const attestedEvents: MinimalEvent[] = [];
  const supersessionEvents: MinimalEvent[] = [];

  for (const ev of store.replay()) {
    const minimal: MinimalEvent = {
      event_id: ev.event_id,
      type: ev.type,
      as_of: ev.as_of,
      payload: (ev.payload ?? {}) as Record<string, unknown>,
    };
    if (ev.type === "ProductApproved") {
      approvedEvents.push(minimal);
    } else if (ev.type === "ProductDimensionAttested") {
      attestedEvents.push(minimal);
    } else if (ev.type === "ProductWithheld" || ev.type === "ProductRetired") {
      supersessionEvents.push(minimal);
    }
  }

  return runOnEvents(approvedEvents, attestedEvents, supersessionEvents);
}

if (import.meta.main) {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");
  const warns = result.violations.filter((v) => v.severity === "warn");
  const infos = result.violations.filter((v) => v.severity === "info");

  for (const v of infos) {
    console.log(`  info  [${v.subject}] ${v.message}`);
  }
  for (const v of warns) {
    console.warn(`  warn  [${v.subject}] ${v.message}`);
  }
  for (const v of fails) {
    console.error(`  FAIL  [${v.subject}] ${v.message}`);
  }

  console.log(
    `\nrecon:${PIPELINE} — ${result.asserted} asserted, ` +
      `${fails.length} fail, ${warns.length} warn, ${infos.length} info`,
  );

  if (!result.ok) {
    console.error(`recon:${PIPELINE} FAILED — ${fails.length} failure(s)`);
    process.exit(1);
  } else {
    console.log(`recon:${PIPELINE} OK`);
  }
}
