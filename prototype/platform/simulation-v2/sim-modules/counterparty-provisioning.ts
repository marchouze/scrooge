// platform/simulation-v2/sim-modules/counterparty-provisioning.ts
//
// M2 — counterparty provisioning seam (SIMULATOR side). Stands up a scenario
// counterparty + its ISDA/CSA agreement FROM THE MANIFEST (not ad-hoc seed
// events). This module emits ONLY the EXTERNAL party's side of the clean Niko
// lifecycle:
//
//   sounding → prospect (implied) → KYC documents → mandate accepted →
//   ISDA/CSA agreement accepted
//
// Each step is an external-party fact tagged `simulated`, born V2, scenario-
// bound. The bank's OWN onboarding / KYC-clearance / ISDA-CSA election + netting-
// set readiness is SUT-internal and lives OUTSIDE this package, in
// platform/markets/counterparty/provision-counterparty.ts. The simulator↔SUT
// boundary gate forbids this module from emitting the SUT-internal election
// events (IsdaCsaElected etc.).
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20). Every new event
// born V2 — never v1-only (D-V1-REMOVAL-PHASE-1).
// Author: Atlas (Core banking platform architect, engineering).

import {
  type CitationRef,
  type Instant,
  citationRefSchema,
  instantSchema,
} from "../../../v2-core/fil-core/primitives";
import {
  makeClientOnboardingAccountsSetup,
  makeClientOnboardingActivated,
  makeClientOnboardingBeneficialOwnerResolved,
  makeClientOnboardingCreditAssessed,
  makeClientOnboardingFaisClassified,
  makeClientOnboardingFatcaCrsClassified,
  makeClientOnboardingKycPassed,
  makeClientOnboardingPopiaConsentRecorded,
  makeClientOnboardingProspectRegistered,
  makeClientOnboardingSanctionsCleared,
  makeClientOnboardingSoundingOpened,
} from "../../event-store/event-types/client-onboarding";
import {
  makeCounterpartyAgreementAccepted,
  makeCounterpartyKycDocumentsSubmitted,
  makeCounterpartyMandateAccepted,
  makeCounterpartySoundingMade,
} from "../../event-store/event-types/counterparty-provisioning";
import { simulatedTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import type { Event } from "../../event-store/types";
import type { ScenarioCounterparty } from "../scenario-manifest";

const ENTITY = "LE-ZA-HOZ-BANK";
const SIM_ACTOR = { type: "service" as const, id: "agent:env:counterparty-provisioning-sim" };
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST"];

function simProvenance(scenarioId: string) {
  return simulatedTag({
    scenario: scenarioId,
    sourceLineage: "simulation-v2:counterparty-provisioning",
  });
}

/** Standard KYC document pack a provisioning counterparty submits. */
const KYC_DOCUMENT_PACK = [
  "constitutional-documents",
  "lei-confirmation",
  "ultimate-beneficial-owner-register",
  "authorised-signatory-list",
] as const;

/**
 * SIMULATOR — emit the external counterparty's full provisioning lifecycle for
 * `cp`: sounding, KYC document submission, mandate acceptance, and (when the
 * manifest declares an agreement) ISDA/CSA agreement acceptance. The bank's SUT
 * recording is a separate step (provision-counterparty.ts). Idempotent on the
 * deterministic per-step event ids.
 *
 * Returns the terminal lifecycle event type reached.
 */
export function emitCounterpartyProvisioning(args: {
  readonly store: EventStore;
  readonly scenarioId: string;
  readonly asOf: string;
  readonly counterparty: ScenarioCounterparty;
  /** Reporting/base currency the dealing mandate covers. */
  readonly reporting: string;
}): "CounterpartyMandateAccepted" | "CounterpartyAgreementAccepted" {
  const { store, scenarioId, asOf, counterparty, reporting } = args;
  const provenance = simProvenance(scenarioId);
  const cpId = counterparty.counterpartyId;

  // 1. Sounding — the counterparty expresses dealing interest (implies prospect).
  store.append(
    makeCounterpartySoundingMade({
      asOf,
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      payload: {
        counterpartyId: cpId,
        name: counterparty.name,
        bic: counterparty.bic,
        eligiblePairs: [...counterparty.eligiblePairs],
      },
      eventId: `${scenarioId}:${cpId}:sounding`,
      provenance,
    }),
  );

  // 2. KYC documents — the counterparty submits its KYC pack.
  store.append(
    makeCounterpartyKycDocumentsSubmitted({
      asOf,
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      payload: { counterpartyId: cpId, documents: [...KYC_DOCUMENT_PACK] },
      eventId: `${scenarioId}:${cpId}:kyc-submitted`,
      provenance,
    }),
  );

  // 3. Mandate — the counterparty accepts the dealing mandate.
  store.append(
    makeCounterpartyMandateAccepted({
      asOf,
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      payload: { counterpartyId: cpId, baseCurrency: reporting },
      eventId: `${scenarioId}:${cpId}:mandate-accepted`,
      provenance,
    }),
  );

  // 4. Agreement — the counterparty accepts the ISDA/CSA terms (when declared).
  const agreement = counterparty.agreement;
  if (agreement) {
    store.append(
      makeCounterpartyAgreementAccepted({
        asOf,
        entity: ENTITY,
        actor: SIM_ACTOR,
        citations: CITATIONS,
        payload: {
          counterpartyId: cpId,
          agreementType: agreement.agreementType,
          csaInScope: agreement.csaInScope,
          ...(agreement.csaInScope ? { csaCurrency: agreement.csaCurrency ?? reporting } : {}),
        },
        eventId: `${scenarioId}:${cpId}:agreement-accepted`,
        provenance,
      }),
    );
    return "CounterpartyAgreementAccepted";
  }
  return "CounterpartyMandateAccepted";
}

// ---------------------------------------------------------------------------
// In-sim client onboarding (WS-FX-V2-SIMULATOR-FIRST)
// ---------------------------------------------------------------------------
//
// The FX simulator transacts ONLY with clients onboarded WITHIN the simulation.
// A scenario counterparty comes into existence as an FX-eligible party by
// running the FULL born-V2 client-onboarding lifecycle to the terminal
// `ClientOnboardingActivated` phase — KYC → sanctions → FAIS → beneficial-owner
// → FATCA/CRS → POPIA → credit → accounts → activated — carrying its BIC + FX
// eligibility at prospect registration. The FX trade generator then selects
// EXACTLY this onboarded set (onboarded-fx-counterparty-resolver.ts). No
// onboarding → no eligible counterparty → no trade (fail-closed).
//
// Every event is `simulated`-tagged (build-phase external-party fact) and born
// V2. Deterministic per-(scenario,counterparty,phase) event ids keep it
// idempotent + replay-safe. The bank's OWN provisioning decision
// (CounterpartyProvisioned, IsdaCsaElected, netting-set stand-up) remains
// SUT-internal and OUTSIDE this simulator module.

/** Standard KYC reviewer seat ref (name-free lineage). */
const KYC_REVIEWER_REF = "urn:party:agent:mlro";

/**
 * Fixed sub-instants within the provisioning instant — replay-stable phase
 * order. Returns a branded `Instant` (validated through `instantSchema`, the
 * same gate the event payloads use), so the value is both type- and
 * runtime-correct at the call boundary (Engineering-Charter cmd 6 — work WITH
 * the type system, no `as`/`!` escape).
 */
function phaseInstant(baseAsOf: string, minuteOffset: number): Instant {
  const ms = Date.parse(baseAsOf) + minuteOffset * 60_000;
  return instantSchema.parse(new Date(ms).toISOString());
}

/** Branded onboarding citations (the payload schemas require `CitationRef[]`). */
const ONBOARDING_CITES: CitationRef[] = CITATIONS.map((c) => citationRefSchema.parse(c));

/**
 * SIMULATOR — onboard `counterparty` as an in-sim FX-eligible client by emitting
 * the full born-V2 client-onboarding lifecycle to `ClientOnboardingActivated`
 * (simulated-tagged). The counterparty's BIC + eligible FX pairs are recorded at
 * prospect registration so the FX resolver can derive it. Idempotent on the
 * deterministic per-step event ids.
 *
 * Returns the terminal event type reached (`ClientOnboardingActivated`).
 */
export function emitClientOnboardingLifecycle(args: {
  readonly store: EventStore;
  readonly scenarioId: string;
  readonly asOf: string;
  readonly counterparty: ScenarioCounterparty;
  /** ISO 3166-1 alpha-2 jurisdiction of incorporation (defaults to ZA). */
  readonly jurisdiction?: string;
  /** Account currency for the accounts-setup phase (defaults to ZAR). */
  readonly accountCurrency?: string;
}): "ClientOnboardingActivated" {
  const { store, scenarioId, asOf, counterparty } = args;
  const provenance = simProvenance(scenarioId);
  const cpId = counterparty.counterpartyId;
  const jurisdiction = args.jurisdiction ?? "ZA";
  const accountCurrency = args.accountCurrency ?? "ZAR";
  const eid = (phase: string) => `${scenarioId}:${cpId}:onboarding:${phase}`;
  const at = (offset: number) => phaseInstant(asOf, offset);

  // Idempotency / crash-safety (mirrors seed:v2-client-onboarding): the store's
  // append is a plain INSERT (a duplicate event_id throws), so we collect the
  // lifecycle and skip any event whose deterministic id already exists. We
  // ALSO short-circuit when the client already reached `activated`.
  const events: Event[] = [];
  const emit = (ev: Event): void => {
    events.push(ev);
  };

  emit(
    makeClientOnboardingSoundingOpened({
      asOf: at(0),
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      provenance,
      eventId: eid("sounding"),
      payload: { counterpartyId: cpId, channel: "outbound", citations: ONBOARDING_CITES },
    }),
  );

  emit(
    makeClientOnboardingProspectRegistered({
      asOf: at(1),
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      provenance,
      eventId: eid("prospect"),
      payload: {
        counterpartyId: cpId,
        legalName: counterparty.name,
        jurisdiction,
        sector: "banking",
        bic: counterparty.bic,
        fxEligiblePairs: [...counterparty.eligiblePairs],
        citations: ONBOARDING_CITES,
      },
    }),
  );

  emit(
    makeClientOnboardingKycPassed({
      asOf: at(2),
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      provenance,
      eventId: eid("kyc"),
      payload: {
        counterpartyId: cpId,
        tier: "Tier-1",
        pep: false,
        jurisdictionalRiskScore: jurisdiction === "ZA" ? "low" : "medium",
        reviewerRef: KYC_REVIEWER_REF,
        passedAt: at(2),
        citations: ONBOARDING_CITES,
      },
    }),
  );

  emit(
    makeClientOnboardingSanctionsCleared({
      asOf: at(3),
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      provenance,
      eventId: eid("sanctions"),
      payload: {
        counterpartyId: cpId,
        screeningProvider: "sim-screening",
        screeningRef: `${cpId}:sanctions`,
        clearedAt: at(3),
        citations: ONBOARDING_CITES,
      },
    }),
  );

  emit(
    makeClientOnboardingFaisClassified({
      asOf: at(4),
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      provenance,
      eventId: eid("fais"),
      payload: {
        counterpartyId: cpId,
        faisCategory: "market-counterparty",
        classifiedAt: at(4),
        citations: ONBOARDING_CITES,
      },
    }),
  );

  emit(
    makeClientOnboardingBeneficialOwnerResolved({
      asOf: at(5),
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      provenance,
      eventId: eid("bo"),
      payload: {
        counterpartyId: cpId,
        beneficialOwners: [
          {
            partyRef: `urn:party:natural-person:${cpId}:ubo`,
            ownershipPct: 100,
            controlBasis: "ultimate-beneficial-owner",
          },
        ],
        resolvedAt: at(5),
        citations: ONBOARDING_CITES,
      },
    }),
  );

  emit(
    makeClientOnboardingFatcaCrsClassified({
      asOf: at(6),
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      provenance,
      eventId: eid("fatca-crs"),
      payload: {
        counterpartyId: cpId,
        fatcaStatus: "non-us-person",
        crsResidency: jurisdiction,
        classifiedAt: at(6),
        citations: ONBOARDING_CITES,
      },
    }),
  );

  emit(
    makeClientOnboardingPopiaConsentRecorded({
      asOf: at(7),
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      provenance,
      eventId: eid("popia"),
      payload: {
        counterpartyId: cpId,
        consentScope: ["onboarding", "trade-processing"],
        recordedAt: at(7),
        citations: ONBOARDING_CITES,
      },
    }),
  );

  emit(
    makeClientOnboardingCreditAssessed({
      asOf: at(8),
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      provenance,
      eventId: eid("credit"),
      payload: {
        counterpartyId: cpId,
        creditGrade: "A",
        exposureLimit: { currency: accountCurrency, amount: "100000000" },
        assessedAt: at(8),
        citations: ONBOARDING_CITES,
      },
    }),
  );

  emit(
    makeClientOnboardingAccountsSetup({
      asOf: at(9),
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      provenance,
      eventId: eid("accounts"),
      payload: {
        counterpartyId: cpId,
        accounts: [
          {
            accountId: `${cpId}:nostro:${accountCurrency}`,
            currency: accountCurrency,
            accountType: "nostro",
          },
        ],
        setupAt: at(9),
        citations: ONBOARDING_CITES,
      },
    }),
  );

  emit(
    makeClientOnboardingActivated({
      asOf: at(10),
      entity: ENTITY,
      actor: SIM_ACTOR,
      citations: CITATIONS,
      provenance,
      eventId: eid("activated"),
      payload: {
        counterpartyId: cpId,
        activatedAt: at(10),
        activatedBy: SIM_ACTOR.id,
        citations: ONBOARDING_CITES,
      },
    }),
  );

  // Append with a per-event dedup guard (replay-/crash-safe). Collect the
  // already-present event ids ONCE, then append only the missing ones; if the
  // terminal `activated` event already exists the whole lifecycle is a no-op.
  const existingIds = new Set<string>();
  for (const ev of store.replay()) existingIds.add(ev.event_id);
  for (const ev of events) {
    if (existingIds.has(ev.event_id)) continue;
    store.append(ev);
  }

  return "ClientOnboardingActivated";
}
