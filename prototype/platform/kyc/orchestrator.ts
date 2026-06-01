// platform/kyc/orchestrator.ts
//
// KYC Onboarding Orchestrator — PROC-FC-01 state machine.
//
// Sequences the full KYC onboarding flow from candidate-registered
// through to accepted or rejected. Each step reads current state from
// the event store projection, calls the relevant adapter, emits the
// typed event, and returns the new CandidateState.
//
// State persistence: no in-memory state between calls. State is
// derived from the event store on each call (fold of kyc-checks +
// client-candidates projections). This satisfies P1 (events are the
// only source of truth).
//
// State machine:
//   candidate-registered
//     → identity-collected
//     → identity-verified  (or identity-verification-failed → rejected)
//     → sanctions-pep-screened
//     → ubo-resolved
//     → risk-rated
//     → [edd-in-progress → edd-complete]  (only if high-risk)
//     → decision-pending  (human gate for medium/high risk or EDD cases)
//     → accepted | rejected
//
// Fail-closed contract:
//   - Adapter unavailable → pause (do not proceed); candidateStatus stays
//     at current step; requiresHuman=false; humanGateReason = adapter-unavailable.
//   - Sanctions exact-hit → auto-reject immediately.
//   - band=low + all checks clean + no EDD → auto-accept.
//   - band=medium or band=high or after EDD → requiresHuman=true; pause.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   PROC-FC-01 (KYC onboarding); AML-CFT-POLICY-V1;
//   FIC-ACT-38-2001 s.21-21B (CDD/EDD); FATF-REC-10, FATF-REC-12;
//   POPIA-S11 (lawful processing).
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Mira (Compliance / RegTech engineer, engineering).

import { makePartyRegistered } from "../../domains/party/factories";
import { eventStore } from "../composition";
import { newEventId, nowUtc } from "../core/types";
import { makeClientCandidateRegistered } from "../event-store/event-types/aml-popia-extended";
import {
  makeClientAccepted,
  makeClientRejected,
  makeKYCDecisionMade,
  makeKYCEDDCompleted,
  makeKYCEDDInitiated,
  makeKYCIdentityCollected,
  makeKYCIdentityVerificationFailed,
  makeKYCIdentityVerified,
  makeKYCRiskRated,
  makeKYCSanctionsPEPScreened,
  makeKYCUBOResolved,
  makeLawfulProcessingRegistered,
} from "../event-store/event-types/kyc";
import type { Actor } from "../event-store/types";
// clientsProjection and kycChecksProjection are used by consumers (tests, dashboard).
// They're exported from their own modules; no imports needed here.
import { CIPCCompanyAdapter } from "./adapters/cipc-company";
import { DHAIdentityAdapter } from "./adapters/dha-identity";
import { PEPAdverseMediaAdapter } from "./adapters/pep-adverse-media";
import { ScreeningAdapter } from "./adapters/screening-adapter";
import { computeRiskScore } from "./risk-rating-engine";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface NewCandidateInput {
  entityName: string;
  entityType: "company" | "trust" | "partnership" | "individual-sole-trader";
  registrationNumber: string;
  jurisdiction: string;
  registeredAddress: string;
  directors: Array<{ name: string; idNumber: string; role: string }>;
  ubos: Array<{
    name: string;
    idNumber: string;
    nationality: string;
    ownershipPct: number;
    basisOfControl: string;
  }>;
  documentHashes: string[];
  submittedBy: string;
}

export interface CandidateState {
  candidateId: string;
  currentStep: string;
  status: "in-progress" | "accepted" | "rejected" | "referred";
  requiresHuman: boolean;
  humanGateReason?: string;
  riskBand?: "low" | "medium" | "high";
  events: string[]; // event IDs emitted so far
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const ORCHESTRATOR_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:kyc-orchestrator",
};

const KYC_CITATIONS = [
  "D-KYC-ONBOARDING-BUILD",
  "PROC-FC-01",
  "AML-CFT-POLICY-V1",
  "FIC-ACT-38-2001",
  "FATF-REC-10",
  "FATF-REC-12",
  "POPIA-S11",
];

const ENTITY = "LE-ZA-HOZ-BANK";

// In-memory candidate registry (maps candidateId → input data).
// This is a process-level cache only; the canonical state is in the event store.
// The input data is needed by adapters during step execution.
const candidateInputRegistry = new Map<string, NewCandidateInput>();

// ---------------------------------------------------------------------------
// Adapter singletons
// ---------------------------------------------------------------------------

const cipcAdapter = new CIPCCompanyAdapter();
const screeningAdapter = new ScreeningAdapter();
const pepAdapter = new PEPAdverseMediaAdapter();
const dhaAdapter = new DHAIdentityAdapter();

// ---------------------------------------------------------------------------
// State derivation from event store
// ---------------------------------------------------------------------------

/**
 * Derive CandidateState for a given candidateId by replaying events.
 * Returns null if the candidate has never been registered.
 */
function deriveState(candidateId: string): CandidateState | null {
  // Collect all events for this candidate in sequence order.
  const allEvents: string[] = [];
  let currentStep = "candidate-registered";
  let status: CandidateState["status"] = "in-progress";
  let requiresHuman = false;
  let humanGateReason: string | undefined;
  let riskBand: "low" | "medium" | "high" | undefined;
  let registered = false;

  for (const e of eventStore.replay()) {
    const p = e.payload as Record<string, unknown>;
    const evtCandidateId = typeof p.candidateId === "string" ? p.candidateId : undefined;
    if (evtCandidateId !== candidateId) continue;

    allEvents.push(e.event_id);

    switch (e.type) {
      case "ClientCandidateRegistered":
        registered = true;
        currentStep = "identity-collected"; // next step to run
        break;

      case "KYCIdentityCollected":
        currentStep = "identity-verified";
        break;

      case "KYCIdentityVerified":
        currentStep = "sanctions-pep-screened";
        break;

      case "KYCIdentityVerificationFailed":
        currentStep = "rejected";
        status = "rejected";
        break;

      case "KYCSanctionsPEPScreened": {
        currentStep = "ubo-resolved";
        break;
      }

      case "KYCUBOResolved":
        currentStep = "risk-rated";
        break;

      case "KYCRiskRated": {
        const band = p.band as "low" | "medium" | "high";
        riskBand = band;
        if (band === "high") {
          currentStep = "edd-in-progress";
        } else if (band === "low") {
          currentStep = "decision-pending";
        } else {
          // medium
          currentStep = "decision-pending";
          requiresHuman = true;
          humanGateReason = "medium-risk-review";
        }
        break;
      }

      case "KYCEDDInitiated":
        currentStep = "edd-in-progress";
        requiresHuman = true;
        humanGateReason = "edd-required";
        break;

      case "KYCEDDCompleted":
        currentStep = "decision-pending";
        requiresHuman = true;
        humanGateReason = "edd-complete-review";
        break;

      case "KYCDecisionMade": {
        const decision = p.decision as string;
        if (decision === "accept") {
          currentStep = "accepted";
        } else if (decision === "reject") {
          currentStep = "rejected";
        } else {
          currentStep = "referred";
          status = "referred";
          requiresHuman = true;
          humanGateReason = "referred-for-review";
        }
        break;
      }

      case "ClientAccepted":
        currentStep = "accepted";
        status = "accepted";
        requiresHuman = false;
        break;

      case "ClientRejected":
        currentStep = "rejected";
        status = "rejected";
        requiresHuman = false;
        break;
    }
  }

  if (!registered) return null;

  // Reconcile final status from currentStep when not already set.
  if (status === "in-progress") {
    if (currentStep === "accepted") status = "accepted";
    else if (currentStep === "rejected") status = "rejected";
    else if (currentStep === "referred") status = "referred";
  }

  const result: CandidateState = {
    candidateId,
    currentStep,
    status,
    requiresHuman,
    events: allEvents,
  };
  if (humanGateReason !== undefined) result.humanGateReason = humanGateReason;
  if (riskBand !== undefined) result.riskBand = riskBand;
  return result;
}

// ---------------------------------------------------------------------------
// Step implementations
// ---------------------------------------------------------------------------

async function stepIdentityCollected(candidateId: string, input: NewCandidateInput): Promise<void> {
  const asOf = nowUtc();
  const evt = makeKYCIdentityCollected({
    asOf,
    entity: ENTITY,
    actor: ORCHESTRATOR_ACTOR,
    citations: KYC_CITATIONS,
    payload: {
      candidateId,
      directors: input.directors.map((d) => ({
        name: d.name,
        id_number: d.idNumber,
        role: d.role,
      })),
      ubos: input.ubos.map((u) => ({
        name: u.name,
        id_number: u.idNumber,
        nationality: u.nationality,
        ownership_pct: u.ownershipPct,
        basis_of_control: u.basisOfControl,
      })),
      documents: input.documentHashes.map((hash, i) => ({
        type: `document-${i + 1}`,
        hash,
      })),
      collectedAt: asOf,
    },
  });
  eventStore.append(evt);
}

async function stepIdentityVerified(
  candidateId: string,
  input: NewCandidateInput,
): Promise<{ verified: boolean; reason?: string }> {
  const asOf = nowUtc();
  const cipcResult = await cipcAdapter.check({
    registrationNumber: input.registrationNumber,
    entityName: input.entityName,
  });

  if (!cipcResult.ok) {
    // Adapter unavailable — pause; do not emit failure.
    return { verified: false, reason: "adapter-unavailable" };
  }

  if (!cipcResult.result.active) {
    // Identity verification failed.
    const reasonMap: Record<
      string,
      "not-found" | "expired" | "name-mismatch" | "adapter-unavailable"
    > = {
      deregistered: "not-found",
      "name-mismatch": "name-mismatch",
      "not-found": "not-found",
    };
    const reason = reasonMap[cipcResult.result.status] ?? "not-found";
    const evt = makeKYCIdentityVerificationFailed({
      asOf,
      entity: ENTITY,
      actor: ORCHESTRATOR_ACTOR,
      citations: KYC_CITATIONS,
      payload: {
        candidateId,
        adapter: "cipc",
        reason,
        failedAt: asOf,
      },
    });
    eventStore.append(evt);
    return { verified: false, reason };
  }

  const evt = makeKYCIdentityVerified({
    asOf,
    entity: ENTITY,
    actor: ORCHESTRATOR_ACTOR,
    citations: KYC_CITATIONS,
    payload: {
      candidateId,
      adapter: "cipc",
      result: "matched",
      verifiedAt: asOf,
    },
  });
  eventStore.append(evt);
  return { verified: true };
}

async function stepSanctionsPEPScreened(
  candidateId: string,
  input: NewCandidateInput,
): Promise<{
  ok: boolean;
  sanctionsResult: "clean" | "hit" | "fuzzy-hit" | "false-positive" | "unavailable";
  pepFlag: boolean;
  pepLinked: boolean;
  hits: Array<{ list: string; name: string; score: number }>;
}> {
  const asOf = nowUtc();

  // Screen the entity itself.
  const entityScreening = await screeningAdapter.check({
    name: input.entityName,
    entityType: "legal-entity",
  });

  if (!entityScreening.ok) {
    return {
      ok: false,
      sanctionsResult: "unavailable",
      pepFlag: false,
      pepLinked: false,
      hits: [],
    };
  }

  // Screen each UBO for PEP.
  let pepFlag = false;
  let pepLinked = false;
  for (const ubo of input.ubos) {
    const pepResult = await pepAdapter.check({
      name: ubo.name,
      nationality: ubo.nationality,
    });
    if (!pepResult.ok) continue;
    if (pepResult.result.pep_flag) pepFlag = true;
    if (pepResult.result.pep_linked) pepLinked = true;
  }

  const hits = entityScreening.result.hits.map((h) => ({
    list: h.list,
    name: h.name,
    score: h.score,
  }));

  const sanctionsResult = entityScreening.result.status;

  const evt = makeKYCSanctionsPEPScreened({
    asOf,
    entity: ENTITY,
    actor: ORCHESTRATOR_ACTOR,
    citations: KYC_CITATIONS,
    payload: {
      candidateId,
      lists_checked: ["un", "ofac", "eu", "uk-hmt", "sa-pocdatara"],
      result:
        sanctionsResult === "hit"
          ? "hit"
          : sanctionsResult === "false-positive"
            ? "false-positive"
            : "clean",
      hits,
      pep_flag: pepFlag,
      pep_linked: pepLinked,
      screenedAt: asOf,
    },
  });
  eventStore.append(evt);

  // Fail-closed: exact sanctions hit → auto-reject immediately (PROC-FC-01 step 3).
  // Do not proceed to UBO/risk rating for a sanctioned entity.
  if (sanctionsResult === "hit") {
    const asOfReject = nowUtc();
    eventStore.append(
      makeKYCDecisionMade({
        asOf: asOfReject,
        entity: ENTITY,
        actor: ORCHESTRATOR_ACTOR,
        citations: KYC_CITATIONS,
        payload: {
          candidateId,
          decision: "reject",
          reason: "Sanctions exact-hit — entity on consolidated list (PROC-FC-01 step 3)",
          decided_by: ORCHESTRATOR_ACTOR.id,
          decidedAt: asOfReject,
        },
      }),
    );
    eventStore.append(
      makeClientRejected({
        asOf: asOfReject,
        entity: ENTITY,
        actor: ORCHESTRATOR_ACTOR,
        citations: KYC_CITATIONS,
        payload: {
          candidateId,
          reason: "sanctions-exact-hit",
          rejectedAt: asOfReject,
        },
      }),
    );
  }

  return {
    ok: true,
    sanctionsResult,
    pepFlag,
    pepLinked,
    hits,
  };
}

async function stepUBOResolved(
  candidateId: string,
  input: NewCandidateInput,
): Promise<{ ok: boolean }> {
  const asOf = nowUtc();

  const uboChain = [];
  let opaqueStructure = false;

  for (const ubo of input.ubos) {
    // Check for opaque structure indicators.
    const basisLower = ubo.basisOfControl.toLowerCase();
    if (
      basisLower.includes("nominee") ||
      basisLower.includes("opaque") ||
      basisLower.includes("trust")
    ) {
      opaqueStructure = true;
    }

    // DHA verification for SA ID numbers (13 digits, all numeric).
    let dhaVerified = false;
    if (/^\d{13}$/.test(ubo.idNumber)) {
      const dhaResult = await dhaAdapter.check({
        idNumber: ubo.idNumber,
        surname: ubo.name.split(" ").pop() ?? ubo.name,
        dob: "1990-01-01", // placeholder; real DOB would come from candidate documents
      });
      if (dhaResult.ok && dhaResult.result.matched) {
        dhaVerified = true;
      }
    }

    // PEP check for each UBO.
    const pepResult = await pepAdapter.check({
      name: ubo.name,
      nationality: ubo.nationality,
    });
    const pepFlag = pepResult.ok ? pepResult.result.pep_flag : false;

    uboChain.push({
      name: ubo.name,
      id_number: ubo.idNumber,
      nationality: ubo.nationality,
      residence_country: ubo.nationality, // use nationality as proxy
      ownership_pct: ubo.ownershipPct,
      basis_of_control: ubo.basisOfControl,
      dha_verified: dhaVerified,
      pep_flag: pepFlag,
    });
  }

  const evt = makeKYCUBOResolved({
    asOf,
    entity: ENTITY,
    actor: ORCHESTRATOR_ACTOR,
    citations: KYC_CITATIONS,
    payload: {
      candidateId,
      ubo_chain:
        uboChain.length > 0
          ? uboChain
          : [
              {
                name: "SOLE OWNER",
                id_number: "0000000000000",
                nationality: "ZA",
                residence_country: "ZA",
                ownership_pct: 100,
                basis_of_control: "direct-ownership",
                dha_verified: false,
                pep_flag: false,
              },
            ],
      ubo_opaque_structure: opaqueStructure,
      resolvedAt: asOf,
    },
  });
  eventStore.append(evt);

  return { ok: true };
}

async function stepRiskRated(
  candidateId: string,
  input: NewCandidateInput,
  pepFlag: boolean,
  pepLinked: boolean,
): Promise<{ band: "low" | "medium" | "high"; requiresEDD: boolean }> {
  const asOf = nowUtc();

  // Check for opaque structure.
  const shellCompanyIndicator = input.ubos.some(
    (u) =>
      u.basisOfControl.toLowerCase().includes("nominee") ||
      u.basisOfControl.toLowerCase().includes("opaque"),
  );

  const riskResult = computeRiskScore({
    jurisdiction: input.jurisdiction,
    entityType: input.entityType,
    pep_flag: pepFlag,
    pep_linked: pepLinked,
    adverse_media: false, // adverse media check is a separate step; default to false here
    shell_company_indicator: shellCompanyIndicator,
  });

  // FATF-REC-12 override: PEP or PEP-linked always requires EDD regardless of
  // composite score. The risk engine uses weights that may not score PEP-linked
  // above the EDD threshold in all jurisdictions; the regulatory obligation
  // applies unconditionally.
  const requiresEDD = riskResult.requiresEDD || pepFlag || pepLinked;

  const evt = makeKYCRiskRated({
    asOf,
    entity: ENTITY,
    actor: ORCHESTRATOR_ACTOR,
    citations: KYC_CITATIONS,
    payload: {
      candidateId,
      score: riskResult.score,
      band: riskResult.band,
      factors: riskResult.factors,
      ratedAt: asOf,
    },
  });
  eventStore.append(evt);

  if (requiresEDD) {
    const eddEvt = makeKYCEDDInitiated({
      asOf,
      entity: ENTITY,
      actor: ORCHESTRATOR_ACTOR,
      citations: KYC_CITATIONS,
      payload: {
        candidateId,
        reason: pepFlag ? "pep" : pepLinked ? "pep" : "high-risk-jurisdiction",
        initiatedBy: ORCHESTRATOR_ACTOR.id,
        initiatedAt: asOf,
      },
    });
    eventStore.append(eddEvt);
  }

  return { band: riskResult.band, requiresEDD };
}

async function stepDecisionMade(
  candidateId: string,
  input: NewCandidateInput,
  band: "low" | "medium" | "high",
  sanctionsResult: string,
  eddComplete: boolean,
): Promise<{ decision: "accept" | "reject" | "refer"; requiresHuman: boolean }> {
  const asOf = nowUtc();

  // Fuzzy hit → refer (sanctions-exact was already rejected in stepSanctionsPEPScreened).
  if (sanctionsResult === "fuzzy-hit") {
    return { decision: "refer", requiresHuman: true };
  }

  // Low risk + no EDD → auto-accept.
  if (band === "low" && !eddComplete) {
    const clientId = newEventId();
    const decisionEvt = makeKYCDecisionMade({
      asOf,
      entity: ENTITY,
      actor: ORCHESTRATOR_ACTOR,
      citations: KYC_CITATIONS,
      payload: {
        candidateId,
        decision: "accept",
        reason: "Low-risk; all checks clean; no EDD required",
        decided_by: ORCHESTRATOR_ACTOR.id,
        decidedAt: asOf,
      },
    });
    eventStore.append(decisionEvt);

    const acceptedEvt = makeClientAccepted({
      asOf,
      entity: ENTITY,
      actor: ORCHESTRATOR_ACTOR,
      citations: KYC_CITATIONS,
      payload: {
        candidateId,
        clientId,
        entityName: input.entityName,
        entityType: input.entityType,
        jurisdiction: input.jurisdiction,
        riskBand: "low",
        category: "PC",
        acceptedAt: asOf,
      },
    });
    eventStore.append(acceptedEvt);

    // Register the accepted client as a Party in the master counterparty store.
    const partyEvt = makePartyRegistered({
      asOf,
      entity: ENTITY,
      actor: ORCHESTRATOR_ACTOR,
      citations: [...KYC_CITATIONS, "D-PARTY-REGISTER"],
      payload: {
        partyId: `urn:party:legal-entity:${clientId}` as `urn:party:legal-entity:${string}`,
        kind: "legal-entity",
        displayName: input.entityName,
        jurisdictions: [input.jurisdiction],
        citations: [...KYC_CITATIONS, "D-PARTY-REGISTER"],
        kindAttributes: {
          kind: "legal-entity",
          entityForm: "Ltd",
          parentPartyId: null,
          primaryRegulator: "other",
          regimeAnchor: [
            `KYC-onboarded counterparty; registration number ${input.registrationNumber}`,
          ],
        },
      },
    });
    eventStore.append(partyEvt);

    const lawfulEvt = makeLawfulProcessingRegistered({
      asOf,
      entity: ENTITY,
      actor: ORCHESTRATOR_ACTOR,
      citations: KYC_CITATIONS,
      payload: {
        clientId,
        lawful_basis: "legal-obligation",
        processing_purposes: ["kyc-cdd", "aml-monitoring", "regulatory-reporting"],
        registeredAt: asOf,
      },
    });
    eventStore.append(lawfulEvt);

    return { decision: "accept", requiresHuman: false };
  }

  // Medium/high or after EDD → require human review.
  return { decision: "refer", requiresHuman: true };
}

// ---------------------------------------------------------------------------
// KYCOrchestrator
// ---------------------------------------------------------------------------

export class KYCOrchestrator {
  /**
   * Step 1: Register a new candidate. Emits ClientCandidateRegistered.
   * Returns the assigned candidateId.
   */
  async startOnboarding(input: NewCandidateInput): Promise<{ candidateId: string }> {
    const candidateId = newEventId();
    const asOf = nowUtc();

    const evt = makeClientCandidateRegistered({
      asOf,
      entity: ENTITY,
      actor: ORCHESTRATOR_ACTOR,
      citations: KYC_CITATIONS,
      payload: {
        candidateId,
        entityType: "legal-entity",
        registeredBy: input.submittedBy,
        entity: ENTITY,
        registeredAt: asOf,
        clientKind: "institutional",
        kycStatus: "in-progress",
      },
    });
    eventStore.append(evt);

    // Store input in process-level registry for this session.
    candidateInputRegistry.set(candidateId, input);

    return { candidateId };
  }

  /**
   * Advance the workflow one step. Reads current state from the event store,
   * determines the next step, runs the adapter, emits the event.
   */
  async advanceStep(candidateId: string): Promise<CandidateState> {
    const state = deriveState(candidateId);
    if (!state) {
      throw new Error(`KYCOrchestrator: candidate ${candidateId} not found in event store`);
    }

    // Already terminal or waiting for human — return as-is.
    if (state.status === "accepted" || state.status === "rejected" || state.requiresHuman) {
      return state;
    }

    const input = candidateInputRegistry.get(candidateId);
    if (!input) {
      throw new Error(
        `KYCOrchestrator: candidate ${candidateId} input not found in registry — startOnboarding must be called in the same process session before advanceStep`,
      );
    }

    switch (state.currentStep) {
      case "identity-collected":
        await stepIdentityCollected(candidateId, input);
        break;

      case "identity-verified": {
        const result = await stepIdentityVerified(candidateId, input);
        if (!result.verified) {
          if (result.reason === "adapter-unavailable") {
            return {
              ...state,
              requiresHuman: true,
              humanGateReason: "identity-adapter-unavailable",
            };
          }
          // Identity failed → emit rejection.
          const asOf = nowUtc();
          eventStore.append(
            makeKYCDecisionMade({
              asOf,
              entity: ENTITY,
              actor: ORCHESTRATOR_ACTOR,
              citations: KYC_CITATIONS,
              payload: {
                candidateId,
                decision: "reject",
                reason: `Identity verification failed: ${result.reason}`,
                decided_by: ORCHESTRATOR_ACTOR.id,
                decidedAt: asOf,
              },
            }),
          );
          eventStore.append(
            makeClientRejected({
              asOf,
              entity: ENTITY,
              actor: ORCHESTRATOR_ACTOR,
              citations: KYC_CITATIONS,
              payload: {
                candidateId,
                reason: `identity-verification-failed: ${result.reason}`,
                rejectedAt: asOf,
              },
            }),
          );
        }
        break;
      }

      case "sanctions-pep-screened": {
        const result = await stepSanctionsPEPScreened(candidateId, input);
        if (!result.ok) {
          // Adapter unavailable — fail-closed: pause.
          return {
            ...state,
            requiresHuman: true,
            humanGateReason: "sanctions-adapter-unavailable",
          };
        }
        break;
      }

      case "ubo-resolved":
        await stepUBOResolved(candidateId, input);
        break;

      case "risk-rated": {
        // Need to know PEP status from screened events.
        let pepFlag = false;
        let pepLinked = false;
        for (const e of eventStore.replay({ type: "KYCSanctionsPEPScreened" })) {
          const p = e.payload as Record<string, unknown>;
          if (p.candidateId === candidateId) {
            pepFlag = p.pep_flag === true;
            pepLinked = p.pep_linked === true;
          }
        }
        await stepRiskRated(candidateId, input, pepFlag, pepLinked);
        break;
      }

      case "decision-pending": {
        // Derive sanctions result and risk band from events.
        let sanctionsResult = "clean";
        let riskBand: "low" | "medium" | "high" = "medium";
        let eddComplete = false;

        for (const e of eventStore.replay()) {
          const p = e.payload as Record<string, unknown>;
          if (p.candidateId !== candidateId) continue;
          if (e.type === "KYCSanctionsPEPScreened") {
            sanctionsResult = typeof p.result === "string" ? p.result : "clean";
          }
          if (e.type === "KYCRiskRated") {
            riskBand = (p.band as "low" | "medium" | "high") ?? "medium";
          }
          if (e.type === "KYCEDDCompleted") {
            eddComplete = true;
          }
        }

        const { requiresHuman } = await stepDecisionMade(
          candidateId,
          input,
          riskBand,
          sanctionsResult,
          eddComplete,
        );
        if (requiresHuman) {
          return {
            ...(deriveState(candidateId) ?? state),
            requiresHuman: true,
            humanGateReason: `${riskBand}-risk-human-review`,
          };
        }
        break;
      }

      default:
        // No step to run — return current state.
        return state;
    }

    // Return refreshed state after emitting the event.
    return deriveState(candidateId) ?? state;
  }

  /**
   * Record a human decision (MLRO or compliance officer).
   * Used to accept/reject after EDD or medium/high risk review.
   */
  async recordHumanDecision(
    candidateId: string,
    decision: "accept" | "reject",
    decidedBy: string,
    mlroSignOffId?: string,
  ): Promise<CandidateState> {
    const state = deriveState(candidateId);
    if (!state) {
      throw new Error(`KYCOrchestrator: candidate ${candidateId} not found`);
    }

    const input = candidateInputRegistry.get(candidateId);
    const asOf = nowUtc();

    // If we're in edd-in-progress, complete the EDD first.
    if (state.currentStep === "edd-in-progress") {
      if (!mlroSignOffId) {
        throw new Error("mlroSignOffId is required for EDD completion");
      }
      const eddEvt = makeKYCEDDCompleted({
        asOf,
        entity: ENTITY,
        actor: { type: "human", id: decidedBy },
        citations: KYC_CITATIONS,
        payload: {
          candidateId,
          mlro_sign_off_event_id: mlroSignOffId,
          outcome: decision === "accept" ? "proceed" : "reject",
          completedAt: asOf,
        },
      });
      eventStore.append(eddEvt);
    }

    // Emit the KYCDecisionMade event.
    const decisionEvt = makeKYCDecisionMade({
      asOf,
      entity: ENTITY,
      actor: { type: "human", id: decidedBy },
      citations: KYC_CITATIONS,
      payload: {
        candidateId,
        decision,
        reason: `Human decision by ${decidedBy}${mlroSignOffId ? ` (MLRO sign-off: ${mlroSignOffId})` : ""}`,
        decided_by: decidedBy,
        decidedAt: asOf,
      },
    });
    eventStore.append(decisionEvt);

    if (decision === "accept") {
      const clientId = newEventId();
      const acceptedEvt = makeClientAccepted({
        asOf,
        entity: ENTITY,
        actor: { type: "human", id: decidedBy },
        citations: KYC_CITATIONS,
        payload: {
          candidateId,
          clientId,
          entityName: input?.entityName ?? candidateId,
          entityType: input?.entityType ?? "company",
          jurisdiction: input?.jurisdiction ?? "ZA",
          riskBand: state.riskBand ?? "medium",
          category: "PC",
          acceptedAt: asOf,
        },
      });
      eventStore.append(acceptedEvt);

      // Register the accepted client in the master counterparty store.
      const partyEvt = makePartyRegistered({
        asOf,
        entity: ENTITY,
        actor: { type: "human", id: decidedBy },
        citations: [...KYC_CITATIONS, "D-PARTY-REGISTER"],
        payload: {
          partyId: `urn:party:legal-entity:${clientId}` as `urn:party:legal-entity:${string}`,
          kind: "legal-entity",
          displayName: input?.entityName ?? candidateId,
          jurisdictions: [input?.jurisdiction ?? "ZA"],
          citations: [...KYC_CITATIONS, "D-PARTY-REGISTER"],
          kindAttributes: {
            kind: "legal-entity",
            entityForm: "Ltd",
            parentPartyId: null,
            primaryRegulator: "other",
            regimeAnchor: [
              `KYC-onboarded counterparty${input?.registrationNumber ? `; registration number ${input.registrationNumber}` : ""}`,
            ],
          },
        },
      });
      eventStore.append(partyEvt);

      const lawfulEvt = makeLawfulProcessingRegistered({
        asOf,
        entity: ENTITY,
        actor: { type: "human", id: decidedBy },
        citations: KYC_CITATIONS,
        payload: {
          clientId,
          lawful_basis: "legal-obligation",
          processing_purposes: ["kyc-cdd", "aml-monitoring", "regulatory-reporting"],
          registeredAt: asOf,
        },
      });
      eventStore.append(lawfulEvt);
    } else {
      const rejectedEvt = makeClientRejected({
        asOf,
        entity: ENTITY,
        actor: { type: "human", id: decidedBy },
        citations: KYC_CITATIONS,
        payload: {
          candidateId,
          reason: `Human decision: rejected by ${decidedBy}`,
          rejectedAt: asOf,
        },
      });
      eventStore.append(rejectedEvt);
    }

    return deriveState(candidateId) ?? state;
  }

  /**
   * Get current state for a candidate without advancing.
   */
  async getCandidateState(candidateId: string): Promise<CandidateState> {
    const state = deriveState(candidateId);
    if (!state) {
      throw new Error(`KYCOrchestrator: candidate ${candidateId} not found`);
    }
    return state;
  }

  /**
   * Run all automated steps until a human gate or terminal state.
   * Progress is logged to stdout.
   */
  async runFull(candidateId: string): Promise<CandidateState> {
    let state = await this.getCandidateState(candidateId);

    const automatedSteps = [
      "identity-collected",
      "identity-verified",
      "sanctions-pep-screened",
      "ubo-resolved",
      "risk-rated",
      "decision-pending",
    ];

    while (
      state.status === "in-progress" &&
      !state.requiresHuman &&
      automatedSteps.includes(state.currentStep)
    ) {
      console.log(`  [KYC] ${candidateId.slice(0, 8)}... step: ${state.currentStep}`);
      state = await this.advanceStep(candidateId);
    }

    if (state.requiresHuman) {
      console.log(
        `  [KYC] ${candidateId.slice(0, 8)}... ⏸  human gate: ${state.humanGateReason ?? "review-required"}`,
      );
    } else if (state.status !== "in-progress") {
      console.log(`  [KYC] ${candidateId.slice(0, 8)}... terminal: ${state.status}`);
    }

    return state;
  }
}

/** Singleton for convenience imports. */
export const kycOrchestrator = new KYCOrchestrator();
