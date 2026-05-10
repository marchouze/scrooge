---
agent: Senna
trigger: m1-trading-stack-threat-model
asOf: 2026-05-08T00:03:00.500Z
decision-required: false
---

# Senna — M1 trading-stack threat-model, 2026-05-08

Autonomous run of Senna's M1 trading-stack threat-model handler per `Team Inbox/2026-05-07_brief_senna_m1-trading-stack-threat-model.md`. Triggered event-driven on `CeoDecision` for `D-MARKETS-SCHEMA-FOUNDATION`.

**Headline:** 4 threat-model dimensions registered (0 emitted; 4 idempotent-skipped). M2 security-gate already present.

## Dimensions modelled

### tm:senna:trading-stack:fix-gateway-stride

- **Surface.** FIX-gateway perimeter (inbound trading-session ingress)
- **Framework.** STRIDE
- **Headline.** STRIDE enumeration on the FIX-gateway perimeter — session authentication, message integrity, replay protection, sequence-gap handling, rate-limit DoS posture, audit-log tamper-evidence.
- **Controls.**
  - Mutual TLS with counterparty certificate pinning (Spoofing)
  - FIX session-level message integrity via signed envelope and per-message HMAC (Tampering)
  - Append-only event-store ingest with as-of replay (Repudiation; pairs with Principle 1)
  - POPIA-aligned per-field encryption on counterparty trader identity (Information disclosure)
  - Rate-limit + token-bucket on the FIX session, surfacing SuspiciousAuthEvent on burst (Denial of Service)
  - Zero-trust workload identity on the gateway — no shared service account (Elevation of privilege)
  - Sequence-gap detection with explicit re-request semantics; gaps emit SecurityIncidentRaised at Tier configurable per RAS B6
- **Substrate gap.** FIX-gateway implementation does not yet exist; the threat model is a forward-load anchor for the gateway build. v1 registration locks the dimensions; the live gateway substrate inherits the controls list at build time.

### tm:senna:trading-stack:gateway-zero-trust

- **Surface.** Pre-trade gateway aggregator + check fan-out path (Kai's `@platform/markets/pre-trade-gateway`, PR #26)
- **Framework.** zero-trust
- **Headline.** Zero-trust posture for the pre-trade gateway — every check handler authenticates and authorises against the substrate, no implicit trust between aggregator and check workers, dispatch is the single architectural non-bypassability point.
- **Controls.**
  - Workload identity per check handler (sanctions / suitability / credit / market-risk / capital-impact / funding / surveillance) — Atlas A2 permission-policy publishes the allow-list
  - Aggregator is the single dispatch point that emits OrderApprovedAtGateway / OrderRejectedAtGateway (Kai.md §15 non-bypassability)
  - GatewayCheckRequested fan-out carries a per-request capability token; check handlers cannot emit decisions outside their scope
  - BusDispatched idempotency on (eventId, handlerKey) prevents replay-style override
  - All gateway events carry the citation chain to FAIS / FIC / JSE / FMA / governance line (Principle 2)
  - Override path deferred entirely from v0 (per S7-Targeted #5 sub-decision C); no break-glass surface in M1
- **Substrate gap.** Slice-1 default-approve aggregator is live (PR #26); slices 2–7 (individual check handlers, surveillance overlay) land per the gateway brief. Zero-trust posture binds at slice 2 when the first check handler authenticates against the aggregator.

### tm:senna:trading-stack:hsm-order-signing

- **Surface.** Order-signing key custody (HSM-bound private keys for order + trade-confirmation events)
- **Framework.** HSM-FIPS-140-2-3-L3
- **Headline.** HSM key-custody for the order-signing and trade-confirmation paths — keys never leave the FIPS 140-2/3 Level 3 boundary; rotation cadence policy-bound; segregation between trade-confirmation and settlement signing keys.
- **Controls.**
  - Trade-confirmation signing key segregated from settlement signing key — different HSM key handles, different rotation cadence, different actor IDs
  - Quarterly key-ceremony rehearsal (Senna spec §6 Cadence) — synthetic phase today, live at licence-day
  - KeyRotationPerformed event emitted on every rotation; KeyRotationDue event from the scheduler triggers Senna's rotation handler
  - Identity issuance via `scripts/identity-issue.ts` produces non-extractable HSM-bound keys (per Senna spec §12)
  - Dual-control on any rotation that changes custodianship (Senna spec §10 escalation to Rashida)
  - Order-signing path emits an event-store entry with the signing key's HSM handle for audit replay
- **Substrate gap.** HSM substrate is not yet provisioned (Senna spec §16 — open Atlas roadmap item; pre-licence cloud-lift target). Local-build phase uses placeholder keys with the same envelope shape so the order-signing path is wire-compatible at cutover.

### tm:senna:trading-stack:oms-ems-ops-security

- **Surface.** OMS / EMS substrate (multi-asset booking, order routing, exchange connectivity, surveillance feeds — Kai's mandate)
- **Framework.** ops-security
- **Headline.** Operational-security boundary on the OMS / EMS substrate — secure SDLC gates, build-time supply-chain attestation, runtime detection on the trading-agent fleet, incident-response runbooks rehearsed for the markets-event stream.
- **Controls.**
  - Secure SDLC gates declared in `prototype/package.json` `ci` script (typecheck, lint, test, citation gate, recon harnesses); SCA / SAST land per Senna spec §16
  - SLSA-aligned build provenance for OMS / EMS deploy artefacts (ORG-CY-13 reference; target Build Level 3)
  - ISO 27001:2022 Annex A.8.25–A.8.34 reference alignment on secure development (ORG-CY-14)
  - Detection-pipeline rules for surveillance-feed anomalies feed `SecurityIncidentRaised` (Senna spec §11; pipeline substrate planned)
  - IR runbook `Procedures/by-policy/incident-response.md` rehearsed monthly (Senna spec §6); Tier-3/Tier-4 cyber severity per RAS B6 routes to Rashida
  - Operational-resilience scenario testing extends to markets-stack outage scenarios (ORG-CY-08; Devon co-owns)
  - POPIA s.22 breach-notification workflow lit on personal-information compromise via `Procedures/by-policy/popia-breach-notification.md`
- **Substrate gap.** Detection pipeline (SIEM / EDR / XDR) and SOAR orchestrator are not yet built (Senna spec §16). v1 dimension registers the controls as posture; live runtime detection lights up at pre-licence.

## M2 security gate

- **Gate ID.** `gate:senna:m1-trading-stack-threat-model:m2-precondition`
- **Pre-condition.** M2 (listed bonds + repo) cannot start until the four dimensions above are reviewed and ratified by Rashida (CISO) per the Joint Standard 2 of 2024 programme.
- **Enforcement.** v1 records the gate as a `SecurityGateRegistered` event; Atlas's gate-check (planned Vera Wave-4 reconciliation) will block M2 dispatch until the gated dimensions carry a `ThreatModelGateApproved` event from Rashida.

## Citation chain

Every event emitted by this handler carries the union of the base chain and the dimension-specific anchors:

- `ORG-CY-01`
- `ORG-CY-03`
- `ORG-CY-05`
- `ORG-CY-09`
- `ORG-CY-12`
- `ORG-PR(IV)-06`
- `GOV-FRAMEWORK-CEO-RESERVED`

Joint Standard 2 of 2024 binds at ORG-CY-01 / 03 / 05; POPIA s.19–22 binds at ORG-PR(IV)-06; BCBS Op Resilience binds at ORG-PR-17 / ORG-CY-08 (cited per dimension where the resilience boundary is load-bearing). NIST SSDF (ORG-CY-12) and ISO 27001:2022 (ORG-CY-09 / 14) are reference-aligned anchors per the obligations register.

_Substrate-gap citations flagged inline with `[citation: route to Mira]` are forward-load — Mira's parallel `m1-regulator-citation-urns` handler is updating the register alongside this run; missing URNs land in the next register snapshot._

## What this run did

- **Trigger.** event-driven `m1-trading-stack-threat-model`
- **Triggering CeoDecisions matched.** `D-MARKETS-SCHEMA-FOUNDATION`
- **`ThreatModelDimensionRegistered` events emitted.** 0
- **`ThreatModelDimensionRegistered` events skipped (idempotent).** 4
- **`SecurityGateRegistered` event.** skipped (already present)

## Out of scope for M1

- Production-grade penetration test of the gateway — separate engagement, post-licence.
- Insider-threat modelling on agent-runtime privileges — separate Senna workstream paired with the agent-runtime substrate's permission policy (Atlas A2).
- Long-form prose threat-model artefacts at `security/threat-models/<dimensionId>.md` — substrate gap (Senna spec §16); v1 anchors registration; prose follows.

## Reconciliation

- Vera asserts every dimension has a registered control set, and every control reconciles to a system capability or procedure (planned recon pipeline against `ThreatModelDimensionRegistered`).
- Senna's `security-substrate-state` weekly handler (`runtime/agents/senna-security-substrate-state.ts`) picks up the four new dimensions in its next snapshot.
- Rashida's CISO ratification arrives as `ThreatModelGateApproved` events; until they land, M2 dispatch is gated.

## Provenance

Read `Team Inbox/2026-05-07_brief_senna_m1-trading-stack-threat-model.md` (binding scope), `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` (source proposal §9 / §11 / §14), `Team/Senna.md` (operating spec), `Regulations/_obligations-register.md` (URN anchors), `prototype/runtime/agents/kai-pre-trade-gateway-aggregator.ts` (PR #26 zero-trust pairing), and CLAUDE.md Principle 4 (security designed in from the start).
