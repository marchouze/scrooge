// tests/counterparty-basel-classification-coverage.test.ts
//
// recon:counterparty-basel-classification-coverage — advisory inventory of
// SA-CCR-exposed counterparties classified (info) vs on the prudent fallback
// (warn). Authority: D-FX-COUNTERPARTY-BASEL-CLASSIFICATION.

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { moneyWireFromMinor } from "../platform/core/money-codec";
import {
  makeCcrEadComputed,
  makeCounterpartyBaselClassAssigned,
} from "../platform/event-store/event-types/counterparty-credit-risk";
import { EventStore } from "../platform/event-store/store";
import { run } from "../platform/recon/counterparty-basel-classification-coverage";

const ENTITY = "LE-ZA-HOZ-BANK";
let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ccr-class-"));
  dbPath = join(dir, "event.db");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function seedEad(store: EventStore, counterpartyId: string): void {
  store.append(
    makeCcrEadComputed({
      asOf: "2026-06-11T17:00:00.000Z",
      entity: ENTITY,
      actor: { type: "service", id: "agent:rohan" },
      citations: ["BCBS-279"],
      payload: {
        nettingSetId: `NS-${counterpartyId}-ZAR`,
        counterpartyId,
        rc: moneyWireFromMinor(1_000_000, "ZAR"),
        pfe: moneyWireFromMinor(200_000, "ZAR"),
        alpha: 1.4,
        ead: moneyWireFromMinor(1_680_000, "ZAR"),
        currency: "ZAR",
        computationDate: "2026-06-11",
        methodology: "sa-ccr",
        sourceEvents: { rcEventId: "rc-1", pfeComponents: 1 },
      },
    }),
  );
}

describe("recon:counterparty-basel-classification-coverage", () => {
  it("returns ok with empty result when no store exists", () => {
    const r = run({ dbPath: join(dir, "missing.db") });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
  });

  it("warns (advisory) on an exposed-but-unclassified counterparty", () => {
    const store = new EventStore(dbPath);
    seedEad(store, "CP-UNCLASSIFIED");
    store.close();
    const r = run({ dbPath });
    expect(r.ok).toBe(true); // advisory — never blocks
    const warns = r.violations.filter((v) => v.severity === "warn");
    expect(warns).toHaveLength(1);
    expect(warns[0]?.subject).toBe("CP-UNCLASSIFIED");
  });

  it("reports info (no warn) on a classified counterparty", () => {
    const store = new EventStore(dbPath);
    seedEad(store, "CP-BANK");
    store.append(
      makeCounterpartyBaselClassAssigned({
        asOf: "2026-06-01T00:00:00.000Z",
        entity: ENTITY,
        actor: { type: "service", id: "agent:helena:cro" },
        citations: ["D-FX-COUNTERPARTY-BASEL-CLASSIFICATION"],
        payload: {
          counterpartyId: "CP-BANK",
          baselClass: "bank",
          assignedBy: "Helena (CRO)",
          approverAuthority: "CRO",
          rationale: "interbank counterparty",
          evidenceRef: "doc:assessment",
          effectiveFrom: "2026-06-01",
          assignedAt: "2026-06-01",
        },
      }),
    );
    store.close();
    const r = run({ dbPath });
    const warns = r.violations.filter((v) => v.severity === "warn");
    const infos = r.violations.filter((v) => v.severity === "info");
    expect(warns).toHaveLength(0);
    expect(infos).toHaveLength(1);
    expect(infos[0]?.message).toContain("bank");
  });
});
