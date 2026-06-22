// scripts/seed-v2-client-onboarding.ts
//
// Idempotent, replay-safe seed — 15 simulated institutional clients run through
// the FULL born-V2 client-onboarding lifecycle to `activated`.
//
// Events-first (Principle 1): the ClientOnboarding* events ARE the register; the
// dashboard render is downstream. Every event is tagged
// `provenance: { kind: "simulated", scenario: "v2-client-onboarding-seed",
// sourceLineage: "seed:v2-client-onboarding" }` so the clients appear under the
// +Sim lens and are excluded under Prod (the bank has no real customers in the
// build phase — Niko's lifecycle activates at licence-day). The seed honestly
// emits EVERY gating phase (KYC, sanctions, FAIS, beneficial-owner, FATCA/CRS,
// POPIA consent, credit assessment, accounts setup) before `activated`, so
// recon:v2-client-onboarding-integrity passes because the gate is genuinely
// satisfied — not because the gate is lenient.
//
// IDEMPOTENCY: counterparty ids + event ids are DERIVED deterministically from
// the client slug + phase, and all `as_of` timestamps are FIXED constants (never
// `new Date()`), so re-running the seed produces byte-identical events. The
// store's INSERT-OR-IGNORE on the deterministic event_id keeps it a no-op on
// re-run; we ALSO replay the register first and skip any client already
// `activated`. The seed therefore runs cleanly inside ci:migrate's replay.
//
// Usage (default home canonical store):
//   bun run scripts/seed-v2-client-onboarding.ts
// Override the store path (tests / local CI):
//   BANK_EVENT_DB=/tmp/e.db bun run scripts/seed-v2-client-onboarding.ts
//
// Authority: D-V1-REMOVAL-PHASE-1 (born V2); WS-V2-CLIENT-ONBOARDING;
//   brief:atlas:v2-client-onboarding-family-onboard-15-sim-clien:2026-06-22.
//   FIC Act 38/2001; FAIS Act 37/2002; POPIA s.11/s.55; IRC §1471–1474; OECD CRS.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../platform/composition";
import {
  makeClientAccountsSetup,
  makeClientActivated,
  makeClientBeneficialOwnerResolved,
  makeClientCreditAssessed,
  makeClientFaisClassified,
  makeClientFatcaCrsClassified,
  makeClientKycPassed,
  makeClientPopiaConsentRecorded,
  makeClientProspectRegistered,
  makeClientSanctionsCleared,
  makeClientSoundingOpened,
} from "../platform/event-store/event-types/client-onboarding";
import type { Event } from "../platform/event-store/types";
import {
  CLIENT_ONBOARDING_EVENT_KINDS,
  type ClientFaisCategory,
  type ClientFatcaStatus,
  type ClientSector,
  foldClientOnboardingRegister,
} from "../v2-core/client-onboarding";

const ENTITY = "LE-ZA-HOZ-BANK"; // canonical anchor bank entity.
const ACTOR = { type: "service" as const, id: "scripts:seed-v2-client-onboarding" };
const LINEAGE = "seed:v2-client-onboarding";
const SCENARIO = "v2-client-onboarding-seed";
const CITES = ["D-V1-REMOVAL-PHASE-1", "WS-V2-CLIENT-ONBOARDING"];

/** Simulated provenance tag — every seeded event carries it (build-phase data). */
const PROVENANCE = {
  kind: "simulated" as const,
  scenario: SCENARIO,
  sourceLineage: LINEAGE,
};

// Fixed lifecycle timestamps — one per phase, never `new Date()` (replay-safe).
const T = {
  sounding: "2026-06-22T08:00:00.000Z",
  prospect: "2026-06-22T08:01:00.000Z",
  kyc: "2026-06-22T08:02:00.000Z",
  sanctions: "2026-06-22T08:03:00.000Z",
  fais: "2026-06-22T08:04:00.000Z",
  bo: "2026-06-22T08:05:00.000Z",
  fatca: "2026-06-22T08:06:00.000Z",
  popia: "2026-06-22T08:07:00.000Z",
  credit: "2026-06-22T08:08:00.000Z",
  accounts: "2026-06-22T08:09:00.000Z",
  activated: "2026-06-22T08:10:00.000Z",
} as const;

interface SeedClient {
  readonly slug: string;
  readonly legalName: string;
  /** ISO 3166-1 alpha-2 jurisdiction of incorporation. */
  readonly jurisdiction: string;
  readonly sector: ClientSector;
  readonly kycTier: "Tier-1" | "Tier-2";
  readonly faisCategory: ClientFaisCategory;
  readonly fatcaStatus: ClientFatcaStatus;
  /** ISO 3166-1 alpha-2 CRS tax-residency. */
  readonly crsResidency: string;
  readonly creditGrade: string;
  readonly accountCurrency: string;
}

// The 15 simulated institutional clients.
//   ZA banks · ZA corporates · international banks (banking sector).
const CLIENTS: readonly SeedClient[] = [
  // --- ZA banks (jurisdiction ZA, sector banking) ---
  bank("standard-bank", "The Standard Bank of South Africa Limited", "ZA"),
  bank("absa-bank", "Absa Bank Limited", "ZA"),
  bank("firstrand-bank", "FirstRand Bank Limited (FNB)", "ZA"),
  bank("nedbank", "Nedbank Limited", "ZA"),
  bank("capitec-bank", "Capitec Bank Limited", "ZA"),
  // --- ZA corporates (jurisdiction ZA, sector corporate) ---
  corp("sasol", "Sasol Limited"),
  corp("shoprite", "Shoprite Holdings Limited"),
  corp("mtn-group", "MTN Group Limited"),
  corp("naspers", "Naspers Limited"),
  corp("bidvest-group", "The Bidvest Group Limited"),
  // --- International banks (sector banking; jurisdiction US/US/DE/GB/FR) ---
  intlBank("jpmorgan-chase", "JPMorgan Chase Bank, N.A.", "US"),
  intlBank("goldman-sachs", "Goldman Sachs Bank USA", "US"),
  intlBank("deutsche-bank", "Deutsche Bank AG", "DE"),
  intlBank("hsbc", "HSBC Bank plc", "GB"),
  intlBank("bnp-paribas", "BNP Paribas SA", "FR"),
];

function bank(slug: string, legalName: string, jurisdiction: string): SeedClient {
  return {
    slug,
    legalName,
    jurisdiction,
    sector: "banking",
    kycTier: "Tier-1",
    faisCategory: "market-counterparty",
    fatcaStatus: "non-us-person",
    crsResidency: jurisdiction,
    creditGrade: "A",
    accountCurrency: "ZAR",
  };
}

function corp(slug: string, legalName: string): SeedClient {
  return {
    slug,
    legalName,
    jurisdiction: "ZA",
    sector: "corporate",
    kycTier: "Tier-2",
    faisCategory: "professional-client",
    fatcaStatus: "non-us-person",
    crsResidency: "ZA",
    creditGrade: "BBB",
    accountCurrency: "ZAR",
  };
}

function intlBank(slug: string, legalName: string, jurisdiction: string): SeedClient {
  const fatca: ClientFatcaStatus = jurisdiction === "US" ? "us-person" : "non-us-person";
  return {
    slug,
    legalName,
    jurisdiction,
    sector: "banking",
    kycTier: "Tier-1",
    faisCategory: "market-counterparty",
    fatcaStatus: fatca,
    crsResidency: jurisdiction,
    creditGrade: "A",
    accountCurrency: "USD",
  };
}

/** Deterministic counterparty id (replay-stable). */
function counterpartyId(slug: string): string {
  return `urn:counterparty:client:${slug}`;
}

/** Deterministic event id from (slug, phase) — replay-stable INSERT-OR-IGNORE key. */
function eid(slug: string, phase: string): string {
  return `client-onboarding:${slug}:${phase}`;
}

/** Build the full clean lifecycle (11 events) for one client, in causal order. */
function lifecycleEvents(c: SeedClient): Event[] {
  const cp = counterpartyId(c.slug);
  const reviewerRef = "urn:party:agent:mlro"; // seat ref (lineage only, name-free).
  return [
    makeClientSoundingOpened({
      eventId: eid(c.slug, "sounding"),
      asOf: T.sounding,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROVENANCE,
      payload: { counterpartyId: cp, channel: "outbound", citations: CITES },
    }),
    makeClientProspectRegistered({
      eventId: eid(c.slug, "prospect"),
      asOf: T.prospect,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROVENANCE,
      payload: {
        counterpartyId: cp,
        legalName: c.legalName,
        jurisdiction: c.jurisdiction,
        sector: c.sector,
        partyRef: `urn:party:counterparty:${c.slug}`,
        citations: CITES,
      },
    }),
    makeClientKycPassed({
      eventId: eid(c.slug, "kyc"),
      asOf: T.kyc,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROVENANCE,
      payload: {
        counterpartyId: cp,
        tier: c.kycTier,
        pep: false,
        jurisdictionalRiskScore: c.jurisdiction === "ZA" ? "low" : "medium",
        reviewerRef,
        passedAt: T.kyc,
        citations: CITES,
      },
    }),
    makeClientSanctionsCleared({
      eventId: eid(c.slug, "sanctions"),
      asOf: T.sanctions,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROVENANCE,
      payload: {
        counterpartyId: cp,
        screeningProvider: "sim-sanctions-screen",
        screeningRef: `SCRN-${c.slug}`,
        clearedAt: T.sanctions,
        citations: CITES,
      },
    }),
    makeClientFaisClassified({
      eventId: eid(c.slug, "fais"),
      asOf: T.fais,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROVENANCE,
      payload: {
        counterpartyId: cp,
        faisCategory: c.faisCategory,
        classifiedAt: T.fais,
        citations: CITES,
      },
    }),
    makeClientBeneficialOwnerResolved({
      eventId: eid(c.slug, "bo"),
      asOf: T.bo,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROVENANCE,
      payload: {
        counterpartyId: cp,
        beneficialOwners: [
          {
            partyRef: `urn:party:natural-person:${c.slug}-ubo-1`,
            ownershipPct: 100,
            controlBasis: "listed-entity-free-float (simulated)",
          },
        ],
        resolvedAt: T.bo,
        citations: CITES,
      },
    }),
    makeClientFatcaCrsClassified({
      eventId: eid(c.slug, "fatca"),
      asOf: T.fatca,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROVENANCE,
      payload: {
        counterpartyId: cp,
        fatcaStatus: c.fatcaStatus,
        crsResidency: c.crsResidency,
        classifiedAt: T.fatca,
        citations: CITES,
      },
    }),
    makeClientPopiaConsentRecorded({
      eventId: eid(c.slug, "popia"),
      asOf: T.popia,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROVENANCE,
      payload: {
        counterpartyId: cp,
        consentScope: ["onboarding-cdd", "ongoing-monitoring"],
        recordedAt: T.popia,
        citations: CITES,
      },
    }),
    makeClientCreditAssessed({
      eventId: eid(c.slug, "credit"),
      asOf: T.credit,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROVENANCE,
      payload: {
        counterpartyId: cp,
        creditGrade: c.creditGrade,
        exposureLimit: { currency: c.accountCurrency, amount: "100000000" },
        assessedAt: T.credit,
        citations: CITES,
      },
    }),
    makeClientAccountsSetup({
      eventId: eid(c.slug, "accounts"),
      asOf: T.accounts,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROVENANCE,
      payload: {
        counterpartyId: cp,
        accounts: [
          {
            accountId: `ACC-${c.slug}-${c.accountCurrency}`,
            currency: c.accountCurrency,
            accountType: "settlement-nostro",
          },
        ],
        setupAt: T.accounts,
        citations: CITES,
      },
    }),
    makeClientActivated({
      eventId: eid(c.slug, "activated"),
      asOf: T.activated,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: PROVENANCE,
      payload: {
        counterpartyId: cp,
        activatedAt: T.activated,
        activatedBy: "urn:party:agent:client-lifecycle",
        citations: CITES,
      },
    }),
  ];
}

function main(): void {
  // Replay the store ONCE to collect (a) the already-present event_ids (the
  // idempotency key — the store's append is a plain INSERT, so re-emitting a
  // duplicate event_id would throw on the primary-key) and (b) the existing
  // onboarding family for the per-client already-activated short-circuit.
  const family = new Set<string>(CLIENT_ONBOARDING_EVENT_KINDS);
  const existingEventIds = new Set<string>();
  const existingFamily: Array<{ kind: string; payload: Record<string, unknown> }> = [];
  for (const ev of eventStore.replay()) {
    existingEventIds.add(ev.event_id);
    if (family.has(ev.type)) existingFamily.push({ kind: ev.type, payload: ev.payload });
  }
  const register = foldClientOnboardingRegister(existingFamily);

  let emitted = 0;
  let skippedActivated = 0;
  let skippedExistingEvents = 0;
  for (const c of CLIENTS) {
    const cp = counterpartyId(c.slug);
    const rec = register.getClient(cp);
    if (rec && rec.phase === "activated") {
      skippedActivated += 1;
      continue;
    }
    // Emit the full lifecycle, skipping any event whose deterministic id already
    // exists (covers a partial prior run — replay-safe + crash-safe).
    for (const ev of lifecycleEvents(c)) {
      if (existingEventIds.has(ev.event_id)) {
        skippedExistingEvents += 1;
        continue;
      }
      eventStore.append(ev);
      emitted += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        clients: CLIENTS.length,
        emittedEvents: emitted,
        skippedAlreadyActivated: skippedActivated,
        skippedExistingEvents,
      },
      null,
      2,
    ),
  );
}

main();
