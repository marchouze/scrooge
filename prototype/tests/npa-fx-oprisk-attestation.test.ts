// tests/npa-fx-oprisk-attestation.test.ts
//
// Tests for the FX operational-risk dimension attestation + the infosec
// gap-closure re-attestation. Both run against isolated tmp stores.
//
// Author: Tomas (Operations & payments engineer, engineering) — governance
//   owner Devon (Chief Operating Officer, governance; op-risk seat).

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { makeProductDimensionAttested } from "../platform/event-store/event-types/product";
import { EventStore } from "../platform/event-store/store";
import { runFxInfosecGapClosure } from "../platform/markets/products/npa-fx-infosec-gap-closure";
import {
  OPRISK_AS_OF,
  OPRISK_PRODUCT_ID,
  runFxOpRiskAttestation,
} from "../platform/markets/products/npa-fx-oprisk-attestation";
import {
  isOperationalLossEventRegistered,
  probeIdentityEnforcement,
} from "../platform/markets/products/oprisk-attestation-gates";

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "npa-oprisk-test-"));
});

afterAll(() => {
  if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

function freshStore(): EventStore {
  return new EventStore(join(tmpDir, `event-${Math.random().toString(36).slice(2)}.db`));
}

describe("op-risk attestation — genuine-enforcement gates", () => {
  it("GATE 1: OperationalLossEvent type is registered (probe round-trips)", () => {
    expect(isOperationalLossEventRegistered()).toBe(true);
  });

  it("GATE 2: identity check enforces fail-closed AND is not reject-always", () => {
    const probe = probeIdentityEnforcement();
    expect(probe.ok).toBe(true);
  });
});

describe("runFxOpRiskAttestation", () => {
  it("PROMOTES operational-risk to implementation-attested with tracked gaps", () => {
    const store = freshStore();
    const result = runFxOpRiskAttestation(store);
    expect(result.promoted).toBe(true);
    expect(result.lossCaptureStands).toBe(true);
    expect(result.identityEnforces).toBe(true);

    const events = [...store.replay({ type: "ProductDimensionAttested" })].filter((e) => {
      const p = e.payload as { dimension?: string };
      return p.dimension === "operational-risk";
    });
    expect(events).toHaveLength(1);
    const p = events[0]?.payload as {
      result?: string;
      deferredGaps?: { gapId: string; owner: string; targetTrigger: string; citations: string[] }[];
    };
    expect(p.result).toBe("implementation-attested");
    const gapIds = (p.deferredGaps ?? []).map((g) => g.gapId);
    expect(gapIds).toContain("fx-op-rwa-gross-income");
    expect(gapIds).toContain("fx-op-risk-loss-distribution");
    // Every gap carries all required fields (write-time schema enforces, this is belt-and-braces).
    for (const g of p.deferredGaps ?? []) {
      expect(g.owner.length).toBeGreaterThan(0);
      expect(g.targetTrigger.length).toBeGreaterThan(0);
      expect(g.citations.length).toBeGreaterThan(0);
    }
    store.close();
  });

  it("is idempotent — a second run skips", () => {
    const store = freshStore();
    expect(runFxOpRiskAttestation(store).promoted).toBe(true);
    const second = runFxOpRiskAttestation(store);
    expect(second.promoted).toBe(false);
    expect(second.skipped).toBe(true);
    store.close();
  });

  it("emits exactly the operational-risk dimension at OPRISK_AS_OF", () => {
    const store = freshStore();
    runFxOpRiskAttestation(store);
    const ev = [...store.replay({ type: "ProductDimensionAttested" })].find((e) => {
      const p = e.payload as { dimension?: string; productId?: string };
      return p.dimension === "operational-risk" && p.productId === OPRISK_PRODUCT_ID;
    });
    expect(ev?.as_of).toBe(OPRISK_AS_OF);
    store.close();
  });
});

describe("runFxInfosecGapClosure", () => {
  function seedInfosecAttestation(store: EventStore, gapIds: string[]): void {
    store.append(
      makeProductDimensionAttested({
        asOf: "2026-06-12T08:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:rashida:npa-infosec-attestation" },
        citations: ["D-FX-HELD-DIMS-SEAT-SWEEP", "dimension:infosec"],
        payload: {
          productId: "prd:bank:fx:otc-vanilla",
          dimension: "infosec",
          result: "implementation-attested",
          citationChain: ["D-FX-HELD-DIMS-SEAT-SWEEP", "dashboard/markets-fx-gateway.ts"],
          deferredGaps: gapIds.map((gapId) => ({
            gapId,
            title: `gap ${gapId}`,
            owner: "Owner (Position, governance)",
            targetTrigger: "trigger",
            citations: ["ORG-CY-03"],
          })),
        },
      }),
    );
  }

  it("removes fx-gateway-identity-check-enforcement and carries other gaps verbatim", () => {
    const store = freshStore();
    seedInfosecAttestation(store, [
      "fx-gateway-identity-check-enforcement",
      "fx-threat-model-sync-gateway-refresh",
      "fx-hsm-key-custody",
      "fx-runtime-detection-pipeline",
    ]);

    const result = runFxInfosecGapClosure(store);
    expect(result.closed).toBe(true);
    expect(result.gapsBefore).toBe(4);
    expect(result.gapsAfter).toBe(3);

    // Latest infosec event now lacks the identity gap and keeps the other three.
    const infosecEvents = [...store.replay({ type: "ProductDimensionAttested" })]
      .filter((e) => (e.payload as { dimension?: string }).dimension === "infosec")
      .sort((a, b) => a.as_of.localeCompare(b.as_of));
    const latest = infosecEvents[infosecEvents.length - 1]?.payload as {
      deferredGaps?: { gapId: string }[];
    };
    const ids = (latest.deferredGaps ?? []).map((g) => g.gapId);
    expect(ids).not.toContain("fx-gateway-identity-check-enforcement");
    expect(ids).toContain("fx-threat-model-sync-gateway-refresh");
    expect(ids).toContain("fx-hsm-key-custody");
    expect(ids).toContain("fx-runtime-detection-pipeline");
    store.close();
  });

  it("refuses when there is no infosec attestation of record", () => {
    const store = freshStore();
    const result = runFxInfosecGapClosure(store);
    expect(result.closed).toBe(false);
    expect(result.blockedReason).toContain("no infosec implementation-attested");
    store.close();
  });

  it("skips idempotently when the gap is already absent", () => {
    const store = freshStore();
    seedInfosecAttestation(store, ["fx-hsm-key-custody"]);
    const result = runFxInfosecGapClosure(store);
    expect(result.closed).toBe(false);
    expect(result.skipped).toBe(true);
    store.close();
  });
});
