---
briefId: brief:owen:source-bowmans-isda-sa-netting-opinion-for-rms-:2026-05-20
issuedBy: Owen (Company Secretary, governance)
issuedTo: Imani (Chief Legal Counsel / Legal-entity & clause-library engineer, governance)
date: 2026-05-20
title: Source Bowmans 2024-04-15 ISDA SA netting opinion + file into RMS document store
priority: next-tick
workstream: WS-MARKET-RISK-PROCEDURES
citations:
  - record:documents:imani:g9-isda-vs-bilateral-fx-master-for-spot:2026-05-20
  - record:documents:helena:controlled-launch-mr1-fx-limit-proposal:2026-05-20
  - record:documents:rashida:finsurv-excon-assessment-for-fx-spot-internal-pre-licence-test:2026-05-20
  - D-RMS-PHASE-3
  - brief:owen:housekeeping-sweep-cco-attribution-isda-opinion-:2026-05-20
expectedOutputs:
  - kind: rms-record-filed
    description: "RecordFiled event for the Bowmans 2024-04-15 ISDA SA netting opinion; registerKey=documents; classification=governance-seat; retention=permanent (legal-opinion retention floor)"
  - kind: hash-publication
    description: "Publish content-hash to replace the placeholder DOC-OP-ISDA-SA-2024-04-15 used in Yael's PR #642 ISDACSAAssessmentCompleted events (optional follow-on PR; not in this brief)"
---

# Brief — Source Bowmans 2024-04-15 ISDA SA netting opinion + file into RMS document store

**Issued by:** Owen (Company Secretary, governance)
**Issued to:** Imani (Chief Legal Counsel / Legal-entity & clause-library engineer, governance)
**Workstream:** WS-MARKET-RISK-PROCEDURES
**Priority:** next-tick
**Date:** 2026-05-20

## Context

Your G-9 close decision (PR #637, `record:documents:imani:g9-isda-vs-bilateral-fx-master-for-spot:2026-05-20`) anchors the netting-enforceability of the controlled-launch FX-spot counterparties (Standard Bank Group + The Standard Bank of South Africa) on the ISDA 2024 South Africa netting opinion authored by Bowmans, dated 2024-04-15 in the publicly-cited ISDA library. Yael's PR #642 emits `ISDACSAAssessmentCompleted` events using `DOC-OP-ISDA-SA-2024-04-15` as a placeholder `jurisdictionOpinionRef`.

The opinion document itself is **not yet stored in the RMS document store**. Your §5 G-9 substrate gap #3 acknowledges this: *"This deliverable cites the Bowmans 2024-04-15 ISDA SA netting opinion by reference, but the document itself is not yet in the RMS document store with a content-addressed hash."*

I (Owen, Company Secretary) do not hold the document in my register-curator capacity. The natural home for an external legal opinion is the legal-entity & clause-library register that you maintain. This brief asks you to source the document and file it.

## What is needed

1. **Retrieve** the Bowmans 2024 ISDA SA netting opinion from the ISDA member library (or from Bowmans direct, or via the existing Standard Bank ISDA Master Agreement file — whichever path Imani has). The opinion is annually-refreshed; the 2024-04-15 vintage is the version cited in PR #637 G-9 G-1 and G-2 rows.
2. **File** the document via the standard `RecordFiled` flow (see `prototype/scripts/file-imani-g9-isda-vs-bilateral-fx.ts` for the pattern):
   - `recordId`: `record:documents:imani:isda-sa-netting-opinion-bowmans-2024-04-15:2026-05-20` (or whatever convention is appropriate for the legal-clause-library)
   - `registerKey`: `documents`
   - `classification`: `governance-seat`
   - **Retention: permanent** — jurisdictional opinions are not subject to the 7-year Companies Act §24 floor; they are load-bearing on every netting set's enforceability assessment for as long as that netting set exists. Use a retention `citationRef` that justifies permanent retention (or surface as a substrate gap if the retention policy does not yet enumerate "permanent" for legal opinions — this is itself a small policy gap).
   - `citations`: PR #637 G-9 (your own decision), the Bowmans-published-by-ISDA library URL or DOI if available, plus this brief ID.
   - `actor`: `agent:imani:governance`
   - `metadata.title`: "ISDA South Africa Netting Opinion — Bowmans 2024-04-15"
   - `metadata.author`: "Bowmans (external counsel, on assignment to ISDA)"
   - `metadata.date`: "2024-04-15"
3. **Publish the content-hash** in your closing brief response so it can replace the placeholder `DOC-OP-ISDA-SA-2024-04-15` in Yael's `ISDACSAAssessmentCompleted` events. The replacement is a separate follow-on PR — out of scope for this brief, but the hash is the unlocking artefact.

## Constraints

- If you cannot retrieve the document (e.g. ISDA library access lapsed, Bowmans gating), surface as a substrate gap with a specific routing — most likely Helena (CRO) or me (CoSec) to engage Bowmans direct, or a Mira-led FSCA/ISDA library renewal. Do not paper over.
- Retention-policy enumeration of "permanent" for legal opinions is a small follow-on if the current retention policy does not list this class — flag rather than freelance.
- The annual refresh cadence (ISDA publishes a new SA opinion each year) means the 2024-04-15 vintage will be superseded; your §3 procedure addendum in the G-9 close already enumerates the `JurisdictionalOpinionRefreshed` event-handling gap, which is separate from this brief and stays with you.

## Authority

- D-RMS-PHASE-3 (active) — `RecordFiled` event required for every deliverable in scope of the documents register.
- WS-MARKET-RISK-PROCEDURES — workstream that brackets the controlled-launch substrate; the Bowmans opinion is the legal underpinning of G-9 + the netting-set register + Yael's credit-limit engine on `creditLimitMethod: post-netting`.
- This brief is itself filed as part of Owen's housekeeping sweep (`brief:owen:housekeeping-sweep-cco-attribution-isda-opinion-:2026-05-20`).

## Substrate gaps surfaced by this brief

1. **No `RecordRequested` event kind in RMS Phase 1.** The seven RMS event kinds are `AgentBriefIssued`, `AgentRunStarted`, `AgentRunCompleted`, `RecordFiled`, `DecisionRequested`, `Decision` (deprecated alias `CeoDecision`), `FeedbackPosted`. A "this document is needed but not yet in hand" semantic is currently encoded as `AgentBriefIssued` (a brief to source it); a dedicated `RecordRequested` would be a cleaner primitive. Surface to Atlas as RMS Phase 5 input (if the substrate ever extends to additional event kinds).
2. **Retention-policy enumeration may lack "permanent" for legal opinions.** Most retention citations in current code paths use `urn:obligation:bank:org:gv:director-decision-retention:v1` (7y floor) or the FIC 5-year floor. A permanent-retention citation may not yet exist. Iris (Information Officer) + Imani co-own the retention-policy surface; surface as a small policy gap for next refresh.

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-20 | Owen (Company Secretary, governance) | Initial brief — Item 2 of Owen housekeeping sweep WS-MARKET-RISK-PROCEDURES. |
