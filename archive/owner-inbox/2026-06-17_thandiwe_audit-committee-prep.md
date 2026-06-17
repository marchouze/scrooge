---
agent: Thandiwe
trigger: audit-committee-prep
asOf: 2026-06-17T07:47:13.477Z
decision-required: false
---

# Thandiwe — Audit-Committee prep, 2026-06-17

Autonomous run of Thandiwe's weekly Audit-Committee prep per `Team/Thandiwe.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Feeds the Interim Audit Forum (Owen chair) until a Board AC is constituted.

**Headline:** 5 `AuditFinding` events in the last 7 days (0 HIGH/Tier-1) · 171 `ReconResult` / 0 `ReconViolation` · 1 Owen governance-cycle prep run · 3 prior AC-pack runs in the last 30 days.

## Recent AuditFinding events (last 7 days)

| When | Finding | Severity | Title |
|---|---|---|---|
| 2026-06-13 | `F-ROHAN-20260613-DZ9F` | medium | vera:mr-1-fx-var-projection-gap — B3 projection folds net open position (NOP); Helena MR-1-FX limit is 1-day 99% VaR (ZAR 350,000) |
| 2026-06-13 | `F-VERA-20260613-BITZ` | medium | code-quality:swallowed-errors: scripts/recover-archive-gap-203832-222995-2026-06-12.ts:176 — Swallowed error: `catch {}`. Either re-throw, log, emit a typed event, or leave a comment explaining why the error is safe to ignore. |
| 2026-06-10 | `F-SCROOGE-20260610-65W7` | medium | Systemic root-render hygiene gap (population extension of F-BEA-20260610-0NH9): 51 tracked root-level record renders (50 .md + 1 PDF, 2026-05-18 → 2026-06-10) remained in-tree after RMS Phase 4; 29 had no RecordFiled event at all and 19 of the 21 filed ones had dangling document references (blob only ever existed in an ephemeral dispatch-worktree store). |
| 2026-06-10 | `F-CAMILLE-20260610-VVZY` | medium | regulatory-reporting-policy-v1 cited ghost obligation id ORG-PR-41 — renamed ORG-FC-24 in obligations-register v1.28 (D4/2022 reclassified Domain A→B: AML/CFT ML/TF/PF risk return under FIC Act s.43A(3), not a prudential BA-return obligation) — so the PR #1187 obligation→policy fold skipped 1 IMPLEMENTED_BY edge. |
| 2026-06-10 | `F-BEA-20260610-0NH9` | low | PR #1189 committed the closure-record markdown render 2026-06-10_bea_irs-tail-closure-b-irs-disallowances-b-irs-multicurve.md at the repo root; RMS Phase 4 (D-RMS-PHASE-4) retired in-tree record markdown — the canonical copy is the RecordFiled event + document-store blob. |

## Recon rollup (last 7 days)

| Event type | Count |
|---|---|
| `ReconResult` | 171 |
| `ReconViolation` | 0 |

## Cross-line digest

| Source | Count | Window |
|---|---|---|
| Owen `GovernanceCyclePrep` | 1 | last 7 days |
| Prior `AuditCommitteePackPrepped` | 3 | last 30 days |
| `WhistleblowingDisclosure` | 0 | last 7 days |
| `ExternalAuditorInquiry` | 0 | last 7 days |

## AC pack readiness

- **Quarterly opinion-pack generator** — _not built_ (substrate gap, `Team/Thandiwe.md` § 16). This weekly digest is the bridging artefact; the formal AC pack is generated, not assembled, once the substrate lands.
- **Issues-and-actions tracker** — _not built_ (§ 16). Tracking lives in the event store today; quarterly opinion-pack will reduce over the tracker once it exists.
- **Combined-assurance-map tooling** — _not built_ (§ 16). Coverage gaps surface only via in-session reasoning; the digest above is the seed.

## Thandiwe's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011Cc8TmZQ9Nn3yRjgEMEe5M"})._

## Provenance

Replayed `AuditFinding`, `ReconResult`, `ReconViolation`, `GovernanceCyclePrep`, `AuditCommitteePackPrepped`, `WhistleblowingDisclosure`, `ExternalAuditorInquiry` from the host event store. Counts are local to this host until the cross-host event-bus lands (M8).
