# State of the Security Platform — note to the CISO

**From:** Senna (security engineer)
**To:** Rashida (CISO)
**Cc:** Devon (COO, prior interim line); Helena (CRO); Owen (CoSec); Vera (internal audit engineer); Atlas, Anya, Tomas (engineering substrate co-owners).
**Date:** 2026-05-07
**Authority:** `Team Inbox/actioned/2026-05-06_brief_ciso-onboarding-senna-iris.md` (the "for Senna" handover).
**Posture context:** D1 build-only — every pipeline below operates against synthetic flows; no live keys, no live counterparties, no live regulator submissions. (`Owner Inbox/2026-05-06_ceo-decision_interim-operating-posture.md`.)

---

## 0. Purpose

A single document so you can re-baseline your sign-off authority on the threat-model gate and write the governance-layer Joint Standard 1 of 2024 programme map on top of a substrate you trust. This is the engineer-view; your governance-view sits above it.

I have organised it by the five surfaces you asked me to cover, and added a sixth — what is **not** built — because honesty about gaps is the most useful thing I can hand you on day one.

---

## 1. Secure-SDLC pipeline — state

**Built and running**

- Source-of-truth: monorepo on the local substrate; signed commits enforced; branch protection on `main` requires two-actor review (one reviewer must be outside the change-author's mandate area).
- CI gates that block merge: dependency scan (SCA), SAST, secret-scan, lint, type-check, unit tests, IaC policy-as-code (OPA / Conftest) against a starter rule set.
- Build attestation: SLSA-aligned provenance generation per artefact; provenance is itself an event in the local event store under `secure-build.attestation` (Atlas owns the event-type registration).
- Reproducible-build harness: artefact hash compared across two independent build runners; mismatch fails the gate.
- Signed-artefact deploy: only artefacts with valid provenance + signature reach the deploy step; verifier is part of the runtime admission path.

**Partial**

- DAST: scaffolding present, ruleset minimal (default OWASP ZAP profile). Needs your standard before it widens.
- Supply-chain verification: SBOM generated per build; vulnerability cross-reference runs daily. **Not yet** wired to a break-glass-and-block on critical CVE — currently raises a finding only.
- Container / image hardening: distroless base + minimal-capability profile; CIS-style benchmark not yet automated as a gate.

**Not built**

- Third-party hardware attestation chain (TPM / measured-boot for build runners). Designed but un-implemented; Azure-target lift will use Trusted Launch + Confidential VMs (per `Owner Inbox/2026-05-06_local-base-infrastructure-spec.md`).
- Pre-prod fuzz-test harness for the event-handling code paths.

**Decision points for you**

- Standard for SAST severity → block-merge mapping (today: critical blocks, high warns; you may want stricter).
- Whether SCA findings auto-create an exception ticket or hard-block (today: hard-block on known-exploited list, ticket otherwise).

---

## 2. Key ceremony / HSM operations — state

**Posture today (build-only).**

- The bank holds **no live cryptographic key material**. Every key in the system is a synthetic test key generated for rehearsal.
- Local substrate uses softHSM with a PKCS#11 façade behind the production interface so the application code, key-rotation events, and audit trail are identical to the eventual managed-HSM operation.
- Production target: Azure Key Vault Managed HSM (FIPS 140-2 Level 3), per `project_cloud_target_azure.md`. The interface seam is in place; the substrate swap is a one-shot.

**What is rehearsed**

- Root-of-trust ceremony: a four-person split with M-of-N reconstitution, dry-run executed once. Output of the rehearsal is captured as a `key-ceremony.rehearsal` event with witnesses named.
- Per-domain key-rotation events (signing keys, transport keys, field-encryption keys) — schemas defined, rotation jobs runnable on synthetic keys, evidence-of-rotation events emitted.
- Break-glass key-recovery rehearsal: scripted; runs against the synthetic root.

**Not rehearsed (gap)**

- Cross-region key escrow with quorum from a second jurisdiction (relevant only when the licence triggers and Azure regions are committed).
- HSM firmware-update procedure under a quorum (vendor-procedure exists; we have not exercised it).

**Decision points for you**

- The actor-set for the live root ceremony when the licence date approaches. I have a candidate-list under `Procedures/key-ceremony.md`; needs your sign-off and Owen's witnessing protocol.
- Whether you want a rehearsal cadence (quarterly?) on synthetic substrate as continuous evidence for Vera.

---

## 3. Threat-model backlog

Counts as of today (full breakdown in `/security/threat-models/_index.md`):

| State | Count | Notes |
|---|---|---|
| Approved (gate-passed) | 18 | Includes event-store write path, identity service, IaC pipeline, customer-onboarding workflow, breach-notification workflow, regulator-submission generators (BA returns, FATCA/CRS, STR/CTR), payments hand-off interfaces. |
| Open (in drafting) | 6 | Trading OMS surfaces (Kai); ZARONIA fixings ingest (Anya); ICAAP-stress engine (Rohan); soft-franchise CRM surface (Niko); ISDA-negotiation workspace (Imani); HR/payroll surface (Sade). |
| Exception-pending | 2 | Both relate to the synthetic-trade replayer used by Kai for surveillance rehearsal. Exceptions are scoped to build-only and auto-expire at licence-grant. |
| Re-baseline candidates | 11 | Approved before D1 was set; build-only posture changes the threat surface (no live external counterparties means external-attack assumptions narrow, but supply-chain and insider surfaces widen relatively). I recommend a re-baseline pass with your standard before the next gate cycle. |

**How the gate runs today.** Author submits model + control set + residual-risk statement; I run the technical critique; a second engineer (rotation) runs the independent challenge; sign-off issues against the obligations register entry. Refusal authority on technical grounds is mine; refusal on standard / risk-appetite grounds is currently mine on interim — that authority transfers to you on the next change after our handover walkthrough.

---

## 4. IR-runbook coverage map

| Scenario class | Runbook status | Last rehearsal |
|---|---|---|
| Credential compromise (operator) | Approved, automated playbook | Tabletop, 2026-04 |
| Supply-chain compromise (build-time) | Approved, automated playbook | Tabletop, 2026-04 |
| Data-exfiltration via misconfigured egress | Approved | Live-fire on synthetic, 2026-04 |
| HSM availability loss | Approved, manual quorum step | Dry-run, 2026-03 |
| Ransomware on workstation fleet | Approved | Tabletop, 2026-03 |
| Cyber-physical (DC / region failure) | Approved (DR-aligned) | Co-rehearsed with operational resilience, 2026-04 |
| **POPIA-notifiable data breach** | Approved — **co-owned with Iris** | Joint tabletop, 2026-04 |
| Regulator-notifiable cyber incident under Joint Standard 1 of 2024 | Drafted, not approved | — |
| Insider abuse (privileged actor) | Drafted | — |
| Third-party processor incident | Drafted | — |

**Gap I want you to see immediately:** the Joint-Standard-1-of-2024 regulator-notification runbook is drafted but un-approved. It needs your standard to close. Drafting it without a CISO standard would have been pre-empting governance.

---

## 5. Detection-pipeline build state

**Built**

- Event-stream tap into the canonical event log with privacy-aware projections (no PII in detection topics; correlation IDs only).
- Anomaly-detection scaffold: rule-based first wave (sign-in anomalies, IaC drift, privilege escalation, egress anomaly, secret-leak in code, dependency-introduction outside policy).
- SOAR-style response orchestrator: actions are themselves events; every detection → enrichment → action chain is replayable as-of any point in time.
- Synthetic adversary harness: generates representative attack patterns against the substrate so the detection rules are exercised in CI.

**Partial**

- ML-assisted detection layer (Anya's ML-platform substrate): scaffolding present; no model in production. By design — we do not run unsupervised models against build-only synthetic data and call it operational.
- User-behaviour analytics: minimum viable, will need calibration when there are real operators in the system.

**Not built**

- External threat-intel ingest in production form. Feeds are subscribed in test; integration is gated on your view of source quality and licensing.
- Deception assets (canary tokens, honey accounts) — designed, not deployed. Want your view on whether deception is in the standard.

---

## 6. Joint Standard 1 of 2024 — engineering programme map

This is my engineer-view of the technical surface the Joint Standard requires, mapped to what is built / partial / planned. It is the substrate your governance programme map sits on.

| JS 1/2024 area | Engineering deliverable | State |
|---|---|---|
| Governance of cyber-resilience | Coded threat-model gate; obligations-register linkage for every control | Built (process); your standard re-baselines |
| Cyber-resilience strategy | Substrate already designed cloud-native (Azure target); zero-trust default; least-privilege; DiD | Built (design); strategy doc is governance-layer (yours) |
| Identification of information assets | Asset-inventory derived from IaC + event-store schema registry; auto-updated | Built |
| Protection — preventative controls | Encryption in transit + at rest; per-field encryption for sensitive data; HSM-backed; network segmentation; identity-based authz | Built (synthetic), Azure-lift is parameterised |
| Detection | §5 above | Built (rule-based); ML deferred |
| Response | §4 above | Built (most scenarios); JS-1 regulator-notification runbook awaits your sign-off |
| Recovery | DR design + immutable event log + reproducible build → reproducible state | Built (design); live-region exercise gated on Azure lift |
| Cyber-resilience testing | Synthetic adversary harness; tabletops; dry-runs (per §4) | Partial; cadence to be set by you |
| Notification & reporting | Drafted runbooks; obligations-register entries cite JS 1/2024 articles | Drafting → governance approval |
| Third-party / supply-chain | SBOM, signed builds, SLSA provenance, vendor-onboarding gate (drafted) | Partial; vendor-onboarding gate awaits your standard |
| Awareness & training | Coded module dispatching role-based curricula; completion is an event | Designed, not built — Sade's HR substrate dependency |

---

## 7. Continuous-controls evidence pipeline (for Vera)

I have coordinated with Vera on her continuous-controls programme brief. The first-wave evidence feed she needs from security to deliver your first second-line opinion includes:

1. Threat-model gate decisions (every approve / refuse / exception, with citation chain) — **live, streaming**.
2. Secure-SDLC gate outcomes per build (pass / fail by gate) — **live, streaming**.
3. Key-rotation events (synthetic today; same shape live) — **live, streaming**.
4. Detection-pipeline incident events — **live, streaming**.
5. IR-runbook rehearsal events (tabletop / dry-run / live-fire) — **emitted on rehearsal**.
6. Supply-chain attestations — **per build**.

Vera's first second-line opinion will draw on (1)–(4) at minimum; (5) and (6) thicken the second cycle. No new collection is required from you; the events already exist and the projection is already running.

---

## 8. What I'd like from you

1. **Your standard for the threat-model gate.** I'll continue running the gate; the standard needs to be yours from the next change. The 30-minute walkthrough is in your calendar.
2. **A view on the eleven re-baseline candidates** in §3 — re-pass them all, or only those that touch external-counterparty paths.
3. **Sign-off on the Joint-Standard-1-of-2024 regulator-notification runbook** in §4. I will redraft to your standard if it differs from mine.
4. **The detection standard** — particularly on UBA calibration, deception assets, and external threat-intel ingest.
5. **Cadence and authority on the synthetic-substrate rehearsals** (key-ceremony, HSM firmware, IR scenarios). Quarterly is my recommendation.

I am not waiting on these to keep building; the substrate continues to harden on the existing standard. But the items above are governance moments where your standard supersedes mine, and I would rather the supersession happen explicitly than implicitly.

—Senna
