// v2-core/client-onboarding/projection.ts
//
// Client-onboarding register projection — a pure fold over the born-V2 client
// onboarding events that produces the per-counterparty lifecycle state and the
// structural integrity violations the recon gate asserts.
//
// PRINCIPLE 1 INVARIANT: the register is a query over events, not stored state.
// The projection is deterministic and replayable from any suffix of the log.
//
// SHAPE-copied from the V1 `platform/lifecycle/onboarding-orchestrator.ts`
// (monotonic phase advance; offboarded is a terminal override) — NONE of the V1
// code is imported (D-V1-REMOVAL-PHASE-1; recon:v2-no-v1-import). The fold is
// tolerant (mirrors `v2-core/posture/projection.ts`): unknown kinds are skipped;
// structural problems accumulate as `violations` rather than throwing.
//
// GATING SET — the upstream phases a counterparty MUST have passed before it may
// legitimately reach `activated`. A `ClientOnboardingActivated` event with any
// gating phase missing is an `activation-without-gate` violation (fail-closed in
// the recon gate). This is the structural invariant the whole family exists to
// guarantee.
//
// Authority: D-V1-REMOVAL-PHASE-1; WS-V2-CLIENT-ONBOARDING.
// Author: Atlas (Core banking platform architect, engineering).

import {
  CLIENT_ACCOUNTS_SETUP,
  CLIENT_ACTIVATED,
  CLIENT_BO_RESOLVED,
  CLIENT_CREDIT_ASSESSED,
  CLIENT_FAIS_CLASSIFIED,
  CLIENT_FATCA_CRS_CLASSIFIED,
  CLIENT_KYC_PASSED,
  CLIENT_OFFBOARDED,
  CLIENT_POPIA_RECORDED,
  CLIENT_PROSPECT_REGISTERED,
  CLIENT_SANCTIONS_CLEARED,
  CLIENT_SOUNDING_OPENED,
  type ClientOnboardingEventKind,
  type ClientSector,
} from "./events";

// ---------------------------------------------------------------------------
// Phase type + ordering (monotonic; mirrors the V1 orchestrator's PHASE_ORDER)
// ---------------------------------------------------------------------------

export type ClientOnboardingPhase =
  | "sounding"
  | "prospect-registered"
  | "kyc-passed"
  | "sanctions-cleared"
  | "fais-classified"
  | "bo-resolved"
  | "fatca-crs-classified"
  | "popia-recorded"
  | "credit-assessed"
  | "accounts-setup"
  | "activated"
  | "offboarded";

const PHASE_ORDER: readonly ClientOnboardingPhase[] = [
  "sounding",
  "prospect-registered",
  "kyc-passed",
  "sanctions-cleared",
  "fais-classified",
  "bo-resolved",
  "fatca-crs-classified",
  "popia-recorded",
  "credit-assessed",
  "accounts-setup",
  "activated",
  "offboarded",
];

function phaseIndex(p: ClientOnboardingPhase): number {
  return PHASE_ORDER.indexOf(p);
}

/** Event kind → phase candidate. Returns null for non-phase events. */
function kindToPhase(kind: string): ClientOnboardingPhase | null {
  switch (kind) {
    case CLIENT_SOUNDING_OPENED:
      return "sounding";
    case CLIENT_PROSPECT_REGISTERED:
      return "prospect-registered";
    case CLIENT_KYC_PASSED:
      return "kyc-passed";
    case CLIENT_SANCTIONS_CLEARED:
      return "sanctions-cleared";
    case CLIENT_FAIS_CLASSIFIED:
      return "fais-classified";
    case CLIENT_BO_RESOLVED:
      return "bo-resolved";
    case CLIENT_FATCA_CRS_CLASSIFIED:
      return "fatca-crs-classified";
    case CLIENT_POPIA_RECORDED:
      return "popia-recorded";
    case CLIENT_CREDIT_ASSESSED:
      return "credit-assessed";
    case CLIENT_ACCOUNTS_SETUP:
      return "accounts-setup";
    case CLIENT_ACTIVATED:
      return "activated";
    case CLIENT_OFFBOARDED:
      return "offboarded";
    default:
      return null;
  }
}

/**
 * The gating phases that MUST precede `activated`. This is the structural
 * invariant of the whole family — the recon gate fails closed on any
 * counterparty that reaches `activated` without each of these.
 */
export const REQUIRED_GATING_PHASES: readonly ClientOnboardingPhase[] = [
  "kyc-passed",
  "sanctions-cleared",
  "fais-classified",
  "bo-resolved",
  "fatca-crs-classified",
  "popia-recorded",
  "credit-assessed",
  "accounts-setup",
];

// ---------------------------------------------------------------------------
// Projected record
// ---------------------------------------------------------------------------

export interface ClientOnboardingRecord {
  readonly counterpartyId: string;
  readonly legalName: string | undefined;
  readonly jurisdiction: string | undefined;
  readonly sector: ClientSector | undefined;
  readonly kycTier: string | undefined;
  readonly faisCategory: string | undefined;
  readonly phase: ClientOnboardingPhase;
  readonly isTerminal: boolean;
  /** Phases seen for this counterparty (set membership, for gate checks). */
  readonly phasesSeen: ReadonlySet<ClientOnboardingPhase>;
  readonly lastEventKind: string;
  readonly lastAdvancedAt: string;
  readonly eventCount: number;
}

export interface ClientOnboardingRegisterViolation {
  readonly counterpartyId: string;
  readonly kind:
    | "activation-without-gate" // reached activated missing a required gating phase
    | "activation-without-prospect" // activated with no prospect registration
    | "orphan-phase"; // a phase event arrived before sounding/prospect
  readonly message: string;
}

export interface ClientOnboardingRegister {
  getClient(counterpartyId: string): ClientOnboardingRecord | null;
  listClients(): ClientOnboardingRecord[];
  /** Clients currently in the `activated` phase. */
  listActiveClients(): ClientOnboardingRecord[];
  readonly violations: readonly ClientOnboardingRegisterViolation[];
  readonly eventCount: number;
}

// ---------------------------------------------------------------------------
// Raw event shape understood by the fold
// ---------------------------------------------------------------------------

/**
 * The fold accepts a minimal `{ kind, payload }` shape so the recon gate can map
 * the live event store's `{ type, payload }` onto it without coupling the v2-core
 * projection to the V1 event envelope.
 */
export interface RawClientOnboardingEvent {
  readonly kind: ClientOnboardingEventKind | string;
  readonly payload: Record<string, unknown>;
  /** Event business time (for lastAdvancedAt). */
  readonly asOf?: string;
}

interface MutableRecord {
  counterpartyId: string;
  legalName: string | undefined;
  jurisdiction: string | undefined;
  sector: ClientSector | undefined;
  kycTier: string | undefined;
  faisCategory: string | undefined;
  phase: ClientOnboardingPhase | null;
  phasesSeen: Set<ClientOnboardingPhase>;
  lastEventKind: string;
  lastAdvancedAt: string;
  eventCount: number;
}

class ClientOnboardingAccumulator {
  private readonly byId = new Map<string, MutableRecord>();
  readonly violations: ClientOnboardingRegisterViolation[] = [];
  eventCount = 0;

  fold(raw: unknown): void {
    if (typeof raw !== "object" || raw === null) return;
    const ev = raw as Partial<RawClientOnboardingEvent>;
    if (typeof ev.kind !== "string") return;
    const phase = kindToPhase(ev.kind);
    if (phase === null) return; // not part of this family — skip silently.

    const payload = (ev.payload ?? {}) as Record<string, unknown>;
    const counterpartyId =
      typeof payload.counterpartyId === "string" ? payload.counterpartyId : "";
    if (!counterpartyId) return;

    this.eventCount += 1;

    let rec = this.byId.get(counterpartyId);
    if (rec === undefined) {
      rec = {
        counterpartyId,
        legalName: undefined,
        jurisdiction: undefined,
        sector: undefined,
        kycTier: undefined,
        faisCategory: undefined,
        phase: null,
        phasesSeen: new Set<ClientOnboardingPhase>(),
        lastEventKind: ev.kind,
        lastAdvancedAt: ev.asOf ?? "",
        eventCount: 0,
      };
      this.byId.set(counterpartyId, rec);
    }

    rec.eventCount += 1;
    rec.phasesSeen.add(phase);

    // Capture descriptive fields from the relevant events.
    if (ev.kind === CLIENT_PROSPECT_REGISTERED) {
      if (typeof payload.legalName === "string") rec.legalName = payload.legalName;
      if (typeof payload.jurisdiction === "string") rec.jurisdiction = payload.jurisdiction;
      if (typeof payload.sector === "string") rec.sector = payload.sector as ClientSector;
    }
    if (ev.kind === CLIENT_KYC_PASSED && typeof payload.tier === "string") {
      rec.kycTier = payload.tier;
    }
    if (ev.kind === CLIENT_FAIS_CLASSIFIED && typeof payload.faisCategory === "string") {
      rec.faisCategory = payload.faisCategory;
    }

    // Activation-integrity checks — the structural invariant of the family.
    if (phase === "activated") {
      if (!rec.phasesSeen.has("prospect-registered")) {
        this.violations.push({
          counterpartyId,
          kind: "activation-without-prospect",
          message: `counterparty ${counterpartyId} reached activated without a ClientOnboardingProspectRegistered event`,
        });
      }
      for (const required of REQUIRED_GATING_PHASES) {
        if (!rec.phasesSeen.has(required)) {
          this.violations.push({
            counterpartyId,
            kind: "activation-without-gate",
            message: `counterparty ${counterpartyId} reached activated without required gating phase "${required}"`,
          });
        }
      }
    }

    // Monotonic phase advance; offboarded is a terminal override.
    if (phase === "offboarded") {
      rec.phase = "offboarded";
      rec.lastEventKind = ev.kind;
      if (ev.asOf) rec.lastAdvancedAt = ev.asOf;
      return;
    }
    const currentIndex = rec.phase === null ? -1 : phaseIndex(rec.phase);
    if (phaseIndex(phase) > currentIndex && rec.phase !== "offboarded") {
      rec.phase = phase;
      rec.lastEventKind = ev.kind;
      if (ev.asOf) rec.lastAdvancedAt = ev.asOf;
    }
  }

  toRegister(): ClientOnboardingRegister {
    const snapshot = new Map(this.byId);
    const violations = [...this.violations];
    const eventCount = this.eventCount;

    const toRecord = (r: MutableRecord): ClientOnboardingRecord => {
      const phase: ClientOnboardingPhase = r.phase ?? "sounding";
      return {
        counterpartyId: r.counterpartyId,
        legalName: r.legalName,
        jurisdiction: r.jurisdiction,
        sector: r.sector,
        kycTier: r.kycTier,
        faisCategory: r.faisCategory,
        phase,
        isTerminal: phase === "activated" || phase === "offboarded",
        phasesSeen: new Set(r.phasesSeen),
        lastEventKind: r.lastEventKind,
        lastAdvancedAt: r.lastAdvancedAt,
        eventCount: r.eventCount,
      };
    };

    return {
      getClient(counterpartyId: string): ClientOnboardingRecord | null {
        const r = snapshot.get(counterpartyId);
        return r ? toRecord(r) : null;
      },
      listClients(): ClientOnboardingRecord[] {
        return Array.from(snapshot.values()).map(toRecord);
      },
      listActiveClients(): ClientOnboardingRecord[] {
        return Array.from(snapshot.values())
          .map(toRecord)
          .filter((c) => c.phase === "activated");
      },
      violations,
      eventCount,
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** An empty register (no events folded). */
export function emptyClientOnboardingRegister(): ClientOnboardingRegister {
  return new ClientOnboardingAccumulator().toRegister();
}

/**
 * Fold a sequence of raw client-onboarding events into a register. Tolerant:
 * unknown kinds are skipped; structural problems accumulate in
 * `register.violations`.
 */
export function foldClientOnboardingRegister(
  rawEvents: Iterable<unknown>,
): ClientOnboardingRegister {
  const acc = new ClientOnboardingAccumulator();
  for (const ev of rawEvents) acc.fold(ev);
  return acc.toRegister();
}
