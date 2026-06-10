// platform/recon/npa-deferred-gap-tracking.ts
//
// Vera recon: npa-deferred-gap-tracking (ADVISORY inventory).
//
// "Approved with tracked deferred gaps" (D-FX-OTC-NPA-SCOPE-EXPANSION): a
// dimension may be `implementation-attested` for its built substrate while
// specific sub-items remain explicitly deferred — provided every deferral is
// genuinely tracked (owner + trigger + citation). That well-formedness is
// ENFORCED AT WRITE-TIME by the Zod schema on the ProductDimensionAttested
// payload (every deferred-gap field is min(1)); a hollow deferral cannot enter
// the store through sanctioned authoring.
//
// This recon is the read-side INVENTORY of that capability: it surfaces every
// tracked deferral on the latest attestation (per product × dimension) as an
// info finding so the open-but-tracked work is visible in one place, and as a
// belt-and-suspenders defence it WARNs on any malformed deferral that somehow
// reached the store by bypassing the schema (raw DB tampering). Advisory:
// never blocks CI (the schema is the actual gate).
//
// Surface: `bun run recon:npa-deferred-gap-tracking`; wired into ci:recon:domain.
//
// Authority: D-FX-OTC-NPA-SCOPE-EXPANSION (CEO session-delegation 2026-06-10);
//            D-NEW-PRODUCT-APPROVAL-POLICY §5.
// Author: Scrooge-coordinated session for marc@tgv.co.za.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "npa-deferred-gap-tracking";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  dbPath?: string;
}

interface RawGap {
  gapId?: unknown;
  title?: unknown;
  owner?: unknown;
  targetTrigger?: unknown;
  citations?: unknown;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");

  const result: ReconResult = emptyResult(PIPELINE);
  if (!existsSync(dbPath)) {
    // No event store — nothing to assert. Return ok.
    return result;
  }

  const store = new EventStore(dbPath);

  // Latest ProductDimensionAttested per (productId, dimension) — deferred gaps
  // are read off the current attestation, not superseded ones.
  const latest = new Map<string, { asOf: string; gaps: RawGap[] }>();
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as Record<string, unknown>;
    const productId = String(p.productId ?? "");
    const dimension = String(p.dimension ?? "");
    if (!productId || !dimension) continue;
    const key = `${productId}::${dimension}`;
    const prev = latest.get(key);
    if (prev && prev.asOf >= ev.as_of) continue;
    const gaps = Array.isArray(p.deferredGaps) ? (p.deferredGaps as RawGap[]) : [];
    latest.set(key, { asOf: ev.as_of, gaps });
  }

  const violations: ReconViolation[] = [];

  for (const [key, { gaps }] of latest) {
    const [productId, dimension] = key.split("::");
    for (const gap of gaps) {
      result.asserted++;
      const missing: string[] = [];
      if (!isNonEmptyString(gap.gapId)) missing.push("gapId");
      if (!isNonEmptyString(gap.title)) missing.push("title");
      if (!isNonEmptyString(gap.owner)) missing.push("owner");
      if (!isNonEmptyString(gap.targetTrigger)) missing.push("targetTrigger");
      if (!Array.isArray(gap.citations) || gap.citations.filter(isNonEmptyString).length === 0) {
        missing.push("citations");
      }
      const gapId = isNonEmptyString(gap.gapId) ? gap.gapId : "(no-id)";
      if (missing.length > 0) {
        violations.push({
          subject: `${productId}/${dimension}/${gapId}`,
          message: `deferred gap is not properly tracked — missing ${missing.join(", ")} — an untracked deferral is a hidden gap (should be impossible via the schema; raw tampering?)`,
          severity: "warn",
        });
      } else {
        violations.push({
          subject: `${productId}/${dimension}/${gapId}`,
          message: `tracked deferral: "${gap.title}" — owner ${gap.owner}; trigger: ${gap.targetTrigger}`,
          severity: "info",
        });
      }
    }
  }

  const warnCount = violations.filter((v) => v.severity === "warn").length;
  result.ok = true; // advisory — the schema is the write-time gate
  result.violations = violations;
  result.asOf = `tracked-deferrals=${result.asserted} malformed=${warnCount}`;
  return result;
}

if (import.meta.main) {
  const result = run();
  for (const v of result.violations) {
    console.log(`  ${v.severity.toUpperCase()}  [${v.subject}] ${v.message}`);
  }
  const warnCount = result.violations.filter((v) => v.severity === "warn").length;
  console.log(
    `\nrecon:${PIPELINE} OK (advisory) — ${result.asOf}; ${warnCount} malformed deferral(s)`,
  );
}
