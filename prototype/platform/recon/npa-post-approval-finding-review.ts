// platform/recon/npa-post-approval-finding-review.ts
//
// Vera recon: npa-post-approval-finding-review (BLOCKING / ENFORCING).
//
// Every ProductPostApprovalFinding must be reviewed and tracked to resolution.
// This gate is active immediately — there is no licence-day deferral allowed,
// even in the pre-licence build phase (per Marc's explicit direction,
// 2026-06-15, and D-NPA-POST-APPROVAL-FINDING-REVIEW).
//
// SLA enforcement:
//   critical / high  → ProductDimensionRetrospectiveReview within 30 calendar days
//   medium           → ProductDimensionRetrospectiveReview within 90 calendar days
//
// Violations:
//   OPEN-FINDING     — no review event exists at all for the finding  (exit 1)
//   OVERDUE-FINDING  — review window has elapsed with no review        (exit 1)
//   Both emit a SubstrateAlert (integrity / high or critical) via stderr.
//
// Surface:
//   bun run recon:npa-post-approval-finding-review
//   wired into ci:recon:domain (prototype/scripts/run-recon-suite.ts)
//
// Authority: D-NPA-POST-APPROVAL-FINDING-REVIEW (CEO-approved 2026-06-15);
//            D-NEW-PRODUCT-APPROVAL-POLICY §5; PROC-NPA-GATE-01 Step 14.
// Author: Scrooge-coordinated session for marc@tgv.co.za.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "npa-post-approval-finding-review";

const SLA_DAYS: Record<string, number> = {
  critical: 30,
  high: 30,
  medium: 90,
};

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

function daysBetween(isoA: string, isoB: string): number {
  const msPerDay = 86_400_000;
  return (Date.parse(isoB) - Date.parse(isoA)) / msPerDay;
}

export interface RunOpts {
  dbPath?: string;
  /** ISO 8601 reference date for SLA calculation. Defaults to today (UTC). */
  asOfDate?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");
  const asOfDate = opts.asOfDate ?? new Date().toISOString().slice(0, 10);

  const result: ReconResult = emptyResult(PIPELINE);
  if (!existsSync(dbPath)) {
    return result;
  }

  const store = new EventStore(dbPath);

  // Collect latest ProductPostApprovalFinding per (productId, findingId).
  const findings = new Map<
    string,
    {
      productId: string;
      findingId: string;
      severity: string;
      discoveredAt: string;
      title: string;
      missedDimension: string;
    }
  >();

  for (const ev of store.replay({ type: "ProductPostApprovalFinding" })) {
    const p = ev.payload as Record<string, unknown>;
    const productId = String(p.productId ?? "");
    const findingId = String(p.findingId ?? "");
    if (!productId || !findingId) continue;
    const key = `${productId}::${findingId}`;
    findings.set(key, {
      productId,
      findingId,
      severity: String(p.severity ?? "medium"),
      discoveredAt: String(p.discoveredAt ?? ev.as_of),
      title: String(p.title ?? findingId),
      missedDimension: String(p.missedDimension ?? ""),
    });
  }

  // Collect latest ProductDimensionRetrospectiveReview per (productId, findingId).
  const reviews = new Map<string, { reviewedAt: string }>();

  for (const ev of store.replay({ type: "ProductDimensionRetrospectiveReview" })) {
    const p = ev.payload as Record<string, unknown>;
    const productId = String(p.productId ?? "");
    const findingId = String(p.findingId ?? "");
    if (!productId || !findingId) continue;
    const key = `${productId}::${findingId}`;
    const prev = reviews.get(key);
    if (prev && prev.reviewedAt >= ev.as_of) continue;
    reviews.set(key, { reviewedAt: String(p.reviewedAt ?? ev.as_of) });
  }

  const violations: ReconViolation[] = [];

  // Dimension heat-map — counts retrospective reviews per dimension.
  const dimensionHits = new Map<string, number>();

  for (const [key, finding] of findings) {
    result.asserted++;

    const slaDays = SLA_DAYS[finding.severity] ?? 90;
    const daysSinceDiscovery = daysBetween(finding.discoveredAt, asOfDate);
    const review = reviews.get(key);

    if (finding.missedDimension) {
      dimensionHits.set(
        finding.missedDimension,
        (dimensionHits.get(finding.missedDimension) ?? 0) + 1,
      );
    }

    if (!review) {
      const overdue = daysSinceDiscovery > slaDays;
      const alertSeverity = overdue
        ? "critical"
        : finding.severity === "critical" || finding.severity === "high"
          ? "high"
          : "medium";

      const label = overdue
        ? `Finding ${finding.findingId} (${finding.severity}) is OVERDUE — ${Math.floor(daysSinceDiscovery)}d since discovery, SLA=${slaDays}d. No ProductDimensionRetrospectiveReview found. Missed dimension: ${finding.missedDimension}. Title: ${finding.title}`
        : `Finding ${finding.findingId} (${finding.severity}) is OPEN — ${Math.floor(daysSinceDiscovery)}d since discovery, SLA=${slaDays}d. No ProductDimensionRetrospectiveReview yet. Missed dimension: ${finding.missedDimension}. Title: ${finding.title}`;

      process.stderr.write(
        `ALERT SubstrateAlert{alertClass:"integrity",severity:"${alertSeverity}",pipeline:"${PIPELINE}",findingId:"${finding.findingId}",productId:"${finding.productId}"}\n`,
      );

      violations.push({
        subject: `${finding.productId}::${finding.findingId}`,
        message: label,
        severity: "fail",
      });
    }
  }

  // Dimension heat-map summary (informational — written to stdout).
  if (dimensionHits.size > 0) {
    const sorted = [...dimensionHits.entries()].sort((a, b) => b[1] - a[1]);
    process.stdout.write(
      `\n[${PIPELINE}] Dimension heat-map (retrospective reviews by dimension):\n`,
    );
    for (const [dim, count] of sorted) {
      process.stdout.write(`  ${dim}: ${count} finding(s)\n`);
    }
  }

  result.violations = violations;
  result.ok = violations.length === 0;
  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  const label = r.ok ? "PASS" : "FAIL";
  process.stdout.write(
    `[${PIPELINE}] ${label} — ${r.asserted} finding(s) checked, ${r.violations.length} violation(s)\n`,
  );
  for (const v of r.violations) {
    process.stdout.write(`  [${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.exit(r.ok ? 0 : 1);
}
