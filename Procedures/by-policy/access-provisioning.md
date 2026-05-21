---
status: POPULATED
---
# Procedure — Access provisioning (joiner / mover / leaver)

**Procedure ID:** PROC-IS-AP-01
**Owner:** Senna (Security engineer, engineering) · Devon (Chief Operating Officer, governance)
**Approval:** EXCO
**Cadence:** Event-triggered (per personnel/agent change); quarterly access review
**Version:** v0.2 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

`Policies/information-security-it-governance-policy-v1.md` — Information Security and IT Governance Policy.

This procedure operationalises the joiner / mover / leaver (JML) lifecycle for all principals — human employees (licence-day) and AI agents (build phase and beyond). The least-privilege and privileged-access-management (PAM) requirements are authoritative in the policy.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CY-15` (JS 1/2023, IT Governance Framework) | IT governance framework: access controls, least privilege, role-based access. |
| `ORG-CY-16` (JS 1/2023, IT Risk Management) | Access risk is a named IT risk; JML lifecycle is a required risk-treatment control. |
| `ORG-CY-17` (JS 2/2024, Cybersecurity Framework) | Identity and access management (IAM) is a mandatory cybersecurity control domain. |

## 3. Purpose

Ensure that every principal (AI agent or human) has access to exactly the systems and data required for their current role — no more, no less — at every point in their lifecycle. Promptly revoke access when a principal departs or changes role; prevent accumulation of privilege across role changes; ensure all access grants are auditable and traceable to typed events.

## 4. Trigger

| Trigger | Sub-flow |
|---|---|
| `AgentRegistered { agent_id, role_profile }` event | Joiner — AI agent |
| `EmployeeOnboarded { employee_id, role_profile }` event | Joiner — human (licence-day) |
| `AgentRoleChanged { agent_id, old_role, new_role }` event | Mover — AI agent |
| `EmployeeRoleChanged { employee_id, old_role, new_role }` event | Mover — human |
| `AgentRetired { agent_id }` event | Leaver — AI agent |
| `EmployeeOffboarded { employee_id }` event | Leaver — human |
| Quarterly calendar event (scheduled agent tick) | Access review — all principals |

## 5. Steps

### Sub-flow A: Joiner

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| J1 | Receive `AgentRegistered` or `EmployeeOnboarded` event. Retrieve role profile from the role registry. | `system` | `@platform/iam/role-registry` (`PLANNED`) | Role profile defines the access scope: systems, permissions, data classifications, API keys, HSM access (if any). |
| J2 | Provision access: create principal identity (`AgentId` or `EmployeeId`), assign role-profile entitlements, issue credentials (API key, mTLS certificate, or MFA token). | `system` | `@platform/iam/provisioning` (`PLANNED`) | MFA is mandatory for all human principals. AI agents authenticate via mTLS client certificates signed by the bank's internal CA. |
| J3 | Confirm access with line manager / responsible agent. Line manager countersigns the access record to confirm the entitlements match the role. | Line manager (human at licence-day; agent during build phase) | `@platform/iam/confirmation` (`PLANNED`) | This is the first-day check. Any discrepancy between provisioned access and the role profile triggers an immediate correction before the principal is activated. |
| J4 | Emit `AccessGranted { subject_id, subject_type, role, systems, permissions, credentials_ref, authorised_by, granted_at }` event. Principal is now active. | `system` | `@platform/event-store` ✓ | The `credentials_ref` is a reference to the credential record in the HSM / secrets vault; no raw credential appears in the event log. |
| J5 | For principals with privileged access in their role profile: initiate PAM on-boarding — dual-approval gate, session-recording configuration, time-limited grant with automatic expiry. | Senna (agent) | `@platform/iam/pam` (`PLANNED`) | Privileged access includes: admin/root on any system, HSM access, direct database write, infrastructure control plane. See PAM sub-flow in Step P1–P4. |

### Sub-flow B: Mover

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| M1 | Receive `AgentRoleChanged` or `EmployeeRoleChanged` event. Retrieve old role profile and new role profile from the role registry. Compute the access delta. | `system` | `@platform/iam/role-registry` (`PLANNED`) | Delta = (new_profile.access − old_profile.access) and (old_profile.access − new_profile.access). |
| M2 | Revoke all access entitlements from the old role profile within 24 hours of the trigger event. Terminate any active sessions under old entitlements. Emit `AccessRevoked { subject_id, revoked_entitlements, revoked_at, reason: 'role-change' }` event. | `system` | `@platform/iam/provisioning` (`PLANNED`) + `@platform/iam/session-mgmt` (`PLANNED`) | The old and new access grants must not overlap. Accumulation of privilege across role changes is a control failure. |
| M3 | Provision new access entitlements per the new role profile. Issue new credentials where required. Emit `AccessGranted { subject_id, subject_type: 'role-change', role: new_role, systems, permissions, authorised_by, granted_at }` and `AccessModified { subject_id, old_role, new_role, added_entitlements, removed_entitlements, authorised_by, modified_at }` events. | `system` | `@platform/iam/provisioning` (`PLANNED`) | If the new role includes privileged access not in the old role, trigger PAM sub-flow (P1–P4) before activating privileged entitlements. |
| M4 | Confirm with line manager. Confirm that new access matches the new role profile. | Line manager | `@platform/iam/confirmation` (`PLANNED`) | Confirmation must occur within 48 hours of the role-change event. |

### Sub-flow C: Leaver

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| L1 | Receive `AgentRetired` or `EmployeeOffboarded` event. Mark principal as departing; begin immediate access revocation. | `system` | `@platform/iam/provisioning` (`PLANNED`) | Clock starts at event receipt. Target: all access revoked within 1 hour. |
| L2 | Revoke all access entitlements. Terminate all active sessions. Invalidate API keys. Revoke mTLS certificates (add to the bank's CRL). If the principal held HSM access credentials, rotate them. | `system` | `@platform/iam/provisioning` (`PLANNED`) + `@platform/iam/session-mgmt` (`PLANNED`) + `@platform/hsm/credential-rotation` (`PLANNED`) | SLA: 1 hour from trigger for AI agents; 1 hour from trigger for humans. Zero tolerance for active sessions post-revocation. |
| L3 | Rotate any API keys or shared secrets the principal had access to. Notify dependent systems of key rotation. | `system` + Senna (agent) | `@platform/iam/key-rotation` (`PLANNED`) | Keys shared with external counterparties require bilateral notification — Senna coordinates with the relevant relationship owner. |
| L4 | Document final access review: confirm that all entitlements have been revoked, no orphan sessions exist, no residual credential is valid. Emit `AccessRevoked { subject_id, revoked_entitlements, revoked_at, reason: 'offboarding', final_review_completed: true }` event. | Senna (agent) | `@platform/event-store` ✓ | Final review is a control attestation, not just a system state. Senna signs the `AccessRevoked` event as the attestor. |

### Sub-flow P: Privileged Access Management (PAM)

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| P1 | Receive privileged access request (from Joiner or Mover sub-flow, or ad-hoc request). Validate that the request is within the principal's role profile or accompanied by a CISO-approved rationale and time-box. | Senna (agent) | `@platform/iam/pam` (`PLANNED`) | Ad-hoc requests above the role profile require: CISO approval + written rationale + time-limited grant (maximum 24 hours without re-approval). |
| P2 | Dual approval: a second authorised approver (nominated by Senna) countersigns the privileged access grant. | Senna (agent) + second approver | `@platform/iam/pam` (`PLANNED`) | Dual approval is non-negotiable for admin/root, HSM access, and infrastructure control-plane access. Self-approval is blocked at the platform layer. |
| P3 | Activate privileged access with session recording and automatic expiry. Session recording stores a full audit trail of commands issued. | `system` | `@platform/iam/pam` (`PLANNED`) + `@platform/iam/session-recording` (`PLANNED`) | Sessions expire automatically at the grant's `expiry_at` timestamp. Renewal requires a new dual-approval cycle. |
| P4 | Emit `PrivilegedAccessGranted { subject_id, system, scope, expiry_at, dual_approved_by, granted_at }` event. On expiry: emit `PrivilegedAccessExpired { grant_id, expired_at }`. | `system` | `@platform/event-store` ✓ | If the session is terminated before natural expiry, emit `PrivilegedAccessRevoked { grant_id, revoked_at, reason }`. |

### Sub-flow H: HSM key custodian access

HSM key custodian access is a sub-class of privileged access with additional ceremony controls. Every HSM partition has a defined custodian roster; changes to that roster follow this sub-flow.

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| H1 | Receive custodian-change request (add or remove). Validate that the request is authorised by Senna and Devon jointly. No single approver may self-authorise HSM custodian changes. | Senna (agent) + Devon (governance) | `@platform/iam/pam` (`PLANNED`) | HSM custodian roster changes are a CISO + COO joint decision. Either party may initiate; both must countersign. |
| H2 | Perform dual-control ceremony to update the HSM partition's custodian roster. Both authorised custodians authenticate into the HSM. Ceremony is video-logged; log hash is stored in the HSM audit log. | Senna (agent) + Devon (governance) | `@platform/hsm/ceremony` (`PLANNED`) | Follows the same ceremony protocol as `key-rotation.md` Step 5. If a retiring custodian is unavailable (leaver), Devon + Senna perform the ceremony with a nominated replacement. |
| H3 | Emit `AccessGranted { subject_id: new_custodian_id, subject_type: 'hsm-custodian', role: 'hsm-custodian', systems: ['hsm:<partition_id>'], permissions: ['key-generate','key-activate','key-retire'], dual_approved_by: ['senna','devon'], granted_at }` event. | `system` | `@platform/event-store` ✓ | HSM custodian grants must carry the `dual_approved_by` field. Grants without this field are rejected by the invariant check. |
| H4 | For custodian removals (leaver or role change): revoke HSM partition access immediately. Rotate any keys the departing custodian had sole knowledge of. Emit `AccessRevoked { subject_id, revoked_entitlements: ['hsm:<partition_id>'], revoked_at, reason }`. | `system` + Senna (agent) | `@platform/hsm/credential-rotation` (`PLANNED`) | Integrates with Sub-flow C (Leaver) Step L2. Key rotation for HSM custodian leavers follows `key-rotation.md`. |

### Sub-flow Q: Quarterly privileged-access review

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| Q1 | Pull all active access grants from the IAM system. Cross-reference against the current principal registry (active `AgentRegistered` / `EmployeeOnboarded` minus `AgentRetired` / `EmployeeOffboarded`). | Senna (agent) | `@platform/iam/access-report` (`PLANNED`) | Orphan access = access grant with no matching active principal. |
| Q2 | Identify orphan access (grants with no matching active principal). Revoke immediately. Emit `OrphanAccessRevoked { grant_id, subject_id, revoked_at }` per orphan. Then emit `AccessRevoked { subject_id, revoked_entitlements, revoked_at, reason: 'orphan-revocation' }` to close the entitlement record. | `system` | `@platform/iam/provisioning` (`PLANNED`) | Orphan access is a critical finding. If count > 0, escalate to Devon and the BRC as a control failure. |
| Q3 | Review all active privileged-access grants. Confirm each grant is still within its authorised scope and time-box. Revoke any expired or out-of-scope grants. | Senna (agent) | `@platform/iam/pam` (`PLANNED`) | Expired grants that have not auto-expired indicate a PAM platform failure — escalate to Atlas. |
| Q4 | Produce `AccessReviewCompleted { review_type: 'quarterly', period, principals_reviewed, orphans_found, orphans_revoked, privileged_grants_reviewed, exceptions, reviewed_by, completed_at }` event. Report to BRC. | Senna (agent) | `@platform/event-store` ✓ | Report surfaces on the CEO dashboard. Exceptions (orphans, stale privileges, unapproved out-of-profile grants) are listed individually. |

### Sub-flow A2: Annual standard-access review

Performed once per calendar year. Reviews all non-privileged access grants against current role profiles. Complements the quarterly privileged-access review.

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| A2-1 | Pull all active standard (non-privileged) access grants from the IAM system. Group by role profile. | Senna (agent) | `@platform/iam/access-report` (`PLANNED`) | Standard access = all grants not classified as privileged (no admin/root, no HSM, no infrastructure control-plane). |
| A2-2 | For each principal, compare actual access grants against the current role-profile definition. Flag any grants exceeding the role profile (accumulated drift) or missing required entitlements (gap). | Senna (agent) | `@platform/iam/role-registry` (`PLANNED`) | Drift above the role profile is treated as an uncontrolled escalation: revoke immediately and raise a Vera finding. |
| A2-3 | Revoke over-provisioned entitlements. Emit `AccessRevoked { subject_id, revoked_entitlements, revoked_at, reason: 'annual-review-cleanup' }` per corrected principal. | `system` | `@platform/iam/provisioning` (`PLANNED`) | Corrections must be completed within 5 business days of the review run. |
| A2-4 | Run orphaned-account detection recon: query the IAM system for accounts with no authentication activity in the last 90 days. Flag for investigation; revoke confirmed orphans. Emit `OrphanAccessRevoked { grant_id, subject_id, revoked_at }` per orphan. | `system` + Senna (agent) | `@platform/iam/orphan-detection` (`PLANNED`) | 90-day inactivity is a presumptive orphan signal; confirmed by cross-reference with the principal registry. Active principals on leave are excluded via the `leave_until` field. |
| A2-5 | Emit `AccessReviewCompleted { review_type: 'annual', period, principals_reviewed, grants_reviewed, drift_found, drift_corrected, orphans_found, orphans_revoked, gaps_found, exceptions, reviewed_by, completed_at }`. Report to EXCO and BRC. | Senna (agent) | `@platform/event-store` ✓ | Annual review is an EXCO governance record. Exceptions list any unresolved drift or access gaps. |

## 6. Reconciliation

**Events produced:**

- `AccessGranted { subject_id, subject_type, role, systems, permissions, credentials_ref, authorised_by, granted_at }` — Joiner completion or Mover new-role grant.
- `AccessRevoked { subject_id, revoked_entitlements, revoked_at, reason, final_review_completed? }` — Leaver completion, Mover old-role revocation, or orphan revocation.
- `AccessModified { subject_id, old_role, new_role, added_entitlements, removed_entitlements, authorised_by, modified_at }` — Mover completion (paired with `AccessRevoked` + `AccessGranted`).
- `PrivilegedAccessGranted { subject_id, system, scope, expiry_at, dual_approved_by, granted_at }` — PAM grant after dual approval.
- `PrivilegedAccessExpired { grant_id, expired_at }` — PAM automatic expiry.
- `PrivilegedAccessRevoked { grant_id, revoked_at, reason }` — PAM early revocation.
- `OrphanAccessRevoked { grant_id, subject_id, revoked_at }` — Orphaned-account detection during quarterly or annual review.
- `AccessReviewCompleted { review_type: 'quarterly'|'annual', period, principals_reviewed, orphans_found, orphans_revoked, privileged_grants_reviewed, exceptions, reviewed_by, completed_at }` — Quarterly (privileged) or annual (standard) review closure.

**Invariants:**

- No active `AgentRegistered` or `EmployeeOnboarded` principal exists without a corresponding `AccessGranted` event (with no subsequent `AccessRevoked` event).
- No active access grant exists for a principal with an `AgentRetired` or `EmployeeOffboarded` event (i.e., no un-revoked access after departure).
- No `PrivilegedAccessGranted` event exists without a `dual_approved_by` field naming two distinct principals.
- Every Mover's `AccessRevoked` (old role) event timestamp precedes or is simultaneous with their `AccessModified` event timestamp — old and new access do not accumulate.
- Every `OrphanAccessRevoked` event is paired with an `AccessRevoked { reason: 'orphan-revocation' | 'annual-review-cleanup' }` event within the same review run.
- Every `AccessGranted` event for HSM custodian access carries a non-null `dual_approved_by` field with two distinct principal identifiers.
- Every quarter has a closed `AccessReviewCompleted { review_type: 'quarterly' }` event; every calendar year has a closed `AccessReviewCompleted { review_type: 'annual' }` event. Absence of either is a Vera finding.

**Failure mode:** If the IAM provisioning system is unavailable, the Joiner flow is suspended — principals are not activated until access is correctly provisioned. The Leaver flow is fail-secure: if the automated revocation cannot confirm completion, Senna performs manual revocation and records the `AccessRevoked` event manually.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `AccessGranted` events | Event log | Permanent (P1) | High |
| `AccessRevoked` events | Event log | Permanent (P1) | High |
| `AccessModified` events | Event log | Permanent (P1) | High |
| `PrivilegedAccessGranted` / `Expired` / `Revoked` events | Event log | Permanent (P1) | Critical |
| PAM session recordings | `@platform/iam/session-recording` store | 5 years | Critical |
| `AccessReviewCompleted` events (quarterly + annual) | Event log + Owner Inbox | 7 years (governance record) | High |
| `OrphanAccessRevoked` events | Event log | Permanent (P1) | High |
| Role registry snapshots (per quarterly review) | Document store | 7 years | Internal |

## 8. Manual steps

- **Step J3 / M4 (line-manager confirmation):** Human-in-the-loop at licence-day. During the build phase, the responsible agent (Devon or Senna) performs the confirmation.
- **Step P2 (dual approval for privileged access):** Requires a second human or senior-agent approver. During the build phase, Devon acts as second approver for agent-level privileged grants.
- **Step L3 (API key rotation / external counterparty notification):** Requires coordination with counterparties; Senna manages the bilateral notification manually where automated notification is not available.
- **Step L2 (HSM credential rotation for human leavers at licence-day):** The HSM requires physical token management for human holders; Devon coordinates with the HSM administrator.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Leaver access not revoked within 1 hour | Leaver-SLA monitor (event timestamp delta) | Senna + Devon immediately; manual revocation initiated; incident filed per `incident-response.md` |
| Mover privilege accumulation (old + new access active simultaneously) | Invariant check in projection runtime | Senna immediately; old access force-revoked; Vera finding raised; CISO report to BRC |
| `AccessProvisioned` without a matching active principal | Orphan-access invariant check | Quarterly review catch; immediate revocation; Senna + Devon; Vera finding |
| Privileged access granted without dual approval | Platform gate logs a blocked attempt; Vera periodic audit | Senna + Devon immediately; grant revoked; incident logged; CISO notified |
| PAM session recording failure during a privileged session | Health-check on `@platform/iam/session-recording` | Session suspended; Senna investigates; no privileged access without recording capability |
| Quarterly review not completed | Cadence monitor (agent scheduler) | Devon escalates to EXCO; BRC informed; review re-queued as urgent |
| IAM provisioning system unavailable | Health-check on `@platform/iam/provisioning` | Atlas + Senna immediately; joiner flow suspended; leaver flow escalated to manual |

## 10. Related procedures

- `incident-response.md` — if an access control failure constitutes a security incident.
- `key-rotation.md` (`PLANNED`) — periodic rotation of cryptographic keys, independent of the JML cycle.
- `secure-sdlc.md` — least-privilege and access control requirements for the software development lifecycle.
- `agent-runtime-deploy.md` — agent deployment procedure, which triggers `AgentRegistered` events consumed by this procedure.

## 12. Recon harness — orphaned-account detection

The orphaned-account detection recon (`@platform/recon/iam-orphan-detection`) runs on the following schedule:

| Run | Trigger | Scope | Output |
|---|---|---|---|
| Continuous | Every `AgentRetired` / `EmployeeOffboarded` event | The departing principal's access grants | Immediate alert if any grant remains unrevoked 1 hour after the trigger event |
| Quarterly | Quarterly review tick (Sub-flow Q) | All privileged-access grants | Flags grants with no matching active principal; feeds Q2 |
| Annual | Annual review tick (Sub-flow A2) | All access grants (privileged + standard) | Flags accounts with 90-day inactivity + role-profile drift; feeds A2-4 |

**Recon invariant assertions** (run at every tick):

1. `∀ grant ∈ active_grants : ∃ principal ∈ active_principals WHERE principal.id == grant.subject_id` — no grant without an active principal.
2. `∀ principal ∈ retired_principals : ¬∃ grant ∈ active_grants WHERE grant.subject_id == principal.id` — no active grant for a retired or offboarded principal.
3. `∀ privileged_grant : privileged_grant.dual_approved_by.length == 2 AND privileged_grant.dual_approved_by[0] ≠ privileged_grant.dual_approved_by[1]` — no self-approved privileged grant.
4. `∀ hsm_custodian_grant : hsm_custodian_grant.dual_approved_by.includes('senna') OR hsm_custodian_grant.dual_approved_by.includes('devon')` — HSM custodian grants must involve CISO or COO as one of the dual approvers.

**Failure action:** Any assertion violation emits a `ReconFinding { recon_id: 'iam-orphan-detection', assertion_id, subject_id, grant_id, found_at, severity: 'critical' }` event, which surfaces immediately on the security dashboard and is escalated to Rashida (Chief Information Security Officer, governance) and Devon (Chief Operating Officer, governance). Vera (internal audit engineer) is notified within the same tick for independence.

**System capability:** `@platform/recon/iam-orphan-detection` (`PLANNED`) — implemented as a TypeScript recon function in `prototype/platform/recon/iam-orphan-detection.ts`, scheduled via the agent scheduler harness.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Rashida (Chief Information Security Officer, governance) + Devon (Chief Operating Officer, governance) | Initial stub; 9 sections across 5 sub-flows (Joiner, Mover, Leaver, PAM, Quarterly review); system capabilities `PLANNED`. |
| v0.2 | 2026-05-15 | Rashida (Chief Information Security Officer, governance) + Devon (Chief Operating Officer, governance) | STUB → POPULATED. Added Sub-flow H (HSM key custodian access), Sub-flow A2 (annual standard-access review). Canonical event names updated to `AccessGranted` / `AccessRevoked` / `AccessReviewCompleted`. Added Section 12 (recon harness — orphaned-account detection). Annual review cadence formalised. All 12 sections complete. |
