---
agent: Yael
trigger: tax-readiness
asOf: 2026-06-04T06:07:00.850Z
decision-required: false
---

# Yael — tax readiness, 2026-06-04

Autonomous run of Yael's weekly tax-readiness snapshot per `Team/Yael.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Twelfth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.

**Headline:** 16 Yael-owned obligations on the register (0 IN FORCE; 0 PARTIAL; 3 PLANNED) · 9 tax cycles tracked (0 ready / 0 drafting / 4 specified / 5 not-yet-specified) · 0 drafts / 0 approvals in last 7 days · Camille anchor: **absent — substrate gap**.

## Yael-owned obligations on register

| Status | Count |
|---|---|
| IN FORCE | 0 |
| PARTIAL | 0 |
| PLANNED | 3 |
| DRAFTING | 0 |
| N/A-yet | 0 |
| **Total** | **16** |

_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Yael (or where Yael is named anywhere on the row). Coarse — refines once the obligations register exposes a structured per-row API._

## Tax-domain events (last 7 days)

| Event | Count |
|---|---|
| `TaxSubmissionApproved` | 0 |
| `VATFilingApproved` | 0 |
| `FATCAReportingPublished` | 0 |
| `CRSReportingPublished` | 0 |
| `TransferPricingFilingApproved` | 0 |
| `STTRemitted` | 0 |
| `SARSGuidanceScanned` | 0 |
| `TaxClassificationPublished` | 0 |
| `FATCAClassificationAssigned` | 0 |
| `CRSClassificationAssigned` | 0 |
| `TaxReturnDrafted` | 0 |

_Build-phase posture: zero tax submissions / drafts. No revenue, no employees, no inter-entity flows. Live event flow activates at revenue-start (= licence-day for most flows) per `project_rules_bind_at_commencement` — banking-specific tax obligations bind at commencement of trading, not during build phase._

## Tax-cycle readiness (engineer-side)

| Cycle | State | Note |
|---|---|---|
| CIT — provisional + final (IRP6 / ITR14) | `not-yet-specified` | Activates at revenue-start (= licence-day for most flows). Tax engine designed; computation pipeline unwired. |
| VAT — monthly cycle with FS-apportionment | `specified` | VAT FS-apportionment engine designed; rehearsed against synthetic postings; SARS-rulings methodology not yet sign-off-ready by Camille. Pre-licence target. |
| STT — continuous (per trade) | `not-yet-specified` | Activates at first trade. STT Act 25 of 2007 binding only at commencement-of-trading per project_rules_bind_at_commencement. |
| FATCA / CRS — annual XML | `specified` | Schema designed against current OECD CRS publication; classification taxonomy maintained. XML production pipeline unwired. Co-owned with Mira. |
| Transfer pricing — master file + local file | `not-yet-specified` | Single-entity during build phase means no inter-entity flows yet to test against. Activates on second-entity registration. Co-owned with Imani. |
| IT3(b)/(c)/(s) — quarterly third-party data | `not-yet-specified` | Activates at licence-day. SARS BRS implementations pending. |
| EMP201 / EMP501 / IRP5 — employment taxes | `not-yet-specified` | PAYE / EMP slice paused per project_ai_driven_bank — no employees during build phase. Activates at licence-day. Co-owned with Sade. |
| Deferred tax — IAS 12 / IFRIC 23 | `specified` | Computation logic specified; activates at first close. Co-owned with Bea (IFRS classification side). |
| SARS BRS / guidance scan (build phase) | `specified` | Weekly scan owned by this handler. First SARSGuidanceScanned event flips state to drafting; ingestion pipeline still substrate-gap. |

_Yael drafts; Camille signs (`Team/Yael.md` §15). The drafter / signer split is preserved architecturally — Yael's typed events stop at `TaxReturnDrafted`; `TaxReturnSubmitted` is Camille-only. Readiness here is tax-engineer state, not CFO sign-off state._

## Camille's financial-position anchor

| Field | Value |
|---|---|
| Latest `FinancialPositionSnapshot` as_of | **never — substrate gap** |
| Last `CloseApproved` | never (build phase) |
| Last `BAReturnSigned` | never (build phase) |

_Engineer-side pairing pattern: Yael consumes Camille's CFO snapshot to anchor tax-cycle readiness against the close view. Mirrors the way Rohan reads Helena's `RiskAppetiteSnapshot`._

## Substrate gaps surfaced this run

- **Tax engine** — designed; partial. CIT / IRP6 / ITR14 computation pipeline unwired. Required pre-revenue.
- **VAT FS-apportionment engine** — designed; methodology rehearsed against synthetic postings. Camille sign-off pending. Pre-licence target.
- **FATCA / CRS XML pipeline** — schema designed; classification taxonomy maintained against current OECD CRS publication; XML production pipeline unwired. Pre-licence target. Co-owned with Mira.
- **SARS eFiling interface** — designed; not yet built. Submission events run as paper exercises during build. Pre-licence-go-live target. Co-owned with Atlas.
- **SARS BRS ingestion** — weekly scan owned by this handler; the BRS-pull machinery and diff-against-prior-version are substrate-gap. First `SARSGuidanceScanned` event flips state to drafting.
- **Transfer-pricing tooling** — designed; not yet built. Activates on second-entity registration. Co-owned with Imani.
- **Tax-mart definitions** — quarterly review with Anya; tax-mart projection schemas not yet specified. Pre-licence target.
- **`TaxReadinessSnapshot` event registry entry** — this handler's typed snapshot event is not yet listed in `platform/event-store/registry.ts` (fail-open path used today, consistent with the other recently-added snapshot events). Atlas register-fold pending.

## Yael's narrative

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CbhicSAE8U67oPscEzEec"})._

## Provenance

Yael-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Yael appears in any cell); tax-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days; tax-cycle readiness curated by Yael against `Team/Yael.md` §16 substrate gaps; Camille-anchor read from latest `FinancialPositionSnapshot` event payload.
