// scripts/emit-capital-injection-v2-sim.ts
//
// Simulate a R300,000,000 CET1 capital injection — V2-NATIVE
// (D-CAPITAL-ASSET-CLASS-V1).
//
// Emits ONE `capital` asset-class FIL instrument creation event
// (FilInstrumentCreated) for a R300,000,000 CET1 paid-up ordinary share-capital
// subscription. It does NOT touch the V1 capital path (NO CapitalEvent, NO
// SubLedgerPostingEmitted) — the V1 emitter `scripts/emit-capital-injection-sim.ts`
// is superseded by this fold-native one.
//
// TWO STORES (mirroring scripts/backfill-fil-instances.ts):
//   1. MAIN canonical store (BANK_EVENT_DB, via composition.eventStore) — the
//      store computeBA700V2 + the capital composition fold read. Emitted via the
//      typed maker makeFilInstrumentCreated with SIMULATED provenance.
//   2. v2 ANCHOR store (BANK_V2_ANCHOR_DB) — the store the
//      recon:capital-materialisation-integrity gate reads. Emitted via raw SQLite
//      (same DDL as seed-v2-fil-instances-ir-fx.ts).
//
// The capital instrument carries its typed qualifying-capital dimension
// (tier `cet1`, sub-category `cet1.paid-up-ordinary-shares`). The accounting fold
// (`v2-core/posting-rules/capital.postCapitalIssuanceLegs`) derives:
//   Dr ACC-1200-001 (ZAR Nostro — settlement cash)   R300,000,000
//   Cr ACC-5000-001 (Share Capital — CET1)            R300,000,000
// and the BA-700 capital-composition fold derives CET1 = Tier 1 = Total own funds
// = R300,000,000.
//
// "capital injection" = CET1 paid-up ordinary share capital (the natural reading
// + the existing sim basis). The design ALSO supports AT1 / Tier 2 issuance — only
// the simulated instance is CET1.
//
// PROVENANCE: `simulated` (scenario "capital-injection-cet1-300m-v2"). The
// PRODUCTION ba700-v2 projection's provenance filter EXCLUDES it (correct — there
// is no real capital pre-licence-day); the demonstration fold + the recon gate
// admit it (includeSimulated / raw read).
//
// ENTITY: the canonical V2 anchor entity is `LE-ZA-HOZ-BANK` (the legal-entity-tree
// anchor that computeBA700V2 + backfill-fil-instances use). The V1 sim used the
// legacy `LE-BANK-SA`; this V2-native sim uses the canonical anchor entity so the
// composition fold (which filters by entity) sees the capital.
//
// Idempotency: guarded on the instance URN in BOTH stores. No wall-clock (fixed
// asOf, idempotent ids) — Charter cmd 6.
//
// Authority: D-CAPITAL-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION;
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; Reg 38; Banks Act §70; BCBS RBC20.2;
//   D5/2025 §2.1.3 (form BA 100); Principle 1; Principle 5.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";

import { eventStore } from "../platform/composition";
import { makeFilInstrumentCreated } from "../platform/event-store/event-types/fil-instances";
import { simulatedTag } from "../platform/event-store/provenance";
import { formatInstanceUrn } from "../v2-core/fil-core/urn";
import type { FilEconomicTerms } from "../v2-core/fil-instances/events";
import { CAPITAL_INSTRUMENT_TYPE_URN } from "../v2-core/fil-models/capital/types/capital-type-definitions";

// ---------------------------------------------------------------------------
// Fixed simulation parameters — no wall-clock; idempotent ids.
// ---------------------------------------------------------------------------

const TENANT = "LE-ZA-HOZ-BANK";
const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-06-21T00:00:00.000Z";
const SETTLEMENT_DATE = "2026-06-21";
const INSTANCE_ID = "cap-cet1-300m-2026-06-21";
const ORIGINATING_EVENT_ID = "CAP-V2-SIM-CET1-300M-2026-06-21";
const MAIN_EVENT_ID = "FIL-CAP-V2-SIM-CET1-300M-2026-06-21";
const AMOUNT_MAJOR = "300000000"; // R300,000,000 in ZAR major units (decimal-native)

const ACTOR = { type: "service" as const, id: "agent:bea:emit-capital-injection-v2-sim" };
const CITATIONS = [
  "D-CAPITAL-ASSET-CLASS-V1",
  "urn:reg:za:regs-relating-to-banks:reg38",
  "urn:reg:za:banks-act-94-1990:s70",
  "urn:reg:bcbs:rbc:20.2",
  "D5/2025 §2.1.3",
  "P1-EVENTS-AS-TRUTH",
];

const SIM_PROVENANCE = simulatedTag({
  scenario: "capital-injection-cet1-300m-v2",
  sourceLineage: "scripts/emit-capital-injection-v2-sim.ts",
  tags: ["manual-simulation", "capital-raise", "cet1", "d-capital-asset-class-v1"],
});

const instance = formatInstanceUrn({ tenant: TENANT, instanceId: INSTANCE_ID });

const economicTerms: FilEconomicTerms = {
  assetClass: "capital",
  notional: { currency: "ZAR", amount: AMOUNT_MAJOR },
  // Direction `long` — the bank holds the issued own funds (the field is required;
  // capital direction is not an SA-CCR delta).
  direction: "long",
  // A capital subscription has no market counterparty / netting set in the SA-CCR
  // sense; the subscriber is the capital provider. Stable self-referential ids
  // (NOT a market counterparty) so the required fields are populated without
  // implying a derivative exposure.
  counterpartyId: "urn:party:capital-provider:founding-subscription",
  nettingSetId: "NS-CAPITAL-CET1-ZAR",
  currency: "ZAR",
  settlementDate: SETTLEMENT_DATE,
  qualifyingCapital: {
    tier: "cet1",
    subCategory: "cet1.paid-up-ordinary-shares",
  },
};

// ---------------------------------------------------------------------------
// 1. MAIN canonical store (via composition.eventStore).
// ---------------------------------------------------------------------------

function alreadyInMainStore(): boolean {
  for (const e of eventStore.replay({ type: "FilInstrumentCreated" })) {
    if (e.event_id === MAIN_EVENT_ID) return true;
    const p = e.payload as { instance?: string };
    if (p.instance === instance) return true;
  }
  return false;
}

function emitToMainStore(): boolean {
  if (alreadyInMainStore()) {
    console.log(`[emit-capital-injection-v2-sim] main store already has ${instance} — skipped`);
    return false;
  }
  const event = makeFilInstrumentCreated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    eventId: MAIN_EVENT_ID,
    payload: {
      kind: "FilInstrumentCreated",
      instance,
      type: CAPITAL_INSTRUMENT_TYPE_URN,
      tenant: TENANT,
      asOf: AS_OF,
      originatingEvent: {
        eventType: "CapitalSubscriptionConfirmed",
        eventId: ORIGINATING_EVENT_ID,
      },
      initialStage: "active",
      economicTerms,
    },
  });
  event.provenance = SIM_PROVENANCE;
  eventStore.append(event);
  console.log(`[emit-capital-injection-v2-sim] main store: emitted ${instance} (simulated)`);
  return true;
}

// ---------------------------------------------------------------------------
// 2. v2 ANCHOR store (raw SQLite — same DDL as seed-v2-fil-instances-ir-fx.ts).
// ---------------------------------------------------------------------------

function resolveV2AnchorDb(): string {
  const fromEnv = process.env.BANK_V2_ANCHOR_DB;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return resolve(homedir(), ".local", "share", "bank", "v2-anchor.db");
}

function emitToAnchorStore(): boolean {
  const dbPath = resolveV2AnchorDb();
  const parentDir = dirname(dbPath);
  if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
  const v2 = new Database(dbPath);
  try {
    v2.exec(`
CREATE TABLE IF NOT EXISTS v2_events (
  sequence    INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    TEXT    UNIQUE NOT NULL,
  type        TEXT    NOT NULL,
  as_of       TEXT    NOT NULL,
  entity      TEXT    NOT NULL,
  actor_type  TEXT    NOT NULL,
  actor_id    TEXT    NOT NULL,
  citations   TEXT    NOT NULL,
  payload     TEXT    NOT NULL,
  recorded_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_v2_type   ON v2_events(type);
CREATE INDEX IF NOT EXISTS idx_v2_entity ON v2_events(entity);
CREATE INDEX IF NOT EXISTS idx_v2_as_of  ON v2_events(as_of);
`);
    const existing = v2
      .query<{ payload: string }, [string]>("SELECT payload FROM v2_events WHERE type = ?")
      .all("FilInstrumentCreated");
    for (const r of existing) {
      try {
        const p = JSON.parse(r.payload) as { instance?: string };
        if (p.instance === instance) {
          console.log(
            `[emit-capital-injection-v2-sim] anchor store already has ${instance} — skipped`,
          );
          return false;
        }
      } catch {
        /* ignore malformed legacy rows */
      }
    }
    const payload: Record<string, unknown> = {
      kind: "FilInstrumentCreated",
      instance,
      type: CAPITAL_INSTRUMENT_TYPE_URN,
      tenant: TENANT,
      asOf: AS_OF,
      originatingEvent: {
        eventType: "CapitalSubscriptionConfirmed",
        eventId: ORIGINATING_EVENT_ID,
      },
      initialStage: "active",
      economicTerms,
      provenance: SIM_PROVENANCE,
    };
    v2.query(
      `INSERT OR IGNORE INTO v2_events
         (event_id, type, as_of, entity, actor_type, actor_id, citations, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      "FilInstrumentCreated",
      AS_OF,
      ENTITY,
      ACTOR.type,
      ACTOR.id,
      JSON.stringify(CITATIONS),
      JSON.stringify(payload),
    );
    console.log(`[emit-capital-injection-v2-sim] anchor store: emitted ${instance} → ${dbPath}`);
    return true;
  } finally {
    v2.close();
  }
}

function main(): number {
  emitToMainStore();
  emitToAnchorStore();
  console.log(
    `[emit-capital-injection-v2-sim] CET1 R${AMOUNT_MAJOR} capital injection simulated — tier=cet1 sub=cet1.paid-up-ordinary-shares type=${CAPITAL_INSTRUMENT_TYPE_URN}`,
  );
  return 0;
}

process.exit(main());
