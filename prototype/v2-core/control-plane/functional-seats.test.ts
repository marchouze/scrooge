// v2-core/control-plane/functional-seats.test.ts
//
// Unit tests for the V2 S11 tenant-scoped functional-seat model.
//
// Proves:
//   1. ANCHOR OCCUPANCY — every roster persona derives to exactly one anchor
//      seat (name → occupant, role → seat + slug, type → seatType,
//      reportsTo → reportsToSeat), against the REAL canonical roster.
//   2. THE MULTI-TENANT PROPERTY — the anchor `tenant:za-bank:seat:cro` and a
//      HYPOTHETICAL `tenant:uk-bank:seat:cro` are distinct, non-colliding keys
//      with distinct occupancy (no real second tenant onboarded).
//   3. IDEMPOTENCY — re-deriving + re-appending does not duplicate seats.
//   4. PARITY ASSERTION is non-vacuous — a sabotaged seat (drifted type / dup
//      slug / dangling reportsTo / orphan / missing) IS caught.
//
// Author: Owen (Company Secretary, governance) with Sade (AgentOps, operations).

import { describe, expect, it } from "bun:test";

import {
  ANCHOR_TENANT_ID,
  type FunctionalSeat,
  type RosterPersona,
  assertSeatRosterParity,
  buildFunctionalSeatProjection,
  deriveAndAppendAnchorSeats,
  deriveSeatMap,
  loadRoster,
  openControlPlaneStore,
  roleSlug,
  seatId,
} from "./index";

const REGISTERED_AT = "2026-06-13T00:00:00.000Z";

// A small synthetic roster used where we need a known, controlled shape.
const SYNTH_ROSTER: readonly RosterPersona[] = [
  { name: "Helena", role: "Chief Risk Officer", type: "governance", reportsTo: "CEO" },
  { name: "Rohan", role: "Risk engineer", type: "engineering", reportsTo: "Helena" },
  { name: "Owen", role: "Company Secretary", type: "governance", reportsTo: "CEO" },
];

describe("roleSlug + seatId", () => {
  it("slugifies roster roles deterministically", () => {
    expect(roleSlug("Chief Risk Officer")).toBe("chief-risk-officer");
    expect(roleSlug("AgentOps & Token Efficiency Engineer")).toBe(
      "agentops-token-efficiency-engineer",
    );
    expect(roleSlug("Independent-validation engineer (second line)")).toBe(
      "independent-validation-engineer-second-line",
    );
  });

  it("embeds the tenant in the seat key", () => {
    expect(seatId("tenant:za-bank", "Chief Risk Officer")).toBe("tenant:za-bank:seat:chief-risk-officer");
    expect(seatId("tenant:uk-bank", "Chief Risk Officer")).toBe("tenant:uk-bank:seat:chief-risk-officer");
  });
});

describe("deriveSeatMap — roster derivation", () => {
  it("maps each persona to one seat with derived attributes", () => {
    const { seats, findings } = deriveSeatMap(SYNTH_ROSTER, ANCHOR_TENANT_ID, REGISTERED_AT);
    expect(findings).toEqual([]);
    expect(seats).toHaveLength(3);

    const cro = seats.find((s) => s.occupant === "Helena");
    expect(cro).toBeDefined();
    expect(cro?.seatId).toBe("tenant:za-bank:seat:chief-risk-officer");
    expect(cro?.functionalRole).toBe("Chief Risk Officer");
    expect(cro?.seatType).toBe("governance");
    expect(cro?.reportsToSeat).toBeNull(); // CEO line → null

    const riskEng = seats.find((s) => s.occupant === "Rohan");
    expect(riskEng?.seatType).toBe("engineering");
    // reportsTo Helena → Helena's seat key
    expect(riskEng?.reportsToSeat).toBe("tenant:za-bank:seat:chief-risk-officer");
  });

  it("flags an unknown seatType as a finding (does not silently fix)", () => {
    const bad: RosterPersona[] = [
      { name: "X", role: "Mystery role", type: "wizard", reportsTo: "CEO" },
    ];
    const { seats, findings } = deriveSeatMap(bad, ANCHOR_TENANT_ID, REGISTERED_AT);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.message).toContain("wizard");
    // still records the seat (defaulted) — roster is the source to fix
    expect(seats[0]?.seatType).toBe("engineering");
  });

  it("flags a dangling reportsTo as a finding", () => {
    const bad: RosterPersona[] = [
      { name: "X", role: "Some role", type: "engineering", reportsTo: "Nonexistent" },
    ];
    const { findings } = deriveSeatMap(bad, ANCHOR_TENANT_ID, REGISTERED_AT);
    expect(findings.some((f) => f.message.includes("Nonexistent"))).toBe(true);
  });

  it("flags a duplicate role slug as a finding", () => {
    const bad: RosterPersona[] = [
      { name: "A", role: "Risk Engineer", type: "engineering", reportsTo: "CEO" },
      { name: "B", role: "risk engineer", type: "engineering", reportsTo: "CEO" },
    ];
    const { findings } = deriveSeatMap(bad, ANCHOR_TENANT_ID, REGISTERED_AT);
    expect(findings.some((f) => f.message.includes("Role slug"))).toBe(true);
  });
});

describe("deriveAndAppendAnchorSeats — against the REAL canonical roster", () => {
  it("maps every roster persona to exactly one anchor seat, idempotently", () => {
    const store = openControlPlaneStore(":memory:");
    try {
      const personas = loadRoster();
      expect(personas.length).toBeGreaterThan(0);

      const first = deriveAndAppendAnchorSeats(store, {
        rosterPersonas: personas,
        registeredAt: REGISTERED_AT,
      });
      // The real roster is internally consistent — no derivation findings.
      expect(first.findings).toEqual([]);

      const proj = buildFunctionalSeatProjection(store);
      const anchorSeats = proj.seatsForTenant(ANCHOR_TENANT_ID);
      // one seat per persona
      expect(anchorSeats).toHaveLength(personas.length);

      // every persona occupies exactly one anchor seat
      for (const p of personas) {
        const seat = proj.seatForOccupant(ANCHOR_TENANT_ID, p.name);
        expect(seat).not.toBeNull();
        expect(seat?.functionalRole).toBe(p.role);
      }

      // Idempotency: re-derive + re-append, projection count unchanged.
      deriveAndAppendAnchorSeats(store, {
        rosterPersonas: personas,
        registeredAt: REGISTERED_AT,
      });
      proj.rebuild();
      expect(proj.seatsForTenant(ANCHOR_TENANT_ID)).toHaveLength(personas.length);

      // Parity holds against the roster.
      const parity = assertSeatRosterParity(
        personas,
        proj.listSeats(),
        ANCHOR_TENANT_ID,
        REGISTERED_AT,
      );
      expect(parity.violations).toEqual([]);
      expect(parity.asserted).toBeGreaterThan(0);
    } finally {
      store.close();
    }
  });

  it("resolves the anchor CRO seat occupied by Helena", () => {
    const store = openControlPlaneStore(":memory:");
    try {
      deriveAndAppendAnchorSeats(store, { rosterPersonas: loadRoster(), registeredAt: REGISTERED_AT });
      const proj = buildFunctionalSeatProjection(store);
      const cro = proj.getSeat("tenant:za-bank:seat:chief-risk-officer");
      expect(cro?.occupant).toBe("Helena");
      expect(cro?.seatType).toBe("governance");
    } finally {
      store.close();
    }
  });
});

describe("the multi-tenant property — anchor vs hypothetical second tenant", () => {
  it("anchor and uk-bank CRO seats are distinct, non-colliding keys with distinct occupancy", () => {
    const store = openControlPlaneStore(":memory:");
    try {
      // Anchor seats — derived from the real roster.
      deriveAndAppendAnchorSeats(store, {
        rosterPersonas: SYNTH_ROSTER,
        registeredAt: REGISTERED_AT,
      });

      // A HYPOTHETICAL second tenant (NOT onboarded — derived in-test only) with
      // its OWN occupant of the same functional role.
      const HYPOTHETICAL_UK = "tenant:uk-bank";
      const ukRoster: RosterPersona[] = [
        { name: "Fiona", role: "Chief Risk Officer", type: "governance", reportsTo: "CEO" },
      ];
      deriveAndAppendAnchorSeats(store, {
        tenantId: HYPOTHETICAL_UK,
        rosterPersonas: ukRoster,
        registeredAt: REGISTERED_AT,
      });

      const proj = buildFunctionalSeatProjection(store);

      const anchorCro = proj.getSeat("tenant:za-bank:seat:chief-risk-officer");
      const ukCro = proj.getSeat("tenant:uk-bank:seat:chief-risk-officer");

      // Distinct keys.
      expect(anchorCro?.seatId).not.toBe(ukCro?.seatId);
      // Same functional role …
      expect(anchorCro?.functionalRole).toBe(ukCro?.functionalRole);
      // … but distinct occupancy — the uk CRO seat does NOT collide with Helena.
      expect(anchorCro?.occupant).toBe("Helena");
      expect(ukCro?.occupant).toBe("Fiona");

      // Each tenant's seat list is isolated to that tenant.
      expect(proj.seatsForTenant(ANCHOR_TENANT_ID).every((s) => s.tenantId === ANCHOR_TENANT_ID)).toBe(
        true,
      );
      expect(proj.seatsForTenant(HYPOTHETICAL_UK).every((s) => s.tenantId === HYPOTHETICAL_UK)).toBe(
        true,
      );
      expect(proj.seatsForTenant(HYPOTHETICAL_UK)).toHaveLength(1);

      // Anchor parity unaffected by the second tenant's seats.
      const parity = assertSeatRosterParity(
        SYNTH_ROSTER,
        proj.listSeats(),
        ANCHOR_TENANT_ID,
        REGISTERED_AT,
      );
      expect(parity.violations).toEqual([]);
    } finally {
      store.close();
    }
  });
});

describe("assertSeatRosterParity — sabotage-proof (non-vacuous)", () => {
  function anchorSeatsFrom(personas: readonly RosterPersona[]): FunctionalSeat[] {
    return deriveSeatMap(personas, ANCHOR_TENANT_ID, REGISTERED_AT).seats.map((s) => ({ ...s }));
  }

  it("catches a missing seat", () => {
    const seats = anchorSeatsFrom(SYNTH_ROSTER).slice(1); // drop Helena's seat
    const { violations } = assertSeatRosterParity(SYNTH_ROSTER, seats, ANCHOR_TENANT_ID, REGISTERED_AT);
    expect(violations.some((v) => v.message.includes("NO registered anchor seat"))).toBe(true);
  });

  it("catches a drifted seatType", () => {
    const seats = anchorSeatsFrom(SYNTH_ROSTER);
    const idx = seats.findIndex((s) => s.occupant === "Helena");
    seats[idx] = { ...seats[idx]!, seatType: "engineering" }; // drift from roster governance
    const { violations } = assertSeatRosterParity(SYNTH_ROSTER, seats, ANCHOR_TENANT_ID, REGISTERED_AT);
    expect(violations.some((v) => v.message.includes("seatType"))).toBe(true);
  });

  it("catches an orphan seat", () => {
    const seats = anchorSeatsFrom(SYNTH_ROSTER);
    seats.push({
      seatId: "tenant:za-bank:seat:phantom",
      tenantId: ANCHOR_TENANT_ID,
      functionalRole: "Phantom",
      seatType: "engineering",
      reportsToSeat: null,
      occupant: "Ghost",
      registeredAt: REGISTERED_AT,
    });
    const { violations } = assertSeatRosterParity(SYNTH_ROSTER, seats, ANCHOR_TENANT_ID, REGISTERED_AT);
    expect(violations.some((v) => v.message.includes("Orphan anchor seat"))).toBe(true);
  });

  it("is clean for the real roster (vacuity guard: asserted > 0)", () => {
    const personas = loadRoster();
    const seats = anchorSeatsFrom(personas);
    const { violations, asserted } = assertSeatRosterParity(
      personas,
      seats,
      ANCHOR_TENANT_ID,
      REGISTERED_AT,
    );
    expect(violations).toEqual([]);
    expect(asserted).toBeGreaterThan(0);
  });
});
