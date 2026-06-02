---
agent: Thandiwe
trigger: audit-committee-prep
asOf: 2026-06-02T07:47:48.143Z
decision-required: false
---

# Thandiwe — Audit-Committee prep, 2026-06-02

Autonomous run of Thandiwe's weekly Audit-Committee prep per `Team/Thandiwe.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Feeds the Interim Audit Forum (Owen chair) until a Board AC is constituted.

**Headline:** 18 `AuditFinding` events in the last 7 days (13 HIGH/Tier-1) · 225 `ReconResult` / 0 `ReconViolation` · 2 Owen governance-cycle prep runs · 1 prior AC-pack run in the last 30 days.

## Recent AuditFinding events (last 7 days)

| When | Finding | Severity | Title |
|---|---|---|---|
| 2026-05-30 | `F-VERA-20260530-DZIF` | high | agent-scope: agent-decision:RAVI-NOP-RECOMPUTE-2026-05-28 — AgentDecision RAVI-NOP-RECOMPUTE-2026-05-28: `decidedBy` "agent:ravi:intraday-stress" does not resolve to any registered agent (no matching AgentRegistered event). Register the agent before it makes autonomous decisions. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF. |
| 2026-05-30 | `F-VERA-20260530-YK63` | high | agent-scope: agent-decision:EITAN-FX-REDUCE-2026-05-28 — AgentDecision EITAN-FX-REDUCE-2026-05-28 (agent: agent:eitan): `inScopeBy` "agent:eitan" is not in the agent's registered `decisionsInScope` [Approve daily SAMOS funding plan (operational), Sign LCR / NSFR / IRRBB submissions to Camille, Approve repo-book sizing within RAS, Approve hedge programmes within RAS, Chair ALCO; approve treasury limits within Helena's RAS, Approve FX-position adjustments within Excon, Approve FTP curve refresh, Approve collateral inventory moves]. Out-of-scope decision. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF. |
| 2026-05-30 | `F-VERA-20260530-X47M` | medium | code-quality:swallowed-errors: scripts/migrate/backfill-aggregate-ids.ts:128 — Swallowed error: `catch { /* ok */ }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore. |
| 2026-05-30 | `F-VERA-20260530-VCA2` | medium | code-quality:swallowed-errors: scripts/migrate/backfill-aggregate-ids.ts:123 — Swallowed error: `catch { /* ok */ }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore. |
| 2026-05-30 | `F-VERA-20260530-NFQT` | medium | code-quality:swallowed-errors: scripts/migrate/backfill-aggregate-ids.ts:118 — Swallowed error: `catch { /* ok */ }`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore. |
| 2026-05-30 | `F-VERA-20260530-CTN4` | high | agent-scope: agent-decision:RAVI-NOP-RECOMPUTE-2026-05-28 — AgentDecision RAVI-NOP-RECOMPUTE-2026-05-28: `decidedBy` "agent:ravi:intraday-stress" does not resolve to any registered agent (no matching AgentRegistered event). Register the agent before it makes autonomous decisions. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF. |
| 2026-05-30 | `F-VERA-20260530-F02J` | high | agent-scope: agent-decision:EITAN-FX-REDUCE-2026-05-28 — AgentDecision EITAN-FX-REDUCE-2026-05-28 (agent: agent:eitan): `inScopeBy` "agent:eitan" is not in the agent's registered `decisionsInScope` [Approve daily SAMOS funding plan (operational), Sign LCR / NSFR / IRRBB submissions to Camille, Approve repo-book sizing within RAS, Approve hedge programmes within RAS, Chair ALCO; approve treasury limits within Helena's RAS, Approve FX-position adjustments within Excon, Approve FTP curve refresh, Approve collateral inventory moves]. Out-of-scope decision. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF. |
| 2026-05-30 | `F-VERA-20260530-YGFV` | high | agent-scope: agent-decision:RAVI-NOP-RECOMPUTE-2026-05-28 — AgentDecision RAVI-NOP-RECOMPUTE-2026-05-28: `decidedBy` "agent:ravi:intraday-stress" does not resolve to any registered agent (no matching AgentRegistered event). Register the agent before it makes autonomous decisions. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF. |
| 2026-05-30 | `F-VERA-20260530-ZW2R` | high | agent-scope: agent-decision:EITAN-FX-REDUCE-2026-05-28 — AgentDecision EITAN-FX-REDUCE-2026-05-28 (agent: agent:eitan): `inScopeBy` "agent:eitan" is not in the agent's registered `decisionsInScope` [Approve daily SAMOS funding plan (operational), Sign LCR / NSFR / IRRBB submissions to Camille, Approve repo-book sizing within RAS, Approve hedge programmes within RAS, Chair ALCO; approve treasury limits within Helena's RAS, Approve FX-position adjustments within Excon, Approve FTP curve refresh, Approve collateral inventory moves]. Out-of-scope decision. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF. |
| 2026-05-29 | `F-VERA-20260529-0KEN` | high | agent-scope: agent-decision:RAVI-NOP-RECOMPUTE-2026-05-28 — AgentDecision RAVI-NOP-RECOMPUTE-2026-05-28: `decidedBy` "agent:ravi:intraday-stress" does not resolve to any registered agent (no matching AgentRegistered event). Register the agent before it makes autonomous decisions. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF. |
| 2026-05-29 | `F-VERA-20260529-A08Z` | high | agent-scope: agent-decision:EITAN-FX-REDUCE-2026-05-28 — AgentDecision EITAN-FX-REDUCE-2026-05-28 (agent: agent:eitan): `inScopeBy` "agent:eitan" is not in the agent's registered `decisionsInScope` [Approve daily SAMOS funding plan (operational), Sign LCR / NSFR / IRRBB submissions to Camille, Approve repo-book sizing within RAS, Approve hedge programmes within RAS, Chair ALCO; approve treasury limits within Helena's RAS, Approve FX-position adjustments within Excon, Approve FTP curve refresh, Approve collateral inventory moves]. Out-of-scope decision. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF. |
| 2026-05-29 | `F-ATLAS-20260529-BUSDEDUP` | medium | Concurrent bus-instance dedup race produced 88 duplicate BusDispatched{ok} rows (2026-05-26); pre-protocol baseline, excluded from A22 recon, root-cause fix is a follow-on. |
| 2026-05-29 | `F-ATLAS-20260529-QM4D` | medium | recon:event-store-append-only archive boundary gap (123431↔185638) — AUTOINCREMENT numbering discontinuity misread as loss; boundary metadata repaired, no events lost. |
| 2026-05-29 | `F-VERA-20260529-JU66` | high | agent-scope: agent-decision:RAVI-NOP-RECOMPUTE-2026-05-28 — AgentDecision RAVI-NOP-RECOMPUTE-2026-05-28: `decidedBy` "agent:ravi:intraday-stress" does not resolve to any registered agent (no matching AgentRegistered event). Register the agent before it makes autonomous decisions. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF. |
| 2026-05-29 | `F-VERA-20260529-0I5B` | high | agent-scope: agent-decision:EITAN-FX-REDUCE-2026-05-28 — AgentDecision EITAN-FX-REDUCE-2026-05-28 (agent: agent:eitan): `inScopeBy` "agent:eitan" is not in the agent's registered `decisionsInScope` [Approve daily SAMOS funding plan (operational), Sign LCR / NSFR / IRRBB submissions to Camille, Approve repo-book sizing within RAS, Approve hedge programmes within RAS, Chair ALCO; approve treasury limits within Helena's RAS, Approve FX-position adjustments within Excon, Approve FTP curve refresh, Approve collateral inventory moves]. Out-of-scope decision. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF. |
| 2026-05-29 | `F-VERA-20260529-VZO0` | high | agent-scope: agent-decision:RAVI-NOP-RECOMPUTE-2026-05-28 — AgentDecision RAVI-NOP-RECOMPUTE-2026-05-28: `decidedBy` "agent:ravi:intraday-stress" does not resolve to any registered agent (no matching AgentRegistered event). Register the agent before it makes autonomous decisions. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF. |
| 2026-05-29 | `F-VERA-20260529-4E6F` | high | agent-scope: agent-decision:EITAN-FX-REDUCE-2026-05-28 — AgentDecision EITAN-FX-REDUCE-2026-05-28 (agent: agent:eitan): `inScopeBy` "agent:eitan" is not in the agent's registered `decisionsInScope` [Approve daily SAMOS funding plan (operational), Sign LCR / NSFR / IRRBB submissions to Camille, Approve repo-book sizing within RAS, Approve hedge programmes within RAS, Chair ALCO; approve treasury limits within Helena's RAS, Approve FX-position adjustments within Excon, Approve FTP curve refresh, Approve collateral inventory moves]. Out-of-scope decision. Citations: P6-AUTONOMOUS-BY-DEFAULT, P2-SINGLE-GRAPH-DISCIPLINE, IIA-IPPF. |
| 2026-05-27 | `F-ATLAS-20260527-MBZB` | high | WAL-loss incident 2026-05-27: 192 events (seq 94331–94522) lost due to WAL deletion before checkpoint |

## Recon rollup (last 7 days)

| Event type | Count |
|---|---|
| `ReconResult` | 225 |
| `ReconViolation` | 0 |

## Cross-line digest

| Source | Count | Window |
|---|---|---|
| Owen `GovernanceCyclePrep` | 2 | last 7 days |
| Prior `AuditCommitteePackPrepped` | 1 | last 30 days |
| `WhistleblowingDisclosure` | 0 | last 7 days |
| `ExternalAuditorInquiry` | 0 | last 7 days |

## AC pack readiness

- **Quarterly opinion-pack generator** — _not built_ (substrate gap, `Team/Thandiwe.md` § 16). This weekly digest is the bridging artefact; the formal AC pack is generated, not assembled, once the substrate lands.
- **Issues-and-actions tracker** — _not built_ (§ 16). Tracking lives in the event store today; quarterly opinion-pack will reduce over the tracker once it exists.
- **Combined-assurance-map tooling** — _not built_ (§ 16). Coverage gaps surface only via in-session reasoning; the digest above is the seed.

## Thandiwe's narrative

_Narrative generation failed (credit exhausted: Anthropic credit balance exhausted: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},"request_id":"req_011Cbe4gPdMDzap1zr5Dnxud"})._

## Provenance

Replayed `AuditFinding`, `ReconResult`, `ReconViolation`, `GovernanceCyclePrep`, `AuditCommitteePackPrepped`, `WhistleblowingDisclosure`, `ExternalAuditorInquiry` from the host event store. Counts are local to this host until the cross-host event-bus lands (M8).
