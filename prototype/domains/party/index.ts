// domains/party/index.ts
//
// Public surface of the unified Party event family. PR 1 of D-PARTY-REGISTER
// (CEO-approved 2026-05-11) — substrate only.
//
// Author: Atlas (Core banking platform architect; substrate)

export type {
  AgentAttrs,
  BeneficialOwnerChainAssertedPayload,
  Citation,
  KindAttributes,
  LegalEntityAttrs,
  NaturalPersonAttrs,
  PartyAttributeChangedPayload,
  PartyClassifiedPayload,
  PartyDeactivatedPayload,
  PartyDeclassifiedPayload,
  PartyEventType,
  PartyId,
  PartyKind,
  PartyRegisteredPayload,
  PartyRelationshipAssertedPayload,
  PartyRelationshipChangedPayload,
  PartyRelationshipRevokedPayload,
  PartyScreeningCompletedPayload,
  RelationshipKind,
} from "./types";

export { PARTY_EVENT_TYPES, PARTY_KINDS, RELATIONSHIP_KINDS, partyId } from "./types";

export {
  RELATIONSHIP_KIND_CONSTRAINTS,
  beneficialOwnerChainAssertedPayloadSchema,
  kindAttributesSchema,
  partyAttributeChangedPayloadSchema,
  partyClassifiedPayloadSchema,
  partyDeactivatedPayloadSchema,
  partyDeclassifiedPayloadSchema,
  partyIdSchema,
  partyKindSchema,
  partyRegisteredPayloadSchema,
  partyRelationshipAssertedPayloadSchema,
  partyRelationshipChangedPayloadSchema,
  partyRelationshipRevokedPayloadSchema,
  partyScreeningCompletedPayloadSchema,
  relationshipKindSchema,
} from "./schemas";

export {
  makeBeneficialOwnerChainAsserted,
  makePartyAttributeChanged,
  makePartyClassified,
  makePartyDeactivated,
  makePartyDeclassified,
  makePartyRegistered,
  makePartyRelationshipAsserted,
  makePartyRelationshipChanged,
  makePartyRelationshipRevoked,
  makePartyScreeningCompleted,
} from "./factories";
