# `@domains/customer` — Institutional client lifecycle

End-to-end design + working module for the bank's institutional client lifecycle. Builds the substrate Saskia's franchise + Niko's CRM run on; the design proposal lives at `Owner Inbox/2026-05-06_institutional-client-lifecycle-proposal.md`.

## Scope

Institutional only — large SA corporates, banks, non-bank FIs. No retail, no commercial banking, no payments rails for third parties.

## Layout

```
domains/customer/
├── types.ts           Event types, payloads, value objects, status enums.
├── onboarding.ts      Pure event constructors (sounding → activation → off-board).
├── projections.ts     Counterparty master · ISDA tracker · authorised-signatory book.
├── index.ts           Public surface.
└── README.md          This file.
```

## Lifecycle stages (build-only posture)

1. **Sounding** — relationship contact; non-contractual.
2. **Prospect** — formal prospect registration.
3. **Tier-1 KYC** — Mira's KYC + sanctions pipelines (institutional default).
4. **Documentation** — ISDA / GMRA / CSA negotiated to ready-to-execute.
5. **Authorised signatories** — persons that bind the counterparty.
6. **Mandate assignment** — within Helena's RAS envelope.
7. **Activation** — *configuration switch at licence-grant; not exercised during build.*
8. **Continuous KYC** — Mira's recurring + signal-driven re-evaluation.
9. **Off-boarding** — symmetric end of lifecycle.

## Procedures backed by this module (Principle 6 — upward chain)

- `Procedures/by-policy/kyc-onboarding.md` — invoked at stage 3 (existing).
- `Procedures/by-policy/sanctions-screening.md` — invoked at stage 3 (existing).
- `Procedures/by-policy/kyc-recurring.md` — invoked at stage 8 (planned).
- `Procedures/by-policy/kyc-continuous.md` — invoked at stage 8 (planned).
- `Procedures/by-policy/counterparty-onboarding.md` — orchestrates stages 1–7 (to be drafted; under Niko + Owen).
- `Procedures/by-policy/counterparty-offboarding.md` — orchestrates stage 9 (to be drafted).

## Citations expected on every event (Principle 2)

- Sounding / prospect: bank's own Counterparty Onboarding Policy.
- KYC events: `FIC-S21` (CDD); FIC GN 7 RBA; sanctions instruments.
- Documentation: relevant ISDA / GMRA / CSA standard versions.
- Mandate: bank's RAS / RAF and Counterparty Credit Policy.
- Activation: configuration-switch reference (the M8-or-later go-live event).

## What this module does not do

- It does not run the KYC pipelines themselves (Mira's domain).
- It does not draft master agreements (Imani's clause-library-as-code).
- It does not assign mandates (Saskia's franchise design owns the mandate-assignment authority within Helena's RAS).
- It does not store PII; counterparty data is held by reference + minimal demographic fields. Per the build-only posture, all data is `SIMULATED`.

## Substrate-replacement seam (Principle 6 — upward chain)

This module imports only `@platform/*` interfaces (`@platform/event-store`, `@platform/projections`, `@platform/identity`). The cloud lift (M8) swaps the substrates without touching this module.
