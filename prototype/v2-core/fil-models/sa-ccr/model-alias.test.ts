// v2-core/fil-models/sa-ccr/model-alias.test.ts
//
// Tests for the SA-CCR model alias seam — the swappable selection of the live
// SA-CCR computation, resolved through the shared FIL alias-registry
// (WS-V2-BBAAS, alias-flip). Authority: D-FIL-SHARED-ALIAS-REGISTRY.
//
// Proves: the alias resolves to the validated v2 `computeSaCcr` by default; a
// swapped implementation behind the same alias is honoured (the seam is real);
// restore unwinds to the validated default. Behaviour-preservation of the
// emitter is covered separately by recon:v2-saccr-parity + recon:ccr-single-
// emitter; this test asserts the seam mechanics only.
//
// Author: Atlas (Substrate Architect, engineering).

import { afterEach, describe, expect, it } from "bun:test";
import type { Money } from "../../fil-core/primitives";
import { computeSaCcr } from "./methodology";
import {
  SA_CCR_MODEL_ALIAS,
  type SaCcrComputeFn,
  computeSaCcrViaAlias,
  registerSaCcrModel,
  resetSaCcrModel,
  resolveSaCcrModel,
} from "./model-alias";

// DECIMAL-NATIVE (D-V2-CORE-MONEY-DECIMAL-NATIVE): sentinel cents → decimal Money.
function zar(centsAmount: bigint): Money {
  const neg = centsAmount < 0n;
  const abs = (neg ? -centsAmount : centsAmount).toString().padStart(3, "0");
  const whole = abs.slice(0, abs.length - 2);
  const frac = abs.slice(abs.length - 2);
  return { currency: "ZAR", amount: `${neg ? "-" : ""}${whole}.${frac}` };
}

const sampleInput = {
  nettingSet: {
    nettingSetId: "ns-test",
    counterpartyId: "cp-test",
    csaPresent: false,
    currency: "ZAR",
  },
  vMtm: zar(0n),
  collateralHeld: zar(0n),
  trades: [],
  asOf: "2026-06-13T00:00:00.000Z",
};

afterEach(() => {
  resetSaCcrModel();
});

describe("SA-CCR model alias seam", () => {
  it("exposes a stable namespaced alias key", () => {
    expect(SA_CCR_MODEL_ALIAS).toBe("fil-models:sa-ccr");
  });

  it("resolves to the validated v2 computeSaCcr out of the box (eager default)", () => {
    expect(resolveSaCcrModel()).toBe(computeSaCcr);
  });

  it("computeSaCcrViaAlias delegates to the resolved model (byte-equal to direct)", () => {
    const viaAlias = computeSaCcrViaAlias(sampleInput);
    const direct = computeSaCcr(sampleInput);
    expect(viaAlias).toEqual(direct);
  });

  it("honours a swapped implementation behind the same alias (the seam is real)", () => {
    const sentinel: SaCcrComputeFn = (input) => ({
      rc: {
        nettingSetId: input.nettingSet.nettingSetId,
        rc: zar(123n),
        vMtm: zar(0n),
        collateralHeld: zar(0n),
        computedAt: input.asOf,
      },
      ead: {
        nettingSetId: input.nettingSet.nettingSetId,
        counterpartyId: input.nettingSet.counterpartyId,
        rc: zar(123n),
        pfe: zar(0n),
        alpha: 1.4,
        multiplier: 1,
        aggregatedAddOn: zar(0n),
        ead: zar(999n),
        asOf: input.asOf,
      },
      addOns: [],
    });

    const handle = registerSaCcrModel(sentinel);
    try {
      expect(resolveSaCcrModel()).toBe(sentinel);
      const out = computeSaCcrViaAlias(sampleInput);
      expect(out.ead.ead.amount).toBe("9.99"); // sentinel's behaviour (999 cents), not the real model's
    } finally {
      handle.restore();
    }

    // After restore: the validated default is honoured again — the seam unwinds.
    expect(resolveSaCcrModel()).toBe(computeSaCcr);
  });
});
