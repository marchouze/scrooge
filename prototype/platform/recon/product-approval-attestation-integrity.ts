// platform/recon/product-approval-attestation-integrity.ts
//
// Vera recon: product-approval-attestation-integrity — backward-looking
// approval integrity gate.
//
// Asserts for every `ProductApproved` event in the store:
//   1. The number of `ProductDimensionAttested` events for the same
//      `productId` with `as_of` ≤ `ProductApproved.as_of` is at least 14.
//      If count < 14 → severity:"fail".
//   2. No attested dimension in that set has `result:"failed"`.
//      If one does AND `ProductApproved` still fired → severity:"fail"
//      (governance bypass).
//   3. Info-level summary per product when assertions pass.
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
//
// Author: Vera (Internal audit engineer)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "product-approval-attestation-integrity";
const REQUIRED_ATTESTATIONS = 14;

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
}

function safeString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Core assertion logic — operates on pre-loaded event arrays so unit tests
 * can pass synthetic in-memory fixtures without touching the file system.
 */
export function runOnEvents(
  approvedEvents: MinimalEvent[],
  attestedEvents: MinimalEvent[],
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

  for (const approved of approvedEvents) {
    const productId = safeString(approved.payload.productId);
    if (!productId) continue;

    result.asserted++;
    const approvedAsOf = approved.as_of;

    // Collect attestations for this product that pre-date or match the approval.
    const prior = (attestedByProduct.get(productId) ?? []).filter(
      (att) => att.as_of <= approvedAsOf,
    );

    const count = prior.length;

    if (count < REQUIRED_ATTESTATIONS) {
      violations.push({
        subject: productId,
        message: `ProductApproved for \`${productId}\` at ${approvedAsOf} is preceded by only ${count}/${REQUIRED_ATTESTATIONS} ProductDimensionAttested events — audit integrity violation (authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 8)`,
        severity: "fail",
      });
      continue; // Skip failed-dimension check when count is already insufficient.
    }

    // Check for any dimension with result:"failed" in the prior attestations.
    const failedDimension = prior.find((att) => safeString(att.payload.result) === "failed");
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
    const designAttestedNoConds = prior.filter((att) => {
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
  if (opts.approvedEvents !== undefined || opts.attestedEvents !== undefined) {
    return runOnEvents([...(opts.approvedEvents ?? [])], [...(opts.attestedEvents ?? [])]);
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

  for (const ev of store.replay()) {
    if (ev.type === "ProductApproved") {
      approvedEvents.push({
        event_id: ev.event_id,
        type: ev.type,
        as_of: ev.as_of,
        payload: (ev.payload ?? {}) as Record<string, unknown>,
      });
    } else if (ev.type === "ProductDimensionAttested") {
      attestedEvents.push({
        event_id: ev.event_id,
        type: ev.type,
        as_of: ev.as_of,
        payload: (ev.payload ?? {}) as Record<string, unknown>,
      });
    }
  }

  return runOnEvents(approvedEvents, attestedEvents);
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
