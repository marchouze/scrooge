// tests/seed-management.test.ts
//
// Unit tests for the Trusted-Figures Phase D seed-management substrate:
//   - loadDescopedSeedIds() folds SeedDescoped + SeedPromotedToSimulated.
//   - buildSeedsView() reflects descope status + per-type event counts.
//   - recon:seed-manifest-parity run() asserts manifest ↔ bootDerive() parity.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import {
  makeSeedDescoped,
  makeSeedPromotedToSimulated,
} from "../platform/event-store/event-types/seed-management";
import { EventStore } from "../platform/event-store/store";
import { run as runSeedManifestParity } from "../platform/recon/seed-manifest-parity";
import { loadDescopedSeedIds } from "../seeds/descope";
import { SEED_MANIFEST } from "../seeds/manifest";
import { buildSeedsView } from "../seeds/seeds-view";

const HUMAN = { type: "human" as const, id: "marc@tgv.co.za" };

function descope(store: EventStore, seedId: string, reason = "test"): void {
  store.append(
    makeSeedDescoped({
      asOf: new Date().toISOString(),
      entity: "LE-BANK-SA",
      actor: HUMAN,
      citations: ["D-TRUSTED-FIGURES-PROGRAM-V1"],
      payload: { seedId, reason },
    }),
  );
}

describe("loadDescopedSeedIds", () => {
  it("returns empty set on a fresh store", () => {
    expect(loadDescopedSeedIds(new EventStore()).size).toBe(0);
  });

  it("folds SeedDescoped events", () => {
    const store = new EventStore();
    descope(store, "npa-attestations");
    const set = loadDescopedSeedIds(store);
    expect(set.has("npa-attestations")).toBe(true);
    expect(set.size).toBe(1);
  });

  it("also treats SeedPromotedToSimulated as a descope", () => {
    const store = new EventStore();
    store.append(
      makeSeedPromotedToSimulated({
        asOf: new Date().toISOString(),
        entity: "LE-BANK-SA",
        actor: HUMAN,
        citations: ["D-TRUSTED-FIGURES-PROGRAM-V1"],
        payload: { seedId: "balance-sheet-baseline", replacementEventIds: ["ev-1"] },
      }),
    );
    expect(loadDescopedSeedIds(store).has("balance-sheet-baseline")).toBe(true);
  });
});

describe("buildSeedsView", () => {
  it("returns empty view on a fresh store (manifest is now empty)", () => {
    const view = buildSeedsView(new EventStore());
    expect(view).toHaveLength(0);
    expect(SEED_MANIFEST.length).toBe(0);
  });
});

describe("recon:seed-manifest-parity", () => {
  it("passes against the live bootDerive() wiring (0 seeds asserted)", () => {
    const result = runSeedManifestParity();
    expect(result.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(0);
  });
});
