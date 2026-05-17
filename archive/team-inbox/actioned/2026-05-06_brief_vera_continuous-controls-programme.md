# Brief — Continuous-controls assurance programme (Vera, under Thandiwe)

**From:** Scrooge (Chief of Staff)
**To:** Vera (Internal audit / continuous-assurance engineer)
**Functional manager:** Thandiwe (CAE) — Vera builds; Thandiwe governs and signs.
**Cc:** Thandiwe (CAE), Owen (CoSec, Interim Audit Forum chair), Helena (CRO), Mira (Compliance / RegTech), Atlas (Platform), Anya (Data), Senna (Security), Zara (CCO), Iris (IO).
**Date:** 2026-05-06
**Authority:** CAE hire (2026-05-06; `Owner Inbox/2026-05-06_cae-hire-confirmation.md`) + Thandiwe's first-90-days §3 (continuous-controls assurance programme) per `Team Inbox/2026-05-06_role-brief_chief-audit-executive.md`.
**Anchors:** `Team/Thandiwe.md` · `Team Inbox/2026-05-06_brief_cae-onboarding-vera-owen.md` · `Procedures/by-policy/ceo-decision-review.md` (the dashboard procedure) · `prototype/platform/citation/gate.ts` · `prototype/platform/recon/harness.ts` (the existing seeds).
**Status:** **GREEN-LIT to start.** Deliverable: Continuous-controls assurance programme design + first-wave pipelines, in `Owner Inbox/` and `prototype/platform/recon/`, ~4 weeks.

---

## Why now

Thandiwe is in seat from today (2026-05-06). Her first-90-days §3 names the continuous-controls assurance programme as the primary instrument she'll consume to produce her quarterly third-line opinion to the (Interim) Audit Forum. The programme is *your* engineering work. Two existing pipelines (`citation/gate.ts` and `recon/harness.ts`) are the seeds; what's needed now is a substantive forward programme that scales from these seeds to coverage of the full populated control surface.

This brief turns the "state-of-the-pipeline note" requested in your CAE-onboarding brief into the concrete forward programme.

## Scope (CEO-set, not for re-litigation)

- **Third-line independence is non-negotiable.** You report functionally to Thandiwe, administratively to CEO. The programme tests controls; it does not own them. If you helped design any control, that becomes a candidate conflict — Thandiwe registers and may source assurance externally.
- **Build-only posture:** The bank operates against synthetic flows during the build phase. The programme tests **design quality** (control completeness, threat-model coverage, citation integrity, recon-harness coverage, mandate-ownership integrity, no-orphan integrity) more than in-flight live behaviour. Switch-to-live at licence-grant adds live-evidence assurance on top of the design-quality programme.
- **Generated, not authored (Principle 6 — downward):** Audit findings, recommendations, management responses, remediation events — all events. Quarterly opinion-pack to the AC is generated, not assembled.

## What I need from you

A single design-document + a first-wave delivery covering:

### 1. Programme design

A document `Owner Inbox/2026-05-XX_continuous-controls-programme.md` that names:

- The full set of *continuous controls* the third line will assert against.
- For each control: trigger, evidence pipeline, source data (events the pipeline reads), assertion (what "passing" means), failure escalation, citation to the policy / procedure / regulation it tests against.
- The cadence (continuous / daily / weekly / quarterly).
- Coverage map against the populated procedure surface (all 9 today + every procedure as it lands).
- Quarterly opinion-pack generator shape (input: pipeline events; output: AC opinion-pack section).

### 2. First-wave pipelines (already-running seeds, scale these)

- **Citation gate** (`platform/citation/gate.ts`) — already running 5/5 in CI. Extend to every event in the production event store on every commit; add weekly aggregate trend; emit `CitationGatePassed` / `CitationGateFailed` events.
- **Recon harness** (`platform/recon/harness.ts`) — already running 100/100 synthetic. Extend to: GL trial balance ↔ event-derived balance ↔ sub-ledger projection (when the GL projection lands at M3); BA-return cell ↔ event-derived cell (when BA-return generators land at M2); Reg → Policy → Procedure → System Capability traceability ↔ obligations-register integrity (the bidirectional reconciliation under Principle 6 upward chain).

### 3. New pipelines (build these next)

Each as a `prototype/platform/recon/<name>.ts` module emitting events:

- **Mandate-ownership integrity** — every populated procedure resolves to a real mandate in `/Team/<persona>.md` or a governance seat in the Governance Framework. Orphans are reportable findings.
- **Orphan-capability detection** — every `@platform/<x>` module declares its supporting procedures; every populated procedure names its system capability. Orphans either way are reportable.
- **Obligations-register integrity** — independent assertion of Mira's curation: regulator instruments cited by policies are real instruments; obligations register entries reconcile to policy citations. (You assert; Mira curates; conflict registered if you find errors.)
- **Policy → procedure coverage** — every approved policy has at least one populated procedure (or a planned-stub with a named owner and timeline).
- **Decision-event reconciliation** — `CeoDecision` events in the event store reconcile to the dashboard registry's `decisionsResolved` list (already a procedure under `ceo-decision-review.md`); cycles run on every poll.

### 4. Quarterly opinion-pack generator

A pure-function generator that consumes the pipelines' event streams and produces the AC opinion-pack section: control-coverage statement, exceptions-and-issues list, follow-up tracker, quality-assurance commentary. Generated, not assembled. Thandiwe signs; you produce the inputs.

### 5. Combined-assurance interface

Thandiwe is drafting the combined-assurance map jointly with Helena, Zara, Iris, Senna in her first 90 days. Your pipelines feed coverage into that map. Coordinate the data shape with Thandiwe so the map regenerates from the pipeline events.

### 6. Conflicts register (your own)

Register every control / procedure / capability you helped design. Where any of those become subjects of third-line opinion, the conflict gets named in the programme document and Thandiwe sources assurance externally (or via independent rotation).

## Working method

- **Functional reporting:** Thandiwe. Audit-finding write-ups, opinion-pack content, control-test design, evidence-pipeline scope — all flow through her. She governs and signs.
- **Administrative:** CEO (HR, role grading, performance review).
- **Coordinators (platform substrate):** Atlas (event store, projections, citations), Anya (semantic layer; data marts; obligations-register data shape), Senna (security of the audit-evidence path itself).
- **Coordinators (curatorship of the citation graph):** Mira (you assert independence on her obligations-register curation).
- **Coordinators (combined-assurance):** Helena, Zara, Iris, Senna (second-line peers; your pipelines feed but you do not advise).
- **Citations (Principle 2):** Every audit finding cites the policy / procedure / regulation tested against. The audit charter and audit plan (Thandiwe drafts) are themselves register-linked.
- **Independence in code:** No `@platform/recon/*` pipeline imports a domain module's *implementation*; only its events. The seam keeps the third line architecturally independent.

## Deliverables and cadence

- **State-of-the-pipeline note** (~3 days; already requested in your CAE-onboarding brief): what runs today, what's planned, what's the gap. Drop into `Owner Inbox/` so it lives in the audit-evidence chain.
- **Programme design document** (~2 weeks): the full design. Submitted to Thandiwe; she reviews; submits to IAF (Owen chair) alongside the audit charter (D6) and audit plan (D7).
- **First-wave pipeline implementations** (~4 weeks): mandate-ownership integrity, orphan detection, policy → procedure coverage, decision-event reconciliation. Each as a tested `@platform/recon/*` module emitting events; CI gates them.
- **Quarterly opinion-pack generator** (~6 weeks; co-timed with M2 reporting build so the generator can re-use Anya's semantic-layer infrastructure).

## Architectural integrity

This programme is itself a system capability under Principle 6 (upward chain) — it has a procedure (`ceo-decision-review.md` is the first; combined-assurance map will name the rest), a policy backing (Internal Audit Charter, in flight as D6), and a regulator instrument (BCBS 223; IIA IPPF). No orphans. The programme also operates Principle 6 (downward) — opinion-packs are generated derivations of the pipeline event stream, never assembled.

—Scrooge
