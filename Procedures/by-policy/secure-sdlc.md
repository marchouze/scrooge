---
status: POPULATED
---
# Procedure — Secure software development lifecycle (idea-to-merge)

**Procedure ID:** PROC-CY-03
**Owner:** Senna (security engineer) · Rashida (CISO — governance) · Atlas (CI platform)
**Approval:** BRC
**Cadence:** Continuous (per commit / merge); threat-model gate per new event type / API / integration / material change
**Version:** v1.0 — 2026-05-06
**Status:** Approved (post Round 2 + CISO hire); system capabilities `PARTIAL` (citation gate built; broader SDLC pipeline `PLANNED`)

## 1. Source policy

- `Owner Inbox/2026-05-06_core-policies-infosec-ops.md` §9 — **Secure SDLC Policy** (primary).
- `Owner Inbox/2026-05-06_core-policies-infosec-ops.md` §1 — Information Security Policy (zero trust, threat modelling, encryption).
- `Owner Inbox/2026-05-06_core-policies-infosec-ops.md` §8 — Change Management Policy (this procedure feeds the change-management procedure at merge).
- `Owner Inbox/2026-05-06_core-policies-infosec-ops.md` §2 — Cyber Resilience Policy (controls catalogue, threat modelling).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CY-01` (Joint Standard 2 of 2024) | Cybersecurity framework with named accountability (CISO holds; Senna engineers). |
| `ORG-CY-03` (Joint Standard 2 of 2024) | Threat modelling, risk assessment, controls catalogue. |
| `ORG-CY-09` (ISO/IEC 27001:2022) | Information-security management system aligned to ISO 27001. |
| `ORG-CY-12` (NIST SSDF v1.1) | Secure software development lifecycle aligned to SSDF practice groups. |
| `ORG-CY-13` (SLSA v1.0) | Build-provenance attestation, signed artefacts, hermetic builds; target Build Level 3. |
| `ORG-CY-14` (ISO/IEC 27001:2022 Annex A.8.25–A.8.34) | Secure-development controls: secure coding, threat modelling, environment separation, outsourced-development governance, system acceptance. |
| `ORG-PR-17` (BCBS Operational Risk) | Operational-risk identification, measurement, control framework — software-build risk. |

## 3. Purpose

Every change to the bank's source code is built through a CI-enforced lifecycle that produces, by construction, signed artefacts with attested provenance and a complete supply-chain inventory. Threat models are gates, not documents; branch protection is non-negotiable; secrets never enter source; the supply chain is inventoried and signed. The lifecycle ends at a deployable, attested artefact — at which point the **Change Management** procedure (`PROC-CY-02`) takes over for promotion to production.

## 4. Trigger

A `RepositoryWriteEvent` from the engineering workflow:

- A commit pushed to a branch under repository governance.
- A pull request opened, updated, or marked ready for review.
- A merge attempted to a deployable branch.
- A new event type, API, workflow, or external integration proposed (triggers the threat-model gate before development begins).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | **Threat-model gate** for new event types, APIs, integrations, material changes; STRIDE / LINDDUN where applicable | `human` (Senna; Rashida signs standard) + `system` (gate-tracker) | `@platform/sdlc/threat-model-gate` (`PLANNED`) | Event: `ThreatModelApproved` (with model version, scope, controls). Required *before* implementation begins on flagged items. Exceptions registered with expiry. |
| 2 | **Branch protection** enforced: required reviewers, required status checks, signed commits | `system` | `@platform/sdlc/branch-protection` (`PLANNED`; today via repo-host config) | Bypass is a Critical event. |
| 3 | **Pre-commit + push-time secret scan** — entropy-based + provider-token regex | `system` | `@platform/sdlc/secrets-scan` (`PLANNED`) | Event: `SecretsScanPassed` / `SecretsScanFailed`. Failure blocks push; secret-rotation IR triggered if reached source. |
| 4 | **Static analysis (SAST)** — language-aware rules, custom rules for bank-specific patterns (event-store mutations, citation-gate bypass, recon-harness bypass) | `system` | `@platform/sdlc/sast` (`PLANNED`) | Event: `SASTPassed`. High-severity findings block; exceptions need security-reviewer sign-off. |
| 5 | **Dependency scan + license scan** — vulnerability database, allowlist enforcement, license-policy check | `system` | `@platform/sdlc/dependency-scan` (`PLANNED`) | Event: `DependencyScanPassed`. New dependencies need security-reviewer sign-off. |
| 6 | **Test gates** — unit + integration tests pass; coverage thresholds per component class; mutation testing on critical paths (citation gate, recon harness, event-store writers) | `system` | `@platform/sdlc/test-gate` (existing — `prototype/` CI today; broader gates `PLANNED`) | Event: `TestsPassed`. Citation-gate tests (`citation/gate.test.ts`) and recon tests cannot regress. |
| 7 | **Code review** — at least one reviewer for normal-risk; security-reviewer (Senna's pool) for high-risk paths (auth, key-handling, payments, settlement, regulator-reporting code, citation gate, recon) | `human` (reviewers) + `system` (CODEOWNERS enforcement) | `@platform/sdlc/review-gate` (`PLANNED`; today via repo-host CODEOWNERS) | Event: `CodeReviewed` (with reviewer identities, security-reviewer flag where applicable). Self-merge is a tracked exception. |
| 8 | **DAST against staging** for promotion-candidate builds (services with external surfaces) | `system` | `@platform/sdlc/dast` (`PLANNED`) | Event: `DASTPassed`. Staging endpoints synthetic-only under build-only posture. |
| 9 | **Build** — hermetic where supported; reproducible; isolated builder | `system` | `@platform/sdlc/builder` (`PLANNED`; SLSA Build Level 3 target) | Event: `BuildStarted` / `BuildCompleted`. Build inputs and outputs hashed. |
| 10 | **SBOM generation** — CycloneDX or SPDX; signed; stored | `system` | `@platform/sdlc/sbom` (`PLANNED`) | Event: `SBOMGenerated` (with hash). Diff-against-prior tracked. |
| 11 | **Build provenance** — SLSA v1.0 provenance attestation, signed with HSM-backed key (sigstore-aligned) | `system` | `@platform/sdlc/provenance` (`PLANNED`; HSM via `@platform/identity` extension) | Event: `BuildSigned` (with provenance hash, key identity). |
| 12 | **Artefact promotion** — signed artefact + SBOM + provenance stored in attested registry | `system` | `@platform/sdlc/artefact-registry` (`PLANNED`) | Event: `ArtefactPromoted` — handoff to `PROC-CY-02` (change management). |
| 13 | **Dependency-update bot** proposes PRs continuously for vulnerable / out-of-date dependencies | `system` | `@platform/sdlc/dep-update-bot` (`PLANNED`) | High-severity findings have hard SLAs (Critical: 24h; High: 7d). |

## 6. Reconciliation

- **Events produced:**
  - `ThreatModelApproved` (where required), `ThreatModelExceptionGranted`.
  - `CommitSigned`, `SecretsScanPassed` / `SecretsScanFailed`.
  - `SASTPassed` / `SASTFailed`, `DependencyScanPassed` / `DependencyScanFailed`.
  - `TestsPassed`, `CodeReviewed` (with reviewer identities).
  - `DASTPassed` / `DASTFailed`.
  - `BuildStarted`, `BuildCompleted`, `SBOMGenerated`, `BuildSigned`.
  - `ArtefactPromoted` (handoff to change-management).
  - `SecretInSourceDetected`, `BranchProtectionBypassed` (Critical events).
- **Reconciliation check:**
  - Every `ArtefactPromoted` has the full upstream chain: `ThreatModelApproved` (where required) → `SASTPassed` → `DependencyScanPassed` → `TestsPassed` → `CodeReviewed` → `BuildSigned` → `SBOMGenerated`. Missing link = procedural breach.
  - Every artefact entering the change-management procedure (`PROC-CY-02`) has a registered `ArtefactPromoted` event. Change-management's `SecurityGatePassed` consumes this event.
  - No `BranchProtectionBypassed` event without an open Critical IR.
  - No `SecretInSourceDetected` event without a `SecretRotated` event within 24h.
  - SBOM diffs reconcile with dependency-scan events: every new dependency in the SBOM has a corresponding scan and sign-off event.
- **Failure mode:** any gate failure blocks promotion; the engineer receives a typed failure event with remediation guidance. Repeated bypass attempts are flagged to Senna and Rashida. Pattern of regressions in citation-gate or recon tests escalates to Vera + Thandiwe.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Threat models | Repo `/threat-models/` + event-log hash | Permanent | High |
| SAST / DAST reports | Artefact store + event-log hash | 5 years | High |
| Dependency-scan results | Artefact store + event-log hash | 5 years | High |
| SBOMs (per build) | Attested artefact registry | Permanent (linked to artefact) | High |
| Build provenance attestations | Attested artefact registry (sigstore-aligned) | Permanent (linked to artefact) | High |
| Code-review records | Repo-host + event-log hash | 5 years | High |
| Test reports + coverage data | CI artefacts + event-log hash | 5 years | Medium |
| SDLC events | Event log | Permanent (P1) | High |
| Exception registrations (with expiry, owner, justification) | Event log + register | Permanent | High |

## 8. Manual steps

- **Step 1** (threat model authoring) — Senna or delegated security-reviewer authors the threat model; Rashida (CISO) signs the gate standard and reviews exception requests.
- **Step 5** (new-dependency review) — security-reviewer judgement on novel dependencies and license posture.
- **Step 7** (code review) — reviewer judgement; security-reviewer for high-risk paths (CODEOWNERS-routed but human-decided).
- **Exception registration** — when a gate produces a registered exception (e.g. SAST high-severity finding accepted with mitigation), Senna registers with expiry; Rashida governs.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Threat-model gate skipped on a new event type / API / integration | Vera continuous-controls pipeline (mandate-ownership and capability-coverage check) | Senna + Rashida; remediate before next promotion; finding to AC if pattern |
| Secret committed to source | Secret scanner alert | Critical IR — rotate immediately; Senna runs IR; Rashida commands; post-incident review |
| Branch protection bypassed | Repo-host audit log + SDLC event reconciliation | Critical IR — Senna + Rashida + Devon; AC notified at 48h regardless of impact |
| SAST high-severity finding shipped without registered exception | SDLC event reconciliation against scan-results store | Senna + Rashida; rollback (via change-management) if in production; finding to Vera |
| SBOM missing for a promoted artefact | Reconciliation: `ArtefactPromoted` without `SBOMGenerated` linked | CI block; Senna + Atlas investigation |
| Dependency-update SLA breach (Critical: 24h; High: 7d) | Continuous-controls projection | Senna; Rashida if recurring; Vera reportable |
| Citation-gate or recon-harness test regression slipped past gate | Daily integrity check | Critical — Senna + Atlas + Anya; AC notified; full regression review |
| Self-merge to deployable branch (exception) without registered tracker | Reconciliation | Senna + Rashida; finding to Vera |

## 10. Related procedures

- [`change-management.md`](change-management.md) (`PROC-CY-02`) — picks up at `ArtefactPromoted`; this procedure is upstream.
- [`incident-response.md`](incident-response.md) (`PROC-CY-01`) — Critical SDLC events trigger IR.
- `threat-model-review.md` (`PLANNED`) — detailed walkthrough of the threat-model authoring and review flow; subsumed under Step 1 here.
- `vulnerability-management.md` / `patch-cadence.md` (`PLANNED`) — dependency-update SLA enforcement and prioritisation.
- `access-provisioning.md` (`PLANNED`) — engineer access to repos and CI is itself governed.
- `key-rotation.md` (`PLANNED`) — build-signing-key lifecycle (HSM-backed).
- `outsourcing-due-diligence.md` (`PLANNED`) — outsourced-development governance (ISO 27001 A.8.30).

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-06 | Senna + Rashida + Atlas | Initial draft. Authored end-of-day 2026-05-06 following the CISO hire (Rashida); pre-board reviewed under Secure SDLC Policy §9 of the InfoSec & Ops bundle. |

## 12. Audit / assurance

- **Vera continuous-controls pipelines** — primary instrument. Pipelines test:
  - Every `ArtefactPromoted` has the full upstream event chain (no missing link).
  - Every new event type / API / integration in the codebase has a corresponding `ThreatModelApproved` (mandate-ownership / capability-coverage check).
  - Branch-protection-bypass events reconcile to open IRs.
  - Secret-in-source events reconcile to rotation events within 24h.
  - Citation-gate and recon-harness test history shows no regression past gate.
- **Thandiwe (CAE)** consumes Vera's evidence for the third-line opinion to the (Interim) Audit Forum.
- **Rashida (CISO)** consumes the same evidence for her second-line opinion to the (Interim) Risk Forum.
- **Annual independent review** of the SDLC pipeline integrity (Rashida-commissioned; external partner credentialled to SLSA assessor framework).
- **Joint Standard 2 of 2024 reporting** — SDLC pipeline status is part of Rashida's regulator-facing programme report (per role brief §3.2).
