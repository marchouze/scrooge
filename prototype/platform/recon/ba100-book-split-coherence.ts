// platform/recon/ba100-book-split-coherence.ts
//
// recon:ba100-book-split-coherence — the fail-closed gate for the BA 100
// banking/trading book column split (Phase 2; D-BA-RETURN-CELL-VALUE-ENGINE).
//
// THE INVARIANT. For every BA 100 row that carries a non-zero C0040 (Total bank)
// value in the leaf fold, assert:
//
//   C0040 ≥ Σ(C0010) + Σ(C0020)
//
// with ≥ because settled-cash instruments without a `cashTerms.bookType` are
// placed on C0040 only (no split column — the fail-safe). Once every cash
// instrument carries a bookType (full Phase-2 wiring), the bound tightens to =.
// Fail-closed: a row where C0010 + C0020 EXCEEDS C0040 means the split allocated
// MORE than the total — a fabrication, never permissible (Charter cmd 2).
//
// WHAT THIS PROVES. The gate proves that:
//   (a) The C0010/C0020 split is self-consistent with C0040 (no fabricated splits).
//   (b) The TOTAL_BANK (C0040) column always carries at least the sum of its
//       components — a necessary condition for any subsequent CFO attestation.
//
// WHAT THIS DOES NOT PROVE. The gate does NOT assert C0040 == C0010 + C0020 —
// that would fail legitimately today because some cash instruments still reach
// the fold without a bookType. The tight equality is a future gate, gated on
// the Phase-2 wiring being universally applied to all settled cash instruments.
// The `≥` guard is the correct harden-only baseline for Phase 2.
//
// CLEAN-STORE REPRO. The gate runs on a CLEAN pinned-store or tmp store (per
// `bun run ci` discipline). It is self-contained: seeds an in-memory FX-book
// with two trading-desk cash legs (bookType "trading" → C0020) and one
// banking-treasury cash leg (bookType "banking-treasury" → C0010), plus a
// no-bookType residual leg (→ C0040 only). This guarantees the gate asserts
// something real on every run (fail-closed; no vacuous pass on empty store).
//
// KNOWN_VIOLATIONS_SNAPSHOT: 0 — on a correctly wired Phase-2 store, no row
// should have C0010 + C0020 > C0040. Zero is the correct baseline.
//
// Authority: D-BA-RETURN-CELL-VALUE-ENGINE (Phase 2; CEO-approved 2026-06-27);
//   D-FX-BOOK-BOUNDARY; D-FRTB-TRADING-DESK-STRUCTURE;
//   D-ENGINEERING-INTEGRITY-CHARTER (fail-closed, harden-only);
//   SARB PA Directive D5/2025 §2.1.3 (BA 100 — columns C0010/C0020/C0040).
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille (CFO); domain owner of SARB BA 100).

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { addD, cmpD, decimalToString, toDecimal } from "../../v2-core/fil-core/decimal";
import { formatInstanceUrn } from "../../v2-core/fil-core/urn";
import type { FilInstrumentCreatedPayload } from "../../v2-core/fil-instances/events";
import { CASH_BALANCE_TYPE_URN } from "../../v2-core/fil-models/cash/types/cash-type-definitions";
import { makeFilInstrumentCreated } from "../event-store/event-types/fil-instances";
import { simulatedTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { setDefaultProvenanceModeOverride } from "../projections/filter";
import { foldBa100LeafValues } from "../reporting/cell-value/ba100-leaf-fold";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba100-book-split-coherence";
const ENTITY = "LE-ZA-HOZ-BANK";
const FUNCTIONAL_CURRENCY = "ZAR";
const AS_OF = "2099-12-31";

/** harden-only KNOWN_VIOLATIONS_SNAPSHOT baseline (Phase 2, clean store: 0). */
const KNOWN_VIOLATIONS_SNAPSHOT = 0;

const ACTOR: Actor = { type: "system", id: "bea:ba100-book-split-coherence" };
const SIM = simulatedTag({
  scenario: "ba100-book-split-coherence",
  sourceLineage: "bea:ba100-book-split-coherence",
  tags: ["manual-simulation", "book-split-gate"],
});

// ---------------------------------------------------------------------------
// Self-contained in-memory fixture — seeds a controlled set of cash legs
// so the gate always asserts something real (fail-closed; vacuous pass is not
// acceptable on a gate that checks split coherence).
//
// Cash legs seeded (all ZAR, ZAR cost basis = ZAR notional, long):
//   T1 — ZAR 100m, bookType "trading"          → C0020 + C0040
//   T2 — ZAR  50m, bookType "trading"          → C0020 + C0040
//   B1 — ZAR  80m, bookType "banking-treasury" → C0010 + C0040
//   R1 — ZAR  20m, no bookType                 → C0040 only (residual)
//
// Expected per-row (all on R0120 via Tier-2-derived "bank" nostro):
//   R0120 C0010 = 80m   (banking-treasury only)
//   R0120 C0020 = 150m  (100m + 50m trading)
//   R0120 C0040 = 250m  (100 + 50 + 80 + 20)
//   Coherence: C0040 (250) ≥ C0010 (80) + C0020 (150) = 230. ✓
// ---------------------------------------------------------------------------

interface CashSeedArgs {
  id: string;
  zarAmount: string;
  bookType?: "trading" | "banking-treasury" | undefined;
}

function seedCashLeg(store: EventStore, args: CashSeedArgs): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: `${args.id}-cash` });
  const economicTerms: Record<string, unknown> = {
    assetClass: "cash" as const,
    notional: { currency: "ZAR", amount: args.zarAmount },
    direction: "long" as const,
    counterpartyId: "urn:party:correspondent:test-bank",
    nettingSetId: `NS-TEST-ZAR-${args.id}`,
    currency: "ZAR",
    settlementDate: "2026-06-22",
    hedgingSetTag: "ZAR/ZAR",
    // Tier-2 derivable FX nostro — originatingInstrument + originatingEvent present
    // so the fold derives counterpartyClass "bank" and places on R0120.
    originatingInstrument: formatInstanceUrn({ tenant: ENTITY, instanceId: `${args.id}-fx` }),
    zarCostBasis: { currency: "ZAR", amount: args.zarAmount },
    // cashTerms: stamp counterpartyClass always (Tier 1 preferred when present),
    // and bookType when supplied (the Phase-2 dimension under test).
    cashTerms: {
      counterpartyClass: "bank" as const,
      ...(args.bookType !== undefined ? { bookType: args.bookType } : {}),
    },
  };
  const payload = {
    kind: "FilInstrumentCreated" as const,
    instance,
    type: CASH_BALANCE_TYPE_URN,
    tenant: ENTITY,
    asOf: "2026-06-22T00:00:00.000Z",
    originatingEvent: {
      eventType: "FxSimSettlementConfirmed" as const,
      eventId: `settle:${args.id}`,
    },
    initialStage: "active" as const,
    economicTerms: economicTerms as FilInstrumentCreatedPayload["economicTerms"],
  };
  store.append(
    makeFilInstrumentCreated({
      asOf: "2026-06-22T00:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: [
        "D-BA-RETURN-CELL-VALUE-ENGINE",
        "D-FX-BOOK-BOUNDARY",
        "D-ENGINEERING-INTEGRITY-CHARTER",
      ],
      provenance: SIM,
      payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
        typeof makeFilInstrumentCreated
      >[0]["payload"],
    }),
  );
}

function buildSelfContainedStore(): string {
  const tmpDir = mkdtempSync(join(tmpdir(), "ba100-book-split-coherence-"));
  const dbPath = join(tmpDir, "event.db");
  const store = new EventStore(dbPath);

  // Trading-book cash legs (two, to test aggregation).
  seedCashLeg(store, { id: "T1", zarAmount: "100000000", bookType: "trading" });
  seedCashLeg(store, { id: "T2", zarAmount: "50000000", bookType: "trading" });
  // Banking-treasury cash leg.
  seedCashLeg(store, { id: "B1", zarAmount: "80000000", bookType: "banking-treasury" });
  // Residual — no bookType — lands on C0040 only (gap flag expected).
  seedCashLeg(store, { id: "R1", zarAmount: "20000000", bookType: undefined });

  store.close();
  return dbPath;
}

// ---------------------------------------------------------------------------
// The gate run function.
// ---------------------------------------------------------------------------

export interface RunOpts {
  /** Override the event store path — used by tests (point at a tmp store). */
  eventDbPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // The gate is self-contained: build an in-memory fixture store so every CI
  // run asserts on controlled data. An externally-supplied path (tests) takes
  // precedence to allow targeted fixture injection.
  const dbPath = opts.eventDbPath ?? buildSelfContainedStore();
  const store = new EventStore(dbPath, { readonly: true });

  // Run under the COMBINED provenance lens (includes simulated fixtures).
  setDefaultProvenanceModeOverride("combined");
  let leafValues: ReadonlyMap<string, string>;
  try {
    leafValues = foldBa100LeafValues({
      eventStore: store,
      marketData: undefined as never,
      entity: ENTITY,
      asOf: AS_OF,
      functionalCurrency: FUNCTIONAL_CURRENCY,
    });
  } finally {
    setDefaultProvenanceModeOverride(undefined);
    store.close();
  }

  // Group cell values by row, then by column.
  // Key format: "<row> <column>" (e.g. "R0120 C0040").
  const byRow = new Map<string, Map<string, ReturnType<typeof toDecimal>>>();
  for (const [key, amount] of leafValues) {
    const parts = key.split(" ");
    const row = parts[0] ?? "";
    const col = parts[1] ?? "";
    if (!byRow.has(row)) byRow.set(row, new Map());
    const rowMap = byRow.get(row);
    if (rowMap !== undefined) rowMap.set(col, toDecimal(amount));
  }

  // Assert coherence for each row that carries a C0040 value.
  let rowsAsserted = 0;
  for (const [row, colMap] of byRow) {
    const c0040 = colMap.get("C0040");
    if (c0040 === undefined) continue; // no Total Bank — nothing to check.

    const c0010 = colMap.get("C0010") ?? toDecimal("0");
    const c0020 = colMap.get("C0020") ?? toDecimal("0");
    const componentSum = addD(c0010, c0020);

    result.asserted += 1;
    rowsAsserted += 1;

    // C0040 ≥ Σ(C0010 + C0020) — the necessary coherence condition.
    // A C0010 + C0020 > C0040 means the split allocated MORE than the Total:
    // a fabricated split that violates the definitional column relationship
    // (Total bank = Banking book + Trading book + any unsplit residual).
    if (cmpD(componentSum, c0040) > 0) {
      violations.push({
        subject: `row:${row}:split-exceeds-total`,
        message: `BA 100 row ${row}: C0010 (${decimalToString(c0010)}) + C0020 (${decimalToString(c0020)}) = ${decimalToString(componentSum)} EXCEEDS C0040 (${decimalToString(c0040)}). The banking/trading book split must not exceed the Total bank column — a split that exceeds the total is a fabricated allocation (Charter cmd 2 fail-closed; D-FX-BOOK-BOUNDARY; SARB BA 100 D5/2025 §2.1.3). Investigate foldCashLegs bookType→column mapping and C0040 accumulation.`,
        severity: "fail",
      });
    }
  }

  // Non-vacuity guard: on the self-contained store, we MUST have folded at
  // least one row (the seeded cash legs should all resolve). If zero rows
  // were asserted, the fold is silently empty — a regression (Charter cmd 2).
  result.asserted += 1;
  if (rowsAsserted === 0) {
    violations.push({
      subject: "vacuity",
      message:
        "recon:ba100-book-split-coherence: no BA 100 rows carried a C0040 value — " +
        "the cash fold is silently empty. The self-contained fixture must produce " +
        "at least one row (R0120 from the seeded trading/banking-treasury cash legs). " +
        "Investigate foldCashLegs or the fixture seeding in this gate.",
      severity: "fail",
    });
  }

  // Harden-only ratchet: violations must not exceed KNOWN_VIOLATIONS_SNAPSHOT.
  result.asserted += 1;
  const splitViolations = violations.filter(
    (v) => v.severity === "fail" && v.subject.includes("split-exceeds-total"),
  ).length;
  if (splitViolations > KNOWN_VIOLATIONS_SNAPSHOT) {
    violations.push({
      subject: "ratchet",
      message: `recon:ba100-book-split-coherence: ${splitViolations} split-coherence violation(s) found vs KNOWN_VIOLATIONS_SNAPSHOT=${KNOWN_VIOLATIONS_SNAPSHOT}. This gate is harden-only: violations must not INCREASE. Fix the failing rows before merging (D-ENGINEERING-INTEGRITY-CHARTER cmd 3).`,
      severity: "fail",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `${PIPELINE}: asserted ${rowsAsserted} rows`;
  return result;
}

// ---------------------------------------------------------------------------
// CLI entry-point — runs the gate and prints a summary.
// ---------------------------------------------------------------------------
const r = run();
const status = r.ok ? "PASS" : "FAIL";
console.log(`[${status}] ${PIPELINE}: ${r.asOf} (${r.asserted} assertions)`);
for (const v of r.violations) {
  if (v.severity === "fail") console.error(`  [FAIL] ${v.subject}: ${v.message}`);
  else console.log(`  [${v.severity.toUpperCase()}] ${v.subject}: ${v.message}`);
}
if (!r.ok) process.exit(1);
