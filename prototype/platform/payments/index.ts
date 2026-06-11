// platform/payments/index.ts
//
// Barrel re-export for the payments platform module.
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE (CEO-approved 2026-06-11).
// Author: Tomas (Operations & payments engineer, engineering)

// Correspondent bank connector — ISO 20022 envelope types + injection contract.
// W2.1 — interface + stubs; wire-up pending correspondent/sponsor-bank selection
// at licence-application moment.
// Authority: D-TREASURER-WAVE2-SUBSTRATE.
export {
  type Pacs008CreditTransfer,
  type Pacs009FinancialInstitutionTransfer,
  type Pacs002StatusReport,
  type Camt053AccountStatement,
  type Camt054CreditDebitNotification,
  type CorrespondentConnector,
  StubCorrespondentConnector,
} from "./correspondent-connector";
