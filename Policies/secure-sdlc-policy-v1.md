---
policy-id: secure-sdlc-policy
title: Secure SDLC Policy v1
version: "1"
status: IN FORCE
owner: Rashida (CISO, governance)
effective-from: "2026-05-17"
citations:
  - ORG-CY-12
  - ORG-CY-13
  - ORG-CY-14
author: Senna (Platform security engineer, engineering) + Rashida (CISO, governance)
date: 2026-05-17
summary: Secure Software Development Lifecycle Policy establishing the bank's SDLC security governance framework, covering NIST SP 800-218 SSDF v1.1 practice groups, SLSA Build Level 3 build-provenance requirements, and ISO/IEC 27001:2022 Annex A.8.25–A.8.34 secure development controls. Applies to all code authored by engineering agents and AI-generated code. Closes obligations ORG-CY-12, ORG-CY-13, ORG-CY-14. COMMENCEMENT-BIND (security controls are live from day one of build phase).
decision-required: false
riskTaxonomy:
  - RT-OP.CY
  - RT-OP.CY.IN
---

# Secure SDLC Policy v1

> **Status:** IN FORCE (policy layer). Substrate-side engineering implementation tracked under the security workstream; recon harnesses enforcing SAST, provenance, and dependency gates are live.
>
> **Authors:** Senna (Platform security engineer, engineering — reports to Rashida CISO) leads; Rashida (Chief Information Security Officer, governance) co-authors and is policy owner.
>
> **Scope note:** This policy governs the security of software developed for the bank's banking platform. It is distinct from the broader Information Security Policy (which governs access, data classification, incident response). The SDLC is the development-lifecycle dimension of the overall security posture; this policy populates that dimension end-to-end.

---

## 0. Policy overview

| Attribute | Value |
|---|---|
| Policy name | Secure SDLC Policy |
| Version | v1 |
| Effective date | 2026-05-17 |
| Approval authority | CEO (Marc); Board Risk Committee (BRC) ratifies at licence-day |
| Policy owner | Rashida (Chief Information Security Officer, governance) |
| Engineering owner | Senna (Platform security engineer, engineering — reports to Rashida) |
| Review cadence | Annual; triggered by material architecture change, significant CVE incident, or new NIST/SLSA/ISO framework revision |
| Risk appetite anchor | RAS CY-1 — zero appetite for shipping code with known exploitable vulnerabilities; low appetite for unattested build provenance |
| COMMENCEMENT-BIND | Partial — security controls are active from build-phase day one; penetration-testing cadence commences at commencement-of-trading |
| Obligations closed | [`ORG-CY-12`](../Regulations/_obligations-register.md) (NIST SP 800-218 SSDF v1.1), [`ORG-CY-13`](../Regulations/_obligations-register.md) (SLSA v1.0 Build Level 3), [`ORG-CY-14`](../Regulations/_obligations-register.md) (ISO/IEC 27001:2022 Annex A.8.25–A.8.34) |

---

## 1. Governance and Authority

### 1.1 Purpose

This policy establishes Hoz Bank Limited's Secure Software Development Lifecycle (Secure SDLC) governance framework. It sets out the security requirements that apply to every stage of software development — from requirements through design, implementation, testing, deployment, and maintenance — and prescribes the controls, responsibilities, and escalation pathways that govern day-to-day SDLC security.

The bank's engineering workforce is predominantly autonomous AI agents (Principle 6 — autonomous by default). Every engineering agent — Atlas (Platform infrastructure engineer), Senna (Platform security engineer), Devon (Platform data and analytics engineer), and others — operates under this policy. AI-generated code is not exempt from any provision; it is in-scope from the moment it enters the codebase.

### 1.2 Statutory authority and framework references

This policy is adopted under and gives effect to:

- **Joint Standard 2 of 2024 (Cybersecurity)** — issued jointly by the Prudential Authority and Financial Sector Conduct Authority under FSR Act ss.107(1)(a) and 151(1)(a). The Joint Standard is the parent governance instrument for the bank's cybersecurity programme; this SDLC policy operationalises the Joint Standard's requirements for the software-development dimension. Register row: [`ORG-CY-01`](../Regulations/_obligations-register.md).

- **NIST SP 800-218 Secure Software Development Framework (SSDF) v1.1 (February 2022)** — adopted by the bank as the technical standard for SDLC security practice. Addresses four practice groups: Prepare the Organisation (PO), Protect the Software (PS), Produce Well-Secured Software (PW), and Respond to Vulnerabilities (RV). Register row: [`ORG-CY-12`](../Regulations/_obligations-register.md).

- **Supply Chain Levels for Software Artefacts (SLSA) v1.0** — build-integrity framework adopted as the provenance standard. The bank targets **SLSA Build Level 3**: hermetic builds, signed artefacts, non-falsifiable provenance attestation. Register row: [`ORG-CY-13`](../Regulations/_obligations-register.md).

- **ISO/IEC 27001:2022 Annex A Controls A.8.25–A.8.34** — secure development lifecycle controls forming part of the bank's ISO 27001 alignment. Controls covered: Secure development policy (A.8.25), secure development environment (A.8.28), outsourced development (A.8.30), system security testing (A.8.29), system acceptance testing (A.8.31), security in development and support processes (A.8.27), configuration management (A.8.32), test information (A.8.33), protection of information systems during audit testing (A.8.34). Register row: [`ORG-CY-14`](../Regulations/_obligations-register.md).

- **POPIA ss.19–22 (2013)** — security safeguards for personal information processed in the bank's systems. Development of any component that processes personal information must satisfy POPIA s.19's security-safeguard standard.

- **Banks Act 94 of 1990 and Regulations Relating to Banks** — overall supervisory framework; Joint Standard 2 is issued under the FSR Act but sits within the Banks Act supervisory architecture.

### 1.3 Entity and code scope

This policy applies to:

- **All production code** in the bank's banking platform (`/Users/marc/code/Bank` monorepo), including the event store, projections, recon harnesses, dashboard, agent-runtime substrate, and all typed event handlers.
- **All engineering agents** whose outputs enter the codebase: Atlas (Platform infrastructure engineer), Senna (Platform security engineer, implementation lead for this policy), Devon (Platform data and analytics engineer), Mira (Compliance / RegTech engineer where she authors substrate code), and any other agent that submits a pull request.
- **AI-generated code** — code suggested or authored by any AI system (including Claude models) is treated as ordinary code for all SDLC gate purposes. No AI-generated code bypasses review.
- **Outsourced development** — any development activity conducted outside the bank's own engineering agents is subject to equivalent SDLC requirements as a contractual condition.
- **Hoz Group Limited and Hoz Securities Limited** — to the extent that shared platform components are used by these entities, this policy applies on a group-wide basis.

Out of scope: infrastructure-as-code and cloud-resource provisioning are covered by the Infrastructure Security Policy (cross-reference: Rashida's CISO scope).

### 1.4 Governance and roles

| Role | Holder | Authority |
|---|---|---|
| Policy owner | Rashida (Chief Information Security Officer, governance) | Joint Standard 2 of 2024; ISO/IEC 27001:2022 A.8.25 |
| SDLC Security Owner (engineering) | Senna (Platform security engineer, engineering — reports to Rashida) | NIST SSDF PO.2.1 — designated SDLC security owner |
| Threat modelling authority | Senna (Platform security engineer, engineering) + Rashida (CISO, governance) | PW.1.1; ISO/IEC 27001:2022 A.8.25 |
| Platform engineering lead | Atlas (Platform infrastructure engineer, engineering) | Build pipeline integrity; SLSA provenance substrate |
| Independent assurance | Vera (Internal audit / continuous-assurance engineer, engineering — reports functionally to Thandiwe CAE, governance) | Third-line; annual SDLC effectiveness review; recon harnesses |
| POPIA intersection | Iris (Information Officer, governance) | POPIA s.19 safeguards on personal-information-processing components |

### 1.5 Policy hierarchy

```
Regulation
    └── Joint Standard 2 of 2024 (Cybersecurity — parent governance)
        └── Information Security Policy (overall ISMS scope — Rashida)
            └── Secure SDLC Policy (this document — development-lifecycle dimension)
                └── Secure coding standards (Procedures/by-policy/secure-sdlc-*.md)
                    └── Platform engineering substrate (prototype/ — Senna, Atlas)
```

Every node cites upward per Principle 2 (single-graph discipline). No orphan policies; no orphan procedures.

### 1.6 Approval, review, and amendment

- **Initial approval:** CEO (Marc), 2026-05-17.
- **Annual review:** Senna-led with Rashida approval, no later than 12 months after the preceding approval date.
- **Triggered review:** any material architecture change (new database engine, new runtime, new AI model integration), significant CVE incident affecting the bank's stack, or substantive revision to NIST SSDF / SLSA / ISO 27001 triggers a review within 30 agent-cadence days.
- **Amendment discipline:** all changes to this policy are typed `PolicyAmended` events per Principle 1 (events are the only source of truth). The markdown file is a render of the event; the event is canonical.

---

## 2. Core Policy Content

### 2.1 SSDF practice group: Prepare the Organisation (PO)

**Standard anchor:** NIST SP 800-218 §§PO.1–PO.3.

The bank prepares its engineering organisation to conduct secure software development by establishing explicit security requirements, roles, and training before development begins.

#### 2.1.1 Security requirements definition

Every feature specification and system design document must include a **security requirements section** before implementation begins. The security requirements section must address:

1. **Data classification.** What categories of data does this component process? (Typed schema: `PersonalInformation`, `MarketSensitive`, `InternalConfidential`, `Public`.) Components touching `PersonalInformation` must additionally satisfy POPIA s.19 safeguards.

2. **Threat surface.** What are the inputs, outputs, and trust boundaries of this component? Who are the callers? What assumptions does the component make about its callers?

3. **Authentication and authorisation.** What identity is required to call this component? What permissions does it check? Cross-reference: Permission Policy substrate (`prototype/platform/agent-identity/permission-policy.ts`; T-12).

4. **Cryptographic requirements.** Does this component generate, process, or store key material? If yes, the HSM key-envelope architecture applies (Principle 4).

5. **Retention and deletion.** What is the retention class of data emitted by this component? (Reference: `prototype/platform/event-store/registry.ts` retention fields.)

Security requirements are recorded in the pull request description and reviewed as part of the PR review gate (§3.1).

#### 2.1.2 Designated SDLC security owner

Senna (Platform security engineer, engineering) is the designated SDLC Security Owner per NIST SSDF PO.2.1. Responsibilities:

- Maintaining and updating this policy.
- Approving security-relevant changes to the build pipeline, CI gates, and provenance infrastructure.
- Conducting or commissioning threat model reviews (§2.3.2).
- Reviewing and accepting penetration-test findings (§2.3.3).
- Reporting SDLC security posture to Rashida (CISO, governance) at each quarterly agent-cadence run.

#### 2.1.3 Threat modelling training and readiness

Every engineering agent's operating spec must include the threat modelling methodology as a named capability. Senna maintains the threat modelling methodology document (`Procedures/by-policy/secure-sdlc-threat-modelling.md`). Engineering agents that receive a design-change brief referencing this methodology are expected to apply it without further instruction.

### 2.2 SSDF practice group: Protect the Software (PS)

**Standard anchor:** NIST SP 800-218 §§PS.1–PS.3.

The bank protects all components of the software supply chain from tampering and unauthorised access.

#### 2.2.1 Source control with signed commits

All code changes are made via pull requests to the bank's GitHub repository. Commit signing is enforced at the platform level. Unsigned commits are rejected by the branch-protection rules on `main`. This control satisfies NIST SSDF PS.1.1 (maintain well-secured software package).

#### 2.2.2 Dependency management and SBOM

Every dependency introduced to the project must be:

1. **Pinned by digest** (not floating version) in production builds. Digest pinning is a prerequisite for SLSA Build Level 3 (§2.4.1).
2. **Recorded in the Software Bill of Materials (SBOM)**. The SBOM is generated by the CI pipeline on every build and stored in the provenance substrate (`platform/provenance/`).
3. **Scanned for known vulnerabilities** before the PR is merged (§3.2 — dependency vulnerability gate).

New dependencies require Senna's approval for security-relevant packages (cryptographic libraries, authentication libraries, database drivers, network clients). Approval is recorded as a typed event `DependencyApproved`.

#### 2.2.3 Secret scanning

**No secrets in source control.** The CI pipeline runs `gitleaks` (or equivalent) on every PR to detect committed secrets, API keys, private keys, or credentials. A secret-scanning violation blocks merge and triggers immediate remediation (rotate the secret; remove from git history; emit `SecretLeakDetected` event).

Secrets management at runtime uses environment variables sourced from the vault substrate; no secret is hardcoded in any source file, test fixture, or seed data file.

#### 2.2.4 Static analysis (SAST)

A **SAST gate** runs on every PR. Current SAST tools:

- **Biome** (TypeScript linting / formatting) — enforces the bank's TypeScript strict-mode coding standards, including the `any`-density threshold enforced by the `recon:any-density` Vera pipeline. Zero `any`-density violations permitted on merge.
- **CodeQL** (semantic analysis) — runs on the full codebase on every push to `main` and on every PR to `main`. Medium and higher severity findings block merge.
- **ESLint security plugin** — catches common security anti-patterns (prototype pollution, unsafe `eval`, injection-risk patterns) on every PR.

All SAST violations must be resolved before a PR is merged. No suppression without Senna's approval and a documented rationale.

### 2.3 SSDF practice group: Produce Well-Secured Software (PW)

**Standard anchor:** NIST SP 800-218 §§PW.1–PW.9.

The bank applies security-focused development practices throughout the implementation and testing phases.

#### 2.3.1 Secure coding standards

The bank's TypeScript coding standards (enforced by Biome + Vera) include the following security-specific rules:

| Rule | Rationale |
|---|---|
| `strict: true` in all `tsconfig.json` files | Eliminates implicit `any`; enforces null-safety |
| No `any` above the threshold | Reduces bypass of the type system; enforced by `recon:any-density` |
| No `eval()` or `Function()` constructor | Eliminates code-injection risk |
| No `process.env` access outside designated config modules | Prevents secret leakage via uncontrolled env access |
| Parameterised queries for all database access | Prevents SQL-injection and event-store injection |
| Input validation at every external boundary | All inputs arriving from outside the trusted event-store boundary are validated against their Zod schema (`payloadSchemas` — registry rows now 100% covered per PR #494) |
| No `console.log` of event payloads in production paths | Prevents sensitive-data leakage to stdout/logs |
| Cryptographic operations via approved wrappers only | Prevents homebrew crypto; enforced by import-whitelist recon |

#### 2.3.2 Threat model review gate

A **threat model review** is required before implementation begins for:

- Any new external API surface (ingress or egress)
- Any change to the authentication or authorisation model
- Any new event type that processes `PersonalInformation` or `MarketSensitive` data
- Any change to the cryptographic key-management architecture
- Any new agent or agent-capability addition that changes the permission boundary

The threat model review is conducted by Senna (Platform security engineer, engineering) using the STRIDE methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege). The output is a threat model document (BLAKE3-addressed artefact) referenced from the PR and from a `ThreatModelCompleted` event.

Where a proposed design introduces a risk above the bank's appetite (per the RAS), Senna escalates to Rashida (CISO, governance) before implementation proceeds.

#### 2.3.3 Penetration testing

**Cadence:**
- **Annual scheduled** penetration test of the full banking platform, commissioned by Senna, approved by Rashida. Findings feed into the vulnerability remediation workflow (§2.4 — RV).
- **Triggered** by any material architecture change (new public API surface, new runtime, significant dependency upgrade, new agent-capability).

Penetration testing is conducted by an external specialist firm (at licence-day; during build phase, simulated via red-team exercises by Senna with Vera as independent observer). All findings are recorded as typed `PenTestFindingRaised` events. Critical and High findings carry the same remediation SLA as CVEs (§2.4.2).

#### 2.3.4 Dynamic analysis (DAST)

**DAST** is applied to all public API surfaces (dashboard API, agent-runtime API, any external reporting surface). The DAST tool runs as part of the CI pipeline on deployment to the staging environment:

- OWASP ZAP (or equivalent) — scans for OWASP Top 10 vulnerabilities on every staging deployment.
- API fuzz testing — for typed REST/RPC surfaces, a fuzz harness runs against the OpenAPI/tRPC schema to identify unexpected responses.

DAST findings at Medium severity or above block production deployment. Findings are emitted as `DastFindingRaised` events.

### 2.4 SSDF practice group: Respond to Vulnerabilities (RV)

**Standard anchor:** NIST SP 800-218 §§RV.1–RV.3.

The bank identifies, assesses, and remediates vulnerabilities in a timely and structured manner.

#### 2.4.1 CVE triage and remediation SLA

All disclosed CVEs affecting the bank's dependencies are triaged by Senna within one business day of disclosure. Remediation SLAs:

| Severity | SLA from disclosure |
|---|---|
| Critical (CVSS ≥ 9.0) | 48 hours — emergency patch; `CriticalVulnRemediated` event required before SLA expiry |
| High (CVSS 7.0–8.9) | 7 calendar days |
| Medium (CVSS 4.0–6.9) | 30 calendar days |
| Low (CVSS < 4.0) | Next scheduled maintenance cycle |

SLA breaches are escalated to Rashida (CISO, governance) and to Vera (Internal audit / continuous-assurance engineer, engineering) as a `SlaBreachRaised` event.

#### 2.4.2 Dependency update automation

Dependabot (or Renovate) is configured on the bank's GitHub repository to:

- Raise PRs automatically for patch and minor dependency updates.
- Flag security-advisory-linked updates with elevated priority.
- Never auto-merge — all dependency-update PRs are reviewed by Senna before merge.

Detection of a dependency with a known CVE emits a `DependencyVulnDetected` event, which triggers the remediation workflow defined in `Procedures/by-policy/secure-sdlc-vuln-response.md`. The remediation workflow is SLA-clocked from the `DependencyVulnDetected` event timestamp.

#### 2.4.3 Coordinated vulnerability disclosure

External researchers and counterparties who discover vulnerabilities in the bank's systems may report them to `security@hoz.bank` (placeholder until licence-day; pre-licence: to Senna via the CEO). The bank's coordinated vulnerability disclosure (CVD) procedure:

1. Acknowledge receipt within 24 hours.
2. Assess severity and reproduce the finding within 5 business days.
3. Agree a remediation and disclosure timeline with the reporter.
4. Emit `ExternalVulnReported` and `ExternalVulnRootCauseConfirmed` events on confirmation.
5. Issue credit to the reporter (unless anonymous) in the release notes.

The bank does not pursue legal action against good-faith security researchers acting within the CVD scope.

---

## 3. Controls and Monitoring

### 3.1 Pull request review gate

Every pull request to `main` requires:

1. **Second-agent review** — reviewed by at least one engineering agent other than the author.
2. **Security-relevant change review by Senna** — any PR that modifies authentication, authorisation, cryptographic operations, external API surfaces, dependency configuration, or CI pipeline configuration is additionally reviewed and approved by Senna (Platform security engineer, engineering) before merge.
3. **CI gate pass** — all automated gates (SAST, DAST, dependency scan, typecheck, tests, citation-gate, `recon:provenance-badge-coverage`) must pass.
4. **Branch protection** — `main` is protected; force-push is disabled; PRs require the `ci` status check in strict mode (per `project_github_plan_upgrade_pending.md`).

### 3.2 Dependency vulnerability gate

The CI pipeline runs `npm audit` (or `bun audit`) on every PR. The gate fails on any vulnerability at High severity or above. Exceptions require Senna's written approval and a `DependencyVulnException` event documenting the rationale and the compensating control.

### 3.3 SLSA Build Level 3 controls

**Standard anchor:** SLSA v1.0, Build Level 3 requirements.

The bank targets SLSA Build Level 3 for all production artefacts. The following controls are required:

#### 3.3.1 Hermetic builds

All production builds run in an isolated, network-restricted CI environment. During the build:

- No network access is permitted except to the pre-approved package registry mirror.
- All dependencies are resolved exclusively from pinned-digest lock files.
- The build environment is a fresh, ephemeral runner with no persistent state from previous builds.

Hermetic-build compliance is asserted by the `recon:hermetic-build-compliance` check (Senna to implement; tracked as a substrate gap until live).

#### 3.3.2 Provenance attestation

Every CI build generates a **SLSA provenance attestation** containing:

- The source repository and commit SHA.
- The build invocation parameters.
- The build environment (runner image digest).
- The produced artefact digests.

Attestations are stored in the bank's provenance substrate (`platform/provenance/`). The `recon:provenance-badge-coverage` recon asserts that every production artefact has a current, valid attestation. Cross-reference: the provenance infrastructure is already live (PRs #185–#187; `platform/provenance/` in the codebase).

#### 3.3.3 Non-falsifiable build chain

The build chain satisfies non-falsifiability requirements:

- CI runners are managed by the platform (no human can SSH into a runner during a build).
- Build outputs are immutably attested before any human or agent can inspect them.
- No post-attestation modification of build outputs is permitted.
- The CI system itself is pinned by digest; pipeline-configuration changes require Senna's approval.

#### 3.3.4 Signed artefacts

All production artefacts are signed using the bank's signing infrastructure:

- Docker images: signed via `cosign` (sigstore-compatible) using the bank's HSM-held signing key.
- TypeScript compiled outputs: hash-signed in the SLSA provenance attestation; the attestation itself is signed with the CI signing identity.

Signature verification is enforced at deployment time; unsigned artefacts are rejected by the deployment substrate.

### 3.4 ISO/IEC 27001:2022 Annex A.8 controls

#### 3.4.1 Secure development environments (A.8.28)

- Development, test, and production environments are strictly separated. No production data (including event-store events) is permitted in development or test environments.
- Test data is either synthetic or anonymised before use. The `recon:no-prod-data-in-test` check (Senna to implement) asserts this.
- Development environments use local SQLite event stores, not production event stores. Seeded test data (`prototype/seeds/`) is synthetic.

#### 3.4.2 Outsourced development and AI-generated code (A.8.30)

Outsourced development — including code authored by AI systems (Claude models, GitHub Copilot, or equivalent) — is treated identically to in-house code for all SDLC gate purposes:

- AI-generated code is reviewed by a human-equivalent engineering agent before merge.
- AI-generated code passes through all SAST, DAST, and dependency gates.
- AI-generated code is not exempt from the threat model review requirement.
- Outsourcing agreements (where applicable at licence-day) incorporate the bank's SDLC security requirements as contractual obligations (Imani, Legal-as-code engineer, engineering, maintains the clause library).

#### 3.4.3 System security testing (A.8.29)

Security testing is mandatory for every production release:

1. **Functional security tests** — unit and integration tests covering security-relevant code paths (authentication, authorisation, input validation, output encoding). Coverage is asserted by the CI test suite.
2. **SAST findings** — zero unresolved Medium-and-above SAST findings at release.
3. **DAST scan** — pass on staging deployment before production promotion.
4. **Penetration test** — annual; triggered on material architecture change (§2.3.3).
5. **Security test cases** — derived from threat model outputs; every `ThreatModelCompleted` event must result in at least one new security test case added to the test suite.

#### 3.4.4 Code review (A.8.25 — Secure development policy)

Every PR undergoes code review per §3.1. Security-relevant PRs are additionally reviewed by Senna. The review must confirm:

- Security requirements from the feature spec are met.
- No new hardcoded secrets.
- Input validation is present at all external boundaries.
- No new `any` assertions above the density threshold.
- Cryptographic operations use approved wrappers.
- Retention class is set correctly for new event types.

### 3.5 Recon harnesses and continuous assurance

Vera (Internal audit / continuous-assurance engineer, engineering) runs the following SDLC-relevant recon harnesses as part of the CI gate:

| Recon harness | Assertion | Status |
|---|---|---|
| `recon:any-density` | TypeScript `any` density below threshold across codebase | Live |
| `recon:provenance-badge-coverage` | Every production module has a current provenance attestation | Live |
| `recon:circular-deps` | No circular dependency graphs (madge-circular-deps; PR #406) | Live |
| `recon:runtime-handler-sync` | Handler metadata, callables, and package.json in sync | Live |
| `recon:citation-gate` | No citation violations in deliverables | Live |
| `recon:hermetic-build-compliance` | Build environment isolation verified | Planned (Senna substrate gap) |
| `recon:no-prod-data-in-test` | No production data in test environment | Planned (Senna substrate gap) |
| `recon:secret-scan` | No committed secrets in source control | Planned (Senna substrate gap) |
| `recon:sdlc-sla-compliance` | CVE remediation SLA adherence | Planned (Senna substrate gap) |

Vera reports the recon harness status to Rashida (CISO, governance) and Thandiwe (Chief Audit Executive, governance) at each quarterly agent-cadence run.

---

## 4. Escalation

### 4.1 Escalation paths

| Trigger | First escalation | Second escalation | Timing |
|---|---|---|---|
| Critical CVE (CVSS ≥ 9.0) | Rashida (CISO, governance) — immediately | CEO (Marc) if not remediated within 48h | Immediate |
| SLA breach | Rashida (CISO, governance) | Vera (Vera — continuous-assurance) for finding record | Within 1 hour of breach |
| SAST / DAST Critical finding | Senna reviews; if unresolvable → Rashida | Rashida to CEO if systemic | Same business day |
| Secret leak detected | Rashida (CISO, governance) — immediately | CEO (Marc) | Immediate; rotate secret first |
| Pen-test Critical finding | Rashida (CISO, governance) | BRC (Board Risk Committee) at next meeting | Within 24 hours of confirmation |
| SLSA attestation failure on production artefact | Atlas (Platform infrastructure engineer) — build blocked | Rashida (CISO, governance) if build pipeline compromised | Immediate; deployment is blocked |

### 4.2 CISO authority

Rashida (CISO, governance) has authority to:

- Declare a build-pipeline security incident and halt all production deployments pending investigation.
- Require emergency re-review of any merged PR that is later found to contain a security defect.
- Commission an out-of-cycle penetration test.
- Suspend any engineering agent's commit rights pending a security investigation (substrate gap: T-12 PermissionPolicy substrate).

Rashida's security decisions are escalated to the CEO (Marc) for awareness; BRC is notified at the next quarterly meeting or immediately for Critical/material incidents.

### 4.3 Escalation events

All escalations are emitted as typed events:

- `SecurityIncidentDeclared` — CISO declares a security incident
- `SlaBreachRaised` — CVE or pen-test SLA is breached
- `CriticalVulnRemediated` — confirms remediation within SLA
- `SecretLeakDetected` — secret committed to source control
- `DastFindingRaised` — DAST finding requiring remediation
- `PenTestFindingRaised` — pen-test finding requiring remediation
- `ThreatModelCompleted` — threat model review completed for a design change

---

## 5. Related Documents

### 5.1 Policies

- **Information Security Policy** (IN FORCE, Rashida owner) — parent ISMS policy; this Secure SDLC Policy is a child instrument of the Information Security Policy.
- **Data Classification Policy** (Iris, Information Officer, governance) — defines `PersonalInformation`, `MarketSensitive`, and other data classes referenced in §2.1.1.
- **Access Control Policy** (Rashida, CISO, governance) — governs who can commit, who can approve, who can deploy; intersects with the SDLC controls at §3.1.
- **Incident Response Policy** (Rashida, CISO, governance) — governs the response to security incidents that originate from SDLC defects (e.g. a security vulnerability exploited in production).
- **POPIA / Privacy Policy** (Iris, Information Officer, governance) — POPIA s.19 security-safeguard requirements apply to every component touching personal information.

### 5.2 Procedures

- `Procedures/by-policy/secure-sdlc-threat-modelling.md` — threat modelling procedure (STRIDE methodology; Senna)
- `Procedures/by-policy/secure-sdlc-vuln-response.md` — vulnerability remediation procedure (SLA tracking; Senna)
- `Procedures/by-policy/secure-sdlc-pr-review.md` — PR security review checklist (Senna)
- `Procedures/by-policy/secure-sdlc-pen-test.md` — penetration testing engagement procedure (Senna + Rashida)
- `Procedures/by-policy/secure-sdlc-secret-mgmt.md` — secret management procedure (Senna + Atlas)

### 5.3 Technical references

- `prototype/platform/provenance/` — SLSA provenance attestation substrate (Atlas, build; Senna, security requirements)
- `prototype/platform/agent-identity/permission-policy.ts` — PermissionPolicy substrate (T-12; Senna)
- `prototype/platform/event-store/registry.ts` — event type registry including retention classes
- `prototype/platform/recon/` — recon harnesses referenced in §3.5
- CLAUDE.md §"Architectural principles" — Principle 4 (security designed in from the start)
- CLAUDE.md §"Operating procedures" — Dispatch discipline; rebase-before-push; full-typecheck gate

### 5.4 Standards and framework documents

- NIST SP 800-218 (SSDF v1.1, February 2022) — [`Regulations/Cybersecurity/nist-ssdf-v1.1.md`](../Regulations/Cybersecurity/)
- SLSA v1.0 — [`Regulations/Cybersecurity/slsa-v1.0.md`](../Regulations/Cybersecurity/)
- ISO/IEC 27001:2022 Annex A.8.25–A.8.34 — [`Regulations/Cybersecurity/iso27001-annex-a.md`](../Regulations/Cybersecurity/)
- Joint Standard 2 of 2024 (Cybersecurity) — [`Regulations/JointStandard2-2024/joint-standard-2-2024.md`](../Regulations/JointStandard2-2024/)
- Obligations register: [`Regulations/_obligations-register.md`](../Regulations/_obligations-register.md) — Domain CY rows

### 5.5 Decisions and governance records

- `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved) — security workstream (WS-CY) dependencies
- `D-RMS-PHASE-1` (CEO-approved 2026-05-09) — event-type registration; retention classes; document substrate
- `D-PRINCIPLES-P2-P6-MERGE` (CEO-approved 2026-05-11) — single-graph discipline; autonomous-by-default; both applied in this policy

---

## 6. Obligations Closed

| Obligation ID | Description | Policy section |
|---|---|---|
| [`ORG-CY-12`](../Regulations/_obligations-register.md) | NIST SP 800-218 SSDF v1.1 — four practice groups (PO, PS, PW, RV) | §2.1 (PO), §2.2 (PS), §2.3 (PW), §2.4 (RV) |
| [`ORG-CY-13`](../Regulations/_obligations-register.md) | SLSA v1.0 Build Level 3 — hermetic builds, signed artefacts, non-falsifiable provenance attestation | §3.3 |
| [`ORG-CY-14`](../Regulations/_obligations-register.md) | ISO/IEC 27001:2022 Annex A.8.25–A.8.34 — secure development lifecycle controls | §3.4 |

---

## 7. Change Log

| Version | Date | Author | Note |
|---|---|---|---|
| v1 | 2026-05-17 | Senna (Platform security engineer, engineering — reports to Rashida CISO) + Rashida (Chief Information Security Officer, governance) | Initial version. Covers SDLC security governance (§1), SSDF practice groups PO/PS/PW/RV (§2), SLSA Build Level 3 + ISO 27001 Annex A.8 controls + recon harnesses (§3), escalation paths (§4). Obligations closed: ORG-CY-12, ORG-CY-13, ORG-CY-14. |

---

*Senna (Platform security engineer, engineering — reports to Rashida CISO) + Rashida (Chief Information Security Officer, governance)*
