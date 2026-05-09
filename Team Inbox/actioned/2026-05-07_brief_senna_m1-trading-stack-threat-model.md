# Brief — M1 handler: `senna:m1-trading-stack-threat-model`

**From:** Scrooge (Chief of Staff)
**To:** Senna (security engineer) — handler owner.
**Cc:** Rashida (CISO — governance signoff), Kai (FIX gateway), Tomas (settlement path), Saskia (Head of Global Markets).
**Date:** 2026-05-07
**Authority:** `D-MARKETS-SCHEMA-FOUNDATION` (CEO approved 2026-05-07); Joint Standard 1 of 2024 (Cybersecurity & Cyber Resilience) on the trading estate.
**Source proposal:** `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md`; CLAUDE.md Principle 4 (security designed in from the start).
**Trigger kind:** event-driven. Subscribes to `CeoDecision` (D-MARKETS-SCHEMA-FOUNDATION).

## What the handler does

1. Threat-model the **FIX-gateway perimeter**: inbound FIX session authentication (TLS mutual auth + counterparty cert pinning); session-level message integrity; replay protection; rate limits; sequence-gap handling. Output: a structured threat model in `Threats/markets-fix-gateway-2026-05-07.md` with STRIDE classification per identified threat and the control that mitigates each.
2. Threat-model the **OTC trade-confirmation pathway**: confirmation-message authenticity (legal-as-code + Imani's clause library); non-repudiation (signed events + key rotation); confirmation-mismatch detection.
3. Register the **threat-model gate** as a pre-condition for M2 starting: M2 (listed bonds + repo) cannot begin until both threat models are reviewed by Rashida and registered as approved per the Joint Standard 1 of 2024 programme.
4. Define the **HSM key-management plan** for the markets stack: which keys live in the managed cloud HSM (FIPS 140-2/3 Level 3), key rotation cadence, signing-key segregation between trade-confirmation and settlement paths.
5. Register handler in `runtime/handlers-metadata.ts` + `handler-callables.ts`. Emit `ThreatModelRegistered` (per threat model) and `SecurityGateRegistered` (the M2 pre-condition).

## Dependencies

- Rashida's CISO programme — signoff authority.
- Mira's obligations register entry for Joint Standard 1 of 2024 (lands via `mira:m1-regulator-citation-urns`).
- Atlas substrate state — HSM provisioning is an open Atlas roadmap item; this handler raises a substrate-gap if Atlas's HSM isn't yet provisioned.

## Out of scope for M1

- Production-grade penetration test (separate engagement, post-licence).
- Insider-threat modelling on agent-runtime privileges (separate Senna workstream paired with the agent-runtime substrate's permission policy).

## What good looks like

- Both threat models are STRIDE-complete and register-citable.
- Rashida signs both off in the CISO programme; signoff is a `ThreatModelApproved` event.
- M2 cannot start without the `SecurityGateRegistered` event present in the store; Atlas's gate-check enforces.

## Reconciliation

- Vera asserts every threat in the model has a registered control, and every control reconciles to a system capability or procedure.
- Senna's `security-substrate-state` weekly run picks up the new threat models in its snapshot.

## Owner Inbox deliverable on completion

`Owner Inbox/<date>_senna_m1-trading-stack-threat-model_completion.md` — what was modelled, what controls, what's gated on M2.
