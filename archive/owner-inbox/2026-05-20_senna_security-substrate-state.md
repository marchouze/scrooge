---
agent: Senna
trigger: security-substrate-state
asOf: 2026-05-20T06:54:39.630Z
decision-required: false
---

# Senna — security substrate state, 2026-05-20

Autonomous run of Senna's weekly security-substrate-state inventory per `Team/Senna.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop.

**Headline:** 49 CI gates · 58 recon pipelines · 0 threat-model artefacts · 0 SBOM files · 0 security incidents in the last 7 days.

## CI gates

| Gate | Command |
|---|---|
| `typecheck` | `bun run typecheck` |
| `lint` | `bun run lint` |
| `test` | `bun run test` |
| `citation-gate` | `bun run citation-gate` |
| `backfill:decisions` | `bun run backfill:decisions` |
| `migrate:decisions-backfill` | `bun run migrate:decisions-backfill` |
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
| `recon:conduct-surveillance-coverage` | `bun run recon:conduct-surveillance-coverage` |
| `recon:counterparty-exposure-coverage` | `bun run recon:counterparty-exposure-coverage` |
| `recon:aggregate-id-coverage` | `bun run recon:aggregate-id-coverage` |
| `recon:market-data-provenance-gate` | `bun run recon:market-data-provenance-gate` |

## Recon pipelines registered

- `platform/recon/parallel-dispatch-divergence.ts`
- `platform/recon/ras-b2-calibration-coverage.ts`
- `platform/recon/dcam-taxonomy-coverage.ts`
- `platform/recon/fsca-reg-to-policy.ts`
- `platform/recon/risk-taxonomy-coverage.ts`
- `platform/recon/runtime-handler-sync.ts`
- `platform/recon/trigger-spec-handler-symmetry.ts`
- `platform/recon/agent-perf-eval-staleness.ts`
- `platform/recon/agent-spec.ts`
- `platform/recon/decision-authority-coverage.ts`
- `platform/recon/agent-scope.ts`
- `platform/recon/semantic-registry-coverage.ts`
- `platform/recon/recon-self-test.ts`
- `platform/recon/madge-circular-deps.ts`
- `platform/recon/permission-gate-default.ts`
- `platform/recon/decisions-baseline.ts`
- `platform/recon/decision-record-event-symmetry.ts`
- `platform/recon/supersession-annotation-integrity-runner.ts`
- `platform/recon/agent-spec-cross-link.ts`
- `platform/recon/document-registration.ts`
- `platform/recon/counterparty-exposure-coverage.ts`
- `platform/recon/decision-required-event-pairing.ts`
- `platform/recon/goal-loop-capability.ts`
- `platform/recon/event-type-registry-coverage.ts`
- `platform/recon/goal-loop-capability-runner.ts`
- `platform/recon/risk-taxonomy-coverage.test.ts`
- `platform/recon/dashboard-derivation-recon.ts`
- `platform/recon/mandate-ownership.ts`
- `platform/recon/decision-event-recon.ts`
- `platform/recon/decision-id-hygiene.ts`
- `platform/recon/aggregate-id-coverage.ts`
- `platform/recon/spread-benchmarking.ts`
- `platform/recon/escalation-channel.ts`
- `platform/recon/decisions-events-only.ts`
- `platform/recon/permission-policy-coverage.ts`
- `platform/recon/rms-event-projection-parity.ts`
- `platform/recon/agent-snapshot-staleness.test.ts`
- `platform/recon/market-data-provenance-gate.ts`
- `platform/recon/retention-citation-coverage.ts`
- `platform/recon/zod-schema-coverage.ts`
- `platform/recon/decision-authority-routing.ts`
- `platform/recon/cron-map-drift.ts`
- `platform/recon/market-data-provenance-gate.test.ts`
- `platform/recon/decision-recommendation-recon.ts`
- `platform/recon/decision-record-event-symmetry.test.ts`
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
- `platform/recon/decision-symmetry.ts`
- `platform/recon/rms-briefs-parity.ts`
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

The substrate is **recon-heavy and security-artefact-empty**: 49 CI gates and 58 recon pipelines are live and cross-wired, but `security/threat-models/` and `security/sbom/` both contain zero artefacts, and the three security event types the inventory expects to project against — `SecurityIncidentRaised`, `KeyRotationPerformed`, `ThreatModelGateDecision` — have produced zero events in the last seven days. The bottleneck is unambiguously the threat-model and SBOM artefact classes; everything else is conformance scaffolding for the platform substrate, not for the security control surface that Joint Standard 2 of 2024 paragraphs 23–27 (information security risk management, including secure SDLC and key management) actually binds us to evidence.

Three observations rank as load-bearing. First, there is no `recon:threat-model-coverage` or `recon:sbom-freshness` gate in the 49-gate list, which means the absent artefacts are not even *flagged* as absent — the substrate is silently zero, not loudly zero, and that is the worse posture under JS2 para 25 (documented and reviewed controls). Second, `KeyRotationPerformed: 0` over seven days is consistent with policy if rotation is quarterly, but with no `KeyRotationPerformed` event ever projected we cannot distinguish "not yet due" from "rotation pipeline not wired to the HSM event emitter" — this is the control most directly load-bearing on POPIA s.19 (appropriate technical safeguards) and s.21 (operator processing) for any key custodying personal data. Third, `ThreatModelGateDecision: 0` with zero threat-model files means the gate has no decisions to make; the citation chain from JS2 para 24 (risk assessment before change) down to a recorded decision is currently unbacked.

Next hardening step, concretely: (1) author `security/threat-models/TM-PLATFORM-EVENT-STORE-001.md` as the first artefact — the event store is the highest-blast-radius asset and every recon pipeline above depends on it; (2) add `recon:threat-model-coverage` to the CI gate set, asserting that every aggregate listed in `recon:aggregate-id-coverage` has a corresponding threat-model file or a logged exception register entry; (3) emit a synthetic `KeyRotationPerformed` event from the HSM rotation runbook on next execution to prove the projection path is live, even if the rotation itself is not yet due. Until (1) and (2) land, the JS2 para 23 evidentiary position is posture-only.

## Provenance

Read `prototype/package.json` `ci` script for gates; listed `prototype/platform/recon/*.ts`; counted files in `security/threat-models/` and `security/sbom/`; replayed security event types from the host event store.
