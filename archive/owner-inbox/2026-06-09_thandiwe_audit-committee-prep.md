---
agent: Thandiwe
trigger: audit-committee-prep
asOf: 2026-06-09T07:47:29.401Z
decision-required: false
---

# Thandiwe — Audit-Committee prep, 2026-06-09

Autonomous run of Thandiwe's weekly Audit-Committee prep per `Team/Thandiwe.md` operating spec § Cadence. Run by the agent runtime; no human-in-the-loop. Feeds the Interim Audit Forum (Owen chair) until a Board AC is constituted.

**Headline:** 9 `AuditFinding` events in the last 7 days (5 HIGH/Tier-1) · 207 `ReconResult` / 0 `ReconViolation` · 1 Owen governance-cycle prep run · 2 prior AC-pack runs in the last 30 days.

## Recent AuditFinding events (last 7 days)

| When | Finding | Severity | Title |
|---|---|---|---|
| 2026-06-08 | `F-HELENA-20260608-XF2F` | medium | Granular D1/2022 consolidation rules unspecified and consolidated-LCR substrate not built (ORG-PR-LCR-003/004/005). |
| 2026-06-08 | `F-HELENA-20260608-96I3` | medium | Non-compliance notification in policy is narrower than D1/2022 §4.1.6 (ratio-breach-only, not any-requirement non-compliance) — ORG-PR-LCR-010. |
| 2026-06-08 | `F-MIRA-20260608-YQNK` | medium | Public LCR disclosure basis not reconciled to D1/2022 / Directive 1/2019 (simple averages of daily observations) — ORG-PR-LCR-002/009. |
| 2026-06-08 | `F-HELENA-20260608-D9IJ` | medium | SARB RCLF (Restricted Committed Liquidity Facility) is missing from the L2B HQLA composition (ORG-PR-NSFR-009). |
| 2026-06-08 | `F-MIRA-20260608-PFJY` | high | Systemic BA-form-number collision for the LCR return: liquidity policy calls it 'BA 325', Pillar 3 sources it from 'BA 900', but D5/2025 (ORG-PR-RETURNS-003) says the LCR return is BA 110. |
| 2026-06-08 | `F-HELENA-20260608-8AO0` | high | The D1/2022 LCR directive cluster (ORG-PR-LCR-001..010) is closed by no policy; liquidity-risk-management-policy-v1 anchors on the older D6/2015 and never references D1/2022. |
| 2026-06-08 | `F-MIRA-20260608-4M7U` | high | Adopted market-risk return obligations ORG-PR-RETURNS-011/012/013 (BA-310/BA-320/BA-325) are closed by no policy — orphaned at the policy layer. |
| 2026-06-08 | `F-MIRA-20260608-D9PR` | high | market-risk-policy-v1 cites BA-325/BA-326 as FRTB market-risk capital returns — stale per D-BA-RETURN-FORM-NUMBERING-RECON; contradicts NPA v2 and regulatory-reporting-policy-v1. |
| 2026-06-08 | `F-HELENA-20260608-VINK` | high | market-risk-policy-v1 §7 marks ORG-PR-60 'closed' but the 72.5% output floor is absent from the policy body — overstated closure. |

## Recon rollup (last 7 days)

| Event type | Count |
|---|---|
| `ReconResult` | 207 |
| `ReconViolation` | 0 |

## Cross-line digest

| Source | Count | Window |
|---|---|---|
| Owen `GovernanceCyclePrep` | 1 | last 7 days |
| Prior `AuditCommitteePackPrepped` | 2 | last 30 days |
| `WhistleblowingDisclosure` | 0 | last 7 days |
| `ExternalAuditorInquiry` | 0 | last 7 days |

## AC pack readiness

- **Quarterly opinion-pack generator** — _not built_ (substrate gap, `Team/Thandiwe.md` § 16). This weekly digest is the bridging artefact; the formal AC pack is generated, not assembled, once the substrate lands.
- **Issues-and-actions tracker** — _not built_ (§ 16). Tracking lives in the event store today; quarterly opinion-pack will reduce over the tracker once it exists.
- **Combined-assurance-map tooling** — _not built_ (§ 16). Coverage gaps surface only via in-session reasoning; the digest above is the seed.

## Thandiwe's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CbsKKRxCxWM8HRaEo4kB7"})._

## Provenance

Replayed `AuditFinding`, `ReconResult`, `ReconViolation`, `GovernanceCyclePrep`, `AuditCommitteePackPrepped`, `WhistleblowingDisclosure`, `ExternalAuditorInquiry` from the host event store. Counts are local to this host until the cross-host event-bus lands (M8).
