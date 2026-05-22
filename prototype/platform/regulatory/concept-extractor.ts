// platform/regulatory/concept-extractor.ts
//
// Regulatory concept extractor — uses Claude API to extract structured
// obligation concepts from regulatory instrument text.
//
// Design:
//   - Parses instrument text into sections using the FAIS Act numbering
//     convention (section numbers like "1.", "2A." at top level).
//   - For each section: idempotency check → Claude extraction → event emit.
//   - Contextualisation (RegulatoryInstrumentContextualised) runs once
//     per instrument on first call.
//   - Prompt-cached: the bank profile + taxonomy + rubrics are the stable
//     system prompt; section text is the volatile user input.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { claudeAvailable, tryGenerateNarrative } from "../../runtime/claude";
import { BANK_ZA_001 } from "../core/types";
import { hashContent } from "../document-store/hash";
import {
  type RegulatoryConceptExtractedPayload,
  type RegulatoryInstrumentContextualisedPayload,
  makeRegulatoryConceptExtracted,
  makeRegulatoryInstrumentContextualised,
} from "../event-store/event-types/regulatory";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { logger } from "../observability/logger";
import { ONTOLOGY_DESCRIPTION, validateExtractionResponse } from "./graph/ontology-schema";

// ---------------------------------------------------------------------------
// Stable system prompt — prompt-cached on the Claude API.
// Must remain byte-stable across runs (no timestamps, no UUIDs).
// ---------------------------------------------------------------------------

const EXTRACTION_SYSTEM_PROMPT = `You are a regulatory analysis engine for a SARB-licensed institutional global-markets trading bank in South Africa.

BANK PROFILE:
- Holds both a banking licence (Banks Act 94/1990) and an FSP licence (Category I, FAIS Act 37/2002)
- Operates exclusively with institutional counterparties — no retail clients
- Activities: JSE-listed bonds and equities, OTC interest rate derivatives (IRD), FX spot
- Does not directly join CLS or SAMOS (uses correspondent banks)
- No physical branches beyond registered office
- AI-agent-operated; human staff at licence-day is statutory minimum (~5-10 people)

TAXONOMY CODES (use only these for classifications):
- Domains: A-PRUDENTIAL, B-FINANCIAL-CRIME, C-FAIS, D-MARKET-CONDUCT, E-CYBER, F-GOVERNANCE, G-REPORTING, H-OPERATIONAL, I-TREASURY, J-MARKET-INFRASTRUCTURE
- Activity scope: ACT-TRADE-EXEC, ACT-TRADE-BOOK, ACT-CLIENT-ONBOARD, ACT-RISK-MGMT, ACT-REPORTING, ACT-SETTLEMENT, ACT-COMPLIANCE, ACT-CUSTODY, ACT-FX, ACT-CREDIT
- Product scope: equity-securities, debt-securities, money-market-instruments, interest-rate-derivatives, fx-instruments, securities-financing, multi-asset
- Risk taxonomy codes (abbreviated): MKT-001 through MKT-010, CRD-001 through CRD-005, OPR-001 through OPR-010, CMP-001 through CMP-010, LIQ-001 through LIQ-005

APPLICABILITY SCORING RUBRIC:
- 1.0: section explicitly names the bank's entity/licence type; condition scope matches activities; currently effective
- 0.7-0.9: plausibly applies; one dimension uncertain
- 0.4-0.6: applies to the bank's sector but not its specific activities (e.g. retail-only rules)
- 0.1-0.3: applies to entities the bank is not (e.g. stockbroker-specific rules)
- 0.0: definitional, penalty admin, or no direct obligation on the bank

RELEVANCY SCORING RUBRIC (given it applies, how operationally significant?):
- 0.9-1.0: criminal penalty / licence-affecting / regulator-recipient obligation
- 0.7-0.8: ongoing operational duty (disclosure, reporting, record-keeping)
- 0.5-0.6: internal governance or system-capability requirement
- 0.3-0.4: client-facing duty (lower exposure for institutional-only bank)
- 0.0-0.2: definitional or contextual; no direct action required

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "sectionTitle": "...",
  "subjectScope": { "entityTypes": [], "licenceTypes": [], "roles": [], "thresholdDescription": null },
  "temporalScope": { "commencementDate": null, "cadence": "ongoing", "eventTrigger": null, "periodDays": null, "transitionalNote": null },
  "conditionScope": { "clientTypes": [], "activityTriggers": [], "instrumentTypes": [], "thresholdConditions": [], "exclusions": [] },
  "obligation": { "type": "duty", "actor": [], "actionSummary": "...", "timeframeDescription": null, "output": null, "recipient": [] },
  "applicabilityScore": 0.0,
  "applicabilityRationale": "...",
  "relevancyScore": 0.0,
  "relevancyRationale": "...",
  "classifications": { "domain": [], "riskTaxonomy": [], "productScope": [], "activityScope": [] },
  "graphNodes": [],
  "graphEdges": []
}

KNOWLEDGE GRAPH EXTRACTION (populate graphNodes and graphEdges above):
Extract graph nodes and edges from this provision following the ontology below.

${ONTOLOGY_DESCRIPTION}

EXTRACTION RULES FOR GRAPH NODES:
- Extract only node types relevant to the provision: Provision, Obligation, Term, RegulatedEntity, Activity, Threshold, ReportingRequirement, Regulator, Jurisdiction, Framework, RiskCategory.
- Always include one Provision node for the section itself (nodeType: "Provision", id: "{instrumentId}:s{section}", label: section heading).
- For each obligation expressed: one Obligation node — one Obligation per duty (not one per section). Sub-section enumerations almost always express multiple distinct duties; emit a separate Obligation node for each. obligationType: must/must-not/may/conditional/recommended; actor: who must act; actionSummary: what they must do (a single sentence, no markdown).
- For each defined term: one Term node (term: the word/phrase; definitionText: its statutory definition).
- For each quantitative threshold: one Threshold node (value as a number; unit; operator from {>=, <=, =, >, <}).
- For each reporting / filing obligation: one ReportingRequirement node, plus a REQUIRES_REPORT edge from the originating Obligation.
- Regulator: emit when the provision explicitly names the issuing or supervisory authority (e.g. "the Authority", "the registrar", "FSCA", "Prudential Authority"). id format: "REG-{slug}" (e.g. "REG-fsca", "REG-pa", "REG-sarb", "REG-fic"). One Regulator per provision is usually enough.
- Jurisdiction: emit when the provision explicitly scopes itself to a jurisdiction other than ZA, or where the provision's territorial reach is non-obvious. id "JUR-{iso}" (e.g. "JUR-ZA", "JUR-GB"). Default ZA may be omitted.
- Framework: emit when the provision transposes or aligns with a named supranational framework (Basel III/IV, FATF, IOSCO, OECD CRS/FATCA, etc.). id "FW-{slug}". Pair with a TRANSPOSES edge from the Document to the Framework when explicit, or with confidence 0.4-0.6 when implied by long-title context.
- RiskCategory: emit one RiskCategory node when the provision addresses a named risk family (market risk, credit risk, liquidity risk, operational risk, compliance risk, cyber risk, conduct risk, financial-crime risk, capital risk, climate risk). id "RISK-{slug}". Pair with an ADDRESSES edge from the Obligation.
- Control, EffectivePeriod, Policy, Procedure: DO NOT emit in this pass. Those node types are populated by the policy-extraction pass (Phase 2) where the bank's own internal artefacts express closure.

EXTRACTION RULES FOR GRAPH EDGES — maximise product/activity/threshold granularity:
- Every Obligation node MUST have an EXPRESSES edge from its Provision (confidence 1.0).
- APPLIES_TO_ACTIVITY (Obligation → Activity): emit ONE edge per applicable ACT-* code. Enumerate aggressively. The applicable codes are: ACT-TRADE-EXEC, ACT-TRADE-BOOK, ACT-CLIENT-ONBOARD, ACT-RISK-MGMT, ACT-REPORTING, ACT-SETTLEMENT, ACT-COMPLIANCE, ACT-CUSTODY, ACT-FX, ACT-CREDIT. A typical institutional-trading obligation will fire 2–4 of these. Set Activity node id to "ACT-{CODE}" (e.g. "ACT-TRADE-EXEC"). Confidence 0.7–1.0 when the activity is named or clearly implied; 0.4–0.6 when inferred by analogy.
- APPLIES_TO (Obligation → RegulatedEntity OR product code): emit ONE edge per applicable product code where the obligation is product-scoped. Product codes: equity-securities, debt-securities, money-market-instruments, interest-rate-derivatives, fx-instruments, securities-financing, multi-asset. For the bank's universal-applicability obligations (e.g. governance, FIC AML, fit-and-proper), emit APPLIES_TO → RegulatedEntity (id "ENT-bank-fsp") instead of product edges.
- SETS (Obligation → Threshold): emit ONE edge for EVERY quantitative threshold expressed in the provision. Numeric limits, percentages, time-windows, monetary amounts all count. Strongly preferred over leaving the threshold un-typed.
- REQUIRES_REPORT (Obligation → ReportingRequirement): emit when the obligation requires a filing to a regulator (STR, CTR, BA-returns, FSCA returns, FIC reports).
- ADDRESSES (Obligation → RiskCategory): emit when the obligation has a named risk-mitigation purpose.
- ISSUED_BY (Document → Regulator): emit when a Regulator node is created.
- DEFINES (Provision → Term): emit when a Term node is created and the provision is a definitions section.
- TRANSPOSES (Document → Framework): emit when a Framework node is created; confidence 0.7+ when the long title or preamble names the framework.
- Set confidenceScore honestly: 1.0 = explicit; 0.7–0.9 = strongly implied; 0.4–0.6 = inferred; 0.1–0.3 = speculative. Do NOT emit edges below 0.4 confidence.
- TRADE-OFF — recall over precision-of-applicability: the applicabilityScore + relevancyScore on the Obligation carry the uncertainty for the obligation as a whole. Per-edge confidence captures the uncertainty of each specific edge. It is BETTER to emit a 0.5-confidence APPLIES_TO_ACTIVITY edge than to omit it.`;

const CONTEXTUALISATION_SYSTEM_PROMPT = `You are a regulatory analysis engine for a SARB-licensed institutional global-markets trading bank in South Africa.

Analyse the regulatory instrument text provided and return ONLY valid JSON (no markdown, no explanation) matching this exact structure:
{
  "regulatoryAuthority": {
    "name": "...",
    "mandate": "...",
    "enforcementPowers": []
  },
  "legislativeFramework": {
    "instrumentType": "...",
    "parentLegislation": [],
    "relatedDomesticInstruments": [],
    "positionInHierarchy": "...",
    "administeredBy": "..."
  },
  "internationalAlignment": {
    "conformsTo": [],
    "alignmentDescription": "...",
    "knownDeviations": []
  },
  "regulatoryObjective": {
    "longTitle": "...",
    "primaryObjective": "...",
    "protectedInterests": [],
    "enforcementApproach": "principles-based",
    "outcomeStatement": "..."
  }
}`;

// ---------------------------------------------------------------------------
// LLM output normalisers
// ---------------------------------------------------------------------------

const CADENCE_MAP: Record<string, "ongoing" | "one-time" | "periodic" | "event-triggered"> = {
  "event-driven": "event-triggered",
  "event driven": "event-triggered",
  "one time": "one-time",
  "one-off": "one-time",
  single: "one-time",
  recurring: "periodic",
  regular: "periodic",
  continuous: "ongoing",
  "continuous obligation": "ongoing",
};

function normaliseCadence(
  raw: string | undefined,
): "ongoing" | "one-time" | "periodic" | "event-triggered" {
  if (!raw) return "ongoing";
  const lower = raw.toLowerCase().trim();
  if (
    lower === "ongoing" ||
    lower === "one-time" ||
    lower === "periodic" ||
    lower === "event-triggered"
  ) {
    return lower as "ongoing" | "one-time" | "periodic" | "event-triggered";
  }
  return CADENCE_MAP[lower] ?? "ongoing";
}

type ObligationType = RegulatoryConceptExtractedPayload["obligation"]["type"];
const OBLIGATION_TYPES = new Set<ObligationType>([
  "duty",
  "prohibition",
  "disclosure",
  "reporting",
  "record-keeping",
  "system-capability",
  "definition",
  "penalty",
  "other",
]);
const OBLIGATION_TYPE_MAP: Record<string, ObligationType> = {
  right: "duty",
  rights: "duty",
  power: "duty",
  requirement: "duty",
  obligation: "duty",
  permission: "duty",
  authorization: "duty",
  authorisation: "duty",
  "record keeping": "record-keeping",
  recordkeeping: "record-keeping",
  "system capability": "system-capability",
};

function normaliseObligationType(raw: string | undefined): ObligationType {
  if (!raw) return "other";
  const lower = raw.toLowerCase().trim();
  if (OBLIGATION_TYPES.has(lower as ObligationType)) return lower as ObligationType;
  return OBLIGATION_TYPE_MAP[lower] ?? "other";
}

// ---------------------------------------------------------------------------
// Section parser
// ---------------------------------------------------------------------------

export interface ParsedSection {
  /** e.g. "7" or "13A" */
  sectionNumber: string;
  /** Full text of the section including subsections */
  text: string;
}

/**
 * Parse a regulatory instrument's full text into top-level sections.
 *
 * FAIS Act convention:
 *   Section 1. heading
 *   (1) subsection one
 *   (2) subsection two
 *
 * Top-level section markers: digits optionally followed by a capital letter,
 * followed by a period and a capital letter or opening bracket.
 * e.g. "1. Definitions", "7. Authorisation", "13A. Fit and proper"
 */
export function parseSections(fullText: string): ParsedSection[] {
  // Match lines starting a top-level section: "  7. Heading" or "13A. Heading"
  // The capital letter or bracket after the period distinguishes sections from
  // sub-references like "(a) text" which do NOT match.
  const lines = fullText.split("\n");
  const sections: ParsedSection[] = [];
  let currentSectionNum: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const m = line.match(/^[ \t]*(\d+[A-Z]?)\.[ \t]+([A-Z\(])/);
    if (m) {
      // Save the previous section if any
      if (currentSectionNum !== null && currentLines.length > 0) {
        sections.push({
          sectionNumber: currentSectionNum,
          text: currentLines.join("\n").trim(),
        });
      }
      currentSectionNum = m[1] ?? null;
      currentLines = [line];
    } else if (currentSectionNum !== null) {
      currentLines.push(line);
    }
    // Lines before the first section are skipped (preamble / table of contents)
  }

  // Flush the last section
  if (currentSectionNum !== null && currentLines.length > 0) {
    sections.push({
      sectionNumber: currentSectionNum,
      text: currentLines.join("\n").trim(),
    });
  }

  return sections;
}

/**
 * Build the canonical sectionId for a given instrument + section number.
 * e.g. ("FAIS-ACT-37-2002", "7") → "FAIS-ACT-37-2002:s7"
 *      ("FAIS-ACT-37-2002", "13A") → "FAIS-ACT-37-2002:s13A"
 */
export function buildSectionId(instrumentId: string, sectionNumber: string): string {
  return `${instrumentId}:s${sectionNumber}`;
}

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

function hasContextualisation(store: EventStore, instrumentId: string): boolean {
  for (const event of store.replay({ type: "RegulatoryInstrumentContextualised" })) {
    const p = event.payload as { instrumentId?: string };
    if (p.instrumentId === instrumentId) return true;
  }
  return false;
}

function hasConceptExtracted(store: EventStore, sectionId: string, contentHash: string): boolean {
  for (const event of store.replay({ type: "RegulatoryConceptExtracted" })) {
    // Key: sectionId must match AND we need to check that the extraction was
    // done against the same content version (same instrument contentHash).
    // We store a composite key in a _contentHash field appended to the payload.
    const raw = event.payload as Record<string, unknown>;
    if (raw.sectionId === sectionId && raw._contentHash === contentHash) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Contextualisation
// ---------------------------------------------------------------------------

async function contextualise(opts: {
  instrumentId: string;
  fullText: string;
  actor: Actor;
  store: EventStore;
}): Promise<void> {
  const { instrumentId, fullText, actor, store } = opts;

  if (!claudeAvailable()) {
    logger.warn({ instrumentId }, "Claude unavailable — skipping contextualisation");
    return;
  }

  // Pass the first 3000 chars of the text (preamble + long title) for context
  const excerpt = fullText.slice(0, 3000);

  const result = await tryGenerateNarrative({
    stableSystem: CONTEXTUALISATION_SYSTEM_PROMPT,
    userInput: `INSTRUMENT: ${instrumentId}\n\nTEXT EXCERPT (first 3000 chars):\n${excerpt}`,
    maxTokens: 2000,
    effort: "medium",
  });

  if (!result.ok) {
    logger.error({ instrumentId, error: result.error }, "contextualisation Claude call failed");
    return;
  }

  let parsed: Omit<
    RegulatoryInstrumentContextualisedPayload,
    "instrumentId" | "contextualisedAt" | "contextualisedBy"
  >;
  try {
    parsed = JSON.parse(result.result.text);
  } catch {
    logger.error(
      { instrumentId, raw: result.result.text.slice(0, 200) },
      "failed to parse contextualisation JSON",
    );
    return;
  }

  const now = new Date().toISOString();
  const event = makeRegulatoryInstrumentContextualised({
    asOf: now,
    entity: BANK_ZA_001,
    actor,
    citations: ["FAIS-ACT-37-2002", "ORG-CD-01"],
    payload: {
      instrumentId,
      ...parsed,
      contextualisedAt: now,
      contextualisedBy: actor.id,
    },
  });

  store.append(event);
  logger.info({ instrumentId }, "RegulatoryInstrumentContextualised emitted");
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

/**
 * Extract regulatory concepts from a full instrument text.
 *
 * For each top-level section:
 * 1. Checks idempotency (skip if already extracted for this content hash).
 * 2. Calls Claude to extract structured obligation concept.
 * 3. Emits RegulatoryConceptExtracted event.
 *
 * Returns counts of concepts emitted and sections skipped.
 */
export async function extractConcepts(opts: {
  instrumentId: string;
  fullText: string;
  actor: Actor;
  eventStore: EventStore;
}): Promise<{ conceptsEmitted: number; skipped: number; highApplicability: string[] }> {
  const { instrumentId, fullText, actor, eventStore } = opts;

  // Compute content hash for idempotency (DocumentHash is a branded string)
  const contentHash = hashContent(fullText) as string;

  // Run contextualisation if not already done
  if (!hasContextualisation(eventStore, instrumentId)) {
    await contextualise({ instrumentId, fullText, actor, store: eventStore });
  }

  // Parse sections
  const sections = parseSections(fullText);
  logger.info({ instrumentId, sectionCount: sections.length }, "sections parsed");

  let conceptsEmitted = 0;
  let skipped = 0;
  const highApplicability: string[] = [];

  for (const section of sections) {
    const sectionId = buildSectionId(instrumentId, section.sectionNumber);

    // Idempotency check
    if (hasConceptExtracted(eventStore, sectionId, contentHash)) {
      skipped++;
      continue;
    }

    if (!claudeAvailable()) {
      logger.warn({ sectionId }, "Claude unavailable — skipping section extraction");
      skipped++;
      continue;
    }

    // Truncate verbatim text to 2000 chars
    const verbatim = section.text.slice(0, 2000);

    const result = await tryGenerateNarrative({
      stableSystem: EXTRACTION_SYSTEM_PROMPT,
      userInput: `INSTRUMENT: ${instrumentId}\nSECTION: ${section.sectionNumber}\n\nTEXT:\n${section.text}`,
      maxTokens: 2000,
      effort: "medium",
    });

    if (!result.ok) {
      logger.error({ sectionId, error: result.error }, "concept extraction Claude call failed");
      skipped++;
      continue;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(result.result.text);
    } catch {
      logger.error(
        { sectionId, raw: result.result.text.slice(0, 200) },
        "failed to parse concept JSON",
      );
      skipped++;
      continue;
    }

    const now = new Date().toISOString();

    // Build payload — map Claude output to our schema
    const payload: RegulatoryConceptExtractedPayload & { _contentHash: string } = {
      instrumentId,
      sectionId,
      sectionTitle:
        (parsed.sectionTitle as string | undefined) ?? `Section ${section.sectionNumber}`,
      verbatimText: verbatim,
      subjectScope: {
        entityTypes:
          ((parsed.subjectScope as Record<string, unknown>)?.entityTypes as string[]) ?? [],
        licenceTypes:
          ((parsed.subjectScope as Record<string, unknown>)?.licenceTypes as string[]) ?? [],
        roles: ((parsed.subjectScope as Record<string, unknown>)?.roles as string[]) ?? [],
        thresholdDescription:
          ((parsed.subjectScope as Record<string, unknown>)?.thresholdDescription as
            | string
            | undefined) ?? undefined,
      },
      temporalScope: {
        commencementDate:
          ((parsed.temporalScope as Record<string, unknown>)?.commencementDate as
            | string
            | undefined) ?? undefined,
        cadence: normaliseCadence(
          (parsed.temporalScope as Record<string, unknown>)?.cadence as string | undefined,
        ),
        eventTrigger:
          ((parsed.temporalScope as Record<string, unknown>)?.eventTrigger as string | undefined) ??
          undefined,
        periodDays:
          ((parsed.temporalScope as Record<string, unknown>)?.periodDays as number | undefined) ??
          undefined,
        transitionalNote:
          ((parsed.temporalScope as Record<string, unknown>)?.transitionalNote as
            | string
            | undefined) ?? undefined,
      },
      conditionScope: {
        clientTypes:
          ((parsed.conditionScope as Record<string, unknown>)?.clientTypes as
            | string[]
            | undefined) ?? undefined,
        activityTriggers:
          ((parsed.conditionScope as Record<string, unknown>)?.activityTriggers as
            | string[]
            | undefined) ?? undefined,
        instrumentTypes:
          ((parsed.conditionScope as Record<string, unknown>)?.instrumentTypes as
            | string[]
            | undefined) ?? undefined,
        thresholdConditions:
          ((parsed.conditionScope as Record<string, unknown>)?.thresholdConditions as
            | string[]
            | undefined) ?? undefined,
        exclusions:
          ((parsed.conditionScope as Record<string, unknown>)?.exclusions as
            | string[]
            | undefined) ?? undefined,
      },
      obligation: {
        type: normaliseObligationType(
          (parsed.obligation as Record<string, unknown>)?.type as string | undefined,
        ),
        actor: ((parsed.obligation as Record<string, unknown>)?.actor as string[]) ?? [],
        actionSummary:
          ((parsed.obligation as Record<string, unknown>)?.actionSummary as string) ??
          "No action summary available.",
        timeframeDescription:
          ((parsed.obligation as Record<string, unknown>)?.timeframeDescription as
            | string
            | undefined) ?? undefined,
        output:
          ((parsed.obligation as Record<string, unknown>)?.output as string | undefined) ??
          undefined,
        recipient:
          ((parsed.obligation as Record<string, unknown>)?.recipient as string[] | undefined) ??
          undefined,
      },
      applicabilityScore: (parsed.applicabilityScore as number | undefined) ?? 0,
      applicabilityRationale:
        (parsed.applicabilityRationale as string | undefined) ?? "No rationale provided.",
      relevancyScore: (parsed.relevancyScore as number | undefined) ?? 0,
      relevancyRationale:
        (parsed.relevancyRationale as string | undefined) ?? "No rationale provided.",
      classifications: {
        domain: ((parsed.classifications as Record<string, unknown>)?.domain as string[]) ?? [],
        riskTaxonomy:
          ((parsed.classifications as Record<string, unknown>)?.riskTaxonomy as string[]) ?? [],
        productScope:
          ((parsed.classifications as Record<string, unknown>)?.productScope as string[]) ?? [],
        activityScope:
          ((parsed.classifications as Record<string, unknown>)?.activityScope as string[]) ?? [],
      },
      extractedAt: now,
      extractedBy: actor.id,
      // Internal idempotency key — stored in payload for deduplication.
      _contentHash: contentHash,
    } as RegulatoryConceptExtractedPayload & { _contentHash: string };

    // ── Graph extraction — validate and attach if present ─────────────────
    const rawGraphNodes = Array.isArray(parsed.graphNodes) ? parsed.graphNodes : undefined;
    const rawGraphEdges = Array.isArray(parsed.graphEdges) ? parsed.graphEdges : undefined;

    if (rawGraphNodes !== undefined || rawGraphEdges !== undefined) {
      const graphValidation = validateExtractionResponse({
        provisionId: sectionId,
        nodes: rawGraphNodes ?? [],
        edges: rawGraphEdges ?? [],
      });
      if (graphValidation.valid) {
        payload.graphNodes = rawGraphNodes;
        payload.graphEdges = rawGraphEdges;
      } else {
        logger.warn(
          { sectionId, errors: graphValidation.errors.slice(0, 5) },
          "graph extraction output failed ontology validation — discarding graphNodes/graphEdges",
        );
      }
    }

    const event = makeRegulatoryConceptExtracted({
      asOf: now,
      entity: BANK_ZA_001,
      actor,
      citations: ["FAIS-ACT-37-2002", "ORG-CD-01"],
      payload,
    });

    eventStore.append(event);
    conceptsEmitted++;

    if (payload.applicabilityScore >= 0.7) {
      highApplicability.push(sectionId);
    }

    logger.debug(
      { sectionId, applicabilityScore: payload.applicabilityScore },
      "concept extracted",
    );
  }

  return { conceptsEmitted, skipped, highApplicability };
}
