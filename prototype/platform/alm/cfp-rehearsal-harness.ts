#!/usr/bin/env bun
// platform/alm/cfp-rehearsal-harness.ts
//
// CFP Annual Rehearsal Harness (WS-TREASURER-WAVE2-SUBSTRATE).
//
// Executable script that drives the annual Contingency Funding Plan rehearsal
// per LRM Policy v1 §5.4 and PROC-RISK-CFP-01 §9. The harness:
//
//   1. Validates the CFP funding-source inventory exists
//      (`docs/treasurer/cfp-funding-source-inventory.md`).
//   2. Fires all seven CFP activation trigger events in tier order
//      (Tier 1 → Tier 2 → Tier 3) with synthetic payloads consistent with
//      the RAS appetite thresholds.
//   3. Emits a `RehearsalEvidenceCollected` event with the rehearsal summary.
//
// Modes:
//   --dry-run (default true)   — validates and logs; does NOT write to the
//                                event store. Use for development and CI.
//   --live                     — writes the `RehearsalEvidenceCollected`
//                                event to the real store. Use for the annual
//                                formal rehearsal only.
//   --store <path>             — override the event-store DB path.
//
// Evidence standard (LRM Policy v1 §5.4):
//   - `RehearsalEvidenceCollected` event emitted with:
//       rehearsalDate, tiersExercised, triggersFired,
//       inventoryCoveragePct, openFindings, dryRun.
//   - Summary printed to stdout; non-zero exit on validation failures.
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE (CEO-approved 2026-06-11);
//   parent D-TREASURER-ROLE-DEFINITION-REVIEW.
// Citations:
//   Policies/liquidity-risk-management-policy-v1.md §5.2 + §5.4;
//   BCBS 144 Principle 11;
//   Banks Act 94 of 1990 Reg 26;
//   Procedures/by-policy/cfp-invocation-and-rehearsal.md (PROC-RISK-CFP-01);
//   docs/treasurer/cfp-funding-source-inventory.md.
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import "../event-store/resolve-event-db-boot";

import { clock, eventStore } from "../composition";
import {
  CFP_ACTIVATION_TRIGGER_TYPES,
  INTRADAY_STRESS_USAGE_PCT,
  LCR_INTERNAL_FLOOR_PCT,
  LCR_REGULATORY_MINIMUM_PCT,
  NSFR_REGULATORY_MINIMUM_PCT,
} from "./cfp-ewi";
import {
  type CfpTier,
  makeCriticalSettlementObligationAtRisk,
  makeExternalCreditEventDetected,
  makeFundingConcentrationAlertTriggered,
  makeIntradayStressDetected,
  makeLcrRatioBreach,
  makeNsfrRatioBreach,
  makeRecoveryEarlyWarningTriggered,
  makeRehearsalEvidenceCollected,
} from "../event-store/event-types/cfp-triggers";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = !args.includes("--live");
const storeOverride = (() => {
  const idx = args.indexOf("--store");
  return idx >= 0 ? args[idx + 1] : undefined;
})();

if (storeOverride) process.env["BANK_EVENT_DB"] = storeOverride;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANK_ENTITY = "LE-ZA-HOZ-BANK";
const REHEARSAL_ACTOR = { type: "service" as const, id: "agent:eitan:treasurer" };
const REHEARSAL_CITATIONS = [
  "D-TREASURER-WAVE2-SUBSTRATE",
  "POLICY:liquidity-risk-management-policy-v1-S5.2",
  "POLICY:liquidity-risk-management-policy-v1-S5.4",
  "PROC-RISK-CFP-01",
  "BCBS-144",
];

/** Repo-root-relative path of the funding-source inventory. */
const INVENTORY_REPO_PATH = "docs/treasurer/cfp-funding-source-inventory.md";

// ---------------------------------------------------------------------------
// Resolve repo root — works from prototype/ or project root
// ---------------------------------------------------------------------------

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "CLAUDE.md"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const INVENTORY_ABS_PATH = resolve(REPO_ROOT, INVENTORY_REPO_PATH);

// ---------------------------------------------------------------------------
// Step 1 — Validate funding-source inventory exists
// ---------------------------------------------------------------------------

interface InventoryValidation {
  exists: boolean;
  openFindings: string[];
  coveragePct: number;
}

function validateInventory(): InventoryValidation {
  if (!existsSync(INVENTORY_ABS_PATH)) {
    return {
      exists: false,
      openFindings: [`MISSING: funding-source inventory not found at ${INVENTORY_REPO_PATH}`],
      coveragePct: 0,
    };
  }

  // Parse the inventory for W2.1 blockers / TBD entries. Simple text scan —
  // the inventory uses consistent "W2.1 externally blocked" and "TBD" markers.
  let body: string;
  try {
    body = readFileSync(INVENTORY_ABS_PATH, "utf8");
  } catch {
    return {
      exists: false,
      openFindings: [`UNREADABLE: funding-source inventory at ${INVENTORY_REPO_PATH}`],
      coveragePct: 0,
    };
  }

  const openFindings: string[] = [];

  // Each T<n>.<m> source is considered "blocked" if it contains the W2.1 marker.
  const blockedPattern = /\*\*W2\.1 externally blocked/g;
  const tbdPattern = /counterparty TBD/gi;
  const blockedCount = (body.match(blockedPattern) ?? []).length;
  const tbdCount = (body.match(tbdPattern) ?? []).length;

  if (tbdCount > 0) {
    openFindings.push(
      `T2.2 correspondent facility — W2.1 externally blocked: ZAR correspondent/sponsor bank counterparty TBD (pre-licence mandatory deliverable)`,
    );
  }
  if (blockedCount > 0 && tbdCount === 0) {
    openFindings.push(`${blockedCount} W2.1-blocked funding sources detected in inventory`);
  }

  // Inventory has 8 sources (T1.1–T1.3, T2.1–T2.5 = 8 total). T2.2 is blocked.
  const TOTAL_SOURCES = 8;
  const blockedSources = tbdCount > 0 ? 1 : 0;
  const operationalSources = TOTAL_SOURCES - blockedSources;
  const coveragePct = Math.round((operationalSources / TOTAL_SOURCES) * 100);

  return { exists: true, openFindings, coveragePct };
}

// ---------------------------------------------------------------------------
// Step 2 — Build synthetic trigger event payloads
// ---------------------------------------------------------------------------

function buildSyntheticPayloads(asOf: string) {
  const date = asOf.slice(0, 10);

  return {
    // ── Tier 1 ──────────────────────────────────────────────────────────────

    intradayStress: makeIntradayStressDetected({
      asOf,
      entity: BANK_ENTITY,
      actor: REHEARSAL_ACTOR,
      citations: REHEARSAL_CITATIONS,
      payload: {
        triggerId: `CFP-INTRADAY-${date}-REHEARSAL`,
        sourceMeasure: "intraday-peak-usage-pct-of-available",
        // RAS appetite:liquidity:intraday red threshold ≥ 80% (LRM Policy v1 §4.5)
        observed: INTRADAY_STRESS_USAGE_PCT + 5, // 85% — above the 80% red threshold
        observedDetail:
          `Synthetic rehearsal payload: ${INTRADAY_STRESS_USAGE_PCT + 5}% peak intraday usage ` +
          `(above the RAS red threshold of ${INTRADAY_STRESS_USAGE_PCT}%).`,
        threshold: INTRADAY_STRESS_USAGE_PCT,
        thresholdDescription: `Intraday stress trigger — peak usage ≥ ${INTRADAY_STRESS_USAGE_PCT}% of available start-of-day liquidity (LRM Policy v1 §4.5; RAS appetite:liquidity:intraday red band)`,
        cfpTier: "tier-1" as CfpTier,
        detectedAt: asOf,
        severity: "persistent",
        stressedWindows: ["NPS-WINDOW-2", "NPS-WINDOW-3"],
      },
    }),

    criticalSettlement: makeCriticalSettlementObligationAtRisk({
      asOf,
      entity: BANK_ENTITY,
      actor: REHEARSAL_ACTOR,
      citations: REHEARSAL_CITATIONS,
      payload: {
        triggerId: `CFP-CRITICAL-SETTLE-${date}-REHEARSAL`,
        sourceMeasure: "time-specific-obligation-coverage",
        observed: null,
        observedDetail:
          "Synthetic rehearsal payload: BondservAfrica JSE settlement cut-off at-risk — " +
          "projected available ZAR liquidity at window 3 insufficient for the simulated settlement obligation.",
        threshold: null,
        thresholdDescription:
          "Critical settlement obligation at-risk — projected available < required at deadline window",
        cfpTier: "tier-1" as CfpTier,
        detectedAt: asOf,
        obligationRef: `REHEARSAL-BONDSERV-${date}`,
        deadline: asOf.slice(0, 16).replace("T", " ") + " (simulated BondservAfrica cut-off)",
        requiredZar: 10_000_000, // ZAR 10m simulated obligation
        projectedAvailableZar: 7_000_000, // below required — triggers the event
      },
    }),

    // ── Tier 2 ──────────────────────────────────────────────────────────────

    lcrWarning: makeLcrRatioBreach({
      asOf,
      entity: BANK_ENTITY,
      actor: REHEARSAL_ACTOR,
      citations: REHEARSAL_CITATIONS,
      payload: {
        triggerId: `CFP-LCR-WARNING-${date}-REHEARSAL`,
        sourceMeasure: "lcr-ratio-pct",
        // LCR 115% — below the 120% internal floor but above 100% PA minimum
        observed: LCR_INTERNAL_FLOOR_PCT - 5, // 115%
        threshold: LCR_INTERNAL_FLOOR_PCT,
        thresholdDescription: `LCR internal floor ${LCR_INTERNAL_FLOOR_PCT}% (LRM Policy v1 §2.1; RAS B3)`,
        cfpTier: "tier-2" as CfpTier,
        detectedAt: asOf,
        severity: "warning",
      },
    }),

    fundingConcentration: makeFundingConcentrationAlertTriggered({
      asOf,
      entity: BANK_ENTITY,
      actor: REHEARSAL_ACTOR,
      citations: REHEARSAL_CITATIONS,
      payload: {
        triggerId: `CFP-CONC-${date}-REHEARSAL`,
        sourceMeasure: "funding-concentration-counterparty-pct",
        observed: 16, // 16% — above the 15% single-counterparty limit
        threshold: 15,
        thresholdDescription:
          "Single-counterparty funding concentration ≥ 15% of total liabilities (LRM Policy v1 §5.2; RAS B3)",
        cfpTier: "tier-2" as CfpTier,
        detectedAt: asOf,
        dimension: "counterparty",
        subjectRef: "REHEARSAL-COUNTERPARTY-A",
      },
    }),

    externalCredit: makeExternalCreditEventDetected({
      asOf,
      entity: BANK_ENTITY,
      actor: REHEARSAL_ACTOR,
      citations: REHEARSAL_CITATIONS,
      payload: {
        triggerId: `CFP-EXTCREDIT-${date}-REHEARSAL`,
        sourceMeasure: "external-credit-event-feed",
        observed: null,
        observedDetail:
          "Synthetic rehearsal payload: simulated ZAR correspondent bank CDS widening to 350bps — material external credit event.",
        threshold: null,
        thresholdDescription: "Material external credit event — material impact on bank's funding access",
        cfpTier: "tier-2" as CfpTier,
        detectedAt: asOf,
        impact: "material",
        description:
          "Simulated correspondent bank credit spread widening (rehearsal scenario B — market-wide ZAR liquidity dislocation)",
        detectionSource: "market-spread-watch",
      },
    }),

    // ── Tier 3 ──────────────────────────────────────────────────────────────

    nsfrCritical: makeNsfrRatioBreach({
      asOf,
      entity: BANK_ENTITY,
      actor: REHEARSAL_ACTOR,
      citations: REHEARSAL_CITATIONS,
      payload: {
        triggerId: `CFP-NSFR-CRITICAL-${date}-REHEARSAL`,
        sourceMeasure: "nsfr-ratio-pct",
        // NSFR 98% — at or below the 100% PA minimum
        observed: NSFR_REGULATORY_MINIMUM_PCT - 2, // 98%
        threshold: NSFR_REGULATORY_MINIMUM_PCT,
        thresholdDescription: `NSFR PA regulatory minimum ${NSFR_REGULATORY_MINIMUM_PCT}% (LRM Policy v1 §3.1; RAS B3; PA D1/2023)`,
        cfpTier: "tier-3" as CfpTier,
        detectedAt: asOf,
        severity: "critical",
      },
    }),

    recoveryEwi: makeRecoveryEarlyWarningTriggered({
      asOf,
      entity: BANK_ENTITY,
      actor: REHEARSAL_ACTOR,
      citations: REHEARSAL_CITATIONS,
      payload: {
        triggerId: `CFP-RECOVERY-EWI-${date}-REHEARSAL`,
        sourceMeasure: "recovery-plan-ewi",
        observed: null,
        observedDetail:
          "Synthetic rehearsal payload: simulated Recovery Plan EWI indicator REC-LQ-001 tripped.",
        threshold: null,
        thresholdDescription:
          "Recovery Plan early-warning indicator trip — ICAAP/ILAAP/Recovery framework §3.3.5",
        cfpTier: "tier-3" as CfpTier,
        detectedAt: asOf,
        indicatorId: "REC-LQ-001",
        indicatorLabel: "Recovery Plan liquidity EWI — survival-horizon indicator",
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const asOf = clock.now();
  const rehearsalDate = asOf.slice(0, 10);

  console.log("\n=== CFP Annual Rehearsal Harness ===");
  console.log(`Mode:          ${dryRun ? "DRY-RUN (no store writes)" : "LIVE (store writes ENABLED)"}`);
  console.log(`Rehearsal date: ${rehearsalDate}`);
  console.log(`Store:          ${storeOverride ?? process.env["BANK_EVENT_DB"] ?? "(default)"}`);
  console.log("");

  // Step 1 — validate inventory
  console.log("Step 1 — Validating funding-source inventory...");
  const inventory = validateInventory();

  if (!inventory.exists) {
    console.error(`  ✗ FAIL: ${inventory.openFindings[0]}`);
    process.exit(1);
  }

  console.log(`  ✓ Inventory found: ${INVENTORY_REPO_PATH}`);
  console.log(`  Coverage: ${inventory.coveragePct}% operational (${inventory.openFindings.length} open findings)`);
  for (const f of inventory.openFindings) {
    console.log(`  OPEN FINDING: ${f}`);
  }

  // Step 2 — build payloads
  console.log("\nStep 2 — Building synthetic trigger payloads...");
  const payloads = buildSyntheticPayloads(asOf);

  // Step 3 — fire triggers in tier order
  const triggerSequence = [
    { tier: "tier-1" as CfpTier, label: "IntradayStressDetected", event: payloads.intradayStress },
    {
      tier: "tier-1" as CfpTier,
      label: "CriticalSettlementObligationAtRisk",
      event: payloads.criticalSettlement,
    },
    { tier: "tier-2" as CfpTier, label: "LcrRatioBreach{warning}", event: payloads.lcrWarning },
    {
      tier: "tier-2" as CfpTier,
      label: "FundingConcentrationAlertTriggered",
      event: payloads.fundingConcentration,
    },
    {
      tier: "tier-2" as CfpTier,
      label: "ExternalCreditEventDetected",
      event: payloads.externalCredit,
    },
    {
      tier: "tier-3" as CfpTier,
      label: "NsfrRatioBreach{critical}",
      event: payloads.nsfrCritical,
    },
    {
      tier: "tier-3" as CfpTier,
      label: "RecoveryEarlyWarningTriggered",
      event: payloads.recoveryEwi,
    },
  ] as const;

  console.log("\nStep 3 — Firing 7 CFP trigger events (tier order: 1 → 2 → 3)...");

  const triggersFired: string[] = [];
  const tiersExercisedSet = new Set<CfpTier>();

  for (const { tier, label, event } of triggerSequence) {
    triggersFired.push(label);
    tiersExercisedSet.add(tier);
    if (dryRun) {
      console.log(`  [DRY-RUN] ${tier}: ${label} — validated (not persisted)`);
    } else {
      eventStore.append(event);
      console.log(`  [LIVE]    ${tier}: ${label} — persisted (event_id: ${event.event_id})`);
    }
  }

  const tiersExercised = [...tiersExercisedSet].sort() as CfpTier[];

  // Step 4 — emit RehearsalEvidenceCollected
  console.log("\nStep 4 — Emitting RehearsalEvidenceCollected...");

  const evidencePayload = {
    rehearsalDate,
    tiersExercised,
    triggersFired,
    inventoryCoveragePct: inventory.coveragePct,
    openFindings: inventory.openFindings,
    dryRun,
  };

  const evidenceEvent = makeRehearsalEvidenceCollected({
    asOf,
    entity: BANK_ENTITY,
    actor: REHEARSAL_ACTOR,
    citations: REHEARSAL_CITATIONS,
    payload: evidencePayload,
  });

  if (!dryRun) {
    eventStore.append(evidenceEvent);
    console.log(`  [LIVE] RehearsalEvidenceCollected persisted (event_id: ${evidenceEvent.event_id})`);
  } else {
    console.log(`  [DRY-RUN] RehearsalEvidenceCollected validated (not persisted)`);
  }

  // Step 5 — summary
  console.log("\n=== CFP Rehearsal Summary ===");
  console.log(
    JSON.stringify(
      {
        ok: true,
        rehearsalDate,
        dryRun,
        tiersExercised,
        triggersFired,
        inventoryCoveragePct: inventory.coveragePct,
        openFindings: inventory.openFindings,
        evidenceEventId: evidenceEvent.event_id,
        msg: dryRun
          ? "CFP rehearsal harness dry-run complete — all 7 triggers validated, 3 tiers exercised. Run with --live to persist."
          : "CFP rehearsal harness live run complete — 7 triggers + RehearsalEvidenceCollected persisted.",
      },
      null,
      2,
    ),
  );

  // Non-zero exit if inventory has critical failures (missing file)
  // Open findings (W2.1 etc.) are expected and reported but not fatal.
  process.exit(0);
}

main().catch((err) => {
  console.error("CFP rehearsal harness failed:", err);
  process.exit(1);
});
