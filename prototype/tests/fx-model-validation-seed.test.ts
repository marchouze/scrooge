// tests/fx-model-validation-seed.test.ts
//
// FX C7 exit-criterion tests: the FX model-validation-of-record seeder
// (`seedFxModelValidations`) + the asserting recon
// (`recon:fx-model-validation-of-record`).
//
// Closes the tracked gap `fx-model-validation-of-record-not-in-gated-store`:
// the `ModelValidationApproved` events for the two FX models must be reproducible
// on a clean store and a blocking recon must assert their presence non-vacuously.
//
// Tests:
//   1. Happy path: seedFxModelValidations approves BOTH FX models on a clean
//      store, with the canonical actors / versions / expiries (byte-faithful to
//      the home-store validation-of-record).
//   2. Idempotency: a second call approves nothing and emits no new events.
//   3. Recon passes on a store carrying both FX validations.
//   4. Recon FAILS (blocking) on a populated store missing the FX validations
//      (non-vacuity proof — the gate would actually catch the gap).
//   5. Recon passes trivially (asserted=0) on a store with no validation events.
//
// Authority:
//   - D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19)
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29)
//   - D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (CEO session-delegation 2026-05-29)
//
// Author: Nadia (Independent-validation engineer, second line).

import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { makeModelValidationApproved } from "../platform/event-store/event-types/model-risk";
import { EventStore } from "../platform/event-store/store";
import {
  FX_FORWARD_IRP_MODEL_ID,
  FX_MARKET_RISK_VAR_HS_MODEL_ID,
  FX_VALIDATION_OF_RECORD_MODEL_IDS,
  seedFxModelValidations,
} from "../platform/model-registry/fx-model-validation-seed";
import { run as runFxValidationRecon } from "../platform/recon/fx-model-validation-of-record";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countEventsOfType(store: EventStore, type: string): number {
  let count = 0;
  for (const _ of store.replay({ type })) count++;
  return count;
}

function approvalsByModel(store: EventStore): Map<string, Record<string, unknown>> {
  const byModel = new Map<string, Record<string, unknown>>();
  for (const ev of store.replay({ type: "ModelValidationApproved" })) {
    const p = ev.payload as Record<string, unknown>;
    const modelId = String(p.modelId ?? "");
    if (modelId) byModel.set(modelId, p);
  }
  return byModel;
}

/** Write a store to a tmp file so the recon (which reads a dbPath) can run against it. */
function withTempDbPath<T>(fn: (dbPath: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "fx-mva-recon-"));
  const dbPath = join(dir, "event.db");
  try {
    return fn(dbPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Test 1: Happy path
// ---------------------------------------------------------------------------

describe("seedFxModelValidations — happy path", () => {
  it("approves both FX models on a clean store with canonical content", () => {
    const store = new EventStore(":memory:");

    const result = seedFxModelValidations(store);

    expect(result.approved.sort()).toEqual([...FX_VALIDATION_OF_RECORD_MODEL_IDS].sort());
    expect(result.submitted.sort()).toEqual([...FX_VALIDATION_OF_RECORD_MODEL_IDS].sort());
    expect(result.tierClassified.sort()).toEqual([...FX_VALIDATION_OF_RECORD_MODEL_IDS].sort());
    expect(result.skipped).toHaveLength(0);

    // Exactly two ModelValidationApproved events (one per FX model).
    expect(countEventsOfType(store, "ModelValidationApproved")).toBe(2);
    // Full triple: submit + classify per model.
    expect(countEventsOfType(store, "ModelSubmitted")).toBe(2);
    expect(countEventsOfType(store, "ModelTierClassified")).toBe(2);

    const approvals = approvalsByModel(store);

    // fx-forward-irp-v1 — Tier-3 pricing, approved by the pricing validation actor.
    const fxFwd = approvals.get(FX_FORWARD_IRP_MODEL_ID);
    expect(fxFwd).toBeDefined();
    expect(fxFwd?.approvedBy).toBe("agent:nadia:model-validation");
    expect(fxFwd?.version).toBe("1.0.0");
    expect(fxFwd?.expiryDate).toBe("2027-05-27");

    // market-risk-var-hs-v1 — Tier-1 risk, approved by the calc validation actor.
    const varHs = approvals.get(FX_MARKET_RISK_VAR_HS_MODEL_ID);
    expect(varHs).toBeDefined();
    expect(varHs?.approvedBy).toBe("agent:nadia:calc-model-validation");
    expect(varHs?.version).toBe("1.0.0");
    expect(varHs?.expiryDate).toBe("2027-05-29");

    store.close();
  });
});

// ---------------------------------------------------------------------------
// Test 2: Idempotency
// ---------------------------------------------------------------------------

describe("seedFxModelValidations — idempotency", () => {
  it("second call approves nothing and emits no new events", () => {
    const store = new EventStore(":memory:");

    const first = seedFxModelValidations(store);
    expect(first.approved).toHaveLength(2);

    const approvedAfterFirst = countEventsOfType(store, "ModelValidationApproved");
    const submittedAfterFirst = countEventsOfType(store, "ModelSubmitted");
    const classifiedAfterFirst = countEventsOfType(store, "ModelTierClassified");

    const second = seedFxModelValidations(store);
    expect(second.approved).toHaveLength(0);
    expect(second.submitted).toHaveLength(0);
    expect(second.tierClassified).toHaveLength(0);
    expect(second.skipped.sort()).toEqual([...FX_VALIDATION_OF_RECORD_MODEL_IDS].sort());

    // No new events.
    expect(countEventsOfType(store, "ModelValidationApproved")).toBe(approvedAfterFirst);
    expect(countEventsOfType(store, "ModelSubmitted")).toBe(submittedAfterFirst);
    expect(countEventsOfType(store, "ModelTierClassified")).toBe(classifiedAfterFirst);

    store.close();
  });
});

// ---------------------------------------------------------------------------
// Test 3: Recon passes when both FX validations are present
// ---------------------------------------------------------------------------

describe("recon:fx-model-validation-of-record — present", () => {
  it("passes (asserted=2) on a store carrying both FX validations", () => {
    withTempDbPath((dbPath) => {
      const store = new EventStore(dbPath);
      seedFxModelValidations(store);
      store.close();

      const result = runFxValidationRecon({ dbPath });
      expect(result.ok).toBe(true);
      expect(result.asserted).toBe(2);
      expect(result.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Test 4: Recon FAILS (blocking) when validations exist but the FX ones are
// missing — the non-vacuity proof.
// ---------------------------------------------------------------------------

describe("recon:fx-model-validation-of-record — non-vacuous", () => {
  it("FAILS on a populated store missing the FX validations", () => {
    withTempDbPath((dbPath) => {
      const store = new EventStore(dbPath);
      // Populate with an UNRELATED model validation so the store is non-empty
      // (approvals.size > 0) but lacks the two FX models.
      store.append(
        makeModelValidationApproved({
          asOf: "2026-05-27T00:00:00.000Z",
          entity: "LE-ZA-HOZ-BANK",
          actor: { type: "service", id: "agent:nadia:model-validation" },
          citations: ["D-TRUSTED-FIGURES-PROGRAM-V1"],
          payload: {
            modelId: "model:some-other-model-v1",
            version: "1.0.0",
            approvedBy: "agent:nadia:model-validation",
            validationFindingsResolved: [],
            expiryDate: "2027-05-27",
          },
        }),
      );
      store.close();

      const result = runFxValidationRecon({ dbPath });
      expect(result.ok).toBe(false);
      const fails = result.violations.filter((v) => v.severity === "fail");
      expect(fails).toHaveLength(2);
      expect(fails.map((v) => v.subject).sort()).toEqual(
        [...FX_VALIDATION_OF_RECORD_MODEL_IDS].sort(),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Test 5: Recon passes trivially on a store with no validation events
// ---------------------------------------------------------------------------

describe("recon:fx-model-validation-of-record — empty store", () => {
  it("passes (asserted=0) when no ModelValidationApproved events exist", () => {
    withTempDbPath((dbPath) => {
      const store = new EventStore(dbPath);
      // Touch the store so the file exists but holds no validation events.
      // (Append a non-validation event via replay-empty is unnecessary; an empty
      // store file is enough — the recon returns early on approvals.size === 0.)
      store.close();

      const result = runFxValidationRecon({ dbPath });
      expect(result.ok).toBe(true);
      expect(result.asserted).toBe(0);
    });
  });
});
