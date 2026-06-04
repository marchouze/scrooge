// platform/obligations/projection.test.ts
import { describe, expect, test } from "bun:test";

import {
  makeObligationAdopted,
  makeObligationLifecycleTransitioned,
} from "../event-store/event-types/obligation-lifecycle";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { buildBankObligations, loadBankObligations } from "./projection";

const ACTOR: Actor = { type: "service", id: "agent:mira:obligations-backfill" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITES = ["D-REGULATORY-ARCHITECTURE-TWO-PLANE"];

function adopted(id: string, status: string, asOf: string, derivesFrom?: string[]) {
  return makeObligationAdopted({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: {
      obligationId: id,
      urn: `urn:obligation:bank:test:${id.toLowerCase()}:v1`,
      domain: "A",
      citation: "Banks Act s.70",
      requirement: "Maintain capital.",
      fulfilmentPolicy: "Capital Management Policy",
      owner: "CFO",
      status,
      ...(derivesFrom ? { derivesFrom } : {}),
      adoptedAt: asOf,
    },
  });
}

describe("buildBankObligations", () => {
  test("ObligationAdopted establishes a bank obligation with its fields", () => {
    const rows = buildBankObligations([adopted("ORG-PR-06", "active", "2026-06-01")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("ORG-PR-06");
    expect(rows[0]?.status).toBe("active");
    expect(rows[0]?.owner).toBe("CFO");
  });

  test("derivesFrom carries the source-obligation bridge", () => {
    const rows = buildBankObligations([
      adopted("ORG-PR-06", "active", "2026-06-01", ["urn:reg:bcbs:lcr:20.5"]),
    ]);
    expect(rows[0]?.derivesFrom).toEqual(["urn:reg:bcbs:lcr:20.5"]);
  });

  test("a lifecycle transition advances status + records lastTransition", () => {
    const rows = buildBankObligations([
      adopted("ORG-PR-06", "legacy-unreviewed", "2026-06-01"),
      makeObligationLifecycleTransitioned({
        asOf: "2026-06-02",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: {
          obligationId: "ORG-PR-06",
          transition: "policy-assigned",
          toStatus: "active",
          detail: "urn:policy:bank:capital-management:v1",
          at: "2026-06-02",
        },
      }),
    ]);
    expect(rows[0]?.status).toBe("active");
    expect(rows[0]?.lastTransition?.transition).toBe("policy-assigned");
  });

  test("re-adoption replaces; transition for an unadopted obligation is skipped", () => {
    const rows = buildBankObligations([
      adopted("ORG-PR-06", "active", "2026-06-01"),
      adopted("ORG-PR-06", "superseded", "2026-06-03"),
      makeObligationLifecycleTransitioned({
        asOf: "2026-06-02",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        payload: { obligationId: "ORG-XX-99", transition: "attested", at: "2026-06-02" },
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("superseded");
  });
});

describe("loadBankObligations (store-backed)", () => {
  test("folds appended events from the store", () => {
    const store = new EventStore();
    store.append(adopted("ORG-FC-01", "active", "2026-06-01"));
    store.append(adopted("ORG-PR-06", "active", "2026-06-01"));
    const rows = loadBankObligations(store);
    expect(rows.map((r) => r.id)).toEqual(["ORG-FC-01", "ORG-PR-06"]);
  });
});
