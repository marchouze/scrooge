---
agent: Senna
trigger: security-substrate-state
asOf: 2026-05-28T08:21:54.286Z
decision-required: false
---

# Senna — security substrate state, 2026-05-28

Autonomous run of Senna's weekly security-substrate-state inventory per `Team/Senna.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop.

**Headline:** 4 CI gates · 122 recon pipelines · 0 threat-model artefacts · 0 SBOM files · 0 security incidents in the last 7 days.

## CI gates

| Gate | Command |
|---|---|
| `ci:core` | `bun run ci:core` |
| `ci:migrate` | `bun run ci:migrate` |
| `ci:recon:infra` | `bun run ci:recon:infra` |
| `ci:recon:domain` | `bun run ci:recon:domain` |

## Recon pipelines registered

- `platform/recon/parallel-dispatch-divergence.ts`
- `platform/recon/ras-b2-calibration-coverage.ts`
- `platform/recon/dcam-taxonomy-coverage.ts`
- `platform/recon/lex-cap-utilisation.ts`
- `platform/recon/fsca-reg-to-policy.ts`
- `platform/recon/risk-taxonomy-coverage.ts`
- `platform/recon/runtime-handler-sync.ts`
- `platform/recon/trigger-spec-handler-symmetry.ts`
- `platform/recon/agent-perf-eval-staleness.ts`
- `platform/recon/agent-spec.ts`
- `platform/recon/credit-limit-no-trade-without-loaded.test.ts`
- `platform/recon/credit-limit-no-trade-without-loaded.ts`
- `platform/recon/urn-shape.ts`
- `platform/recon/decision-authority-coverage.ts`
- `platform/recon/agent-scope.ts`
- `platform/recon/event-store-no-delete-callsite.ts`
- `platform/recon/recon-period-close-cursor-integrity.ts`
- `platform/recon/regulatory-extraction-coverage.ts`
- `platform/recon/semantic-registry-coverage.ts`
- `platform/recon/dispatch-sync-integrity.ts`
- `platform/recon/credit-limit-breach-unescalated.test.ts`
- `platform/recon/recon-self-test.ts`
- `platform/recon/madge-circular-deps.ts`
- `platform/recon/policy-next-review.test.ts`
- `platform/recon/model-risk-gap-inventory.ts`
- `platform/recon/permission-gate-default.ts`
- `platform/recon/decisions-baseline.ts`
- `platform/recon/decision-record-event-symmetry.ts`
- `platform/recon/entity-identity-coherence.ts`
- `platform/recon/supersession-annotation-integrity-runner.ts`
- `platform/recon/agent-spec-cross-link.ts`
- `platform/recon/fx-pair-direction.test.ts`
- `platform/recon/persona-attribution-coherence.ts`
- `platform/recon/document-registration.ts`
- `platform/recon/fx-rate-magnitude.test.ts`
- `platform/recon/counterparty-exposure-coverage.ts`
- `platform/recon/gl-ledger-coverage.test.ts`
- `platform/recon/decision-required-event-pairing.ts`
- `platform/recon/goal-loop-capability.ts`
- `platform/recon/liquidity-appetite-snapshot-coverage.test.ts`
- `platform/recon/fx-quoting-convention.test.ts`
- `platform/recon/event-type-registry-coverage.ts`
- `platform/recon/goal-loop-capability-runner.ts`
- `platform/recon/risk-taxonomy-coverage.test.ts`
- `platform/recon/dashboard-derivation-recon.ts`
- `platform/recon/fx-pair-direction.ts`
- `platform/recon/dispatch-sync-integrity.test.ts`
- `platform/recon/mandate-ownership.ts`
- `platform/recon/recon-golden-source-decisions.ts`
- `platform/recon/compliance-obligation-tracing.ts`
- `platform/recon/decision-event-recon.ts`
- `platform/recon/recon-golden-source-stale-pages.ts`
- `platform/recon/decision-id-hygiene.ts`
- `platform/recon/npa-gate-integrity.ts`
- `platform/recon/event-store-append-only.test.ts`
- `platform/recon/persona-attribution-coherence.test.ts`
- `platform/recon/aggregate-id-coverage.ts`
- `platform/recon/liquidity-limit-breach-unescalated.ts`
- `platform/recon/credit-limit-breach-unescalated.ts`
- `platform/recon/liquidity-limit-coverage.test.ts`
- `platform/recon/test-lineage-not-in-production.ts`
- `platform/recon/spread-benchmarking.ts`
- `platform/recon/escalation-channel.ts`
- `platform/recon/no-prop-attribution.ts`
- `platform/recon/recon-mtm-vs-gl-amount-delta.ts`
- `platform/recon/decisions-events-only.ts`
- `platform/recon/procedure-actor.ts`
- `platform/recon/entity-identity-coherence.test.ts`
- `platform/recon/mtm-reversal-paired-with-reval.ts`
- `platform/recon/policy-next-review.ts`
- `platform/recon/permission-policy-coverage.ts`
- `platform/recon/rms-event-projection-parity.ts`
- `platform/recon/fx-quoting-convention.ts`
- `platform/recon/fx-pair-canonical-aggregation.test.ts`
- `platform/recon/product-approval-attestation-integrity.ts`
- `platform/recon/liquidity-limit-coverage.ts`
- `platform/recon/obligation-review-status.ts`
- `platform/recon/no-prop-attribution.test.ts`
- `platform/recon/agent-snapshot-staleness.test.ts`
- `platform/recon/market-data-provenance-gate.ts`
- `platform/recon/clients-entityname-uniqueness.ts`
- `platform/recon/retention-citation-coverage.ts`
- `platform/recon/zod-schema-coverage.ts`
- `platform/recon/decision-authority-routing.ts`
- `platform/recon/cron-map-drift.ts`
- `platform/recon/recon-golden-source-hardcoded-maps.ts`
- `platform/recon/market-data-provenance-gate.test.ts`
- `platform/recon/recon-liquidity-position-vs-settled-notional.ts`
- `platform/recon/procedure-event-name-coherence.test.ts`
- `platform/recon/decision-recommendation-recon.ts`
- `platform/recon/event-store-no-delete-callsite.test.ts`
- `platform/recon/decision-record-event-symmetry.test.ts`
- `platform/recon/lex-cap-utilisation.test.ts`
- `platform/recon/position-revalued-cites-mark.ts`
- `platform/recon/provenance-lineage-registered.ts`
- `platform/recon/provenance-tag-coverage.ts`
- `platform/recon/agent-snapshot-staleness.ts`
- `platform/recon/obligation-policy-coverage.ts`
- `platform/recon/recon-posting-rule-stub-audit.ts`
- `platform/recon/supersession-annotation-integrity.ts`
- `platform/recon/event-store-append-only.ts`
- `platform/recon/mandate-coverage.ts`
- `platform/recon/prose-duplication.ts`
- `platform/recon/liquidity-appetite-snapshot-coverage.ts`
- `platform/recon/fx-rate-magnitude.ts`
- `platform/recon/conduct-surveillance-coverage.ts`
- `platform/recon/graph-ontology-coverage.ts`
- `platform/recon/wall-clock-callsite-coverage.ts`
- `platform/recon/recon-server-version-vs-head.ts`
- `platform/recon/provenance-badge-coverage.ts`
- `platform/recon/recon-golden-source-schema.ts`
- `platform/recon/procedure-event-name-coherence.ts`
- `platform/recon/harness.ts`
- `platform/recon/credit-limit-annual-review-staleness.ts`
- `platform/recon/liquidity-limit-breach-unescalated.test.ts`
- `platform/recon/decision-symmetry.ts`
- `platform/recon/recon-ba-returns-vs-gl-balances.ts`
- `platform/recon/rms-briefs-parity.ts`
- `platform/recon/credit-limit-annual-review-staleness.test.ts`
- `platform/recon/fx-pair-canonical-aggregation.ts`
- `platform/recon/gl-ledger-coverage.ts`
- `platform/recon/rms-documents-parity.ts`

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
| `ThreatModelGateDecision` | 0 |

_Note: under build-only posture and the AI-driven-bank reframe, security-event production runs against synthetic flows. Live event types are exercised when the substrate hardens._

## Senna's narrative

Substrate is recon-heavy but security-artefact-empty: 4 CI gates and 122 recon pipelines are live, yet `security/threat-models/` and `security/sbom/` both hold zero artefacts and the last seven days show zero `SecurityIncidentRaised`, zero `KeyRotationPerformed`, zero `ThreatModelGateDecision` events. The bottleneck is the threat-model and SBOM artefact classes — the directories are declared posture but nothing is on disk, so `ci:recon:domain` cannot yet enforce coverage even if a pipeline were added. Joint Standard 2 of 2024 (cyber resilience — threat & vulnerability management, software supply chain) and POPIA s.19 (reasonable technical safeguards) both bind here; we are currently asserting these controls in spec only.

Three observations rank as load-bearing. First, of the 122 recon pipelines none is a `threat-model-coverage.ts` or `sbom-freshness.ts` — `ci:recon:domain` is well-instrumented for ledger and decision invariants but is not yet backstopping the security substrate, which means the empty `security/threat-models/` directory is silently tolerated rather than gated. Second, zero `KeyRotationPerformed` events is consistent with quarterly cadence on a 7-day window, but combined with zero historical emissions it suggests the event-type is declared in the registry without a producing handler — HSM custody is load-bearing on POPIA s.19 and JS2 §6 (cryptographic controls) and we cannot evidence rotation from events alone. Third, with zero SBOM artefacts we have no supply-chain attestation surface for JS2 third-party / ICT supplier obligations, and no input to s.22 breach-scoping if a dependency CVE lands.

Next hardening step, concretely: (1) author `TM-NEON-EVENT-STORE-001` as the first threat-model artefact — the event store is referenced by `event-store-append-only.ts` and `event-store-no-delete-callsite.ts` as an integrity surface and warrants a documented TM before any further recon coverage is meaningful; (2) register `threat-model-coverage.ts` under `ci:recon:domain` so that any aggregate marked material in the entity registry without a corresponding TM artefact fails the gate; (3) wire a `KeyRotationPerformed` emitter into the HSM custody handler so the quarterly-cadence claim becomes event-evidenced rather than policy-asserted. SBOM generation can follow once the TM gate is green — it is a separate workstream and should not block the threat-model substrate from coming online.

## Provenance

Read `prototype/package.json` `ci` script for gates; listed `prototype/platform/recon/*.ts`; counted files in `security/threat-models/` and `security/sbom/`; replayed security event types from the host event store.
