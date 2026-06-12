// tests/fx-opinion-refresh-watchdog.test.ts
//
// Legal dimension of the FX umbrella NPA (D-FX-HELD-DIMS-SEAT-SWEEP):
//   1. legal-documentation gate unit behaviour (qualifying forms, latest-wins,
//      none-listed / GMRA exclusion).
//   2. opinion-refresh watchdog: counterparty-with-ISDA without a
//      JurisdictionalOpinionRefreshed → "missing" finding; opinion older than
//      12 months → "stale"; fresh opinion (class-level or per-counterparty)
//      → no finding. Emission is a MEDIUM SubstrateAlert{integrity} —
//      monitoring, never an order-path block — and idempotent by alertId.
//
// Author: Imani (Legal-as-code engineer, engineering) — governance owner
//         Devon (COO, interim, pending future GC).
// Citations: D-FX-HELD-DIMS-SEAT-SWEEP, ORG-CS3-001

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import {
  makeJurisdictionalOpinionRefreshed,
  makeLegalDocumentationSigned,
} from "../platform/event-store/event-types/legal-documentation";
import { EventStore } from "../platform/event-store/store";
import { checkLegalDocumentationOfRecord } from "../platform/markets/legal/legal-documentation-gate";
import {
  checkOpinionRefresh,
  emitOpinionRefreshGapAlerts,
} from "../platform/markets/legal/opinion-refresh-watchdog";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "test:imani:legal" };
const CITATIONS = ["D-FX-HELD-DIMS-SEAT-SWEEP", "ORG-CS3-001"];
const CP = "urn:party:legal-entity:test-bank-za";
const AS_OF = "2026-06-12T07:00:00.000Z";

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "fx-opinion-watchdog-test-"));
});

afterAll(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

function freshStore(): EventStore {
  return new EventStore(join(tmpDir, `event-${Math.random().toString(36).slice(2)}.db`));
}

function seedSigning(
  store: EventStore,
  counterpartyId: string,
  agreementType: "isda-2002" | "isda-2025" | "fx-bilateral" | "none-listed" | "gmra-2011",
  signedDate = "2026-06-01",
): void {
  store.append(
    makeLegalDocumentationSigned({
      asOf: `${signedDate}T00:00:00.000Z`,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId,
        agreementType,
        version: "test",
        signedDate,
        csaPresent: false,
        nettingEnforceable: true,
      },
    }),
  );
}

function seedOpinion(
  store: EventStore,
  opinionDate: string,
  coversCounterparties: string[] = [],
): void {
  store.append(
    makeJurisdictionalOpinionRefreshed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        jurisdiction: "ZA",
        opinionAuthority: "ISDA",
        opinionAuthor: "Bowmans",
        opinionDate,
        opinionDocumentHash: `blake3:${"a".repeat(64)}`,
        coversCounterparties,
        refreshedAt: AS_OF,
        previousOpinionDate: null,
      },
    }),
  );
}

describe("legal-documentation gate (ORG-CS3-001)", () => {
  it("fails closed when no LegalDocumentationSigned exists", () => {
    const store = freshStore();
    const res = checkLegalDocumentationOfRecord(store, CP);
    expect(res.ok).toBe(false);
    expect(res.rejectionReason).toContain("ORG-CS3-001");
    store.close();
  });

  it("admits isda-2002, isda-2025, and fx-bilateral; not none-listed or gmra-2011", () => {
    for (const [form, admitted] of [
      ["isda-2002", true],
      ["isda-2025", true],
      ["fx-bilateral", true],
      ["none-listed", false],
      ["gmra-2011", false],
    ] as const) {
      const store = freshStore();
      seedSigning(store, CP, form);
      expect(checkLegalDocumentationOfRecord(store, CP).ok).toBe(admitted);
      store.close();
    }
  });

  it("is keyed per counterparty (another counterparty's signing does not admit)", () => {
    const store = freshStore();
    seedSigning(store, "urn:party:legal-entity:other-bank", "isda-2002");
    expect(checkLegalDocumentationOfRecord(store, CP).ok).toBe(false);
    store.close();
  });

  it("returns the latest qualifying signing", () => {
    const store = freshStore();
    seedSigning(store, CP, "fx-bilateral", "2026-01-01");
    seedSigning(store, CP, "isda-2002", "2026-06-01");
    const res = checkLegalDocumentationOfRecord(store, CP);
    expect(res.ok).toBe(true);
    expect(res.agreementType).toBe("isda-2002");
    expect(res.signedDate).toBe("2026-06-01");
    store.close();
  });
});

describe("opinion-refresh watchdog (12-month SLA, monitoring control)", () => {
  it("no findings when no counterparty has an ISDA Master", () => {
    const store = freshStore();
    seedSigning(store, CP, "fx-bilateral"); // bilateral form: no netting-opinion reliance asserted
    expect(checkOpinionRefresh(store, AS_OF)).toHaveLength(0);
    store.close();
  });

  it("counterparty-with-ISDA and no opinion → 'missing' finding", () => {
    const store = freshStore();
    seedSigning(store, CP, "isda-2002");
    const findings = checkOpinionRefresh(store, AS_OF);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("missing");
    expect(findings[0]?.counterpartyId).toBe(CP);
    store.close();
  });

  it("opinion older than 12 months → 'stale' finding with the opinion date", () => {
    const store = freshStore();
    seedSigning(store, CP, "isda-2002");
    seedOpinion(store, "2024-04-15"); // Bowmans 2024 SA opinion — >12 months before 2026-06-12
    const findings = checkOpinionRefresh(store, AS_OF);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("stale");
    expect(findings[0]?.latestOpinionDate).toBe("2024-04-15");
    store.close();
  });

  it("fresh class-level opinion (coversCounterparties: []) clears all counterparties", () => {
    const store = freshStore();
    seedSigning(store, CP, "isda-2002");
    seedSigning(store, "urn:party:legal-entity:second-bank", "isda-2025");
    seedOpinion(store, "2026-04-15");
    expect(checkOpinionRefresh(store, AS_OF)).toHaveLength(0);
    store.close();
  });

  it("fresh per-counterparty opinion clears only the covered counterparty", () => {
    const store = freshStore();
    const other = "urn:party:legal-entity:second-bank";
    seedSigning(store, CP, "isda-2002");
    seedSigning(store, other, "isda-2002");
    seedOpinion(store, "2026-04-15", [CP]);
    const findings = checkOpinionRefresh(store, AS_OF);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.counterpartyId).toBe(other);
    expect(findings[0]?.kind).toBe("missing");
    store.close();
  });

  it("emits a MEDIUM SubstrateAlert(integrity) per finding, idempotent by alertId", () => {
    const store = freshStore();
    seedSigning(store, CP, "isda-2002");

    const first = emitOpinionRefreshGapAlerts(store, AS_OF);
    expect(first.emitted).toHaveLength(1);
    expect(first.skipped).toHaveLength(0);

    const alerts = [];
    for (const ev of store.replay({ type: "SubstrateAlert" })) alerts.push(ev);
    expect(alerts).toHaveLength(1);
    const payload = alerts[0]?.payload as { severity?: string; alertClass?: string };
    expect(payload.severity).toBe("medium"); // monitoring control — never high+ / order-path
    expect(payload.alertClass).toBe("integrity");

    const second = emitOpinionRefreshGapAlerts(store, AS_OF);
    expect(second.emitted).toHaveLength(0);
    expect(second.skipped).toHaveLength(1);
    store.close();
  });
});
