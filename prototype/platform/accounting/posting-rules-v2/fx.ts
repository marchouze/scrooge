// platform/accounting/posting-rules-v2/fx.ts
//
// RE-EXPORT SHIM. The lifted pure FX posting rules now live in the canonical
// `v2-core/posting-rules/fx.ts` spine (WS-ACCT-FX-COMPLETENESS Slice 2,
// D-ACCT-SCHEMA-CANONICAL-HOME). This v1 module re-exports them so existing
// importers (gl-posting-engine-v2, the FX fold, projections, recon gates) keep
// working unchanged.
//
// Authority: D-ACCT-SCHEMA-CANONICAL-HOME (CEO-approved 2026-06-18);
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST.
// Author: Bea (Accounting & financial reporting engineer, engineering).

export {
  FX_TYPE_PREFIX,
  isFxInstance,
  type FxPostingLeg,
  FX_POSTING_RULE_IDS,
  selectFxRule,
  type FxAccountSet,
  resolveFxAccountSet,
  FX_FVOCI_OCI_RESERVE_ACCOUNT,
  type FxElectionOverride,
  postFxInitialRecognitionLegs,
  postFxRevaluationLegs,
  postFxCloseLegs,
  FX_CANCEL_REVERSAL_RULE_ID,
  postFxCancellationReversalLegs,
} from "../../../v2-core/posting-rules/fx";
