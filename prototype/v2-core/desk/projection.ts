// v2-core/desk/projection.ts
//
// Desk register projection — a pure fold over desk events that produces the
// canonical desk-register state (the current desk roster). The projection
// answers:
//
//   getDesk(deskId)   — a single desk record (latest revision), or null.
//   listDesks()       — all desks (active and retired).
//   activeDesks()     — desks whose status is currently "active".
//
// PRINCIPLE 1 INVARIANT: the register is a query over events, not stored state.
// The fold is deterministic and replayable from any suffix of the event log.
// Mirrors the posture-register projection (`v2-core/posture/projection.ts`).
//
// PACKAGE BOUNDARY: inside `v2-core/` — no v1 imports. See `recon:v2-no-v1-import`.
// Authority: D-FRTB-TRADING-DESK-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Atlas (Core banking platform architect, engineering).

import type { Instant } from "../fil-core/primitives";
import type { DeskBookType, DeskKind, DeskRiskManagementStructure, DeskStatus } from "./events";

// ---------------------------------------------------------------------------
// Desk record — the projected state of a single desk.
// ---------------------------------------------------------------------------

export interface Desk {
  readonly deskId: string;
  readonly deskName: string;
  readonly deskKind: DeskKind;
  readonly bookType: DeskBookType;
  readonly businessStrategy: string;
  readonly deskHeadSeat: string;
  readonly reportingLine: string;
  readonly riskManagementStructure: DeskRiskManagementStructure;
  readonly status: DeskStatus;
  readonly effectiveFrom: Instant;
  readonly citations: readonly string[];
  /** Retirement reason, if the desk has been retired. */
  readonly retirementReason?: string;
}

interface DeskState {
  deskId: string;
  deskName: string;
  deskKind: DeskKind;
  bookType: DeskBookType;
  businessStrategy: string;
  deskHeadSeat: string;
  reportingLine: string;
  riskManagementStructure: DeskRiskManagementStructure;
  status: DeskStatus;
  effectiveFrom: Instant;
  citations: readonly string[];
  retirementReason: string | undefined;
}

// ---------------------------------------------------------------------------
// Raw event shapes understood by the fold.
// ---------------------------------------------------------------------------

interface RawDeskRegistered {
  kind?: never;
  deskId: string;
  deskName: string;
  deskKind: DeskKind;
  bookType: DeskBookType;
  businessStrategy: string;
  deskHeadSeat: string;
  reportingLine: string;
  riskManagementStructure: DeskRiskManagementStructure;
  status: DeskStatus;
  effectiveFrom: Instant;
  citations: readonly string[];
}

interface RawDeskAttributeChanged {
  deskId: string;
  revisedFields: {
    deskName?: string;
    businessStrategy?: string;
    deskHeadSeat?: string;
    reportingLine?: string;
    riskManagementStructure?: DeskRiskManagementStructure;
  };
}

interface RawDeskRetired {
  deskId: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Public register surface.
// ---------------------------------------------------------------------------

export interface DeskRegister {
  getDesk(deskId: string): Desk | null;
  listDesks(): Desk[];
  activeDesks(): Desk[];
  /** Structural integrity findings surfaced during fold (for the recon gate). */
  readonly violations: readonly DeskRegisterViolation[];
  /** Total number of events folded. */
  readonly eventCount: number;
}

export interface DeskRegisterViolation {
  readonly deskId: string;
  readonly kind: "orphan-change" | "orphan-retire" | "duplicate-registration";
  readonly message: string;
}

/**
 * A folded desk event, tagged with its event type. The fold is keyed on the
 * event `type` literal so callers pass `{ type, payload }` pairs (the desk
 * register store-read converts CpEvent → this shape).
 */
export type FoldedDeskEvent =
  | { readonly type: "DeskRegistered"; readonly payload: RawDeskRegistered }
  | { readonly type: "DeskAttributeChanged"; readonly payload: RawDeskAttributeChanged }
  | { readonly type: "DeskRetired"; readonly payload: RawDeskRetired };

// ---------------------------------------------------------------------------
// Fold implementation.
// ---------------------------------------------------------------------------

class DeskRegisterAccumulator {
  private readonly byId = new Map<string, DeskState>();
  readonly violations: DeskRegisterViolation[] = [];
  eventCount = 0;

  fold(ev: FoldedDeskEvent): void {
    this.eventCount += 1;
    switch (ev.type) {
      case "DeskRegistered": {
        const e = ev.payload;
        if (this.byId.has(e.deskId)) {
          this.violations.push({
            deskId: e.deskId,
            kind: "duplicate-registration",
            message: `DeskRegistered received for already-registered desk: ${e.deskId}`,
          });
          // Latest-wins for idempotent reseeds.
        }
        this.byId.set(e.deskId, {
          deskId: e.deskId,
          deskName: e.deskName,
          deskKind: e.deskKind,
          bookType: e.bookType,
          businessStrategy: e.businessStrategy,
          deskHeadSeat: e.deskHeadSeat,
          reportingLine: e.reportingLine,
          riskManagementStructure: e.riskManagementStructure,
          status: e.status,
          effectiveFrom: e.effectiveFrom,
          citations: e.citations,
          retirementReason: undefined,
        });
        break;
      }
      case "DeskAttributeChanged": {
        const e = ev.payload;
        const state = this.byId.get(e.deskId);
        if (!state) {
          this.violations.push({
            deskId: e.deskId,
            kind: "orphan-change",
            message: `DeskAttributeChanged for unregistered desk: ${e.deskId}`,
          });
          return;
        }
        const f = e.revisedFields;
        if (f.deskName !== undefined) state.deskName = f.deskName;
        if (f.businessStrategy !== undefined) state.businessStrategy = f.businessStrategy;
        if (f.deskHeadSeat !== undefined) state.deskHeadSeat = f.deskHeadSeat;
        if (f.reportingLine !== undefined) state.reportingLine = f.reportingLine;
        if (f.riskManagementStructure !== undefined) {
          state.riskManagementStructure = f.riskManagementStructure;
        }
        break;
      }
      case "DeskRetired": {
        const e = ev.payload;
        const state = this.byId.get(e.deskId);
        if (!state) {
          this.violations.push({
            deskId: e.deskId,
            kind: "orphan-retire",
            message: `DeskRetired for unregistered desk: ${e.deskId}`,
          });
          return;
        }
        state.status = "retired";
        state.retirementReason = e.reason;
        break;
      }
    }
  }

  toRegister(): DeskRegister {
    const snapshot = new Map(this.byId);
    const violations = [...this.violations];
    const eventCount = this.eventCount;
    return {
      getDesk(deskId: string): Desk | null {
        const s = snapshot.get(deskId);
        return s ? stateToDesk(s) : null;
      },
      listDesks(): Desk[] {
        return Array.from(snapshot.values()).map(stateToDesk);
      },
      activeDesks(): Desk[] {
        return Array.from(snapshot.values())
          .filter((s) => s.status === "active")
          .map(stateToDesk);
      },
      violations,
      eventCount,
    };
  }
}

function stateToDesk(s: DeskState): Desk {
  return {
    deskId: s.deskId,
    deskName: s.deskName,
    deskKind: s.deskKind,
    bookType: s.bookType,
    businessStrategy: s.businessStrategy,
    deskHeadSeat: s.deskHeadSeat,
    reportingLine: s.reportingLine,
    riskManagementStructure: s.riskManagementStructure,
    status: s.status,
    effectiveFrom: s.effectiveFrom,
    citations: s.citations,
    ...(s.retirementReason !== undefined ? { retirementReason: s.retirementReason } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

export function emptyDeskRegister(): DeskRegister {
  return new DeskRegisterAccumulator().toRegister();
}

/**
 * Fold a sequence of desk events into a desk register. Each event is a
 * `{ type, payload }` pair (the store-read maps CpEvent → FoldedDeskEvent).
 */
export function foldDeskRegister(events: Iterable<FoldedDeskEvent>): DeskRegister {
  const acc = new DeskRegisterAccumulator();
  for (const ev of events) {
    acc.fold(ev);
  }
  return acc.toRegister();
}
