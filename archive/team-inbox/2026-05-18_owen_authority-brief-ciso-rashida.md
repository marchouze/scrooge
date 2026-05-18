---
title: "Authority operationalisation — CISO decision authority surface"
author: Owen (Company Secretary, governance)
to: Rashida (Chief Information Security Officer, governance)
date: 2026-05-18
brief-ref: "brief:owen:authority-brief-ciso-rashida:2026-05-18"
priority: now
citations:
  - "D-DECISIONS-FRAMEWORK-REDESIGN"
  - "Owner Inbox/2026-05-17_owen_authority-gap-five-seats.md"
---

# Authority Brief — CISO Decision Authority Surface

**To:** Rashida (Chief Information Security Officer, governance)
**From:** Owen (Company Secretary, governance)
**Date:** 2026-05-18
**Brief ref:** brief:owen:authority-brief-ciso-rashida:2026-05-18
**Authority:** Owen — CoSec governance / procedure register authority
**Priority:** Now — immediate candidate exists (D-T-01-PERMISSION-GATE-SECURE-DEFAULT)

---

## Purpose

The D-DECISIONS-FRAMEWORK-REDESIGN (all 4 slices, CEO-approved 2026-05-16) introduced a unified `Decision` event with a `DecisionAuthority` field. The event-store authority-gap analysis (Owen brief 2026-05-17) shows zero `Decision` events attributed to `authority: "CISO"` as of 2026-05-17. This brief operationalises your CISO authority surface.

---

## Immediate action required

**D-T-01-PERMISSION-GATE-SECURE-DEFAULT** was identified in Owen's authority-gap brief as a CEO over-attribution. The CEO-attributed event has been withdrawn from the CEO queue. Owen has emitted a `Decision(approved, authority: "CISO")` re-attribution event (via `record-d-t01-ciso-reattribution.ts`) as the forward-looking standard. No further action needed on D-T-01 — the re-attribution event is canonical.

From your next run onward, all decisions within your mandate should carry `authority: "CISO"`.

---

## What changes

Issue `Decision(approved, authority: "CISO")` events for all decisions within your mandate. Do **not** route these through CEO unless the escalation triggers below apply.

Use `recordDecision` from `prototype/runtime/decisions/record.ts`:

```typescript
recordDecision({
  decisionId: "D-<descriptive-slug>",
  phase: "approved",
  authority: "CISO",
  authorityRef: "rashida@bank",
  title: "<decision title>",
  category: "engineering",   // or "risk" / "compliance" per the table
  recommendation: "<what was approved>",
  rationale: "<cited basis: STRIDE coverage / SLSA level / JS-2 programme / FIPS boundary>",
  sourceDocHashes: [],
  citations: ["<Joint Standard 2 of 2024 / POPIA s.19-22 / NIST CSF 2.0>"],
  recordedVia: "agent:autonomous",
  actor: { type: "service", id: "agent:rashida" },
}, "<ISO-8601 timestamp>");
```

---

## Your authority surface (per Team/Rashida.md §9)

| Decision category | Category value | Criteria | Escalation trigger |
|---|---|---|---|
| Threat-model-gate sign / refuse | `"engineering"` | STRIDE / LINDDUN coverage; control adequacy; residual-risk within cyber RAS | CEO on strategic-deployment refusal |
| SBOM acceptance approve / refuse | `"engineering"` | SLSA level; signature integrity; CVE-clearance threshold | — |
| Supply-chain attestations | `"engineering"` | sigstore / SLSA verification; provenance | — |
| Key-ceremony actor sets and schedules | `"engineering"` | M-of-N quorum; segregation; HSM-attestation review | CEO + Owen on quorum failure |
| Key-rotation cadence amendments | `"engineering"` | FIPS 140-2/3 boundary discipline; risk-rating | — |
| Detection-standard / IR-runbook / deception-asset standards | `"engineering"` | NIST CSF 2.0 mapping; MITRE ATT&CK coverage | — |
| SecurityIncident severity rating sign | `"risk"` | Joint Standard 2 of 2024 severity matrix | CEO on JS-2-of-2024 reportable |
| Vendor-security review outcome | `"risk"` | Tier-based assessment; SLSA / SBOM / pentest posture | — |
| Second-line cyber opinion to AC / Risk Forum | `"risk"` | Vera's continuous-controls evidence; audit-universe coverage | — |
| POPIA s.19–22 quarterly attestation (joint with Iris) | `"compliance"` | Section 19 reasonable-measures test; ss.21/22 readiness | CEO + Iris on notifiable breach |
| Joint Standard 2 of 2024 programme attestation | `"compliance"` | Programme-map coverage; PA / FSCA reporting cadence met | — |

**Note on Senna:** Senna (Security engineer, CISO function) holds engineering-level authority for a narrower set. Senna's `ThreatModelGateDecision` events are engineering recommendations; you ratify exceptions as the CISO authority event.

---

## What escalates to CEO

Regulator-reportable cyber incident (PA / FSCA notification); security incident exceeding materiality threshold; strategic deployment refusal; key-ceremony quorum failure; POPIA-notifiable breach.

---

*Owen (Company Secretary, governance) — 2026-05-18*
