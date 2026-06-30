// platform/markets/fx/counterparty-residency.ts
//
// FX counterparty RESIDENCY classification for the SARB BA 325 reg-29(3)
// foreign-currency residency-segmented detail block (R0360–R0790).
//
// WHAT THIS IS: a deterministic, fail-closed map from an FX position's
// counterparty (the `economicTerms.counterpartyId` carried on each
// `FilInstrumentCreated` FX event) → its BA 325 residency bucket. The four
// buckets are the SARB Exchange Control / Reg 29(3) residency categories, read
// VERBATIM off the canonical BA 325 form (BA325.xsd / SARB-Return - BA325.xlsx):
//
//   • resident          — R0420 / R0560 / R0700 ("Residents")
//   • non-resident      — R0370 / R0510 / R0640 / R0710 ("Non-residents")
//   • authorised-dealer — R0450 / R0600 / R0650 / R0720 ("Authorised dealers")
//   • sarb              — R0460 / R0660 / R0730 ("S A Reserve Bank")
//
// WHY THIS IS BUILDABLE NOW (not licence-day-DATA-gated): residency truth
// already lives in the bank's event-sourced registers. The classifier sources
// it from the existing party register (`buildPartyProjection` → `jurisdictions`
// / `taxResidencies` / `classifications` / `kindAttributes.primaryRegulator`)
// and, for in-sim onboarded clients keyed by `urn:counterparty:client:*`, the
// client-onboarding register (`foldClientOnboardingRegister` → `jurisdiction` /
// `sector`). This is a FOLD / MAPPING problem provable today against the sim
// counterparty book — exactly as deposit `counterpartySector` was. The only
// deferral is the licence-day real-counterparty POPULATION (DATA), tracked as
// gap `ba325-reg29-fx-residency-detail`, never a blocker.
//
// DOMAIN-TRUTH ORACLE (ADC §20; a consistent-but-wrong result is a finding):
// the residency categories are validated against the EXTERNAL oracle — the SARB
// Currency & Exchanges Manual for Authorised Dealers + Reg 29(3) — not the
// bank's own record. The classification RULES below cite the Exchange-Control
// concept each maps to:
//   - An "Authorised Dealer" is a SA bank licensed by SARB to deal in foreign
//     exchange (Currency & Exchanges Manual §A.1). We recognise it as a
//     ZA-jurisdiction legal entity whose primary regulator is the PA — i.e. a
//     SARB/PA-licensed SA bank. (The SA bank licence IS the AD authority.)
//   - "Resident" / "Non-resident" is the Exchange-Control residency boundary
//     (Currency & Exchanges Manual §A.2; modelled by v2-core/finsurv/
//     bop-category.ts `crossBorder`): a party tax-resident / incorporated in ZA
//     is a resident; otherwise a non-resident.
//   - "S A Reserve Bank" is the central bank itself (party classification
//     `central-bank`).
//
// FAIL-CLOSED (Engineering Charter cmd 2): a counterparty that cannot be
// classified from either register yields an explicit `unmappable` result with a
// reason — NEVER a silent default bucket. The fold surfaces it as a loud gap,
// never folds an unmappable position into a real-looking residency line.
//
// PACKAGE BOUNDARY: lives in `platform/markets/fx/` (L2-FX territory). Imports
// only V2 canonical homes (party projection, client-onboarding register). Adds
// NO new field to the shared FIL events file — it reads the counterpartyId that
// already exists on the FX position.
//
// Authority: D-BA-RETURN-PER-PRODUCT-RICHNESS; D-BA-RETURN-SIMULATOR-FIRST;
//   D-FX-V2-SIMULATOR-FIRST; D-ENGINEERING-INTEGRITY-CHARTER;
//   Regulations Relating to Banks reg 29(3) (daily selected-risk: trading &
//   treasury — foreign-currency residency detail); SARB Currency & Exchanges
//   Manual for Authorised Dealers §A.1 / §A.2; SARB PA Directive D5/2025 §2.1.14
//   (form BA 325, Annexure 13A/13B).
// Author: Bea (Accounting & financial reporting engineer, engineering — reports
//   to Camille CFO; BA-form line-mapping owner).

import type { Ba325ResidencyBucket, PartyId } from "../../../domains/party";
import {
  type ClientOnboardingRegister,
  foldClientOnboardingRegister,
} from "../../../v2-core/client-onboarding";
import type { EventStore } from "../../event-store/store";
import {
  type PartyProjection,
  type PartyRecord,
  buildPartyProjection,
} from "../../identity/party-projection";

// ---------------------------------------------------------------------------
// Residency bucket — the four SARB BA 325 reg-29(3) residency categories.
// VERBATIM off the canonical form row labels. This is the canonical axis; the
// fold maps each axis member onto its row set.
// ---------------------------------------------------------------------------

/**
 * The SARB BA 325 reg-29(3) counterparty-residency buckets (Exchange Control /
 * Reg 29(3) categories). Each value names a form row group.
 *
 * Canonical definition lives in `domains/party/types.ts`.
 * Re-exported here for backward compatibility — new code should import from
 * `domains/party`. Authority: D-BA-RETURN-CELL-VALUE-ENGINE Phase 3.
 */
export type { Ba325ResidencyBucket } from "../../../domains/party";
export { BA325_RESIDENCY_BUCKETS } from "../../../domains/party";

/** Human-facing label for each bucket (matches the BA 325 row labels). */
export const BA325_RESIDENCY_BUCKET_LABEL: Readonly<Record<Ba325ResidencyBucket, string>> = {
  resident: "Residents",
  "non-resident": "Non-residents",
  "authorised-dealer": "Authorised dealers",
  sarb: "S A Reserve Bank",
};

// ---------------------------------------------------------------------------
// Classification result — present (a bucket + lineage) or unmappable (a reason).
// ---------------------------------------------------------------------------

/** A successfully classified counterparty. */
export interface ResidencyClassified {
  readonly classified: true;
  readonly counterpartyId: string;
  readonly bucket: Ba325ResidencyBucket;
  /** The register + attribute the bucket was derived from (Principle 2 lineage). */
  readonly lineage: string;
}

/** A counterparty that could NOT be classified (fail-closed; loud, never silent). */
export interface ResidencyUnmappable {
  readonly classified: false;
  readonly counterpartyId: string;
  /** Why classification failed (which registers were consulted, what was missing). */
  readonly reason: string;
}

export type ResidencyClassification = ResidencyClassified | ResidencyUnmappable;

// ---------------------------------------------------------------------------
// Counterparty descriptive detail — the human-facing granularity Marc asked be
// VISIBLE on the FX blotter (legal name / jurisdiction-domicile / sector)
// ALONGSIDE the BA-325 residency bucket. Sourced from the SAME two registers the
// residency classifier reads (party register + onboarding register) — no new
// capture, no hardcoding. The counterparty LEGAL NAME is surfaced (the
// name-free policy is about AGENT/persona names, NOT counterparties — feedback
// no-agent-names-in-ui / D-V2-UI-OVERSIGHT-STANDARD). Every field is OPTIONAL:
// when a register carries no value the caller renders "—", never a fabricated
// default (Engineering Charter cmd 2).
// ---------------------------------------------------------------------------

/**
 * Descriptive counterparty detail for the FX surface, paired with the residency
 * classification. The `residency` carries the fail-closed bucket-or-reason; the
 * descriptive fields are best-effort lineage off the same registers.
 */
export interface CounterpartyDetail {
  readonly counterpartyId: string;
  /** Counterparty legal/display name (party register, else onboarding). */
  readonly legalName: string | null;
  /** Jurisdiction / domicile (tax-residency basis preferred, else incorporation). */
  readonly jurisdiction: string | null;
  /** Business sector (onboarding sector, else a party-classification-derived note). */
  readonly sector: string | null;
  /** The BA-325 residency classification (bucket + lineage, or unmappable reason). */
  readonly residency: ResidencyClassification;
}

// ---------------------------------------------------------------------------
// The residency oracle — wraps the two source registers behind one classifier.
// ---------------------------------------------------------------------------

/** ISO-3166 alpha-2 code for the bank's home jurisdiction (the residency anchor). */
const HOME_JURISDICTION = "ZA";

/** The party classification value that identifies the central bank (SARB). */
const CENTRAL_BANK_CLASSIFICATION = "central-bank";

/**
 * The primary-regulator value that, on a home-jurisdiction legal entity,
 * identifies a SARB/PA-licensed SA bank — i.e. an Exchange-Control Authorised
 * Dealer (Currency & Exchanges Manual §A.1: an AD is a SA bank licensed to deal
 * in foreign exchange).
 */
const AUTHORISED_DEALER_REGULATOR = "PA";

/**
 * A residency oracle built over the bank's event-sourced registers. Construct it
 * ONCE (it folds the party + onboarding registers) and classify many
 * counterparties against it. Pure with respect to the supplied snapshots — it
 * reads them, never the store.
 */
export interface ResidencyOracle {
  /** Classify one counterparty id → residency bucket (fail-closed). */
  classify(counterpartyId: string): ResidencyClassification;
  /**
   * Resolve the full descriptive detail (legal name / jurisdiction / sector) for
   * a counterparty, paired with its residency classification. Reads the SAME two
   * registers as {@link classify}; descriptive fields are best-effort (null when
   * a register carries no value — never fabricated). The residency field carries
   * the fail-closed bucket-or-reason exactly as {@link classify} returns.
   */
  classifyDetail(counterpartyId: string): CounterpartyDetail;
}

/**
 * Decide whether a jurisdiction list / tax-residency list marks the party as a
 * SA resident. A party is a RESIDENT when its tax-residency (preferred, the
 * Exchange-Control residency basis) — or, absent that, its jurisdiction of
 * incorporation — includes ZA.
 *
 * Returns:
 *   - `"resident"`     when ZA is present
 *   - `"non-resident"` when a non-empty list excludes ZA
 *   - `null`           when there is NO residency evidence at all (fail-closed —
 *                      the caller must not guess)
 */
export function residencyFromLists(
  taxResidencies: readonly string[] | undefined,
  jurisdictions: readonly string[] | undefined,
): "resident" | "non-resident" | null {
  // Prefer tax-residency (the Exchange-Control residency concept); fall back to
  // jurisdiction of incorporation when tax-residency is not recorded.
  const primary = taxResidencies && taxResidencies.length > 0 ? taxResidencies : undefined;
  const fallback = jurisdictions && jurisdictions.length > 0 ? jurisdictions : undefined;
  const basis = primary ?? fallback;
  if (!basis) return null;
  return basis.includes(HOME_JURISDICTION) ? "resident" : "non-resident";
}

/**
 * Classify a counterparty from a party-register record. Returns a bucket or
 * `null` when the party record carries no usable residency evidence (the caller
 * then tries the onboarding register before failing closed).
 */
function classifyFromParty(
  party: PartyRecord,
): { bucket: Ba325ResidencyBucket; lineage: string } | null {
  // 1. Central bank (SARB) — highest precedence: a party classified central-bank
  //    is the SARB bucket regardless of jurisdiction.
  if (party.classifications.includes(CENTRAL_BANK_CLASSIFICATION)) {
    return {
      bucket: "sarb",
      lineage: `party-register classifications include '${CENTRAL_BANK_CLASSIFICATION}' (SARB)`,
    };
  }

  const residency = residencyFromLists(party.taxResidencies, party.jurisdictions);

  // 2. Authorised Dealer — a HOME-jurisdiction (resident) legal entity whose
  //    primary regulator is the PA (a SARB/PA-licensed SA bank = an AD per the
  //    Currency & Exchanges Manual §A.1). A non-resident bank is NOT a SA AD.
  if (
    residency === "resident" &&
    party.kindAttributes.kind === "legal-entity" &&
    party.kindAttributes.primaryRegulator === AUTHORISED_DEALER_REGULATOR
  ) {
    return {
      bucket: "authorised-dealer",
      lineage: `party-register: ${HOME_JURISDICTION}-resident legal-entity, primaryRegulator='${AUTHORISED_DEALER_REGULATOR}' (SARB/PA-licensed SA bank = Authorised Dealer, Currency & Exchanges Manual §A.1)`,
    };
  }

  // 3. Resident / non-resident from the residency basis.
  if (residency === "resident") {
    return {
      bucket: "resident",
      lineage: "party-register: ZA tax-residency / jurisdiction (resident)",
    };
  }
  if (residency === "non-resident") {
    return {
      bucket: "non-resident",
      lineage: "party-register: tax-residency / jurisdiction excludes ZA (non-resident)",
    };
  }

  return null;
}

/**
 * Classify a counterparty from an onboarding-register record (the in-sim
 * onboarded client path, keyed by `urn:counterparty:client:*`). The onboarding
 * record carries `jurisdiction` (residency basis) and `sector` (banking ⇒ a
 * bank). A home-jurisdiction bank onboarded as a market counterparty is an
 * Authorised Dealer; a foreign client is a non-resident; a home corporate is a
 * resident.
 */
function classifyFromOnboarding(record: {
  readonly jurisdiction: string | undefined;
  readonly sector: string | undefined;
}): { bucket: Ba325ResidencyBucket; lineage: string } | null {
  const jurisdiction = record.jurisdiction;
  if (!jurisdiction) return null;
  const residency = jurisdiction === HOME_JURISDICTION ? "resident" : "non-resident";

  if (residency === "resident" && record.sector === "banking") {
    return {
      bucket: "authorised-dealer",
      lineage: `onboarding-register: ${HOME_JURISDICTION}-jurisdiction banking-sector client (SA bank = Authorised Dealer, Currency & Exchanges Manual §A.1)`,
    };
  }
  if (residency === "resident") {
    return {
      bucket: "resident",
      lineage: `onboarding-register: ${HOME_JURISDICTION} jurisdiction (resident)`,
    };
  }
  return {
    bucket: "non-resident",
    lineage: `onboarding-register: jurisdiction '${jurisdiction}' (non-resident)`,
  };
}

/**
 * Build a residency oracle from supplied register snapshots. Prefer
 * {@link buildResidencyOracle} (which folds the store); this overload accepts
 * pre-folded snapshots for callers that already hold them (and for tests).
 */
export function makeResidencyOracle(
  party: PartyProjection,
  onboarding: ClientOnboardingRegister,
): ResidencyOracle {
  // Shared register lookups so `classify` and `classifyDetail` read the SAME
  // sources (no drift). The party register is keyed by `urn:party:*` URNs.
  const partyRecordFor = (counterpartyId: string): PartyRecord | undefined =>
    counterpartyId.startsWith("urn:party:")
      ? party.parties.get(counterpartyId as PartyId)
      : undefined;

  const oracle: ResidencyOracle = {
    classify(counterpartyId: string): ResidencyClassification {
      if (!counterpartyId) {
        return {
          classified: false,
          counterpartyId,
          reason: "empty counterpartyId — the FX position carries no counterparty to classify",
        };
      }

      // Party register is the primary, oracle-aligned residency source.
      const partyRecord = partyRecordFor(counterpartyId);
      if (partyRecord) {
        const fromParty = classifyFromParty(partyRecord);
        if (fromParty) {
          return {
            classified: true,
            counterpartyId,
            bucket: fromParty.bucket,
            lineage: fromParty.lineage,
          };
        }
      }

      // Onboarding register — the in-sim onboarded client path.
      const onboardingRecord = onboarding.getClient(counterpartyId);
      if (onboardingRecord) {
        const fromOnboarding = classifyFromOnboarding(onboardingRecord);
        if (fromOnboarding) {
          return {
            classified: true,
            counterpartyId,
            bucket: fromOnboarding.bucket,
            lineage: fromOnboarding.lineage,
          };
        }
      }

      // Fail-closed: neither register classifies the counterparty.
      const consulted = [
        partyRecord
          ? "party-register (found, no residency evidence)"
          : "party-register (not found)",
        onboardingRecord
          ? "onboarding-register (found, no jurisdiction)"
          : "onboarding-register (not found)",
      ].join("; ");
      return {
        classified: false,
        counterpartyId,
        reason: `counterparty '${counterpartyId}' could not be classified to a BA 325 residency bucket. Consulted: ${consulted}. Register the party with a jurisdiction/tax-residency (and primaryRegulator for an Authorised Dealer) before its FX positions can fold into the reg-29(3) residency detail.`,
      };
    },

    classifyDetail(counterpartyId: string): CounterpartyDetail {
      const residency = this.classify(counterpartyId);
      const partyRecord = partyRecordFor(counterpartyId);
      const onboardingRecord = onboarding.getClient(counterpartyId);

      // Legal name — party register first (legalName, else displayName), then
      // the onboarding register's legalName. Null when neither carries one.
      const legalName =
        partyRecord?.legalName ?? partyRecord?.displayName ?? onboardingRecord?.legalName ?? null;

      // Jurisdiction / domicile — the Exchange-Control residency basis preferred
      // (tax-residency), else jurisdiction of incorporation, else the onboarding
      // jurisdiction. First entry only (the domicile axis is single-valued in the
      // BA-325 sense).
      const jurisdiction =
        partyRecord?.taxResidencies?.[0] ??
        partyRecord?.jurisdictions?.[0] ??
        onboardingRecord?.jurisdiction ??
        null;

      // Sector — the onboarding sector is the closed-vocabulary business kind;
      // absent that, derive a descriptive note from a party classification
      // (e.g. central-bank) or the legal-entity primary regulator. Never guessed.
      let sector: string | null = onboardingRecord?.sector ?? null;
      if (sector === null && partyRecord) {
        if (partyRecord.classifications.includes(CENTRAL_BANK_CLASSIFICATION)) {
          sector = "central-bank";
        } else if (
          partyRecord.kindAttributes.kind === "legal-entity" &&
          partyRecord.kindAttributes.primaryRegulator === AUTHORISED_DEALER_REGULATOR
        ) {
          sector = "banking";
        }
      }

      return { counterpartyId, legalName, jurisdiction, sector, residency };
    },
  };

  return oracle;
}

/**
 * Build a residency oracle by folding the party + onboarding registers from the
 * event store. The canonical entry point for the BA 325 reg-29 fold.
 */
export function buildResidencyOracle(eventStore: EventStore, asOf?: string): ResidencyOracle {
  const party = buildPartyProjection(eventStore, asOf);
  // Fold the onboarding register from the store's onboarding-family events.
  const onboarding = foldClientOnboardingRegister(
    (function* () {
      for (const ev of eventStore.replay()) {
        yield { kind: ev.type, payload: ev.payload, asOf: ev.as_of };
      }
    })(),
  );
  return makeResidencyOracle(party, onboarding);
}
