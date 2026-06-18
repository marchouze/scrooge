---
agent: Senna
trigger: security-substrate-state
asOf: 2026-06-18T07:37:26.361Z
decision-required: false
---

# Senna — security substrate state, 2026-06-18

Autonomous run of Senna's weekly security-substrate-state inventory per `Team/Senna.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop.

**Headline:** 4 CI gates · 321 recon pipelines · 0 threat-model artefacts · 0 SBOM files · 0 security incidents in the last 7 days.

## CI gates

| Gate | Command |
|---|---|
| `ci:core` | `bun run ci:core` |
| `ci:migrate` | `bun run ci:migrate` |
| `ci:recon:infra` | `bun run ci:recon:infra` |
| `ci:recon:domain` | `bun run ci:recon:domain` |

## Recon pipelines registered

- `platform/recon/var-v2-parity.ts`
- `platform/recon/ba700-v2-parity.ts`
- `platform/recon/parallel-dispatch-divergence.ts`
- `platform/recon/escalation-surface-parity.ts`
- `platform/recon/posting-source-id-canonical.ts`
- `platform/recon/ras-b2-calibration-coverage.ts`
- `platform/recon/dcam-taxonomy-coverage.ts`
- `platform/recon/lex-cap-utilisation.ts`
- `platform/recon/fsca-reg-to-policy.ts`
- `platform/recon/posting-source-id-canonical.test.ts`
- `platform/recon/provenance-emit-discipline.ts`
- `platform/recon/risk-taxonomy-coverage.ts`
- `platform/recon/no-skipped-tests.test.ts`
- `platform/recon/rms-document-blob-integrity.test.ts`
- `platform/recon/runtime-handler-sync.ts`
- `platform/recon/trigger-spec-handler-symmetry.ts`
- `platform/recon/provision-tick-drift.test.ts`
- `platform/recon/odp-portfolio-recon-dispute-staleness.test.ts`
- `platform/recon/coa-name-no-currency.ts`
- `platform/recon/agent-perf-eval-staleness.ts`
- `platform/recon/tracked-todo.test.ts`
- `platform/recon/odp-repo-recon-dispute-staleness.ts`
- `platform/recon/no-float-money-arithmetic.ts`
- `platform/recon/v2-posture-register-integrity.ts`
- `platform/recon/domain-ownership-coherence.test.ts`
- `platform/recon/agent-spec.ts`
- `platform/recon/v2-no-v1-import.test.ts`
- `platform/recon/v1-removal-v2status-coverage.ts`
- `platform/recon/rwa-computed-v2-parity.ts`
- `platform/recon/fx-lifecycle-parity.ts`
- `platform/recon/goal-loop-run-lifecycle-runner.ts`
- `platform/recon/trade-lifecycle-parity.ts`
- `platform/recon/agent-performance-v2-parity.ts`
- `platform/recon/v2-eval-harness-integrity.ts`
- `platform/recon/dsar-sla.ts`
- `platform/recon/credit-limit-no-trade-without-loaded.test.ts`
- `platform/recon/credit-limit-no-trade-without-loaded.ts`
- `platform/recon/v2-anchor-migration-rehearsal.ts`
- `platform/recon/v2-type-registry-coverage.ts`
- `platform/recon/category-policy-coverage.ts`
- `platform/recon/urn-shape.ts`
- `platform/recon/decision-authority-coverage.ts`
- `platform/recon/regulatory-source-extract-quality.test.ts`
- `platform/recon/agent-scope.ts`
- `platform/recon/gl-v2-fold-equivalence-fx.ts`
- `platform/recon/event-store-no-delete-callsite.ts`
- `platform/recon/recon-period-close-cursor-integrity.ts`
- `platform/recon/odp-collateral-segregation-engine.ts`
- `platform/recon/ba320-fx-v2-parity.ts`
- `platform/recon/regulatory-extraction-coverage.ts`
- `platform/recon/semantic-registry-coverage.ts`
- `platform/recon/dispatch-sync-integrity.ts`
- `platform/recon/credit-limit-breach-unescalated.test.ts`
- `platform/recon/obligation-divergence.ts`
- `platform/recon/basel-constants-coverage.ts`
- `platform/recon/recon-self-test.ts`
- `platform/recon/fx-book-nop-parity.ts`
- `platform/recon/no-swallowed-errors.test.ts`
- `platform/recon/madge-circular-deps.ts`
- `platform/recon/policy-next-review.test.ts`
- `platform/recon/odp-collateral-segregation-breach-staleness.ts`
- `platform/recon/model-risk-gap-inventory.ts`
- `platform/recon/fx-gateway-threshold-enforcement.test.ts`
- `platform/recon/permission-gate-default.ts`
- `platform/recon/posting-engine-single-subscriber.ts`
- `platform/recon/v2-tier-entitlement-coherence.ts`
- `platform/recon/reporting-treatment-registry-conflict.ts`
- `platform/recon/decisions-baseline.ts`
- `platform/recon/decision-record-event-symmetry.ts`
- `platform/recon/gl-v2-parity.ts`
- `platform/recon/no-swallowed-errors.ts`
- `platform/recon/orphan-run-detector.ts`
- `platform/recon/entity-identity-coherence.ts`
- `platform/recon/v2-alias-registry-conformance.test.ts`
- `platform/recon/supersession-annotation-integrity-runner.ts`
- `platform/recon/cash-materialisation-integrity.test.ts`
- `platform/recon/sla-codegen-drift.ts`
- `platform/recon/v2-released-surface-gate.test.ts`
- `platform/recon/agent-spec-cross-link.ts`
- `platform/recon/fx-pair-direction.test.ts`
- `platform/recon/fx-cash-gl-recognition-integrity.test.ts`
- `platform/recon/sla-rule-versioning.ts`
- `platform/recon/fx-settlement-continuity.ts`
- `platform/recon/v2-tier-entitlement-coherence.test.ts`
- `platform/recon/alm-snapshot-v2-parity.ts`
- `platform/recon/v1-only-count-trend.ts`
- `platform/recon/persona-attribution-coherence.ts`
- `platform/recon/v2-store-parity-adapter.ts`
- `platform/recon/v2-released-surface-gate.ts`
- `platform/recon/calc-no-silent-zero.ts`
- `platform/recon/objective-policy-alignment.ts`
- `platform/recon/operational-loss-v2-parity.ts`
- `platform/recon/orphan-run-deliverable-state.ts`
- `platform/recon/obligation-urn-coverage.ts`
- `platform/recon/document-registration.ts`
- `platform/recon/fx-rate-magnitude.test.ts`
- `platform/recon/counterparty-exposure-coverage.ts`
- `platform/recon/gl-ledger-coverage.test.ts`
- `platform/recon/decision-required-event-pairing.ts`
- `platform/recon/odp-collateral-segregation-engine.test.ts`
- `platform/recon/fx-subledger-reconciliation.ts`
- `platform/recon/ras-cluster-feeder-coverage.ts`
- `platform/recon/goal-loop-capability.ts`
- `platform/recon/liquidity-appetite-snapshot-coverage.test.ts`
- `platform/recon/fx-quoting-convention.test.ts`
- `platform/recon/event-type-registry-coverage.ts`
- `platform/recon/goal-loop-capability-runner.ts`
- `platform/recon/v2-fleet-integrity.test.ts`
- `platform/recon/valuation-adjustment-additive.test.ts`
- `platform/recon/risk-taxonomy-coverage.test.ts`
- `platform/recon/decision-distillation-coverage.test.ts`
- `platform/recon/orphan-capability.ts`
- `platform/recon/dashboard-derivation-recon.ts`
- `platform/recon/fx-pair-direction.ts`
- `platform/recon/ccr-single-emitter.test.ts`
- `platform/recon/attribution-var-diversification.ts`
- `platform/recon/posture-v2-parity.ts`
- `platform/recon/dispatch-sync-integrity.test.ts`
- `platform/recon/bucket-c-batch2-v2-parity.ts`
- `platform/recon/mandate-ownership.ts`
- `platform/recon/recon-golden-source-decisions.ts`
- `platform/recon/compliance-obligation-tracing.ts`
- `platform/recon/financial-constants-coverage.ts`
- `platform/recon/decision-event-recon.ts`
- `platform/recon/recon-golden-source-stale-pages.ts`
- `platform/recon/decision-id-hygiene.ts`
- `platform/recon/ba300-v2-parity.ts`
- `platform/recon/npa-gate-integrity.ts`
- `platform/recon/event-store-append-only.test.ts`
- `platform/recon/persona-attribution-coherence.test.ts`
- `platform/recon/decision-distillation-coverage.ts`
- `platform/recon/ras-b6-cyber-severity-coverage.ts`
- `platform/recon/aggregate-id-coverage.ts`
- `platform/recon/liquidity-limit-breach-unescalated.ts`
- `platform/recon/credit-limit-breach-unescalated.ts`
- `platform/recon/v2-no-v1-import.ts`
- `platform/recon/liquidity-limit-coverage.test.ts`
- `platform/recon/v2-store-tee-coverage.ts`
- `platform/recon/test-lineage-not-in-production.ts`
- `platform/recon/v2-control-plane-tenant-registry.ts`
- `platform/recon/ba-form-numbering.test.ts`
- `platform/recon/bond-gl-v2-parity.ts`
- `platform/recon/extraction-provenance.ts`
- `platform/recon/spread-benchmarking.ts`
- `platform/recon/risk-register-closure.test.ts`
- `platform/recon/gl-fold-election-provenance.ts`
- `platform/recon/v2-posture-dimension-vocab.ts`
- `platform/recon/v1-v2-parity-harness.ts`
- `platform/recon/npa-post-approval-finding-review.ts`
- `platform/recon/counterparty-basel-classification-coverage.ts`
- `platform/recon/escalation-channel.ts`
- `platform/recon/no-prop-attribution.ts`
- `platform/recon/regulatory-review-freshness.ts`
- `platform/recon/recon-mtm-vs-gl-amount-delta.ts`
- `platform/recon/fx-gateway-threshold-enforcement.ts`
- `platform/recon/regulatory-golden-source-integrity.ts`
- `platform/recon/no-residual-minor-encoding-fixture-check.ts`
- `platform/recon/seed-manifest-parity.ts`
- `platform/recon/regulatory-source-coverage.test.ts`
- `platform/recon/fx-subledger-reconciliation.test.ts`
- `platform/recon/decisions-events-only.ts`
- `platform/recon/bucket-c-loadbearing-v2-parity.ts`
- `platform/recon/valuation-adjustment-additive.ts`
- `platform/recon/procedure-actor.ts`
- `platform/recon/entity-identity-coherence.test.ts`
- `platform/recon/mtm-reversal-paired-with-reval.ts`
- `platform/recon/credit-limit-v2-parity.ts`
- `platform/recon/bucket-c-batch3-v2-parity.ts`
- `platform/recon/provenance-emit-discipline.test.ts`
- `platform/recon/fx-supported-currency-no-suspense.ts`
- `platform/recon/bucket-c-batch4-v2-parity.ts`
- `platform/recon/ba320-ir-general-weighting-basis.ts`
- `platform/recon/policy-next-review.ts`
- `platform/recon/regulatory-golden-source-integrity.test.ts`
- `platform/recon/permission-policy-coverage.ts`
- `platform/recon/rms-event-projection-parity.ts`
- `platform/recon/fx-quoting-convention.ts`
- `platform/recon/fx-pair-canonical-aggregation.test.ts`
- `platform/recon/product-approval-attestation-integrity.ts`
- `platform/recon/liquidity-limit-coverage.ts`
- `platform/recon/operating-book-selector-coverage.ts`
- `platform/recon/obligation-review-status.ts`
- `platform/recon/no-prop-attribution.test.ts`
- `platform/recon/agent-snapshot-staleness.test.ts`
- `platform/recon/market-data-provenance-gate.ts`
- `platform/recon/clients-entityname-uniqueness.ts`
- `platform/recon/daily-pnl-v2-parity.ts`
- `platform/recon/account-designated-currency.ts`
- `platform/recon/ras-b7-model-tier-discipline-coverage.ts`
- `platform/recon/retention-citation-coverage.ts`
- `platform/recon/v2-csi-cross-tenant-gate.test.ts`
- `platform/recon/cfp-trigger-coverage.test.ts`
- `platform/recon/cash-materialisation-integrity.ts`
- `platform/recon/v2-composition-factory.ts`
- `platform/recon/fx-book-nop-parity.test.ts`
- `platform/recon/bucket-c-batch1-v2-parity.ts`
- `platform/recon/obligations-seed-parity.ts`
- `platform/recon/no-ts-suppression.test.ts`
- `platform/recon/attribution-var-diversification.test.ts`
- `platform/recon/posting-engine-single-subscriber.test.ts`
- `platform/recon/no-residual-minor-encoding-fixture-check.test.ts`
- `platform/recon/zod-schema-coverage.ts`
- `platform/recon/requirement-objective-linkage.ts`
- `platform/recon/fx-v2-parity.ts`
- `platform/recon/provision-tick-drift.ts`
- `platform/recon/decision-authority-routing.ts`
- `platform/recon/cron-map-drift.ts`
- `platform/recon/recon-golden-source-hardcoded-maps.ts`
- `platform/recon/market-data-provenance-gate.test.ts`
- `platform/recon/ba320-ir-general-weighting-basis.test.ts`
- `platform/recon/recon-liquidity-position-vs-settled-notional.ts`
- `platform/recon/ras-register-parity.test.ts`
- `platform/recon/procedure-event-name-coherence.test.ts`
- `platform/recon/dashboard-v2-coverage.test.ts`
- `platform/recon/goal-loop-run-lifecycle.test.ts`
- `platform/recon/account-designated-currency.test.ts`
- `platform/recon/decision-recommendation-recon.ts`
- `platform/recon/obligation-review-status.test.ts`
- `platform/recon/event-store-no-delete-callsite.test.ts`
- `platform/recon/decision-record-event-symmetry.test.ts`
- `platform/recon/recon-ba310-submission-completeness.ts`
- `platform/recon/npa-coverage.ts`
- `platform/recon/ratchet-hardening-only.test.ts`
- `platform/recon/context-pack-freshness.ts`
- `platform/recon/orphan-run-gh-lookup.ts`
- `platform/recon/fx-supported-currency-no-suspense.test.ts`
- `platform/recon/fil-conformance.ts`
- `platform/recon/calc-model-binding.ts`
- `platform/recon/no-skipped-tests.ts`
- `platform/recon/v2-fleet-integrity.ts`
- `platform/recon/governance-attestation-v2-parity.ts`
- `platform/recon/v2-tenant-axis-present.ts`
- `platform/recon/fx-cash-gl-recognition-integrity.ts`
- `platform/recon/rms-document-blob-integrity.ts`
- `platform/recon/domain-ownership-coherence.ts`
- `platform/recon/handler-schema-parity.test.ts`
- `platform/recon/no-transactional-sim-events.ts`
- `platform/recon/goal-loop-run-lifecycle.ts`
- `platform/recon/tb-snapshot-reproducible.ts`
- `platform/recon/fx-settlement-continuity.test.ts`
- `platform/recon/v2-onboarding-readiness.ts`
- `platform/recon/lex-cap-utilisation.test.ts`
- `platform/recon/attribution-nonadditive-no-sum.ts`
- `platform/recon/position-revalued-cites-mark.ts`
- `platform/recon/pnl-signoff-coverage.ts`
- `platform/recon/attribution-additivity.ts`
- `platform/recon/recon-rwa-computed-sourcing.ts`
- `platform/recon/bucket-a-a2-v2-parity.ts`
- `platform/recon/risk-register-closure.ts`
- `platform/recon/provenance-lineage-registered.ts`
- `platform/recon/provenance-tag-coverage.ts`
- `platform/recon/regulatory-source-coverage.ts`
- `platform/recon/agent-snapshot-staleness.ts`
- `platform/recon/tracked-todo.ts`
- `platform/recon/obligation-policy-coverage.ts`
- `platform/recon/all-asset-pnl-ipv-coverage.ts`
- `platform/recon/ras-register-parity.ts`
- `platform/recon/recon-posting-rule-stub-audit.ts`
- `platform/recon/escalation-surface-parity.test.ts`
- `platform/recon/no-residual-minor-encoding.ts`
- `platform/recon/v2-standing-data-seed-parity.ts`
- `platform/recon/money-free-batch-3-v2-parity.ts`
- `platform/recon/ratchet-hardening-only.ts`
- `platform/recon/supersession-annotation-integrity.ts`
- `platform/recon/no-legacy-le-identity.ts`
- `platform/recon/v1-removal-ratchet.ts`
- `platform/recon/npa-deferred-gap-tracking.ts`
- `platform/recon/event-store-append-only.ts`
- `platform/recon/orphan-run-deliverable-state.test.ts`
- `platform/recon/mandate-coverage.ts`
- `platform/recon/prose-duplication.ts`
- `platform/recon/v2-functional-seat-roster-parity.ts`
- `platform/recon/liquidity-appetite-snapshot-coverage.ts`
- `platform/recon/ccr-single-emitter.ts`
- `platform/recon/odp-portfolio-recon-dispute-staleness.ts`
- `platform/recon/v2-decision-impact-sweep-coverage.ts`
- `platform/recon/fx-rate-magnitude.ts`
- `platform/recon/conduct-surveillance-coverage.ts`
- `platform/recon/odp-repo-recon-dispute-staleness.test.ts`
- `platform/recon/cfp-trigger-coverage.ts`
- `platform/recon/graph-ontology-coverage.ts`
- `platform/recon/wall-clock-callsite-coverage.ts`
- `platform/recon/ras-cluster-feeder-coverage.test.ts`
- `platform/recon/money-tail-v2-parity.ts`
- `platform/recon/recon-server-version-vs-head.ts`
- `platform/recon/provenance-badge-coverage.ts`
- `platform/recon/recon-golden-source-schema.ts`
- `platform/recon/procedure-event-name-coherence.ts`
- `platform/recon/orphan-run-classifier.ts`
- `platform/recon/var-nop-exposure-parity.test.ts`
- `platform/recon/regulatory-source-extract-quality.ts`
- `platform/recon/v2-onboarding-readiness.test.ts`
- `platform/recon/charter-scan.ts`
- `platform/recon/harness.ts`
- `platform/recon/credit-limit-annual-review-staleness.ts`
- `platform/recon/regulator-mandate-coverage.ts`
- `platform/recon/v2-alias-registry-conformance.ts`
- `platform/recon/liquidity-limit-breach-unescalated.test.ts`
- `platform/recon/decision-symmetry.ts`
- `platform/recon/expected-event-watchdog.ts`
- `platform/recon/ba-form-numbering.ts`
- `platform/recon/v2-applicability-assessment-integrity.ts`
- `platform/recon/reference-data-v2-parity.ts`
- `platform/recon/v2-csi-cross-tenant-gate.ts`
- `platform/recon/v2-tenant-isolation.ts`
- `platform/recon/money-codec-no-float.ts`
- `platform/recon/v2-saccr-parity.ts`
- `platform/recon/var-nop-exposure-parity.ts`
- `platform/recon/recon-ba-returns-vs-gl-balances.ts`
- `platform/recon/dashboard-v2-coverage.ts`
- `platform/recon/sla-approval-workflow.ts`
- `platform/recon/pnl-attribution-reconciles.ts`
- `platform/recon/no-ts-suppression.ts`
- `platform/recon/rms-briefs-parity.ts`
- `platform/recon/credit-limit-annual-review-staleness.test.ts`
- `platform/recon/fx-pair-canonical-aggregation.ts`
- `platform/recon/gl-ledger-coverage.ts`
- `platform/recon/v2-composition-factory.test.ts`
- `platform/recon/no-hardcoded-reporting-currency.ts`
- `platform/recon/rms-documents-parity.ts`
- `platform/recon/odp-collateral-segregation-breach-staleness.test.ts`

## Security artefacts

| Artefact class | Count | Path |
|---|---|---|
| Threat-model files | 0 | `security/threat-models/` |
| SBOM files | 0 | `security/sbom/` |

_Threat-model and SBOM directories not yet established. Substrate gap — drafted in Senna's spec § Triggers (event-driven on `MergeRequested`) and Rashida's first-90-days posture (`Team/Rashida.md`)._

## Security events (last 7 days)

| Event | Count |
|---|---|
| `SecurityIncidentRaised` | 0 |
| `KeyRotationPerformed` | 0 |
| `ThreatModelGateDecision` | 1 |

_Note: under build-only posture and the AI-driven-bank reframe, security-event production runs against synthetic flows. Live event types are exercised when the substrate hardens._

## Senna's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CcALqCYaXqXAsCxsTemGi"})._

## Provenance

Read `prototype/package.json` `ci` script for gates; listed `prototype/platform/recon/*.ts`; counted files in `security/threat-models/` and `security/sbom/`; replayed security event types from the host event store.
