# Procedure — Client / counterparty categorisation (OTC derivative scope)

**Procedure ID:** PROC-MK-ODP-08
**Owner:** Zara (CCO, governance) · Niko (lead-to-client lifecycle, build-phase paused per AI-driven-bank reframe)
**Approval:** BRC (under Conduct Policy)
**Cadence:** Per-counterparty at onboarding; review at material change + annually
**Version:** v0.1 — 2026-05-07 — STUB
**Status:** STUB · system capability `PLANNED` · Niko's lifecycle activates at licence-day per `memory:project_ai_driven_bank.md`

## 1. Source policy

Client Categorisation Policy (planned). Conduct of Business / TCF Policy.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CS3-005` (CS 3/2018 §7) | Client / counterparty categorisation policy + due diligence pre-trade. |

## 3. Purpose

Categorise every prospective OTC derivative counterparty (retail / professional / counterparty class) and apply the conduct-protection regime appropriate to the category before any transaction.

## 4. Trigger

`CounterpartyOnboardingRequested` event from Niko's lifecycle (post-licence-day).

## 5. Steps (planned)

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Capture counterparty profile | Niko | `@crm/counterparty` (PLANNED) | Per Niko's lead-to-client substrate |
| 2 | Apply categorisation rules | Niko + Zara | `@conduct/categorisation` (PLANNED) | Per CS 3/2018 + FAIS scope |
| 3 | Suitability + appropriateness check (if professional / retail) | Niko | `@conduct/suitability` (PLANNED) | |
| 4 | Hand-off to Mira for KYC / sanctions | Niko → Mira | `kyc-onboarding.md` | |
| 5 | Post `CounterpartyCategorised { tier, basis }` event | system | `@platform/event-store` | |
| 6 | Trade-eligibility gate | Kai's pre-trade gateway | `@trading/pre-trade-gate` | Block if categorisation absent or expired |

## 6. Build-phase posture

Niko's lead-to-client lifecycle is paused per the AI-driven-bank reframe (no real clients during build). Substrate built; activates at licence-day. Soft-franchise track (Saskia + Imani) continues with negotiations-in-principle but no formal categorisation events fire.

## 7. Reconciliation

Every CSA-counterparty has a current categorisation event. Vera's mandate-ownership recon flags any open trade with a missing or expired categorisation.
