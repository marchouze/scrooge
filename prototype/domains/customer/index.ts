// domains/customer/index.ts
//
// Public surface of the institutional client lifecycle module.

export type {
  ActivationPayload,
  AgreementType,
  AuthorisedSignatoryPayload,
  CounterpartyId,
  CounterpartyStatus,
  CustomerEventType,
  DocumentationPayload,
  DocumentationStatus,
  KycCompletedPayload,
  KycTier,
  MandatePayload,
  OffboardPayload,
  ProspectPayload,
  SoundingPayload,
} from "./types";

export { CUSTOMER_EVENT_TYPES, DEFAULT_ENTITY, counterpartyId } from "./types";

export {
  authorisedSignatoryAdded,
  authorisedSignatoryRemoved,
  counterpartyActivated,
  counterpartyOffboarded,
  documentationDrafted,
  documentationReadyToExecute,
  kycCompleted,
  mandateAssigned,
  mandateRevised,
  mandateRevoked,
  prospectRegistered,
  soundingOpened,
} from "./onboarding";

export type {
  AgreementKey,
  CounterpartyMaster,
  CounterpartyMasterRecord,
  IsdaTracker,
  SignatoryBook,
  SignatoryEntry,
} from "./projections";

export { counterpartyMaster, isdaTracker, signatoryBook } from "./projections";
