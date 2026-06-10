// tests/npa-deferred-gap-tracking.test.ts
//
// recon:npa-deferred-gap-tracking — "approved with tracked deferred gaps"
// (D-FX-OTC-NPA-SCOPE-EXPANSION). A well-formed deferral passes and surfaces as
// info; a deferral missing an owner/trigger/citation FAILS (an untracked deferral
// is a hidden gap).
//
// Author: Scrooge-coordinated session for marc@tgv.co.za.

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { makeProductDimensionAttested } from "../platform/event-store/event-types/product";
import { EventStore } from "../platform/event-store/store";
import { run } from "../platform/recon/npa-deferred-gap-tracking";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:bea:accounting" };
const PID = "prd:bank:fx:otc-vanilla";

let tmpDir: string;
beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "npa-defgap-"));
});
afterAll(() => {
  if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});
function freshStore(): { store: EventStore; path: string } {
  const path = join(tmpDir, `event-${Math.random().toString(36).slice(2)}.db`);
  return { store: new EventStore(path), path };
}

describe("recon:npa-deferred-gap-tracking", () => {
  it("passes and surfaces a well-formed tracked deferral", () => {
    const { store, path } = freshStore();
    store.append(
      makeProductDimensionAttested({
        asOf: "2026-06-10T12:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: ["D-FX-OTC-NPA-SCOPE-EXPANSION"],
        payload: {
          productId: PID,
          dimension: "accounting",
          result: "implementation-attested",
          citationChain: ["D-FX-OTC-NPA-SCOPE-EXPANSION", "IAS-21"],
          deferredGaps: [
            {
              gapId: "fx-forward-points-accrual",
              title: "Forward-points accrual (IAS 21 §28)",
              owner: "Bea (Accounting policy engineer, finance)",
              targetTrigger: "forward/swap go-live",
              citations: ["IAS-21"],
            },
          ],
        },
      }),
    );
    const result = run({ dbPath: path });
    expect(result.ok).toBe(true);
    expect(result.asserted).toBe(1);
    expect(result.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
    expect(result.violations.filter((v) => v.severity === "info")).toHaveLength(1);
    store.close();
  });

  it("uses the LATEST attestation — a later design-attested with no gaps clears earlier deferrals", () => {
    const { store, path } = freshStore();
    const base = {
      productId: PID,
      dimension: "accounting",
      citationChain: ["D-FX-OTC-NPA-SCOPE-EXPANSION"],
    };
    store.append(
      makeProductDimensionAttested({
        asOf: "2026-06-10T12:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: ["D-FX-OTC-NPA-SCOPE-EXPANSION"],
        payload: {
          ...base,
          result: "implementation-attested",
          deferredGaps: [
            {
              gapId: "g1",
              title: "x",
              owner: "Bea (Accounting policy engineer, finance)",
              targetTrigger: "t",
              citations: ["IAS-21"],
            },
          ],
        },
      }),
    );
    // Later re-attestation with no gaps (gap closed).
    store.append(
      makeProductDimensionAttested({
        asOf: "2026-06-11T12:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: ["D-FX-OTC-NPA-SCOPE-EXPANSION"],
        payload: { ...base, result: "implementation-attested" },
      }),
    );
    const result = run({ dbPath: path });
    expect(result.asserted).toBe(0); // latest has no deferrals
    store.close();
  });

  it("a hollow deferral (no owner/trigger/citation) is rejected AT WRITE-TIME by the factory schema", () => {
    // The enforcement lives in the ProductDimensionAttested payload schema, not
    // the recon: an untracked deferral can never enter the store through
    // sanctioned authoring (makeProductDimensionAttested → Zod parse).
    expect(() =>
      makeProductDimensionAttested({
        asOf: "2026-06-10T12:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: ["D-FX-OTC-NPA-SCOPE-EXPANSION"],
        payload: {
          productId: PID,
          dimension: "accounting",
          result: "implementation-attested",
          citationChain: ["D-FX-OTC-NPA-SCOPE-EXPANSION"],
          // @ts-expect-error — intentionally malformed: missing owner, empty trigger/citations
          deferredGaps: [{ gapId: "hollow", title: "untracked", targetTrigger: "", citations: [] }],
        },
      }),
    ).toThrow();
  });
});
