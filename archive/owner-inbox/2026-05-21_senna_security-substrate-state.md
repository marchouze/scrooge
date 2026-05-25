---
agent: Senna
trigger: security-substrate-state
asOf: 2026-05-21T07:37:36.123Z
decision-required: false
---

# Senna — security substrate state, 2026-05-21

Autonomous run of Senna's weekly security-substrate-state inventory per `Team/Senna.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop.

**Headline:** 60 CI gates · 77 recon pipelines · 0 threat-model artefacts · 0 SBOM files · 0 security incidents in the last 7 days.

## CI gates

| Gate | Command |
|---|---|
| `typecheck` | `bun run typecheck` |
| `lint` | `bun run lint` |
| `test` | `bun run test` |
| `citation-gate` | `bun run citation-gate` |
| `backfill:decisions` | `bun run backfill:decisions` |
| `migrate:decisions-backfill` | `bun run migrate:decisions-backfill` |
| `backfill:policy-activations` | `bun run backfill:policy-activations` |
| `recon` | `bun run recon` |
| `recon:dashboard` | `bun run recon:dashboard` |
| `recon:prose-duplication` | `bun run recon:prose-duplication` |
| `recon:runtime-handler-sync` | `bun run recon:runtime-handler-sync` |
| `recon:agent-spec` | `bun run recon:agent-spec` |
| `recon:agent-spec-cross-link` | `bun run recon:agent-spec-cross-link` |
| `recon:cron-map-drift` | `bun run recon:cron-map-drift` |
| `recon:decision-recommendation` | `bun run recon:decision-recommendation` |
| `recon:parallel-dispatch-divergence` | `bun run recon:parallel-dispatch-divergence` |
| `recon:retention-citation-coverage` | `bun run recon:retention-citation-coverage` |
| `recon:trigger-spec-handler-symmetry` | `bun run recon:trigger-spec-handler-symmetry` |
| `recon:provenance-tag-coverage` | `bun run recon:provenance-tag-coverage` |
| `recon:provenance-lineage-registered` | `bun run recon:provenance-lineage-registered` |
| `recon:provenance-badge-coverage` | `bun run recon:provenance-badge-coverage` |
| `recon:ras-b2-calibration-coverage` | `bun run recon:ras-b2-calibration-coverage` |
| `recon:permission-gate-default` | `bun run recon:permission-gate-default` |
| `recon:permission-policy-coverage` | `bun run recon:permission-policy-coverage` |
| `recon:event-type-registry-coverage` | `bun run recon:event-type-registry-coverage` |
| `recon:decision-required-event-pairing` | `bun run recon:decision-required-event-pairing` |
| `recon:agent-snapshot-staleness` | `bun run recon:agent-snapshot-staleness` |
| `recon:goal-loop-capability` | `bun run recon:goal-loop-capability` |
| `recon:risk-taxonomy-coverage` | `bun run recon:risk-taxonomy-coverage` |
| `recon:decision-record-event-symmetry` | `bun run recon:decision-record-event-symmetry` |
| `recon:document-registration` | `bun run recon:document-registration` |
| `recon:wall-clock-callsite-coverage` | `bun run recon:wall-clock-callsite-coverage` |
| `recon:fsca-reg-to-policy` | `bun run recon:fsca-reg-to-policy` |
| `recon:madge-circular-deps` | `bun run recon:madge-circular-deps` |
| `recon:graph-ontology` | `bun run recon:graph-ontology` |
| `recon:dcam-taxonomy-coverage` | `bun run recon:dcam-taxonomy-coverage` |
| `recon:semantic-registry-coverage` | `bun run recon:semantic-registry-coverage` |
| `recon:decisions-events-only` | `bun run recon:decisions-events-only` |
| `recon:decision-symmetry` | `bun run recon:decision-symmetry` |
| `recon:decision-id-hygiene` | `bun run recon:decision-id-hygiene` |
| `recon:decision-authority-coverage` | `bun run recon:decision-authority-coverage` |
| `recon:decision-authority-routing` | `bun run recon:decision-authority-routing` |
| `recon:zod-schema-coverage` | `bun run recon:zod-schema-coverage` |
| `recon:rms-event-projection-parity` | `bun run recon:rms-event-projection-parity` |
| `recon:rms-briefs-parity` | `bun run recon:rms-briefs-parity` |
| `recon:rms-documents-parity` | `bun run recon:rms-documents-parity` |
| `recon:dispatch-sync-integrity` | `bun run recon:dispatch-sync-integrity` |
| `recon:conduct-surveillance-coverage` | `bun run recon:conduct-surveillance-coverage` |
| `recon:counterparty-exposure-coverage` | `bun run recon:counterparty-exposure-coverage` |
| `recon:aggregate-id-coverage` | `bun run recon:aggregate-id-coverage` |
| `recon:market-data-provenance-gate` | `bun run recon:market-data-provenance-gate` |
| `recon:credit-limit-no-trade-without-loaded` | `bun run recon:credit-limit-no-trade-without-loaded` |
| `recon:credit-limit-annual-review-staleness` | `bun run recon:credit-limit-annual-review-staleness` |
| `recon:lex-cap-utilisation` | `bun run recon:lex-cap-utilisation` |
| `recon:credit-limit-breach-unescalated` | `bun run recon:credit-limit-breach-unescalated` |
| `recon:position-revalued-cites-mark` | `bun run recon:position-revalued-cites-mark` |
| `recon:no-prop-attribution` | `bun run recon:no-prop-attribution` |
| `recon:persona-attribution-coherence` | `bun run recon:persona-attribution-coherence` |
| `recon:policy-next-review` | `bun run recon:policy-next-review` |
| `recon:gl-ledger-coverage` | `bun run recon:gl-ledger-coverage` |

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
- `platform/recon/decision-authority-coverage.ts`
- `platform/recon/agent-scope.ts`
- `platform/recon/semantic-registry-coverage.ts`
- `platform/recon/dispatch-sync-integrity.ts`
- `platform/recon/credit-limit-breach-unescalated.test.ts`
- `platform/recon/recon-self-test.ts`
- `platform/recon/madge-circular-deps.ts`
- `platform/recon/policy-next-review.test.ts`
- `platform/recon/permission-gate-default.ts`
- `platform/recon/decisions-baseline.ts`
- `platform/recon/decision-record-event-symmetry.ts`
- `platform/recon/supersession-annotation-integrity-runner.ts`
- `platform/recon/agent-spec-cross-link.ts`
- `platform/recon/persona-attribution-coherence.ts`
- `platform/recon/document-registration.ts`
- `platform/recon/counterparty-exposure-coverage.ts`
- `platform/recon/gl-ledger-coverage.test.ts`
- `platform/recon/decision-required-event-pairing.ts`
- `platform/recon/goal-loop-capability.ts`
- `platform/recon/event-type-registry-coverage.ts`
- `platform/recon/goal-loop-capability-runner.ts`
- `platform/recon/risk-taxonomy-coverage.test.ts`
- `platform/recon/dashboard-derivation-recon.ts`
- `platform/recon/dispatch-sync-integrity.test.ts`
- `platform/recon/mandate-ownership.ts`
- `platform/recon/decision-event-recon.ts`
- `platform/recon/decision-id-hygiene.ts`
- `platform/recon/persona-attribution-coherence.test.ts`
- `platform/recon/aggregate-id-coverage.ts`
- `platform/recon/credit-limit-breach-unescalated.ts`
- `platform/recon/spread-benchmarking.ts`
- `platform/recon/escalation-channel.ts`
- `platform/recon/no-prop-attribution.ts`
- `platform/recon/decisions-events-only.ts`
- `platform/recon/policy-next-review.ts`
- `platform/recon/permission-policy-coverage.ts`
- `platform/recon/rms-event-projection-parity.ts`
- `platform/recon/no-prop-attribution.test.ts`
- `platform/recon/agent-snapshot-staleness.test.ts`
- `platform/recon/market-data-provenance-gate.ts`
- `platform/recon/retention-citation-coverage.ts`
- `platform/recon/zod-schema-coverage.ts`
- `platform/recon/decision-authority-routing.ts`
- `platform/recon/cron-map-drift.ts`
- `platform/recon/market-data-provenance-gate.test.ts`
- `platform/recon/decision-recommendation-recon.ts`
- `platform/recon/decision-record-event-symmetry.test.ts`
- `platform/recon/lex-cap-utilisation.test.ts`
- `platform/recon/position-revalued-cites-mark.ts`
- `platform/recon/provenance-lineage-registered.ts`
- `platform/recon/provenance-tag-coverage.ts`
- `platform/recon/agent-snapshot-staleness.ts`
- `platform/recon/supersession-annotation-integrity.ts`
- `platform/recon/prose-duplication.ts`
- `platform/recon/conduct-surveillance-coverage.ts`
- `platform/recon/graph-ontology-coverage.ts`
- `platform/recon/wall-clock-callsite-coverage.ts`
- `platform/recon/provenance-badge-coverage.ts`
- `platform/recon/harness.ts`
- `platform/recon/credit-limit-annual-review-staleness.ts`
- `platform/recon/decision-symmetry.ts`
- `platform/recon/rms-briefs-parity.ts`
- `platform/recon/credit-limit-annual-review-staleness.test.ts`
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

Substrate is **recon-heavy, security-artefact-empty**: 60 CI gates and 77 recon pipelines are live and load-bearing on integrity, provenance, and conduct controls, but the security-specific artefact directories — `security/threat-models/` and `security/sbom/` — are both at zero, and the inventory has logged no `SecurityIncidentRaised`, `KeyRotationPerformed`, or `ThreatModelGateDecision` events in the last seven days. The bottleneck is unambiguously **threat-model and SBOM artefacts**: the operational gates exist in posture, not on disk.

The three load-bearing observations. **First**, there is no `recon:threat-model-coverage` or `recon:sbom-freshness` gate in the 60-gate list — meaning the absence of threat models is not itself a CI failure, so the empty directory is silent rather than blocking. Under Joint Standard 2 of 2024 §6 (risk management) and §8 (change management), threat-model coverage of in-scope systems is expected to be demonstrable; right now it is not. **Second**, zero `KeyRotationPerformed` events over seven days is consistent with a quarterly rotation cadence, but with zero artefacts in `security/sbom/` and no rotation-evidence recon, we cannot distinguish "not yet due" from "not happening" — this is a custody-evidence gap directly relevant to POPIA s.19 (security safeguards) and JS2 §7 (cryptographic controls). **Third**, `recon:provenance-tag-coverage`, `recon:provenance-lineage-registered`, and `recon:market-data-provenance-gate` are all live and presumably green, which means provenance integrity is genuinely defended — but none of them speak to *personal-data* flows specifically, so POPIA s.19–22 coverage is currently inferred from generic provenance gates rather than asserted by a dedicated control.

Next hardening step, in order: (1) author `security/threat-models/TM-PLATFORM-CORE-001.md` covering the event store and dispatch path — that is the spine everything else runs on, and JS2 §6.2 requires it before further system extensions; (2) add a `recon:threat-model-coverage` gate that fails when any agent listed in `Team/` lacks a referenced threat-model artefact, so the directory's emptiness becomes a build failure rather than a silent gap; (3) stand up `recon:key-rotation-cadence` against the HSM custody log so a quarter passing without a `KeyRotationPerformed` event is a CI signal, not a calendar oversight. Until (1) and (2) land, the substrate's security posture is asserted by spec and not by gate — which is precisely the distinction this inventory is meant to expose.

## Provenance

Read `prototype/package.json` `ci` script for gates; listed `prototype/platform/recon/*.ts`; counted files in `security/threat-models/` and `security/sbom/`; replayed security event types from the host event store.
