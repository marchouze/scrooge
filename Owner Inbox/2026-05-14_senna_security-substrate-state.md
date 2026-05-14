---
agent: Senna
trigger: security-substrate-state
asOf: 2026-05-14T05:54:29.854Z
decision-required: false
---

# Senna — security substrate state, 2026-05-14

Autonomous run of Senna's weekly security-substrate-state inventory per `Team/Senna.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop.

**Headline:** 29 CI gates · 31 recon pipelines · 0 threat-model artefacts · 0 SBOM files · 0 security incidents in the last 7 days.

## CI gates

| Gate | Command |
|---|---|
| `typecheck` | `bun run typecheck` |
| `lint` | `bun run lint` |
| `test` | `bun run test` |
| `citation-gate` | `bun run citation-gate` |
| `backfill:decisions` | `bun run backfill:decisions` |
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
| `recon:event-type-registry-coverage` | `bun run recon:event-type-registry-coverage` |
| `recon:decision-required-event-pairing` | `bun run recon:decision-required-event-pairing` |
| `recon:goal-loop-capability` | `bun run recon:goal-loop-capability` |
| `recon:risk-taxonomy-coverage` | `bun run recon:risk-taxonomy-coverage` |
| `recon:decision-record-event-symmetry` | `bun run recon:decision-record-event-symmetry` |
| `recon:document-registration` | `bun run recon:document-registration` |
| `recon:wall-clock-callsite-coverage` | `bun run recon:wall-clock-callsite-coverage` |
| `recon:fsca-reg-to-policy` | `bun run recon:fsca-reg-to-policy` |

## Recon pipelines registered

- `platform/recon/parallel-dispatch-divergence.ts`
- `platform/recon/ras-b2-calibration-coverage.ts`
- `platform/recon/fsca-reg-to-policy.ts`
- `platform/recon/risk-taxonomy-coverage.ts`
- `platform/recon/runtime-handler-sync.ts`
- `platform/recon/trigger-spec-handler-symmetry.ts`
- `platform/recon/agent-spec.ts`
- `platform/recon/permission-gate-default.ts`
- `platform/recon/decision-record-event-symmetry.ts`
- `platform/recon/supersession-annotation-integrity-runner.ts`
- `platform/recon/agent-spec-cross-link.ts`
- `platform/recon/document-registration.ts`
- `platform/recon/decision-required-event-pairing.ts`
- `platform/recon/goal-loop-capability.ts`
- `platform/recon/event-type-registry-coverage.ts`
- `platform/recon/goal-loop-capability-runner.ts`
- `platform/recon/risk-taxonomy-coverage.test.ts`
- `platform/recon/dashboard-derivation-recon.ts`
- `platform/recon/mandate-ownership.ts`
- `platform/recon/decision-event-recon.ts`
- `platform/recon/retention-citation-coverage.ts`
- `platform/recon/cron-map-drift.ts`
- `platform/recon/decision-recommendation-recon.ts`
- `platform/recon/decision-record-event-symmetry.test.ts`
- `platform/recon/provenance-lineage-registered.ts`
- `platform/recon/provenance-tag-coverage.ts`
- `platform/recon/supersession-annotation-integrity.ts`
- `platform/recon/prose-duplication.ts`
- `platform/recon/wall-clock-callsite-coverage.ts`
- `platform/recon/provenance-badge-coverage.ts`
- `platform/recon/harness.ts`

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

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Inventory above stands on its own._

## Provenance

Read `prototype/package.json` `ci` script for gates; listed `prototype/platform/recon/*.ts`; counted files in `security/threat-models/` and `security/sbom/`; replayed security event types from the host event store.
