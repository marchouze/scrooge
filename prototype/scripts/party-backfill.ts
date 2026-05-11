// scripts/party-backfill.ts
//
// D-PARTY-REGISTER PR 2 (CEO-approved 2026-05-11) — idempotent boot-time
// backfill from existing legal-entity / counterparty / agent / signatory
// streams into the unified Party event family (PartyRegistered +
// PartyRelationshipAsserted + PartyClassified).
//
// Backfill discipline (per feedback_phase0_record_to_event_backfill.md):
//   - idempotent: keyed by source-event id (Party events are tagged with
//     `payload.backfillSourceEventId` and `payload.backfillSourceType`);
//     re-running on a second boot produces zero new events.
//   - append-only via the event store: no in-memory synthesis in the
//     projection. Principle 1 (events are truth).
//   - replay-safe: existing target-event lookups are folded BEFORE any
//     append so concurrent ticks don't double-emit.
//
// Backfill sources (per plan §3):
//   1. LegalEntityRegistered + seeds/legal-entity-tree.json
//      → PartyRegistered{kind: "legal-entity"} + parent-of edges.
//   2. CounterpartySoundingOpened / CounterpartyProspectRegistered
//      → PartyRegistered{kind: "counterparty"} + PartyClassified
//        (lifecycle status as classification).
//   3. AgentRegistered (27 personas) + Team/_team-roster.json
//      → PartyRegistered{kind: "agent"} + reports-to edges.
//   4. AuthorisedSignatoryAdded
//      → mint a natural-person Party (if not yet known) +
//        PartyRelationshipAsserted{kind: "signatory-of"}.
//
// PII discipline (Principle 4 + POPIA s.19-22): natural-person Parties
// minted from AuthorisedSignatoryAdded events carry empty/placeholder
// `kindAttributes` (no DOB, no piiDocumentRef). Actual KYC dossier
// hashing comes in PR 5. Pre-licence-day data scope only.
//
// Wire-in: dashboard/server.ts boot path, immediately after the
// CeoDecision record-to-event backfill.
//
// Author: Imani (Legal-as-code engineer; reports to Devon, Chief
// Operating Officer, governance).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  type PartyId,
  type PartyKind,
  makePartyClassified,
  makePartyRegistered,
  makePartyRelationshipAsserted,
  partyId as makePartyId,
} from "../domains/party";
import type { EventStore } from "../platform/event-store/store";
import type { Actor, Event } from "../platform/event-store/types";

// ---------------------------------------------------------------------------
// Result + actor + citation constants
// ---------------------------------------------------------------------------

export interface PartyBackfillResult {
  readonly legalEntityPartiesEmitted: number;
  readonly counterpartyPartiesEmitted: number;
  readonly agentPartiesEmitted: number;
  readonly naturalPersonPartiesEmitted: number;
  readonly relationshipsEmitted: number;
  readonly classificationsEmitted: number;
  readonly skipped: number;
}

const IMANI_ACTOR: Actor = { type: "service", id: "agent:imani" };
const ATLAS_ACTOR: Actor = { type: "service", id: "agent:atlas" };
const ENTITY = "BANK-ZA-001";

// Envelope citation set per event family (P2). Per-payload citations
// further narrow the regulatory anchor for the specific Party kind.
const LEGAL_ENTITY_CITATIONS = [
  "D-PARTY-REGISTER",
  "D-LEGAL-ENTITY-TREE-V0",
  "COMPANIES-ACT-71-2008",
  "BANKS-ACT-94-1990",
];
const COUNTERPARTY_CITATIONS = ["D-PARTY-REGISTER", "FIC-ACT-38-2001"];
const AGENT_CITATIONS = ["D-PARTY-REGISTER", "PRINCIPLE-7", "JOINT-STANDARD-2-2024"];
const NATURAL_PERSON_CITATIONS = [
  "D-PARTY-REGISTER",
  "POPIA-ACT-4-2013",
  "COMPANIES-ACT-71-2008-S66",
];
const RELATIONSHIP_CITATIONS = ["D-PARTY-RELATIONSHIP-KINDS-V0", "D-PARTY-REGISTER"];

// ---------------------------------------------------------------------------
// Idempotency — fold existing Party events to discover which
// `backfillSourceEventId`s have already been processed.
// ---------------------------------------------------------------------------

interface BackfilledIndex {
  readonly partyIds: Set<string>;
  readonly sourceEventIds: Set<string>;
  readonly relationshipIds: Set<string>;
  readonly classificationKeys: Set<string>; // `${partyId}|${classification}`
}

function buildBackfilledIndex(eventStore: EventStore): BackfilledIndex {
  const partyIds = new Set<string>();
  const sourceEventIds = new Set<string>();
  const relationshipIds = new Set<string>();
  const classificationKeys = new Set<string>();

  for (const e of eventStore.replay({ type: "PartyRegistered" })) {
    const p = e.payload as Record<string, unknown>;
    if (typeof p.partyId === "string") partyIds.add(p.partyId);
    if (typeof p.backfillSourceEventId === "string")
      sourceEventIds.add(p.backfillSourceEventId);
  }
  for (const e of eventStore.replay({ type: "PartyRelationshipAsserted" })) {
    const p = e.payload as Record<string, unknown>;
    if (typeof p.relationshipId === "string") relationshipIds.add(p.relationshipId);
    if (typeof p.backfillSourceEventId === "string")
      sourceEventIds.add(p.backfillSourceEventId);
  }
  for (const e of eventStore.replay({ type: "PartyClassified" })) {
    const p = e.payload as Record<string, unknown>;
    const pid = typeof p.partyId === "string" ? p.partyId : "";
    const cls = typeof p.classification === "string" ? p.classification : "";
    if (pid && cls) classificationKeys.add(`${pid}|${cls}`);
    if (typeof p.backfillSourceEventId === "string")
      sourceEventIds.add(p.backfillSourceEventId);
  }
  return { partyIds, sourceEventIds, relationshipIds, classificationKeys };
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

/**
 * Derive a URL-safe Party slug from any free-form input. The slug rule
 * matches `partyIdSchema` in `domains/party/schemas.ts`:
 *
 *   /^[a-z0-9][a-z0-9._-]*$/
 *
 * We lowercase, replace whitespace + colons + slashes with hyphens, and
 * collapse runs of non-allowed chars. Falls back to `unknown` if the
 * input is unusable.
 */
export function slugifyForPartyUrn(raw: string): string {
  const lowered = raw.toLowerCase();
  const replaced = lowered
    .replace(/[\s/\\:_]+/g, "-")
    .replace(/[^a-z0-9.\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9]+$/, "");
  return replaced.length > 0 ? replaced : "unknown";
}

/**
 * Derive a natural-person Party slug from an opaque personId by hashing
 * it deterministically. PII discipline: the personId itself is treated
 * as opaque (signatory IDs may carry surnames); we never embed it
 * verbatim in the URN.
 *
 * We use a simple FNV-1a 64-bit-ish hash to stay dependency-light at
 * the substrate layer; this is not a cryptographic hash — it just
 * produces a stable URL-safe slug.
 */
export function naturalPersonSlugFromPersonId(personId: string): string {
  // FNV-1a 32-bit. Stable across process boots / hosts.
  let h = 0x811c9dc5;
  for (let i = 0; i < personId.length; i++) {
    h ^= personId.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  // 8-hex-char digest is enough for build-phase uniqueness (< 1000
  // signatories pre-licence-day; collision chance is order 1/4e9).
  return `np-${h.toString(16).padStart(8, "0")}`;
}

// ---------------------------------------------------------------------------
// Helper — append a fully-formed event with the backfill source-event id
// folded into the payload (the schema in domains/party/schemas.ts uses
// `passthrough` so unknown fields are preserved; we explicitly attach
// `backfillSourceEventId` + `backfillSourceType` for the idempotency
// fold above).
// ---------------------------------------------------------------------------

function appendWithBackfillTag(
  eventStore: EventStore,
  event: Event,
  backfillSourceEventId: string,
  backfillSourceType: string,
): void {
  const taggedPayload = {
    ...(event.payload as Record<string, unknown>),
    backfillSourceEventId,
    backfillSourceType,
  };
  const taggedEvent: Event = { ...event, payload: taggedPayload };
  eventStore.append(taggedEvent);
}

// ---------------------------------------------------------------------------
// 1 — Legal-entity backfill
// ---------------------------------------------------------------------------

interface LegalEntitySeed {
  readonly entityId: string;
  readonly legalName: string;
  readonly registeredForm: "Ltd" | "RF" | "Pty";
  readonly jurisdiction: string;
  readonly parentEntityId: string | null;
  readonly regulatoryRegime: {
    readonly primaryRegulator: "PA" | "JSE" | "FSCA" | "none-companies-act-only" | "other";
    readonly regimeAnchor: readonly string[];
  };
}

/**
 * Map a `urn:legal-entity:<group>:<slug>:v<n>` to `urn:party:legal-entity:<slug>`.
 * Conservative: we take the *entity* slug (third colon-segment) so the
 * group prefix doesn't leak into the Party URN — keeps slugs readable
 * and matches the plan's example (`hoz-bank`, `hoz-securities`).
 */
export function legalEntityUrnToPartyUrn(entityUrn: string): PartyId {
  const parts = entityUrn.split(":");
  // `urn:legal-entity:hoz:hoz-bank:v1` → ["urn","legal-entity","hoz","hoz-bank","v1"]
  const slug = parts[3] ?? slugifyForPartyUrn(entityUrn);
  return makePartyId("legal-entity", slugifyForPartyUrn(slug));
}

function backfillLegalEntities(
  eventStore: EventStore,
  index: BackfilledIndex,
  result: { legalEntityPartiesEmitted: number; relationshipsEmitted: number; skipped: number },
  asOf: string,
  seeds: readonly LegalEntitySeed[],
): void {
  // Index the seed entries by entity URN so we can resolve parent-of edges.
  const partyUrnByEntityUrn = new Map<string, PartyId>();
  for (const seed of seeds) {
    partyUrnByEntityUrn.set(seed.entityId, legalEntityUrnToPartyUrn(seed.entityId));
  }

  // Pass 1 — emit PartyRegistered for every legal-entity.
  for (const seed of seeds) {
    const partyId = partyUrnByEntityUrn.get(seed.entityId);
    if (!partyId) continue;
    if (index.partyIds.has(partyId)) {
      result.skipped += 1;
      continue;
    }
    const parentPartyId =
      seed.parentEntityId !== null
        ? partyUrnByEntityUrn.get(seed.parentEntityId) ?? null
        : null;
    const event = makePartyRegistered({
      asOf,
      entity: ENTITY,
      actor: IMANI_ACTOR,
      citations: [...LEGAL_ENTITY_CITATIONS],
      payload: {
        partyId,
        kind: "legal-entity",
        displayName: seed.legalName,
        legalName: seed.legalName,
        jurisdictions: [seed.jurisdiction],
        kindAttributes: {
          kind: "legal-entity",
          entityForm: seed.registeredForm,
          parentPartyId,
          primaryRegulator: seed.regulatoryRegime.primaryRegulator,
          regimeAnchor: seed.regulatoryRegime.regimeAnchor,
        },
        citations: [
          "[citation: D-LEGAL-ENTITY-TREE-V0]",
          "[citation: Companies Act 71 of 2008]",
          ...(seed.regulatoryRegime.primaryRegulator === "PA"
            ? ["[citation: Banks Act 94 of 1990 s.7]"]
            : []),
        ],
      },
    });
    appendWithBackfillTag(
      eventStore,
      event,
      `legal-entity-seed:${seed.entityId}`,
      "LegalEntityRegistered",
    );
    index.partyIds.add(partyId);
    index.sourceEventIds.add(`legal-entity-seed:${seed.entityId}`);
    result.legalEntityPartiesEmitted += 1;
  }

  // Pass 2 — emit parent-of relationship edges.
  for (const seed of seeds) {
    if (seed.parentEntityId === null) continue;
    const childPartyId = partyUrnByEntityUrn.get(seed.entityId);
    const parentPartyId = partyUrnByEntityUrn.get(seed.parentEntityId);
    if (!childPartyId || !parentPartyId) continue;
    const relationshipId = `relationship:parent-of:${parentPartyId}->${childPartyId}`;
    if (index.relationshipIds.has(relationshipId)) {
      result.skipped += 1;
      continue;
    }
    const event = makePartyRelationshipAsserted({
      asOf,
      entity: ENTITY,
      actor: IMANI_ACTOR,
      citations: [...RELATIONSHIP_CITATIONS],
      payload: {
        relationshipId,
        fromPartyId: parentPartyId,
        toPartyId: childPartyId,
        kind: "parent-of",
        scopeJson: { source: "legal-entity-tree-seed" },
        effectiveFrom: asOf,
        citations: [
          "[citation: D-LEGAL-ENTITY-TREE-V0]",
          "[citation: Companies Act 71 of 2008 — group structure]",
        ],
      },
    });
    appendWithBackfillTag(
      eventStore,
      event,
      `legal-entity-parent-of:${seed.entityId}`,
      "LegalEntityRegistered",
    );
    index.relationshipIds.add(relationshipId);
    result.relationshipsEmitted += 1;
  }
}

// ---------------------------------------------------------------------------
// 2 — Counterparty backfill
// ---------------------------------------------------------------------------

interface CounterpartyLifecycleState {
  readonly counterpartyId: string;
  // Source-event metadata used to seed PartyRegistered kindAttributes.
  readonly legalName?: string;
  readonly jurisdiction?: string;
  readonly sector?: string;
  readonly channel?: "introduction" | "inbound" | "outbound" | "event";
  readonly introSource?: string;
  // Current lifecycle classification (becomes a PartyClassified event).
  readonly classification: string;
  // First-known source event for idempotency / actor inheritance.
  readonly sourceEventId: string;
  readonly sourceEventType: string;
  readonly firstAsOf: string;
}

function foldCounterpartyLifecycle(eventStore: EventStore): readonly CounterpartyLifecycleState[] {
  const byId = new Map<string, CounterpartyLifecycleState>();
  for (const e of eventStore.replay()) {
    const p = e.payload as Record<string, unknown>;
    const cpId = typeof p.counterpartyId === "string" ? p.counterpartyId : "";
    if (!cpId) continue;
    switch (e.type) {
      case "CounterpartySoundingOpened": {
        if (!byId.has(cpId)) {
          byId.set(cpId, {
            counterpartyId: cpId,
            channel: typeof p.channel === "string"
              ? (p.channel as CounterpartyLifecycleState["channel"])
              : undefined,
            introSource: typeof p.introSource === "string" ? p.introSource : undefined,
            classification: "Sounding",
            sourceEventId: e.event_id,
            sourceEventType: e.type,
            firstAsOf: e.as_of,
          });
        }
        break;
      }
      case "CounterpartyProspectRegistered": {
        const prior = byId.get(cpId);
        const merged: CounterpartyLifecycleState = {
          counterpartyId: cpId,
          legalName: typeof p.legalName === "string" ? p.legalName : prior?.legalName,
          jurisdiction:
            typeof p.jurisdiction === "string" ? p.jurisdiction : prior?.jurisdiction,
          sector: typeof p.sector === "string" ? p.sector : prior?.sector,
          channel: prior?.channel,
          introSource: prior?.introSource,
          classification: "Prospect",
          sourceEventId: prior?.sourceEventId ?? e.event_id,
          sourceEventType: prior?.sourceEventType ?? e.type,
          firstAsOf: prior?.firstAsOf ?? e.as_of,
        };
        byId.set(cpId, merged);
        break;
      }
      case "KycCompleted": {
        const prior = byId.get(cpId);
        if (!prior) break;
        byId.set(cpId, { ...prior, classification: "KycPassed" });
        break;
      }
      case "CounterpartyActivated": {
        const prior = byId.get(cpId);
        if (!prior) break;
        byId.set(cpId, { ...prior, classification: "Active" });
        break;
      }
      case "CounterpartyOffboarded": {
        const prior = byId.get(cpId);
        if (!prior) break;
        byId.set(cpId, { ...prior, classification: "Offboarded" });
        break;
      }
      default:
        break;
    }
  }
  return [...byId.values()];
}

function backfillCounterparties(
  eventStore: EventStore,
  index: BackfilledIndex,
  result: {
    counterpartyPartiesEmitted: number;
    classificationsEmitted: number;
    skipped: number;
  },
  asOf: string,
): void {
  const cps = foldCounterpartyLifecycle(eventStore);
  for (const cp of cps) {
    const slug = slugifyForPartyUrn(cp.counterpartyId);
    const partyId = makePartyId("counterparty", slug);
    if (!index.partyIds.has(partyId)) {
      const event = makePartyRegistered({
        asOf: cp.firstAsOf,
        entity: ENTITY,
        actor: IMANI_ACTOR,
        citations: [...COUNTERPARTY_CITATIONS],
        payload: {
          partyId,
          kind: "counterparty",
          displayName: cp.legalName ?? cp.counterpartyId,
          ...(cp.legalName ? { legalName: cp.legalName } : {}),
          jurisdictions: cp.jurisdiction ? [cp.jurisdiction.slice(0, 2).toUpperCase()] : ["ZA"],
          kindAttributes: {
            kind: "counterparty",
            sector: cp.sector ?? "unknown",
            channel: cp.channel ?? "inbound",
            ...(cp.introSource ? { introSource: cp.introSource } : {}),
            classification: cp.classification,
          },
          citations: [
            "[citation: D-PARTY-REGISTER]",
            "[citation: FIC Act 38 of 2001 s.21 customer due diligence]",
          ],
        },
      });
      appendWithBackfillTag(eventStore, event, cp.sourceEventId, cp.sourceEventType);
      index.partyIds.add(partyId);
      result.counterpartyPartiesEmitted += 1;
    } else {
      result.skipped += 1;
    }

    // Emit the current-lifecycle classification (idempotent per
    // partyId+classification).
    const classificationKey = `${partyId}|${cp.classification}`;
    if (!index.classificationKeys.has(classificationKey)) {
      const event = makePartyClassified({
        asOf,
        entity: ENTITY,
        actor: IMANI_ACTOR,
        citations: [...COUNTERPARTY_CITATIONS],
        payload: {
          partyId,
          classification: cp.classification,
          scopeJson: { source: "counterparty-lifecycle-fold", legacyCounterpartyId: cp.counterpartyId },
          citations: [
            "[citation: D-PARTY-REGISTER]",
            "[citation: FIC Act 38 of 2001 — CDD lifecycle stage]",
          ],
        },
      });
      appendWithBackfillTag(eventStore, event, cp.sourceEventId, cp.sourceEventType);
      index.classificationKeys.add(classificationKey);
      result.classificationsEmitted += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// 3 — Agent backfill (AgentRegistered → PartyRegistered{kind: "agent"} +
// reports-to edges from Team/_team-roster.json).
// ---------------------------------------------------------------------------

interface TeamRosterPersona {
  readonly name: string;
  readonly role: string;
  readonly reportsTo?: string;
}

interface TeamRoster {
  readonly personas: readonly TeamRosterPersona[];
}

export function agentUrnToPartyUrn(agentUrn: string): PartyId {
  // agentUrn shape: `agent:<slug>` per agentRegisteredPayloadSchema regex.
  const slug = agentUrn.startsWith("agent:") ? agentUrn.slice("agent:".length) : agentUrn;
  return makePartyId("agent", slugifyForPartyUrn(slug));
}

function backfillAgents(
  eventStore: EventStore,
  index: BackfilledIndex,
  result: {
    agentPartiesEmitted: number;
    relationshipsEmitted: number;
    skipped: number;
  },
  asOf: string,
  rosterPath: string | undefined,
): void {
  // Build a roster map by persona name (case-insensitive).
  let roster: TeamRoster | undefined;
  if (rosterPath) {
    try {
      roster = JSON.parse(readFileSync(rosterPath, "utf8")) as TeamRoster;
    } catch {
      // Missing or unparseable roster — proceed without reports-to edges.
      roster = undefined;
    }
  }
  const reportsToByName = new Map<string, string>();
  if (roster) {
    for (const p of roster.personas) {
      if (p.reportsTo && p.reportsTo.length > 0) {
        reportsToByName.set(p.name.toLowerCase(), p.reportsTo);
      }
    }
  }
  const roleByName = new Map<string, string>();
  if (roster) {
    for (const p of roster.personas) {
      roleByName.set(p.name.toLowerCase(), p.role);
    }
  }

  // Pass 1 — fold AgentRegistered (latest-wins) and emit a Party per agent.
  const latestPayloadByUrn = new Map<string, { event: Event; payload: Record<string, unknown> }>();
  for (const e of eventStore.replay({ type: "AgentRegistered" })) {
    const payload = e.payload as Record<string, unknown>;
    const urn = typeof payload.agentUrn === "string" ? payload.agentUrn : "";
    if (!urn) continue;
    latestPayloadByUrn.set(urn, { event: e, payload });
  }
  for (const [agentUrn, { event, payload }] of latestPayloadByUrn.entries()) {
    const partyId = agentUrnToPartyUrn(agentUrn);
    const personaName = typeof payload.personaName === "string" ? payload.personaName : agentUrn;
    if (!index.partyIds.has(partyId)) {
      const reportsToLabel = typeof payload.reportsTo === "string" ? payload.reportsTo : "";
      const mandateLine =
        roleByName.get(personaName.toLowerCase()) ??
        (typeof payload.cadenceMode === "string" ? payload.cadenceMode : "agent operating spec");
      const registeredEvent = makePartyRegistered({
        asOf: event.as_of,
        entity: ENTITY,
        actor: ATLAS_ACTOR,
        citations: [...AGENT_CITATIONS],
        payload: {
          partyId,
          kind: "agent",
          displayName: personaName,
          jurisdictions: ["ZA"],
          kindAttributes: {
            kind: "agent",
            personaSpecPath: `Team/${personaName}.md`,
            mandate: mandateLine,
          },
          citations: [
            "[citation: D-PARTY-REGISTER]",
            "[citation: Principle 7 — autonomous-by-default]",
            ...(reportsToLabel
              ? [`[citation: reports-to label from AgentRegistered payload: ${reportsToLabel}]`]
              : []),
          ],
        },
      });
      appendWithBackfillTag(eventStore, registeredEvent, event.event_id, "AgentRegistered");
      index.partyIds.add(partyId);
      result.agentPartiesEmitted += 1;
    } else {
      result.skipped += 1;
    }
  }

  // Pass 2 — reports-to edges from the canonical team roster (the
  // AgentRegistered payload carries a prose `reportsTo` label which is
  // not a stable Party URN; the roster's structured `reportsTo` field
  // by persona name is canonical).
  if (!roster) return;
  // Build name → Party URN map from the latest AgentRegistered fold,
  // so reports-to edges only resolve when both ends have a Party.
  const partyUrnByPersonaName = new Map<string, PartyId>();
  for (const [agentUrn, { payload }] of latestPayloadByUrn.entries()) {
    const personaName = typeof payload.personaName === "string" ? payload.personaName : agentUrn;
    partyUrnByPersonaName.set(personaName.toLowerCase(), agentUrnToPartyUrn(agentUrn));
  }
  for (const persona of roster.personas) {
    if (!persona.reportsTo) continue;
    const fromPartyId = partyUrnByPersonaName.get(persona.name.toLowerCase());
    const toPartyId = partyUrnByPersonaName.get(persona.reportsTo.toLowerCase());
    if (!fromPartyId || !toPartyId) continue;
    const relationshipId = `relationship:reports-to:${fromPartyId}->${toPartyId}`;
    if (index.relationshipIds.has(relationshipId)) {
      result.skipped += 1;
      continue;
    }
    const event = makePartyRelationshipAsserted({
      asOf,
      entity: ENTITY,
      actor: ATLAS_ACTOR,
      citations: [...RELATIONSHIP_CITATIONS],
      payload: {
        relationshipId,
        fromPartyId,
        toPartyId,
        kind: "reports-to",
        scopeJson: {
          source: "team-roster",
          persona: persona.name,
          reportsToLabel: persona.reportsTo,
        },
        effectiveFrom: asOf,
        citations: [
          "[citation: D-PARTY-RELATIONSHIP-KINDS-V0]",
          "[citation: Team/_team-roster.json — canonical reports-to graph]",
        ],
      },
    });
    appendWithBackfillTag(
      eventStore,
      event,
      `team-roster:reports-to:${persona.name}`,
      "team-roster",
    );
    index.relationshipIds.add(relationshipId);
    result.relationshipsEmitted += 1;
  }
}

// ---------------------------------------------------------------------------
// 4 — Authorised-signatory backfill (AuthorisedSignatoryAdded
//      → mint a natural-person Party if not yet known + signatory-of edge).
// ---------------------------------------------------------------------------

function backfillSignatories(
  eventStore: EventStore,
  index: BackfilledIndex,
  result: {
    naturalPersonPartiesEmitted: number;
    relationshipsEmitted: number;
    skipped: number;
  },
  _asOf: string,
): void {
  for (const e of eventStore.replay({ type: "AuthorisedSignatoryAdded" })) {
    const p = e.payload as Record<string, unknown>;
    const personId = typeof p.personId === "string" ? p.personId : "";
    const counterpartyId = typeof p.counterpartyId === "string" ? p.counterpartyId : "";
    const scope = typeof p.scope === "string" ? p.scope : "signatory";
    if (!personId || !counterpartyId) continue;

    // (a) Natural-person Party. Mint if not already known.
    const personSlug = naturalPersonSlugFromPersonId(personId);
    const personPartyId = makePartyId("natural-person", personSlug);
    if (!index.partyIds.has(personPartyId)) {
      const registeredEvent = makePartyRegistered({
        asOf: e.as_of,
        entity: ENTITY,
        actor: IMANI_ACTOR,
        citations: [...NATURAL_PERSON_CITATIONS],
        payload: {
          partyId: personPartyId,
          kind: "natural-person",
          displayName: `Signatory ${personSlug}`,
          jurisdictions: ["ZA"],
          kindAttributes: {
            kind: "natural-person",
            nationalities: ["ZA"],
            purposeRoles: ["signatory"],
            // PII placeholders — dobHashRef and piiDocumentRef stay
            // unset pre-licence-day per build-phase data scope.
          },
          citations: [
            "[citation: D-PARTY-REGISTER]",
            "[citation: POPIA Act 4 of 2013 s.19-22 minimum-necessary]",
            "[citation: Companies Act 71 of 2008 s.66 signing authority]",
          ],
        },
      });
      appendWithBackfillTag(
        eventStore,
        registeredEvent,
        `signatory-person:${e.event_id}`,
        "AuthorisedSignatoryAdded",
      );
      index.partyIds.add(personPartyId);
      result.naturalPersonPartiesEmitted += 1;
    }

    // (b) signatory-of relationship edge.
    const counterpartyPartyId = makePartyId(
      "counterparty",
      slugifyForPartyUrn(counterpartyId),
    );
    const relationshipKind = scope === "authorised-trader" ? "authorised-trader-for" : "signatory-of";
    const relationshipId = `relationship:${relationshipKind}:${personPartyId}->${counterpartyPartyId}`;
    if (index.relationshipIds.has(relationshipId)) {
      result.skipped += 1;
      continue;
    }
    const edgeEvent = makePartyRelationshipAsserted({
      asOf: e.as_of,
      entity: ENTITY,
      actor: IMANI_ACTOR,
      citations: [...RELATIONSHIP_CITATIONS],
      payload: {
        relationshipId,
        fromPartyId: personPartyId,
        toPartyId: counterpartyPartyId,
        kind: relationshipKind,
        scopeJson: {
          source: "AuthorisedSignatoryAdded backfill",
          scope,
          legacyPersonId: personId,
          legacyCounterpartyId: counterpartyId,
        },
        effectiveFrom: e.as_of,
        citations: [
          "[citation: D-PARTY-RELATIONSHIP-KINDS-V0]",
          "[citation: Companies Act 71 of 2008 s.66 signing authority]",
        ],
      },
    });
    appendWithBackfillTag(
      eventStore,
      edgeEvent,
      `signatory-edge:${e.event_id}`,
      "AuthorisedSignatoryAdded",
    );
    index.relationshipIds.add(relationshipId);
    result.relationshipsEmitted += 1;
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface PartyBackfillOptions {
  /** Override path to the canonical legal-entity-tree seed (test isolation). */
  readonly legalEntityTreeSeedPath?: string;
  /** Override path to the canonical Team/_team-roster.json (test isolation). */
  readonly teamRosterPath?: string;
  /** Override the "now" timestamp the backfill stamps on derived events. */
  readonly asOf?: string;
}

const DEFAULT_LEGAL_ENTITY_SEED = resolve(
  import.meta.dir,
  "..",
  "seeds",
  "legal-entity-tree.json",
);
const DEFAULT_TEAM_ROSTER = resolve(import.meta.dir, "..", "..", "Team", "_team-roster.json");

export function runPartyBackfill(
  eventStore: EventStore,
  opts: PartyBackfillOptions = {},
): PartyBackfillResult {
  const asOf = opts.asOf ?? new Date().toISOString();
  const result = {
    legalEntityPartiesEmitted: 0,
    counterpartyPartiesEmitted: 0,
    agentPartiesEmitted: 0,
    naturalPersonPartiesEmitted: 0,
    relationshipsEmitted: 0,
    classificationsEmitted: 0,
    skipped: 0,
  };

  const index = buildBackfilledIndex(eventStore);

  // 1 — Legal entities (read from seeds JSON; no LegalEntityRegistered
  // events are pre-emitted in the fresh worktree boot path).
  const seedPath = opts.legalEntityTreeSeedPath ?? DEFAULT_LEGAL_ENTITY_SEED;
  let seeds: readonly LegalEntitySeed[] = [];
  try {
    const raw = JSON.parse(readFileSync(seedPath, "utf8")) as { entities: LegalEntitySeed[] };
    seeds = raw.entities;
  } catch {
    // Missing seed — degrade gracefully, no legal-entity Parties emitted.
    seeds = [];
  }
  backfillLegalEntities(eventStore, index, result, asOf, seeds);

  // 2 — Counterparties (from existing event stream).
  backfillCounterparties(eventStore, index, result, asOf);

  // 3 — Agents (from existing AgentRegistered stream + Team/_team-roster.json).
  backfillAgents(eventStore, index, result, asOf, opts.teamRosterPath ?? DEFAULT_TEAM_ROSTER);

  // 4 — Signatories (from existing AuthorisedSignatoryAdded stream).
  backfillSignatories(eventStore, index, result, asOf);

  return result;
}
