// v2-core/control-plane/functional-seats.ts
//
// Tenant-scoped functional-seat model — V2 S11 (the last Wave-3 slice).
//
// THE SEAT / PERSONA SPLIT
// ------------------------
// In a multi-tenant platform you cannot have "Helena the CRO" as a global
// singleton — every tenant needs its OWN functional seats (a CRO seat, a
// Risk-Engineer seat, …), each filled by that tenant's own agent. S11
// introduces the abstraction:
//
//   • the SEAT is the functional role, TENANT-SCOPED. Its key embeds the
//     tenant: `tenant:za-bank:seat:cro`. A second tenant's CRO seat is a
//     DISTINCT key `tenant:uk-bank:seat:cro` — they never collide.
//   • the PERSONA (Helena, Rohan, …) is the ANCHOR tenant's OCCUPANT of its
//     seat. The persona name is occupancy, NOT seat identity.
//
// DERIVATION — ADDITIVE, ROSTER IS THE SOURCE
// -------------------------------------------
// `Team/_team-roster.json` is canonical (Vera mandate-coverage recon,
// CLAUDE.md renders, persona-file headers, dashboard tile all derive from it).
// S11 is PURELY ADDITIVE: it DERIVES the anchor tenant's seat map FROM the
// roster's existing `name`/`role`/`type`/`reportsTo` fields. It never renames a
// persona, restructures the roster, or touches a persona file. The roster stays
// the single source of truth; this v2 seat register *references* it.
//
//   persona.name      → seat occupant
//   persona.role      → functionalRole + (slugified) seat key
//   persona.type      → seatType (governance | engineering)
//   persona.reportsTo → reportsToSeat (the seatId of the reports-to persona's
//                       seat; "CEO"/"marc" → null, the top-of-house CEO line)
//
// The derivation is IDEMPOTENT: replaying the derived events into a fresh
// projection yields the same seat map regardless of how many times it runs.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from any
// v1 code-line directory (`platform/`, `runtime/`, `domains/`, …). Reading the
// repo-root roster DATA file via `node:fs` is permitted (it is data, not code —
// exactly as the control-plane store reads a SQLite data file). See
// `recon:v2-no-v1-import`.
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C — per-tenant stores +
// control-plane store); D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:owen:v2-s11-tenant-scoped-functional-seat-model-roste:2026-06-13
// Author: Owen (Company Secretary, governance) with Sade (AgentOps, operations).

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  FUNCTIONAL_SEAT_REGISTERED,
  type FunctionalSeatRegisteredPayload,
  type SeatType,
  functionalSeatRegisteredPayloadSchema,
} from "./events";
import type { ControlPlaneStore, CpEvent } from "./store";
import { ANCHOR_TENANT_ID } from "./tenant";

// ---------------------------------------------------------------------------
// Seat-key construction
// ---------------------------------------------------------------------------

/**
 * Slugify a roster role into the `seat:` key segment: lowercase, non-alphanumeric
 * runs collapsed to a single hyphen, leading/trailing hyphens stripped.
 *
 *   "Chief Risk Officer"                     → "chief-risk-officer"
 *   "Independent-validation engineer (…)"    → "independent-validation-engineer"
 *   "AgentOps & Token Efficiency Engineer"   → "agentops-token-efficiency-engineer"
 *
 * Deterministic and total — every non-empty role yields a non-empty slug.
 */
export function roleSlug(role: string): string {
  return role
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Build a seat key `tenant:<tenantId-segment>:seat:<role-slug>`. */
export function seatId(tenantId: string, role: string): string {
  // `tenantId` already carries the `tenant:` prefix (e.g. "tenant:za-bank").
  return `${tenantId}:seat:${roleSlug(role)}`;
}

// ---------------------------------------------------------------------------
// Roster shape (the subset S11 derives from — read-only)
// ---------------------------------------------------------------------------

/**
 * The roster fields S11 reads. The roster carries more fields (expertise,
 * workflowFile, …) S11 ignores; it derives ONLY name/role/type/reportsTo.
 */
export interface RosterPersona {
  readonly name: string;
  readonly role: string;
  readonly type: string; // expected "governance" | "engineering"
  readonly reportsTo: string; // persona name, or "CEO" / "marc" for top-of-house
}

interface RawRoster {
  readonly personas?: ReadonlyArray<Partial<RosterPersona> & Record<string, unknown>>;
}

/**
 * `reportsTo` values that denote the top-of-house CEO line rather than another
 * persona's seat. A seat reporting to one of these has `reportsToSeat: null`.
 */
const CEO_REPORTS_TO = new Set(["CEO", "marc"]);

// ---------------------------------------------------------------------------
// Repo-root resolution (local — NO v1 import)
// ---------------------------------------------------------------------------

/**
 * Walk up from `start` until a directory containing `CLAUDE.md` is found — the
 * repo root. Mirrors the v1 recon helper's behaviour but is defined locally so
 * v2-core does not import any v1 module. Throws if no root is found.
 */
export function findRepoRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`findRepoRoot: no CLAUDE.md found walking up from "${start}"`);
    }
    dir = parent;
  }
}

/** Default roster path: `<repo-root>/Team/_team-roster.json`. */
export function defaultRosterPath(): string {
  return resolve(findRepoRoot(import.meta.dir), "Team", "_team-roster.json");
}

/**
 * Load + parse the canonical roster. `pathOrJson` may be an explicit file path,
 * or omitted to resolve `defaultRosterPath()`. Returns the persona array
 * (read-only). The roster is NEVER mutated here — S11 derives, it does not write.
 */
export function loadRoster(path?: string): readonly RosterPersona[] {
  const resolved = path ?? defaultRosterPath();
  const raw = readFileSync(resolved, "utf8");
  return parseRoster(raw);
}

/** Parse roster JSON text into the persona subset S11 derives from. */
export function parseRoster(json: string): readonly RosterPersona[] {
  const data = JSON.parse(json) as RawRoster;
  const out: RosterPersona[] = [];
  for (const p of data.personas ?? []) {
    if (
      typeof p.name === "string" &&
      typeof p.role === "string" &&
      typeof p.type === "string" &&
      typeof p.reportsTo === "string"
    ) {
      out.push({ name: p.name, role: p.role, type: p.type, reportsTo: p.reportsTo });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Roster → seat derivation
// ---------------------------------------------------------------------------

/**
 * A roster inconsistency surfaced while deriving the seat map. S11 REPORTS
 * these (the recon turns them into findings) — it does NOT silently fix the
 * roster. The roster is the source of truth.
 */
export interface DerivationFinding {
  readonly subject: string;
  readonly message: string;
}

export interface DerivedSeatMap {
  /** One `FunctionalSeatRegistered` payload per persona, in roster order. */
  readonly seats: readonly FunctionalSeatRegisteredPayload[];
  /** Inconsistencies found while deriving (roster is source — do not auto-fix). */
  readonly findings: readonly DerivationFinding[];
}

/**
 * Derive a tenant's functional-seat map from the roster (READ-ONLY). For the
 * anchor map pass `tenantId = ANCHOR_TENANT_ID`. Each persona becomes one seat:
 * name → occupant, role → functionalRole + slug key, type → seatType,
 * reportsTo → reportsToSeat (the reports-to persona's seat key; CEO/marc → null).
 *
 * Idempotent + deterministic — same roster ⇒ same seat map. Surfaces (does not
 * fix) inconsistencies: unknown seatType, duplicate role slug, dangling
 * reportsTo (a reportsTo naming a persona not in the roster).
 */
export function deriveSeatMap(
  personas: readonly RosterPersona[],
  tenantId: string,
  registeredAt: string,
): DerivedSeatMap {
  const findings: DerivationFinding[] = [];

  // Persona-name → seatId, so we can resolve `reportsTo` to a reports-to seat.
  const nameToSeatId = new Map<string, string>();
  for (const p of personas) {
    nameToSeatId.set(p.name, seatId(tenantId, p.role));
  }

  const seats: FunctionalSeatRegisteredPayload[] = [];
  const seenSlugs = new Map<string, string>(); // slug → first persona that claimed it

  for (const p of personas) {
    const sId = seatId(tenantId, p.role);
    const slug = roleSlug(p.role);

    // Finding: duplicate role slug ⇒ two personas would collide on one seat key.
    const prior = seenSlugs.get(slug);
    if (prior !== undefined && prior !== p.name) {
      findings.push({
        subject: sId,
        message: `Role slug "${slug}" is claimed by both "${prior}" and "${p.name}" — two personas map to the same seat key. Roster roles must be distinct per tenant.`,
      });
    } else {
      seenSlugs.set(slug, p.name);
    }

    // seatType: derive from roster `type`; flag (but still record) unknowns.
    let seatType: SeatType;
    if (p.type === "governance" || p.type === "engineering") {
      seatType = p.type;
    } else {
      findings.push({
        subject: sId,
        message: `Persona "${p.name}" has roster type "${p.type}" — expected "governance" or "engineering". Defaulting seatType to "engineering" for the derived seat; FIX THE ROSTER, not the seat.`,
      });
      seatType = "engineering";
    }

    // reportsToSeat: CEO/marc → null; otherwise the reports-to persona's seat.
    let reportsToSeat: string | null;
    if (CEO_REPORTS_TO.has(p.reportsTo)) {
      reportsToSeat = null;
    } else {
      const target = nameToSeatId.get(p.reportsTo);
      if (target === undefined) {
        findings.push({
          subject: sId,
          message: `Persona "${p.name}" reportsTo "${p.reportsTo}", which is neither a roster persona nor the CEO line. reportsToSeat left null.`,
        });
        reportsToSeat = null;
      } else {
        reportsToSeat = target;
      }
    }

    seats.push({
      seatId: sId,
      tenantId,
      functionalRole: p.role,
      seatType,
      reportsToSeat,
      occupant: p.name,
      registeredAt,
    });
  }

  return { seats, findings };
}

// ---------------------------------------------------------------------------
// Event construction + idempotent emission
// ---------------------------------------------------------------------------

const SEAT_ENTITY = "control-plane";

/**
 * Build a `FunctionalSeatRegistered` CpEvent for a derived seat payload. The
 * `event_id` is DETERMINISTIC (`seat-registered:<seatId>`) so re-deriving the
 * anchor map and re-appending is idempotent at the store layer (the store's
 * `INSERT OR IGNORE` dedupes on event_id).
 */
export function makeFunctionalSeatRegisteredEvent(
  payload: FunctionalSeatRegisteredPayload,
  actorId = "v2:functional-seat-deriver",
  citations: readonly string[] = ["D-V2-TENANCY-ARCHITECTURE"],
): CpEvent {
  // Validate before emit (Principle 1 — only well-formed events enter the log).
  functionalSeatRegisteredPayloadSchema.parse(payload);
  return {
    event_id: `seat-registered:${payload.seatId}`,
    type: FUNCTIONAL_SEAT_REGISTERED,
    as_of: payload.registeredAt,
    entity: SEAT_ENTITY,
    actor: { type: "service", id: actorId },
    citations,
    payload: payload as unknown as Record<string, unknown>,
  };
}

/**
 * Derive the anchor tenant's seat map from the roster and APPEND it to the
 * control-plane store. Idempotent — deterministic event_ids mean repeated runs
 * do not duplicate seats. Returns the derived map (incl. any findings) so the
 * caller (a seed script / the recon) can surface inconsistencies.
 *
 * `tenantId` defaults to the anchor tenant. Pass an explicit roster path for
 * tests; omit it to resolve the canonical roster.
 */
export function deriveAndAppendAnchorSeats(
  store: ControlPlaneStore,
  opts: {
    readonly tenantId?: string;
    readonly rosterPath?: string;
    readonly rosterPersonas?: readonly RosterPersona[];
    readonly registeredAt?: string;
  } = {},
): DerivedSeatMap {
  const tenantId = opts.tenantId ?? ANCHOR_TENANT_ID;
  const personas = opts.rosterPersonas ?? loadRoster(opts.rosterPath);
  const registeredAt = opts.registeredAt ?? new Date().toISOString();
  const map = deriveSeatMap(personas, tenantId, registeredAt);
  for (const seat of map.seats) {
    store.append(makeFunctionalSeatRegisteredEvent(seat));
  }
  return map;
}

// ---------------------------------------------------------------------------
// FunctionalSeatProjection — folds FunctionalSeatRegistered over the store
// ---------------------------------------------------------------------------

/** A registered functional seat, as folded from the store. */
export interface FunctionalSeat {
  readonly seatId: string;
  readonly tenantId: string;
  readonly functionalRole: string;
  readonly seatType: SeatType;
  readonly reportsToSeat: string | null;
  readonly occupant: string;
  readonly registeredAt: string;
}

/**
 * In-memory projection of the tenant-scoped functional-seat register. Pure
 * query over the control-plane log (Principle 1). Latest registration per
 * `seatId` wins (re-registration overwrites), so a re-derive that changes a
 * seat's occupancy/role attributes is reflected.
 */
export class FunctionalSeatProjection {
  private readonly seats = new Map<string, FunctionalSeat>();
  private readonly store: ControlPlaneStore;

  constructor(store: ControlPlaneStore) {
    this.store = store;
    this.fold();
  }

  /** Re-seed from a full store replay (idempotent). */
  rebuild(): void {
    this.seats.clear();
    this.fold();
  }

  /** Every registered seat across all tenants, in seatId order. */
  listSeats(): FunctionalSeat[] {
    return [...this.seats.values()].sort((a, b) => a.seatId.localeCompare(b.seatId));
  }

  /** Seats for a single tenant, in seatId order. */
  seatsForTenant(tenantId: string): FunctionalSeat[] {
    return this.listSeats().filter((s) => s.tenantId === tenantId);
  }

  /** Single seat lookup by key. Returns `null` when unknown. */
  getSeat(seatIdKey: string): FunctionalSeat | null {
    return this.seats.get(seatIdKey) ?? null;
  }

  /**
   * The seat a given persona occupies within a tenant, or `null`. The same
   * persona NAME can occupy distinct seats in distinct tenants without
   * colliding — occupancy is scoped by tenant.
   */
  seatForOccupant(tenantId: string, occupant: string): FunctionalSeat | null {
    return this.seatsForTenant(tenantId).find((s) => s.occupant === occupant) ?? null;
  }

  private fold(): void {
    for (const event of this.store.replay({ type: FUNCTIONAL_SEAT_REGISTERED })) {
      const p = event.payload as unknown as FunctionalSeatRegisteredPayload;
      this.seats.set(p.seatId, {
        seatId: p.seatId,
        tenantId: p.tenantId,
        functionalRole: p.functionalRole,
        seatType: p.seatType,
        reportsToSeat: p.reportsToSeat,
        occupant: p.occupant,
        registeredAt: p.registeredAt,
      });
    }
  }
}

/** Build a functional-seat projection seeded from `store`. */
export function buildFunctionalSeatProjection(store: ControlPlaneStore): FunctionalSeatProjection {
  return new FunctionalSeatProjection(store);
}

// ---------------------------------------------------------------------------
// Parity assertion (pure — shared by the test and the recon)
// ---------------------------------------------------------------------------

export interface SeatRosterParityViolation {
  readonly subject: string;
  readonly message: string;
}

/**
 * Pure parity assertion: the ANCHOR tenant's seat register must be consistent
 * with the roster (the roster is the source — DRIFT is a finding, not a fix):
 *
 *   1. every roster persona maps to EXACTLY ONE anchor seat (no missing seat);
 *   2. each seat's functionalRole / seatType / reportsToSeat match what the
 *      roster says (re-derived from the same roster);
 *   3. no ORPHAN anchor seat — every anchor seat traces back to a roster persona;
 *   4. any derivation finding (unknown type, dup slug, dangling reportsTo) is a
 *      violation.
 *
 * Returns the list of violations (empty == clean) plus the assertion count.
 */
export function assertSeatRosterParity(
  personas: readonly RosterPersona[],
  registeredSeats: readonly FunctionalSeat[],
  tenantId: string,
  registeredAt: string,
): { violations: SeatRosterParityViolation[]; asserted: number } {
  const violations: SeatRosterParityViolation[] = [];
  let asserted = 0;

  const expected = deriveSeatMap(personas, tenantId, registeredAt);

  // (4) derivation findings are violations.
  for (const f of expected.findings) {
    violations.push({ subject: f.subject, message: f.message });
  }

  // Index the anchor-tenant registered seats by key.
  const anchorRegistered = registeredSeats.filter((s) => s.tenantId === tenantId);
  const registeredById = new Map<string, FunctionalSeat>();
  for (const s of anchorRegistered) {
    registeredById.set(s.seatId, s);
  }
  const expectedById = new Map(expected.seats.map((s) => [s.seatId, s] as const));

  // (1) + (2) every persona maps to exactly one consistent anchor seat.
  for (const exp of expected.seats) {
    asserted += 1;
    const reg = registeredById.get(exp.seatId);
    if (!reg) {
      violations.push({
        subject: exp.seatId,
        message: `Roster persona "${exp.occupant}" (${exp.functionalRole}) has NO registered anchor seat "${exp.seatId}". Derive + register it.`,
      });
      continue;
    }
    asserted += 1;
    if (reg.functionalRole !== exp.functionalRole) {
      violations.push({
        subject: exp.seatId,
        message: `Seat "${exp.seatId}" functionalRole "${reg.functionalRole}" drifts from roster "${exp.functionalRole}". Roster is the source.`,
      });
    }
    asserted += 1;
    if (reg.seatType !== exp.seatType) {
      violations.push({
        subject: exp.seatId,
        message: `Seat "${exp.seatId}" seatType "${reg.seatType}" drifts from roster "${exp.seatType}". Roster is the source.`,
      });
    }
    asserted += 1;
    if (reg.reportsToSeat !== exp.reportsToSeat) {
      violations.push({
        subject: exp.seatId,
        message: `Seat "${exp.seatId}" reportsToSeat "${reg.reportsToSeat ?? "null"}" drifts from roster "${exp.reportsToSeat ?? "null"}". Roster is the source.`,
      });
    }
    asserted += 1;
    if (reg.occupant !== exp.occupant) {
      violations.push({
        subject: exp.seatId,
        message: `Anchor seat "${exp.seatId}" occupant "${reg.occupant}" drifts from roster persona "${exp.occupant}". Roster is the source.`,
      });
    }
  }

  // (3) no orphan anchor seat.
  for (const reg of anchorRegistered) {
    asserted += 1;
    if (!expectedById.has(reg.seatId)) {
      violations.push({
        subject: reg.seatId,
        message: `Orphan anchor seat "${reg.seatId}" (occupant "${reg.occupant}") has no matching roster persona. The roster is the source — remove the seat or restore the persona.`,
      });
    }
  }

  return { violations, asserted };
}
