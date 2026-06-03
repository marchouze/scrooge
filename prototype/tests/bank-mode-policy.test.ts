// tests/bank-mode-policy.test.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR2 — the event-sourced bank-wide
// provenance policy: default, latest-wins resolution, per-category mapping, and
// boot-sync to the lifecycle-phase indicator.
//
// Author: Scrooge (Chief of Staff / Orchestrator), on behalf of Marc (CEO).

import { afterEach, describe, expect, it } from "bun:test";

import { makeBankModePolicySet } from "../platform/event-store/event-types/bank-mode";
import {
  bankLifecyclePhase,
  setBankLifecyclePhaseOverride,
} from "../platform/event-store/provenance";
import { EventStore } from "../platform/event-store/store";
import {
  DEFAULT_BANK_MODE_POLICY,
  DEFAULT_CATEGORY_POLICY,
  currentBankModePolicy,
  lifecyclePhaseForBankMode,
  provenanceForCategory,
  syncBankModeToLifecyclePhase,
} from "../platform/projections/bank-mode";

const ACTOR = { type: "service", id: "agent:scrooge:chief-of-staff" } as const;

function setPolicy(store: EventStore, bankMode: "sim" | "prod", asOf: string): void {
  store.append({
    ...makeBankModePolicySet({
      asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: ACTOR,
      citations: ["D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE"],
      payload: {
        bankMode,
        categoryPolicy: [...DEFAULT_CATEGORY_POLICY],
        setBy: "marc@tgv.co.za",
      },
    }),
    provenance: { kind: "production", sourceLineage: "bank-mode-policy" },
  });
}

afterEach(() => setBankLifecyclePhaseOverride(undefined));

describe("bank-mode policy — default", () => {
  it("returns the built-in default (sim) when no event is recorded", () => {
    const store = new EventStore();
    const policy = currentBankModePolicy(store);
    expect(policy).toEqual(DEFAULT_BANK_MODE_POLICY);
    expect(policy.bankMode).toBe("sim");
    expect(policy.isDefault).toBe(true);
  });

  it("default category policy: governance/build = production, operations = simulated", () => {
    expect(provenanceForCategory(DEFAULT_BANK_MODE_POLICY, "governance")).toBe("production");
    expect(provenanceForCategory(DEFAULT_BANK_MODE_POLICY, "build")).toBe("production");
    expect(provenanceForCategory(DEFAULT_BANK_MODE_POLICY, "trading")).toBe("simulated");
    expect(provenanceForCategory(DEFAULT_BANK_MODE_POLICY, "accounting")).toBe("simulated");
    expect(provenanceForCategory(DEFAULT_BANK_MODE_POLICY, "counterparty")).toBe("simulated");
    expect(provenanceForCategory(DEFAULT_BANK_MODE_POLICY, "messaging")).toBe("simulated");
  });
});

describe("bank-mode policy — latest wins", () => {
  it("resolves to the most recently recorded policy", () => {
    const store = new EventStore();
    setPolicy(store, "sim", "2026-06-03T08:00:00.000Z");
    setPolicy(store, "prod", "2026-06-03T09:00:00.000Z");
    const policy = currentBankModePolicy(store);
    expect(policy.bankMode).toBe("prod");
    expect(policy.isDefault).toBe(false);
    expect(policy.setBy).toBe("marc@tgv.co.za");
    expect(policy.setAt).toBe("2026-06-03T09:00:00.000Z");
  });
});

describe("bank-mode → lifecycle phase", () => {
  it("maps sim→build-phase, prod→commencement", () => {
    expect(lifecyclePhaseForBankMode("sim")).toBe("build-phase");
    expect(lifecyclePhaseForBankMode("prod")).toBe("commencement");
  });

  it("syncBankModeToLifecyclePhase pins the override from the recorded policy", () => {
    const store = new EventStore();
    setPolicy(store, "prod", "2026-06-03T09:00:00.000Z");
    const policy = syncBankModeToLifecyclePhase(store);
    expect(policy.bankMode).toBe("prod");
    expect(bankLifecyclePhase()).toBe("commencement");
  });

  it("syncs to build-phase under the default (sim) policy", () => {
    const store = new EventStore();
    syncBankModeToLifecyclePhase(store);
    expect(bankLifecyclePhase()).toBe("build-phase");
  });
});
