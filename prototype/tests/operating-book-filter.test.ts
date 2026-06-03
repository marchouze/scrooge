// tests/operating-book-filter.test.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR1 — the canonical operating-book
// inclusion selector. Asserts the separation of the inclusion axis from the
// lineage/audit axis (`provenance.kind`):
//
//   - build-phase: the book = production + operational-simulated; EXCLUDES
//     seed-harness scaffolding (`build-phase-fixture`) and sandbox runs
//     (explicit `tags:["sandbox"]` OR held-out scenario-id prefixes).
//   - commencement: the book = production only.
//
// These cases pin the semantics PR2-PR5 build on, and document why the
// operating-book filter is NOT `production-only` (which keeps fixture, drops
// simulated — the opposite of what flows/measurements want).
//
// Author: Scrooge (Chief of Staff / Orchestrator), on behalf of Marc (CEO).

import { afterEach, describe, expect, it } from "bun:test";

import {
  buildPhaseFixtureTag,
  productionTag,
  setBankLifecyclePhaseOverride,
  simulatedTag,
} from "../platform/event-store/provenance";
import type { ProvenanceTag } from "../platform/event-store/types";
import {
  SANDBOX_TAG,
  eventInOperatingBook,
  isSandboxProvenance,
  operatingBookFilter,
} from "../platform/projections";

function inBook(provenance: ProvenanceTag | undefined): boolean {
  return eventInOperatingBook({ provenance });
}

const prod = productionTag({ sourceLineage: "decision-record" });
const opSim = simulatedTag({
  scenario: "operator:manual-sim-booking",
  sourceLineage: "operator:manual-trade-booking",
});
const preSubstrateSim = simulatedTag({
  scenario: "pre-substrate-build-phase",
  sourceLineage: "pre-substrate-backfill",
});
const fixture = buildPhaseFixtureTag({ sourceLineage: "synthetic-bank-seed:v3" });
const stressSim = simulatedTag({
  scenario: "stress-adverse-2026q1",
  sourceLineage: "scenario-runner:stress",
});
const testPollutionSim = simulatedTag({
  scenario: "test-pollution:test-run-1",
  sourceLineage: "test-run-1",
});
const taggedSandbox = simulatedTag({
  scenario: "operator:manual-sim-booking",
  sourceLineage: "operator:manual-trade-booking",
  tags: [SANDBOX_TAG],
});

afterEach(() => setBankLifecyclePhaseOverride(undefined));

describe("operating-book filter — build phase", () => {
  it("includes production", () => {
    setBankLifecyclePhaseOverride("build-phase");
    expect(inBook(prod)).toBe(true);
  });

  it("includes operational simulated (manual bookings, pre-substrate operating backfill)", () => {
    setBankLifecyclePhaseOverride("build-phase");
    expect(inBook(opSim)).toBe(true);
    expect(inBook(preSubstrateSim)).toBe(true);
  });

  it("includes untagged events (pre-provenance-substrate default)", () => {
    setBankLifecyclePhaseOverride("build-phase");
    expect(inBook(undefined)).toBe(true);
  });

  it("EXCLUDES seed-harness scaffolding (build-phase-fixture)", () => {
    setBankLifecyclePhaseOverride("build-phase");
    expect(inBook(fixture)).toBe(false);
  });

  it("EXCLUDES sandbox runs — stress/what-if scenario prefixes and test-pollution", () => {
    setBankLifecyclePhaseOverride("build-phase");
    expect(inBook(stressSim)).toBe(false);
    expect(inBook(testPollutionSim)).toBe(false);
  });

  it("EXCLUDES events explicitly tagged sandbox even when the scenario is operational", () => {
    setBankLifecyclePhaseOverride("build-phase");
    expect(inBook(taggedSandbox)).toBe(false);
  });
});

describe("operating-book filter — commencement", () => {
  it("includes only production; drops fixture and all simulated", () => {
    setBankLifecyclePhaseOverride("commencement");
    expect(inBook(prod)).toBe(true);
    expect(inBook(fixture)).toBe(false);
    expect(inBook(opSim)).toBe(false);
    expect(inBook(preSubstrateSim)).toBe(false);
  });
});

describe("isSandboxProvenance classifier", () => {
  it("flags explicit sandbox tag and held-out scenario prefixes; spares operational sim", () => {
    expect(isSandboxProvenance(taggedSandbox)).toBe(true);
    expect(isSandboxProvenance(stressSim)).toBe(true);
    expect(isSandboxProvenance(testPollutionSim)).toBe(true);
    expect(isSandboxProvenance(opSim)).toBe(false);
    expect(isSandboxProvenance(preSubstrateSim)).toBe(false);
    expect(isSandboxProvenance(prod)).toBe(false);
    expect(isSandboxProvenance(fixture)).toBe(false);
  });
});

describe("operatingBookFilter()", () => {
  it("returns the operating-book mode", () => {
    expect(operatingBookFilter().mode).toBe("operating-book");
  });
});
