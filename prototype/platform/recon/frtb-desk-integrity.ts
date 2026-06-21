// platform/recon/frtb-desk-integrity.ts
//
// recon:frtb-desk-integrity — the standing enforcement of FRTB trading-desk
// compliance (D-FRTB-TRADING-DESK-STRUCTURE).
//
// TWO ASSERTION FAMILIES:
//
//   (A) DESK-REGISTER INTEGRITY. Read the v2 control-plane store, fold the desk
//       register, and assert every registered desk carries the FULL MAR12
//       desk-definition attribute set + a valid (deskKind, bookType) pairing.
//       The desk Zod schema already fails closed at append time, so this is the
//       at-rest re-assertion (re-parse each stored payload through
//       `deskRegisteredPayloadSchema`) plus a fold-time structural check (no
//       orphan change/retire; no duplicate registration).
//
//   (B) FX-TRADE BOUNDARY INTEGRITY. Read the v1 event store, walk every
//       `FxTradeExecuted`, and assert each trade's `deskId` resolves to a
//       REGISTERED, ACTIVE desk whose `bookType` MATCHES the trade's bookType.
//       This is the FRTB trading/banking-book boundary at audit time: a
//       trading-book trade booked to a banking-book desk (or to an unknown /
//       retired desk) is a finding.
//
// SEVERITY: ADVISORY → ENFORCING. The pure assertion logic
// (`assertDeskRegisterIntegrity` / `assertFxTradeDeskBoundary`) is exercised
// sabotage-proof in the regression test. The gate is ENFORCING from the start:
// the desk register is seeded into `ci:migrate` (so on a clean CI store the
// three desks are present), and the FX schema refinement already rejects a
// mismatched deskId at write time — so there is no legacy backlog to drain. A
// violation is a real integrity breach, not a migration artefact.
//
// EMPTY-STATE CORRECTNESS: zero desks + zero FX trades → asserted=0, ok=true.
//
// ARCHITECTURE NOTE: this gate lives on the v1 side (v1-side infra checks v2
// behaviour; the reverse is forbidden — `recon:v2-no-v1-import`). It imports
// the v2 desk register via the permitted v1→v2 direction, and the v1 event
// store via the v1 composition seam.
//
// Authority: D-FRTB-TRADING-DESK-STRUCTURE (CEO-approved 2026-06-21);
//   D-FX-BOOK-BOUNDARY; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:frtb-compliant-trading-desk-structure-simulator-:2026-06-21
// Author: Atlas (Core banking platform architect, engineering).

import {
  defaultControlPlanePath,
  openControlPlaneStore,
} from "../../v2-core/control-plane";
import {
  type Desk,
  DESK_KIND_BOOK_TYPE,
  DESK_REGISTERED,
  type DeskBookType,
  buildDeskRegister,
  deskRegisteredPayloadSchema,
} from "../../v2-core/desk";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "frtb-desk-integrity";

/** ENFORCING from the start — the seed is in ci:migrate; no legacy backlog. */
const ENFORCING = true;

// ---------------------------------------------------------------------------
// Pure assertion inputs + logic (exercised sabotage-proof in the test).
// ---------------------------------------------------------------------------

export interface DeskRegisterIntegrityInput {
  /** The folded desks (active and retired). */
  readonly desks: readonly Desk[];
  /** The raw stored DeskRegistered payloads, for at-rest schema re-assertion. */
  readonly storedRegisteredPayloads: readonly unknown[];
  /** Structural fold violations surfaced by the desk-register projection. */
  readonly foldViolations: ReadonlyArray<{ readonly deskId: string; readonly message: string }>;
}

export interface FxTradeDeskBoundaryInput {
  /** Minimal FX trade shape — the deskId + bookType the boundary rule needs. */
  readonly fxTrades: ReadonlyArray<{
    readonly eventId: string;
    readonly deskId: unknown;
    readonly bookType: unknown;
  }>;
  /**
   * Resolver: deskId → the registered ACTIVE desk's bookType, or null if the
   * deskId is not a registered active desk.
   */
  readonly resolveActiveDeskBookType: (deskId: string) => DeskBookType | null;
}

/**
 * (A) Assert every registered desk carries the full MAR12 attribute set + a
 * valid (deskKind, bookType) pairing, and that the fold surfaced no structural
 * violation. Re-parsing each stored payload through the desk Zod schema is the
 * at-rest re-assertion of the write-time fail-closed contract.
 */
export function assertDeskRegisterIntegrity(
  input: DeskRegisterIntegrityInput,
  severity: ReconViolation["severity"],
): { asserted: number; violations: ReconViolation[] } {
  const violations: ReconViolation[] = [];
  let asserted = 0;

  // At-rest schema re-assertion of every stored DeskRegistered payload.
  for (const raw of input.storedRegisteredPayloads) {
    asserted += 1;
    const parsed = deskRegisteredPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      const subject =
        raw && typeof raw === "object" && "deskId" in raw
          ? String((raw as { deskId: unknown }).deskId)
          : "<unknown-desk>";
      for (const issue of parsed.error.issues) {
        const path = issue.path.map(String).join(".") || "<root>";
        violations.push({
          subject: `DeskRegistered:${subject}:${path}`,
          severity,
          message: `MAR12 desk-definition violation: ${issue.message} (D-FRTB-TRADING-DESK-STRUCTURE)`,
        });
      }
    }
  }

  // (deskKind, bookType) coherence on the folded desks (defence in depth — the
  // schema enforces this too, but a folded register read is the runtime truth).
  for (const desk of input.desks) {
    asserted += 1;
    const expected = DESK_KIND_BOOK_TYPE[desk.deskKind];
    if (desk.bookType !== expected) {
      violations.push({
        subject: `desk:${desk.deskId}`,
        severity,
        message:
          `deskKind '${desk.deskKind}' requires bookType '${expected}', got '${desk.bookType}' ` +
          `(FRTB trading/banking-book boundary; D-FX-BOOK-BOUNDARY)`,
      });
    }
  }

  // Structural fold violations (orphan change/retire, duplicate registration).
  for (const v of input.foldViolations) {
    asserted += 1;
    violations.push({
      subject: `desk:${v.deskId}`,
      severity,
      message: `desk-register fold violation: ${v.message} (D-FRTB-TRADING-DESK-STRUCTURE)`,
    });
  }

  return { asserted, violations };
}

/**
 * (B) Assert every FX trade's deskId resolves to a registered ACTIVE desk whose
 * bookType matches the trade's bookType (the FRTB boundary at audit time).
 */
export function assertFxTradeDeskBoundary(
  input: FxTradeDeskBoundaryInput,
  severity: ReconViolation["severity"],
): { asserted: number; violations: ReconViolation[] } {
  const violations: ReconViolation[] = [];
  let asserted = 0;

  for (const trade of input.fxTrades) {
    asserted += 1;
    if (typeof trade.deskId !== "string" || trade.deskId.length === 0) {
      violations.push({
        subject: `FxTradeExecuted:${trade.eventId}:deskId`,
        severity,
        message: "FX trade has no deskId (FRTB MAR12; D-FRTB-TRADING-DESK-STRUCTURE)",
      });
      continue;
    }
    const deskBookType = input.resolveActiveDeskBookType(trade.deskId);
    if (deskBookType === null) {
      violations.push({
        subject: `FxTradeExecuted:${trade.eventId}:deskId`,
        severity,
        message:
          `deskId '${trade.deskId}' does not resolve to a registered active desk ` +
          `(D-FRTB-TRADING-DESK-STRUCTURE)`,
      });
      continue;
    }
    if (typeof trade.bookType === "string" && deskBookType !== trade.bookType) {
      violations.push({
        subject: `FxTradeExecuted:${trade.eventId}:deskId`,
        severity,
        message:
          `FRTB boundary integrity: a '${trade.bookType}'-book trade is booked to desk ` +
          `'${trade.deskId}' (a '${deskBookType}'-book desk). The desk's bookType must match ` +
          `the trade's bookType (D-FRTB-TRADING-DESK-STRUCTURE; D-FX-BOOK-BOUNDARY).`,
      });
    }
  }

  return { asserted, violations };
}

// ---------------------------------------------------------------------------
// Live run() — reads the control-plane store (desk register) + the v1 event
// store (FX trades).
// ---------------------------------------------------------------------------

export function run(controlPlanePath?: string): ReconResult {
  const result = emptyResult(PIPELINE);
  const severity: ReconViolation["severity"] = ENFORCING ? "fail" : "warn";
  const violations: ReconViolation[] = [];
  let asserted = 0;

  // (A) Desk-register integrity from the control-plane store.
  const cpPath = controlPlanePath ?? process.env.BANK_V2_CONTROL_PLANE_DB ?? defaultControlPlanePath();
  const store = openControlPlaneStore(cpPath);
  try {
    const register = buildDeskRegister(store);
    const storedRegisteredPayloads: unknown[] = [];
    for (const ev of store.replay({ type: DESK_REGISTERED })) {
      storedRegisteredPayloads.push(ev.payload);
    }
    const a = assertDeskRegisterIntegrity(
      {
        desks: register.listDesks(),
        storedRegisteredPayloads,
        foldViolations: register.violations.map((v) => ({ deskId: v.deskId, message: v.message })),
      },
      severity,
    );
    asserted += a.asserted;
    violations.push(...a.violations);

    // (B) FX-trade boundary integrity from the v1 event store.
    const activeBookTypeByDeskId = new Map<string, DeskBookType>();
    for (const desk of register.activeDesks()) {
      activeBookTypeByDeskId.set(desk.deskId, desk.bookType);
    }
    const fxTrades: FxTradeDeskBoundaryInput["fxTrades"] = [...collectFxTrades()];
    const b = assertFxTradeDeskBoundary(
      {
        fxTrades,
        resolveActiveDeskBookType: (deskId) => activeBookTypeByDeskId.get(deskId) ?? null,
      },
      severity,
    );
    asserted += b.asserted;
    violations.push(...b.violations);
  } finally {
    store.close();
  }

  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  return result;
}

function* collectFxTrades(): Generator<{
  eventId: string;
  deskId: unknown;
  bookType: unknown;
}> {
  for (const ev of eventStore.replay({ type: "FxTradeExecuted" })) {
    const p = ev.payload as { deskId?: unknown; bookType?: unknown };
    yield { eventId: ev.event_id, deskId: p.deskId, bookType: p.bookType };
  }
}

// ---------------------------------------------------------------------------
// CLI entry point — `bun run recon:frtb-desk-integrity`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = run();
  const label = result.violations.length === 0 ? "OK" : ENFORCING ? "FAIL" : "ADVISORY";
  console.log(`recon:frtb-desk-integrity [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
