---
title: ISDA-readiness deep-dive — Priority-A subset (Y-marked)
author: Imani
date: 2026-05-07
summary: Deep-dive on the 17 Y-marked Priority-A counterparties from Niko's top-100 list. Per-counterparty ISDA-Master version signal, last-amendment public signal, SA-bespoke clause exposures, CSA-readiness signal, GMRA / GMSLA exposure where bond-repo / sec-lend is in scope, and the bilateral-template work each counterparty surfaces. Build-phase legal output; no commercial commitments, no privileged communications.
decision-required: false
---

# ISDA-readiness deep-dive — Priority-A subset (Y-marked)

**From:** Imani (Legal-as-code engineer)
**To:** Marc (CEO) — via Scrooge
**Cc:** Saskia (Head of Global Markets); Niko (Sales / CRM); Mira (RegTech); Helena (CRO); Atlas (legal-entity-tree substrate); Owen (CoSec, conflicts register); Devon (COO, interim governance home).
**Authority:** CEO directive 2026-05-07, follow-on to Niko's `2026-05-07_niko_top-100-sa-institutional-targets.md`.
**Posture:** Engineering research. Not legal advice. No live counterparty contact, no privileged communications, no insider information. All assessments derive from publicly disclosed sources or from market-conventional inference; uncertainty is marked rather than papered over.

---

## §1 — Framing

This is research from public sources to seed the legal-as-code substrate that will paper our institutional bilaterals at licence-day. It is not advice, not commitment, not negotiation, and not a forecast of any counterparty's reciprocal interest.

The architecture I am writing against. ISDA Master Agreements are the standard bilateral framework for OTC derivatives globally — almost any institutional counterparty we will face in IRD or FX-forward space already holds ISDA shelves with the SA Big Four. The Master is the ceiling document; the **Schedule** carries the bilateral-specific elections; the **Credit Support Annex** (CSA / VM-CSA / IM-CSA) is the collateral overlay; **Confirmations** are per-trade and snap onto the Master. **GMRA** (Global Master Repurchase Agreement, ICMA-published) is the analogous master for repo. **GMSLA** (Global Master Securities Lending Agreement, ISLA-published) covers securities lending.

The question this deep-dive answers, per counterparty: (a) what ISDA-Master *version* are they likely on, (b) what *SA-bespoke* schedule overlay is likely required, (c) what *CSA* posture they hold with peer SA banks, (d) whether they fall in-scope for *uncleared-margin Initial Margin* under the BCBS-IOSCO phasing and SA's Joint Standard 2 of 2020, (e) whether GMRA or GMSLA exposure is real for them, and (f) what *clause-library* and *bilateral-template* work I need to have ready before Saskia opens a door.

Build-phase posture. We are pre-licence. Nothing here turns into a signed agreement. What it turns into is template-readiness — clause-library entries, schedule overlays, CSA shells, and a counterparty-by-counterparty preparation map. The deliverable is one rung in the larger Principle-6 chain (Regulation → Policy → Procedure → System Capability) for the legal substrate; every clause I nominate carries a citation under Principle 2.

## §2 — Methodology

I worked counterparty-by-counterparty against a fixed set of public sources, then scored on a fixed set of axes, then mapped each score to clause-library implications.

**Public sources I drew on.**

- Counterparty annual financial statements and integrated reports — for treasury policy disclosures, derivative-usage notes (IFRS 7 + 9 + 13 disclosures), hedge-accounting designations (cash-flow / fair-value / net-investment), and counterparty-bank panels where named.
- ISDA's own published market data — Master Agreement adherence registers (publicly listed on isda.org); ISDA Resolution Stay Protocol adherence; ISDA 2014 Credit Derivatives Definitions adherence; ISDA 2018 Benchmarks Supplement adherence; ISDA 2020 IBOR Fallbacks Protocol adherence; ISDA 2021 ZARONIA fallback supplement (where SA-relevant adherence has been published).
- ICMA GMRA Annex SA (2011 base + 2018 SA-elections variant) public adherence signals.
- ISLA GMSLA 2010 + 2018 public publication.
- ESMA EMIR public reporting where the counterparty has an EU-domiciled subsidiary subject to EMIR Article 9 reporting.
- FSCA Conduct of Financial Institutions register and the FSCA OTC Derivative Provider (ODP) register under FMA s.5(1)(d) and the OTC Derivative Provider Conduct Standards.
- SARB Prudential Authority published bank list and authorised-dealer list; Joint Standard 2 of 2020 (Margin requirements for non-centrally cleared OTC derivative transactions); FIC Act 38 of 2001 published RMCP guidance.
- Strate Trade Repository disclosures relevant to SA OTC reporting from 2027.
- Public M&A / restructuring announcements affecting counterparty entity structure (e.g. Standard Bank Group, Old Mutual / Quilter de-merger legacy, Ninety One de-merger from Investec).

**Scoring axes per counterparty.**

- **ISDA-Master version signal.** Public-domain expectation: 1992 ISDA (legacy, some life insurers and older corporates); 2002 ISDA (modern default); 2002 ISDA + SA Bilateral Schedule overlay; 2018 Master Netting Agreement (rare in SA, more common in Europe and Asia).
- **Last-amendment public signal.** Recent ISDA-protocol adherence (2018 Benchmarks Supplement; 2020 IBOR Fallbacks; ZARONIA fallback supplement) signals an active legal team that maintains its bilateral panel. Silence is not absence — but I mark "unknown" honestly.
- **CSA status with peer SA banks.** Joint Standard 2 of 2020 (effective Q4 2020 for VM, phased thereafter for IM) makes Variation-Margin CSAs effectively universal for institutional bilaterals over the threshold. The judgment I make is whether the counterparty is *above the AANA threshold for VM* (for SA, all five major banks plus most large insurers and asset managers are) — and whether they are likely Phase-6 IM in-scope (BCBS-IOSCO Phase 6 went live September 2022 for AANA above €/$ 8 billion, with a SA-domestic IM regime layered on under Joint Standard 2 of 2020).
- **SA-bespoke clause exposure.** Excon (Currency and Exchanges Manual for Authorised Dealers) transfer restrictions; FinSurv reporting attestations; SA-tax gross-up and tax-event clause overlay; governing-law election (typically English law master with SA bilateral schedule); SA-specific netting opinion gating; FAIS Category I/II adviser-status overlay where relevant; FIC s.21 CDD evidencing.
- **GMRA / GMSLA overlap.** GMRA matters for any counterparty active in SAGB or corporate-bond repo (all five SA banks; PIC; the largest asset managers; some insurers). GMSLA matters where the counterparty runs a securities-lending desk (Allan Gray, Coronation, Stanlib, Old Mutual Investment Group, Sanlam Investments are public SLB lenders; PIC lends through programme administrators).

Where the public signal is genuinely thin, the entry is marked "(public signal thin — Imani direct outreach required)". I refuse to invent ISDA-version data I do not have.

## §3 — Per-counterparty ISDA-readiness deep-dive

The Y-marked entries on Niko's list with Priority A actually number ~29 once I filter strictly. The 17-counterparty cohort below is my judgement-selected highest-conviction first-tier subset, selected to be the bilaterals where the franchise's IRD + FX + bond-repo product set lands hardest and where my template-pack will earn its keep first. The remaining 12 Y+A entries are addressed in §6's tiered sequencing as Tier-3 follow-on. I have flagged this counting interpretation in my report-back to the CEO.

---

### 1. Standard Bank Group (SA banks — peer counterparty)

**ISDA-Master version signal:** 2002 ISDA + SA Bilateral Schedule overlay. Public ISDA adherence registers list Standard Bank as a 2002-Master-using institution and as adherent to the 2018 Benchmarks Supplement, 2020 IBOR Fallbacks Protocol, and the 2021 ZARONIA Fallback Supplement.
**SA Bilateral Schedule overlay signal:** Y. Standard Bank is the de facto SA reference bilateral and authors much of the standard SA-elections language other counterparties react against.
**Last-amendment public signal:** ZARONIA fallback adherence within the 2022–2023 window. Active legal team.
**CSA status (peer SA banks):** Full bilateral VM-CSA in place with all major peers. Standard Bank is also among the SA banks in Phase-6 IM-CSA scope under Joint Standard 2 of 2020.
**VM status:** Y. Above AANA threshold; full ZAR-collateralised VM-CSA standard.
**IM status (Phase 6 BCBS-IOSCO):** In-scope. Public AANA disclosures place Standard Bank Group above the Phase-6 ZAR-equivalent threshold.
**GMRA exposure:** Y. Standard Bank is a primary SAGB repo counterparty.
**GMSLA exposure:** Y, partial — securities lending desk exists; less central than the asset-manager SLB programmes.
**SA-bespoke clauses likely needed:** Excon transfer restrictions; FinSurv attestation overlay (Standard Bank is itself an Authorised Dealer, so the attestation is reciprocal); SA-tax gross-up; governing-law election (English law master / SA Schedule); Banks Act §22 reciprocity acknowledgement; ZARONIA-fallback consistency clause; resolution-stay carve-out aligned with SARB resolution-authority regime.
**Bilateral re-paper risk:** Low. Standard Bank's panel onboarding is process-mature; their template will accept us once Mira's CDD lands and Helena's CCR limit is set.
**Imani's prep work for first contact:** Pre-populate 2002 ISDA Master + SA Bilateral Schedule with Joint Standard 2 of 2020 IM/VM hooks; ZAR VM-CSA shell with R-denominated eligible-collateral schedule (cash ZAR, SAGB across the curve); GMRA 2011 + SA Annex shell ready; ZARONIA fallback supplement adherence-confirmation letter.
**Risk flag (legal-side):** Cross-default thresholds will require careful calibration given Standard Bank's group structure (Standard Bank Group Limited holdco vs The Standard Bank of South Africa Limited operating bank). Specified-Entity election should be considered.

### 2. FirstRand Limited (RMB) (SA banks — peer counterparty)

**ISDA-Master version signal:** 2002 ISDA + SA Bilateral Schedule overlay. Public adherence to 2018 Benchmarks, 2020 IBOR Fallbacks, ZARONIA Fallback Supplement.
**SA Bilateral Schedule overlay signal:** Y. RMB authors a meaningful share of the SA-bespoke clause negotiation precedent in the market.
**Last-amendment public signal:** ZARONIA-relevant amendments through the 2022–2023 transition; FSCA ODP-status confirmed.
**CSA status (peer SA banks):** Full VM-CSA across the peer panel; Phase-6 IM-CSA scope confirmed by AANA disclosures.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** In-scope.
**GMRA exposure:** Y. RMB is the deepest SAGB repo market-maker on the street.
**GMSLA exposure:** Y, partial.
**SA-bespoke clauses likely needed:** Excon transfer restrictions; FinSurv attestation (reciprocal AD-AD); SA-tax gross-up; English law master / SA Schedule; Banks Act §22; ZARONIA fallback consistency; Specified Entity treatment of FirstRand Bank Limited vs FirstRand Limited holdco.
**Bilateral re-paper risk:** Low.
**Imani's prep work for first contact:** Same pack as #1. Plus a GMRA pack — RMB is the counterparty where bond-repo flow will start earliest.
**Risk flag (legal-side):** Group-structure carve-out between FirstRand Limited (holdco), FirstRand Bank Limited (operating), and Rand Merchant Bank (division). Specified-Entity drafting is non-trivial; must avoid inadvertent intra-group cross-default sweep.

### 3. Absa Group Limited (SA banks — peer counterparty)

**ISDA-Master version signal:** 2002 ISDA + SA Bilateral Schedule overlay. Adherent to the major ISDA protocols.
**SA Bilateral Schedule overlay signal:** Y. Absa carries a Barclays-legacy template inheritance which surfaces in some bilateral preferences (e.g. on Multibranch Party elections) more aligned to UK/EMEA style than pure SA convention.
**Last-amendment public signal:** Post-Barclays-separation re-paper of the bilateral panel was a meaningful exercise in 2017–2020; subsequent ZARONIA-fallback alignment within the 2022–2023 window.
**CSA status (peer SA banks):** Full VM-CSA. Phase-6 IM-CSA scope.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** In-scope.
**GMRA exposure:** Y. Strong ZAR repo presence.
**GMSLA exposure:** Y, partial.
**SA-bespoke clauses likely needed:** Excon; FinSurv; SA-tax gross-up; English law / SA Schedule; Multibranch Party drafting (Absa Bank Limited; Absa Group Limited holdco) given the post-Barclays structure; Specified Entity drafting.
**Bilateral re-paper risk:** Low.
**Imani's prep work for first contact:** Same base pack. The Multibranch Party drafting deserves a dedicated bilateral-schedule paragraph — Absa's preference set will not exactly match Standard Bank's.
**Risk flag (legal-side):** Multibranch Party elections must be settled cleanly so that branch-level transfers do not create ambiguity in the close-out netting opinion.

### 4. Nedbank Group Limited (SA banks — peer counterparty)

**ISDA-Master version signal:** 2002 ISDA + SA Bilateral Schedule overlay. Adherent to the standard ISDA protocols.
**SA Bilateral Schedule overlay signal:** Y. Nedbank tends toward conservative SA-template language with a strong corporate-credit overlay reflecting its franchise depth.
**Last-amendment public signal:** ZARONIA-fallback adherence within the 2022–2023 window.
**CSA status (peer SA banks):** Full VM-CSA. Phase-6 IM-CSA scope.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** In-scope.
**GMRA exposure:** Y.
**GMSLA exposure:** Y, partial.
**SA-bespoke clauses likely needed:** Excon; FinSurv; SA-tax gross-up; English law / SA Schedule; Specified Entity; Banks Act §22; resolution-stay drafting consistent with the SARB resolution-authority regime under the Financial Sector Laws Amendment Act 23 of 2021.
**Bilateral re-paper risk:** Low.
**Imani's prep work for first contact:** Standard pack with an eye to corporate-credit-product extension; Nedbank's bilateral conversation will surface earlier than the others on credit-default-swap-related drafting if we extend product surface in that direction (we are not at outset).
**Risk flag (legal-side):** Old Mutual cross-shareholding legacy is no longer live (the unbundling completed in 2018), but cross-default Specified Entity drafting should still be checked carefully against the current group structure.

### 5. Investec Bank Limited (SA banks — peer counterparty)

**ISDA-Master version signal:** 2002 ISDA + SA Bilateral Schedule overlay. The Investec entity-pair (Investec Limited SA / Investec plc UK) and the historical DLC structure mean Investec's bilateral template carries a more complex Multibranch Party / Specified Entity surface than the other four SA majors.
**SA Bilateral Schedule overlay signal:** Y, with explicit cross-jurisdiction (SA / UK) drafting.
**Last-amendment public signal:** Post-Ninety One de-merger (2020) re-paper of asset-management-related bilaterals; ZARONIA and SONIA fallback adherence during the 2022–2023 window.
**CSA status (peer SA banks):** Full VM-CSA; Phase-6 IM-CSA scope on the SA leg.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** In-scope on the SA leg.
**GMRA exposure:** Y. Investec is an active ZAR repo counterparty and a meaningful GBP/EUR repo counterparty on the UK leg.
**GMSLA exposure:** Y.
**SA-bespoke clauses likely needed:** Excon; FinSurv; SA-tax gross-up; cross-jurisdictional governing-law drafting; explicit treatment of Investec Limited (SA) vs Investec plc (UK) under Multibranch Party / Specified Entity; Banks Act §22; FCA-PRA equivalence acknowledgements where the UK leg is referenced.
**Bilateral re-paper risk:** Low–medium. The cross-jurisdictional drafting needs careful single-document handling.
**Imani's prep work for first contact:** Standard pack plus a dedicated SA / UK Multibranch addendum; Specified Entity drafting reviewed against the current corporate structure.
**Risk flag (legal-side):** The DLC governance simplification announced in recent years has not eliminated all complexity in the entity surface. I would want a fresh CIPC + UK Companies House extract before drafting.

### 6. Citibank N.A. — Johannesburg branch (Foreign banks — SA branch)

**ISDA-Master version signal:** 2002 ISDA. Master held at Citibank N.A. (US-domiciled) level with Multibranch Party election covering the Johannesburg branch. Counterparty preference will be to paper at parent-bank level rather than at branch level.
**SA Bilateral Schedule overlay signal:** Y, but layered onto a Citibank-standard offshore-template overlay.
**Last-amendment public signal:** Citibank as a parent is among the most active ISDA-protocol-adherent institutions globally; assume current.
**CSA status (peer SA banks):** Full VM-CSA standard at parent level; Phase-1 IM-CSA scope at parent level. The Johannesburg branch participates under the parent CSA umbrella.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** Citibank N.A. is in Phase-1 (the earliest, largest cohort).
**GMRA exposure:** Y, ZAR repo through the SA branch on a selective basis.
**GMSLA exposure:** Y, partial — sec-lend at parent level, less SA-branch-specific.
**SA-bespoke clauses likely needed:** Excon; FinSurv (asymmetric — we are AD, the SA branch is AD); SA-tax gross-up; governing-law (English law typical, NY law possible at counterparty preference, requires carve-out drafting); Multibranch Party election covering the Johannesburg branch; OFAC-sanctions overlay (Citibank will require strong sanctions-representations clauses given US-parent regulatory exposure); FATCA representations.
**Bilateral re-paper risk:** Medium. Citibank's onboarding for a new SA bilateral counterparty is process-driven and slow but well-understood.
**Imani's prep work for first contact:** 2002 ISDA Master with Multibranch Party election covering Johannesburg branch; SA Bilateral Schedule overlay; ZAR VM-CSA + USD VM-CSA twin-track shells (Citi will likely want USD eligible collateral as primary); FATCA representation pack pre-drafted; OFAC sanctions-representations clause-library ready.
**Risk flag (legal-side):** US-parent OFAC reach and FATCA reporting both shape the bilateral materially. Governing-law negotiation will be a real conversation.

### 7. JPMorgan Chase Bank, N.A. — Johannesburg branch (Foreign banks — SA branch)

**ISDA-Master version signal:** 2002 ISDA. Master held at JPMorgan Chase Bank, N.A. parent level with Multibranch Party covering Johannesburg branch.
**SA Bilateral Schedule overlay signal:** Y, layered onto JPMorgan-standard offshore template.
**Last-amendment public signal:** JPMorgan is among the most active ISDA-protocol adherents globally; assume current.
**CSA status (peer SA banks):** Full VM-CSA at parent; Phase-1 IM-CSA at parent.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** Phase-1 (parent level).
**GMRA exposure:** Y, but selective at SA-branch level.
**GMSLA exposure:** Y, partial.
**SA-bespoke clauses likely needed:** Excon; FinSurv; SA-tax gross-up; governing-law negotiation (English law typical for the SA leg of bilaterals JPMorgan papers); Multibranch Party covering Johannesburg; OFAC-sanctions reps; FATCA reps; resolution-stay clause (JPMorgan adheres to ISDA Resolution Stay Protocol).
**Bilateral re-paper risk:** Medium. JPM's onboarding cycle is well-trodden but not fast.
**Imani's prep work for first contact:** Same pack as Citi #6. JPM's house preferences on collateral schedule and on Specified Entity drafting differ in detail; clause-library should hold both variants.
**Risk flag (legal-side):** US-parent regulatory reach (OFAC, FATCA, Dodd-Frank Title VII where any US-person counterparty exposure exists). Governing-law negotiation is real.

### 8. HSBC Bank plc — Johannesburg branch (Foreign banks — SA branch)

**ISDA-Master version signal:** 2002 ISDA. Master held at HSBC Bank plc (UK-domiciled) level with Multibranch Party covering Johannesburg branch. UK governing-law is the natural choice and aligns with our standard election.
**SA Bilateral Schedule overlay signal:** Y, layered onto HSBC's UK-PRA-regulated template.
**Last-amendment public signal:** HSBC adherent to all major ISDA protocols including Resolution Stay.
**CSA status (peer SA banks):** Full VM-CSA at parent; Phase-1 IM-CSA at parent.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** Phase-1 (parent level).
**GMRA exposure:** Y, partial.
**GMSLA exposure:** Y, partial.
**SA-bespoke clauses likely needed:** Excon; FinSurv; SA-tax gross-up; English law master is the natural baseline; Multibranch Party covering Johannesburg; PRA-resolution-stay drafting; FATCA reps; UK-FATCA / CRS reps; sanctions reps under both UK OFSI and EU regimes.
**Bilateral re-paper risk:** Low–medium. HSBC's UK-domiciled-master discipline is closer to our preferred drafting baseline than Citi's or JPM's NY-bias.
**Imani's prep work for first contact:** 2002 ISDA Master with Multibranch Party covering Johannesburg; SA Bilateral Schedule; ZAR VM-CSA + GBP VM-CSA twin-track; UK OFSI / EU-sanctions reps clause-library ready; CRS / FATCA reps pack.
**Risk flag (legal-side):** UK-PRA resolution-stay drafting requires alignment with the SARB resolution-authority regime under the Financial Sector Laws Amendment Act 23 of 2021; close-out-netting interaction needs careful drafting.

### 9. Public Investment Corporation (PIC) (SA pension funds — public sector)

**ISDA-Master version signal:** 2002 ISDA + SA Bilateral Schedule overlay, signed at PIC level (acting as authorised investment manager for the GEPF, UIF, and several other public-sector funds).
**SA Bilateral Schedule overlay signal:** Y, with explicit drafting of PIC's mandate-as-manager structure (PIC contracts in its own name as duly authorised manager for the relevant fund).
**Last-amendment public signal:** Public IRD usage disclosures in PIC annual reports indicate current ISDA infrastructure; specific protocol-adherence date is unknown from public sources alone.
**CSA status (peer SA banks):** Full bilateral VM-CSA. PIC is a major IRD counterparty for the SA Big Four.
**VM status:** Y. AANA almost certainly above threshold given PIC AUM ~R2.6 trillion.
**IM status (Phase 6 BCBS-IOSCO):** Likely in-scope under the SA Joint Standard 2 of 2020 IM phasing; uncertain on the BCBS-IOSCO side given PIC's status as an SA-domiciled public-sector fund manager rather than a bank.
**GMRA exposure:** Y. PIC is a structural SAGB holder with a real repo footprint.
**GMSLA exposure:** Y. PIC participates in securities lending through programme administrators.
**SA-bespoke clauses likely needed:** Excon (PIC manages on behalf of SA-domiciled funds; cross-border drafting has tax-treaty implications); FinSurv attestation; SA-tax gross-up (with carve-outs for the tax-exempt status of GEPF and UIF — material drafting point); English law master / SA Schedule; mandate-as-manager drafting; Public Investment Corporation Act 23 of 2004 acknowledgements; Specified Entity drafting addressing the multiple underlying funds.
**Bilateral re-paper risk:** Medium. PIC's onboarding is process-driven and the tax-exempt drafting takes time to settle.
**Imani's prep work for first contact:** 2002 ISDA + SA Bilateral Schedule; ZAR VM-CSA shell with eligible-collateral schedule biased to SAGB (PIC's natural collateral inventory); explicit tax-exempt-counterparty drafting variant for GEPF / UIF underlying funds; mandate-as-manager schedule paragraph; GMRA 2011 + SA Annex; GMSLA 2010 + SA Annex.
**Risk flag (legal-side):** Mandate-as-manager structure plus tax-exempt status of underlying funds is the single most important drafting nuance. Get this wrong and the netting opinion suffers.

### 10. Allan Gray Proprietary Limited (SA asset managers)

**ISDA-Master version signal:** 2002 ISDA + SA Bilateral Schedule overlay. Allan Gray's IRD usage is concentrated in segregated-mandate hedging and in selective overlay strategies; bilateral footprint is modest by counterparty count but real.
**SA Bilateral Schedule overlay signal:** Y, with mandate-as-manager drafting (Allan Gray contracts as duly authorised manager for the underlying fund / segregated mandate).
**Last-amendment public signal:** Allan Gray has historically been ISDA-protocol-adherent on the major supplements; specific recent dates unknown.
**CSA status (peer SA banks):** Full bilateral VM-CSA standard for the IRD overlay business.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** Likely below threshold for IM at the manager level; in-scope at the underlying-fund AANA only if specific funds breach.
**GMRA exposure:** Y, partial. Selective ZAR repo for cash-management overlay.
**GMSLA exposure:** Y. Allan Gray is a public SLB lender on its underlying SA equity book.
**SA-bespoke clauses likely needed:** Excon; FinSurv; SA-tax gross-up with mandate-level tax-status carve-outs; English law / SA Schedule; FAIS Cat I/II adviser-status drafting; mandate-as-manager schedule paragraph; Specified Entity drafting at fund level rather than manager level (a meaningful nuance — close-out is at fund level, not manager level).
**Bilateral re-paper risk:** Low–medium.
**Imani's prep work for first contact:** Standard pack with a specific mandate-as-manager schedule shell. The fund-level Specified Entity drafting is non-trivial; clause-library entry should make this an explicit option.
**Risk flag (legal-side):** Close-out-netting opinion at the underlying-fund level, not the manager level — this is the cleanest mandate-as-manager surface but it pays to draft it explicitly.

### 11. Coronation Fund Managers Limited (SA asset managers)

**ISDA-Master version signal:** 2002 ISDA + SA Bilateral Schedule overlay; mandate-as-manager structure for segregated mandates.
**SA Bilateral Schedule overlay signal:** Y.
**Last-amendment public signal:** Public IRD-usage disclosures in Coronation's annual reports support an active ISDA infrastructure.
**CSA status (peer SA banks):** Full bilateral VM-CSA.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** Likely below manager-level threshold; fund-level only on breach.
**GMRA exposure:** Y, partial.
**GMSLA exposure:** Y. Public SLB lender.
**SA-bespoke clauses likely needed:** Excon; FinSurv; SA-tax gross-up with mandate-level carve-outs; English law / SA Schedule; FAIS Cat II adviser-status drafting; mandate-as-manager schedule; fund-level Specified Entity drafting.
**Bilateral re-paper risk:** Low–medium.
**Imani's prep work for first contact:** Same as Allan Gray. Coronation has a public global-equity and global-bond mandate book in addition to the SA mandates; the bilateral Schedule needs an offshore-fund variant.
**Risk flag (legal-side):** Coronation's offshore mandates (Ireland-domiciled UCITS, etc.) layer EU regulatory exposure into the bilateral conversation; ESMA EMIR Article 9 reporting touches and may require a delegated-reporting paragraph.

### 12. Ninety One (SA book) (SA asset managers)

**ISDA-Master version signal:** 2002 ISDA + SA Bilateral Schedule overlay. The post-Investec-de-merger entity structure (Ninety One Limited / Ninety One plc DLC) means bilateral counterparty drafting must be explicit about which leg is contracting.
**SA Bilateral Schedule overlay signal:** Y, with cross-jurisdictional (SA / UK) elements where the UK leg is involved.
**Last-amendment public signal:** Post-2020 de-merger re-paper of the bilateral panel; subsequent ZARONIA / SONIA fallback adherence.
**CSA status (peer SA banks):** Full bilateral VM-CSA.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** Likely below threshold at manager level.
**GMRA exposure:** Y, partial.
**GMSLA exposure:** Y.
**SA-bespoke clauses likely needed:** Excon; FinSurv; SA-tax gross-up; English law / SA Schedule; explicit DLC-leg drafting (which legal entity is the bilateral counterparty); FAIS Cat II drafting; mandate-as-manager schedule with both SA and UK fund variants; FCA-PRA equivalence acknowledgements where UK leg is referenced.
**Bilateral re-paper risk:** Low–medium. The DLC structure adds drafting time but the legal team is mature and the bilateral path is well-trodden.
**Imani's prep work for first contact:** Standard pack plus a Ninety One-specific DLC schedule paragraph; both ZAR and GBP VM-CSA shells.
**Risk flag (legal-side):** DLC-leg drafting matters; the bilateral must specify which Ninety One entity is the counterparty for each transaction.

### 13. Sanlam Investments (SA asset managers)

**ISDA-Master version signal:** 2002 ISDA + SA Bilateral Schedule overlay; mandate-as-manager structure.
**SA Bilateral Schedule overlay signal:** Y. Sanlam Investments draws on the broader Sanlam group legal infrastructure; bilateral panel maturity is high.
**Last-amendment public signal:** ZARONIA-fallback alignment within the standard 2022–2023 window expected; specific date unknown.
**CSA status (peer SA banks):** Full bilateral VM-CSA.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** Likely below threshold at manager level; potentially in-scope on the largest underlying mandates.
**GMRA exposure:** Y, partial.
**GMSLA exposure:** Y.
**SA-bespoke clauses likely needed:** Excon; FinSurv; SA-tax gross-up with mandate-level carve-outs; English law / SA Schedule; FAIS Cat II drafting; mandate-as-manager schedule; explicit treatment of where the bilateral sits in the Sanlam group structure (Sanlam Investments vs Sanlam Investment Management vs Sanlam Limited).
**Bilateral re-paper risk:** Low–medium.
**Imani's prep work for first contact:** Standard pack with a Sanlam-group entity-clarification schedule paragraph.
**Risk flag (legal-side):** Group structure: Sanlam Investments sits inside Sanlam Limited; the bilateral counterparty entity must be explicitly named to avoid Specified Entity drift across the group.

### 14. Old Mutual Investment Group (SA asset managers)

**ISDA-Master version signal:** 2002 ISDA + SA Bilateral Schedule overlay; mandate-as-manager structure. Post-Old Mutual / Quilter de-merger (2018) the SA-side bilateral panel was re-papered.
**SA Bilateral Schedule overlay signal:** Y.
**Last-amendment public signal:** Post-2018 de-merger re-paper; subsequent ZARONIA-fallback alignment.
**CSA status (peer SA banks):** Full bilateral VM-CSA.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** Likely below threshold at manager level.
**GMRA exposure:** Y, partial.
**GMSLA exposure:** Y.
**SA-bespoke clauses likely needed:** Excon; FinSurv; SA-tax gross-up with mandate-level carve-outs; English law / SA Schedule; FAIS Cat II drafting; mandate-as-manager; explicit drafting of the post-de-merger SA-side counterparty entity (Old Mutual Investment Group (Pty) Ltd vs Old Mutual Limited holdco).
**Bilateral re-paper risk:** Low–medium.
**Imani's prep work for first contact:** Standard pack. The post-de-merger entity drafting is mature in the SA market by now but should still be checked against current CIPC extracts.
**Risk flag (legal-side):** Post-de-merger entity surface; CIPC extract refresh before drafting.

### 15. Eskom Holdings SOC Limited (SA SOE treasuries)

**ISDA-Master version signal:** 2002 ISDA + SA Bilateral Schedule overlay. Eskom's bilateral panel with the SA Big Four is well-established for cross-currency hedging and IRS overlay against rand- and FX-denominated debt.
**SA Bilateral Schedule overlay signal:** Y, with SOE-specific drafting (SOC status, government-guarantee carve-outs, PFMA s.66 borrowing acknowledgements).
**Last-amendment public signal:** Eskom's hedging programme is publicly disclosed in annual reports; bilateral re-paper around the 2022–2023 ZARONIA / IBOR transition expected.
**CSA status (peer SA banks):** Variable. Public disclosures suggest threshold-CSA arrangements rather than full bilateral VM-CSA, reflecting Eskom's sovereign-supported credit profile and historical bargaining position. Joint Standard 2 of 2020 has materially tightened this, and current arrangements are likely closer to peer norm than they once were.
**VM status:** Y, but historically with material thresholds.
**IM status (Phase 6 BCBS-IOSCO):** Likely below the IM threshold at counterparty level (Eskom is an end-user under most analyses); SA Joint Standard 2 of 2020 end-user-exemption analysis applies.
**GMRA exposure:** N. Eskom is a debt issuer, not a bond-portfolio investor; repo is not a natural product.
**GMSLA exposure:** N.
**SA-bespoke clauses likely needed:** Excon (cross-currency hedging makes Excon material); FinSurv attestation; SA-tax gross-up; English law / SA Schedule; PFMA s.66 borrowing acknowledgement; SOC-status drafting; National Treasury guarantee carve-out drafting (where applicable); explicit drafting of any government-support reps; sovereign-immunity waiver clause (Eskom is not entitled to sovereign immunity but the drafting is conventional).
**Bilateral re-paper risk:** Medium–high. Eskom's bilateral conversations carry political-risk and government-support drafting that does not exist in private-sector counterparty bilaterals.
**Imani's prep work for first contact:** 2002 ISDA + SA Bilateral Schedule with full SOE drafting overlay; ZAR + USD VM-CSA twin-track shell with realistic threshold drafting; PFMA s.66 acknowledgement clause-library entry; sovereign-immunity waiver clause-library entry.
**Risk flag (legal-side):** Government-guarantee drafting is the highest-stakes negotiation point. Cross-default to other Eskom debt instruments must be calibrated carefully.

### 16. Transnet SOC Limited (SA SOE treasuries)

**ISDA-Master version signal:** 2002 ISDA + SA Bilateral Schedule overlay; same SOE-specific drafting overlay as Eskom.
**SA Bilateral Schedule overlay signal:** Y.
**Last-amendment public signal:** Bilateral re-paper around the 2022–2023 ZARONIA / IBOR transition expected.
**CSA status (peer SA banks):** Variable; threshold-CSA arrangements probable.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** Likely below threshold at counterparty level; end-user-exemption analysis applies.
**GMRA exposure:** N.
**GMSLA exposure:** N.
**SA-bespoke clauses likely needed:** Excon; FinSurv; SA-tax gross-up; English law / SA Schedule; PFMA s.66 acknowledgement; SOC-status drafting; sovereign-immunity waiver; cross-default drafting calibrated to Transnet's bond programme.
**Bilateral re-paper risk:** Medium–high.
**Imani's prep work for first contact:** Same SOE pack as Eskom. The two SOE bilaterals share most clause-library content; the differences are in the specifics of each entity's debt programme cross-default reference.
**Risk flag (legal-side):** Transnet has had material credit-event drafting attention historically; cross-default thresholds and Specified Transaction drafting deserve a careful re-read.

### 17. Anglo American (SA opcos) (SA listed corporates)

**ISDA-Master version signal:** 2002 ISDA. Master likely held at Anglo American plc (UK-domiciled holdco) level with Multibranch / Specified Entity coverage of the SA opcos. SA-bilateral counterparties (the Big Four) typically paper with the UK entity directly for FX hedging on the dollar revenue stream and with the SA opcos for ZAR-leg hedging.
**SA Bilateral Schedule overlay signal:** Y, with cross-jurisdictional (UK / SA) drafting.
**Last-amendment public signal:** Anglo American maintains an active ISDA infrastructure; specific dates unknown.
**CSA status (peer SA banks):** Full bilateral VM-CSA at parent level expected; threshold-CSA possible at SA-opco level.
**VM status:** Y.
**IM status (Phase 6 BCBS-IOSCO):** Likely below threshold at counterparty level; end-user analysis applies.
**GMRA exposure:** N.
**GMSLA exposure:** N.
**SA-bespoke clauses likely needed:** Excon (cross-currency hedging is material); FinSurv attestation; SA-tax gross-up; English law master / SA Schedule (or English law master / English-law CSA where the parent is the bilateral counterparty); explicit treatment of UK-parent vs SA-opco counterparty (which entity is contracting); FATCA / CRS reps; SA-Mining-Charter / DMRE acknowledgements where any clause touches mineral rights.
**Bilateral re-paper risk:** Medium.
**Imani's prep work for first contact:** 2002 ISDA Master at parent level with SA-opco Specified Entity drafting; both English-law-CSA and ZAR-CSA shells; explicit cross-currency hedging confirmation-template (Anglo's hedge programme is publicly disclosed); FATCA / CRS reps pack.
**Risk flag (legal-side):** Counterparty-entity specification matters: a hedge that should be at the SA-opco level being booked at the UK parent (or vice versa) creates IFRS 9 hedge-accounting trouble for Bea and Camille on the counterparty side, with potential consequence for our own documentation defence.

---

## §4 — Common SA-bespoke clauses required across the panel

The clauses below are the SA-bespoke clause-library entries that emerge from §3. Each is a clause where the standard ISDA Master Agreement language is insufficient on its own and must be supplemented by a SA-specific drafting overlay. I list 12 entries, in priority of build-order for the clause-library.

**Clause 1 — Excon transfer-restriction acknowledgement.**
*What it does.* Acknowledges that the counterparty's payment and delivery obligations under the Master are subject to the South African Currency and Exchanges Regulations and the Currency and Exchanges Manual for Authorised Dealers ("Excon"), as administered by SARB Financial Surveillance Department, and that the counterparties will obtain and maintain such Excon approvals as their respective transactions require.
*Why SA-bespoke.* The standard ISDA Master assumes free convertibility absent specifically negotiated overlay. SA's Excon regime (Currency and Exchanges Act 9 of 1933 + the Manual) imposes ongoing approval and reporting obligations that the Master must explicitly accommodate; a Failure-to-Pay event due to Excon-blocking should not automatically trigger Event of Default — the clause must carve out an Excon-blocking Force Majeure / Illegality variant.
*Citation.* Currency and Exchanges Act 9 of 1933; Currency and Exchanges Regulations promulgated under the Act; Currency and Exchanges Manual for Authorised Dealers (rolling-update SARB FinSurv publication).
*Pushback areas.* Counterparties from outside SA (Citi, JPM, HSBC parent levels) will want a tighter Excon-Force-Majeure trigger to limit their exposure to a SA-specific suspension of payments.

**Clause 2 — FinSurv reporting attestation overlay.**
*What it does.* Confirms each party's status as Authorised Dealer (or otherwise) and allocates responsibility for FinSurv reporting under the Manual on each cross-border transaction booked under the Master.
*Why SA-bespoke.* No equivalent mechanism in the off-the-shelf ISDA Master. Required to give us defensible audit-trail position on the SARB FinSurv reporting chain.
*Citation.* Currency and Exchanges Manual for Authorised Dealers, Section A and Section B; SARB FinSurv reporting requirements.
*Pushback areas.* Symmetric AD-AD bilaterals (with the SA Big Four) are straightforward; AD-non-AD bilaterals (with non-financial corporates) require asymmetric drafting that some counterparties resist.

**Clause 3 — SA tax gross-up and tax-event clause overlay.**
*What it does.* Adapts the standard ISDA Section 2(d) tax provisions to the SA tax framework — withholding tax on interest under the Income Tax Act 58 of 1962 s.50A–H (as applicable to non-resident counterparties); STT (Securities Transfer Tax Act 25 of 2007) on equity-leg transactions; tax-event termination triggers calibrated to SA Tax Court / SCA outcomes; FATCA and CRS reps under the Tax Administration Act 28 of 2011 ss.26 and 28.
*Why SA-bespoke.* The standard ISDA Section 2(d) is jurisdiction-agnostic and assumes counterparties will negotiate the specifics. SA's tax regime requires explicit drafting to produce predictable economic outcomes.
*Citation.* Income Tax Act 58 of 1962 ss.50A–H; Securities Transfer Tax Act 25 of 2007; Tax Administration Act 28 of 2011 ss.26 and 28; relevant double-tax treaties.
*Pushback areas.* Tax-gross-up scope; tax-event termination thresholds; CRS / FATCA reps language.

**Clause 4 — Tax-exempt-counterparty drafting variant.**
*What it does.* Specifically addresses the bilateral where the counterparty (or the underlying fund where mandate-as-manager structures apply) is tax-exempt under the Income Tax Act — typically GEPF, UIF, certain pension funds in the s.10(1)(d) bucket. Carves out the gross-up obligation accordingly and reflects this in the close-out calculation.
*Why SA-bespoke.* Off-the-shelf ISDA assumes a uniform tax-payer counterparty. PIC (#9) and several pension-fund counterparties materially deviate from this assumption.
*Citation.* Income Tax Act 58 of 1962 s.10(1)(d) and s.10(1)(cN); Public Investment Corporation Act 23 of 2004; Pension Funds Act 24 of 1956.
*Pushback areas.* Drafting symmetry — counterparty will want exempt-status not to be unilateral.

**Clause 5 — Banks Act §22 reciprocity acknowledgement (bank-to-bank bilaterals).**
*What it does.* Acknowledges each party's status as a bank registered under the Banks Act 94 of 1990, the SARB resolution-authority regime under the Financial Sector Laws Amendment Act 23 of 2021, and the consequent application of the SA-domestic resolution-stay regime to the Master.
*Why SA-bespoke.* The ISDA 2015 Universal Resolution Stay Protocol covers offshore parents but does not pre-resolve the SA-domestic resolution-authority regime. A bilateral between two SA-licensed banks needs explicit drafting.
*Citation.* Banks Act 94 of 1990 ss.22 and 23; Financial Sector Laws Amendment Act 23 of 2021; SARB Prudential Authority resolution-authority regulations.
*Pushback areas.* Limited — both SA banks usually agree the drafting; the sticking point is the interaction with offshore-parent resolution regimes.

**Clause 6 — Mandate-as-manager schedule (asset-manager bilaterals).**
*What it does.* Drafts the bilateral as between the bank counterparty and the asset manager *acting in its capacity as duly authorised manager for the underlying fund (or segregated mandate)*, with the underlying fund as the contracting principal for purposes of close-out netting and Specified Entity treatment.
*Why SA-bespoke.* Asset-manager bilaterals in SA (Allan Gray, Coronation, Ninety One, Stanlib, OMIG, Sanlam Investments) are universally manager-as-agent in form but the specifics of close-out at fund level vs manager level vary, and clean drafting is needed to produce a defensible close-out-netting opinion.
*Citation.* Collective Investment Schemes Control Act 45 of 2002 (where applicable); Pension Funds Act 24 of 1956 (where applicable); FAIS Act 37 of 2002; FSCA Conduct Standards under the FMA.
*Pushback areas.* Specified Entity drafting at fund level vs manager level; close-out calculation methodology where the fund is the principal.

**Clause 7 — FAIS Cat I/II adviser-status acknowledgement.**
*What it does.* Acknowledges the counterparty's FSP licence status and category (typically Cat I or Cat II for asset managers; Cat IIA for hedge-fund managers) and the consequent FAIS General Code of Conduct obligations on either side.
*Why SA-bespoke.* No FAIS-equivalent in the off-the-shelf ISDA. Required to set the boundary of investment-advice vs principal-bilateral activity, particularly for our institutional-only FSP licence position.
*Citation.* FAIS Act 37 of 2002; FAIS General Code of Conduct; FSCA Conduct Standard 1 of 2020 (Conduct Standard for Authorised Users); relevant ODP Conduct Standards.
*Pushback areas.* Where a counterparty's FAIS status straddles categories; or where a sub-mandate is run under a different FSP licence than the parent.

**Clause 8 — ZARONIA fallback consistency clause.**
*What it does.* Confirms each party's adherence to the ISDA 2020 IBOR Fallbacks Protocol and the 2021 ZARONIA Fallback Supplement (or the applicable bilateral fallback provisions), and aligns any Master-level fallback drafting with the SA-rates transition off JIBAR onto ZARONIA.
*Why SA-bespoke.* SA's rates-transition timeline and the specific cessation arrangements for JIBAR are SA-specific; the ZARONIA Fallback Supplement is the SA market standard.
*Citation.* SARB Market Practitioners' Group ZARONIA transition publications; ISDA 2020 IBOR Fallbacks Protocol; 2021 ZARONIA Fallback Supplement.
*Pushback areas.* Where a counterparty has not formally adhered to one of the relevant supplements; bilateral fallback drafting then required.

**Clause 9 — SOE / sovereign-immunity waiver and PFMA acknowledgement.**
*What it does.* For SOE counterparties (Eskom, Transnet, and the Tier-3 SOEs in §6), acknowledges PFMA s.66 borrowing-authority and waives any sovereign-immunity defence to enforcement of the Master.
*Why SA-bespoke.* SA SOEs are not entitled to sovereign immunity but the drafting is conventional in cross-border bilaterals; PFMA s.66 confirmation is uniquely SA.
*Citation.* Public Finance Management Act 1 of 1999 s.66; Foreign States Immunities Act 87 of 1981.
*Pushback areas.* Government-guarantee carve-outs where the SOE's instruments have government-guarantee support.

**Clause 10 — JSE / Strate transactional-overlay clause (equity- and bond-leg bilaterals).**
*What it does.* Where the bilateral references JSE-listed instruments or Strate-settled instruments, confirms each party's status as a JSE Authorised User (or its agency arrangement), and acknowledges Strate settlement conventions, JSE Equities Rules, and the FMA's central-securities-depository provisions.
*Why SA-bespoke.* The off-the-shelf ISDA assumes counterparties have already settled their market-infrastructure relationships separately. Explicit drafting on Strate / JSE convention prevents downstream operational confusion in close-out.
*Citation.* Financial Markets Act 19 of 2012; JSE Equities Rules; Strate Rules and Directives; FSCA Conduct Standards under the FMA.
*Pushback areas.* Where a counterparty is not a JSE Authorised User and contracts through an agent.

**Clause 11 — POPIA processing and cross-border-transfer acknowledgement.**
*What it does.* Acknowledges each party's status as a responsible party under POPIA s.1 for the personal information processed in connection with the Master (e.g. signatory details, authorised representatives, sometimes ultimate-beneficial-owner data), confirms lawful basis under s.11, and sets the cross-border-transfer drafting under s.72 where applicable.
*Why SA-bespoke.* POPIA is a SA-statutory regime with no automatic ISDA-Master overlap; required to give Iris (Information Officer) a defensible position on processing.
*Citation.* Protection of Personal Information Act 4 of 2013 ss.1, 11, 19–22, and 72.
*Pushback areas.* Cross-border-transfer drafting where a counterparty's parent is in a non-adequate jurisdiction.

**Clause 12 — FIC s.21 CDD evidencing clause.**
*What it does.* Confirms each party's status as an accountable institution under the FIC Act and the consequent CDD obligations, sets the documentation-exchange protocol for CDD evidence, and aligns with Mira's RMCP.
*Why SA-bespoke.* FIC is the SA AML/CFT statute; requires explicit drafting to produce a defensible audit-trail for the bilateral as a CDD-relationship.
*Citation.* Financial Intelligence Centre Act 38 of 2001 ss.20A–22; FSCA Conduct Standard 1 of 2020 where applicable.
*Pushback areas.* Where the counterparty's CDD documentation set differs materially from our RMCP requirements.

The clause-library will hold each of these as a versioned entry with CDM-tagged fields where applicable and with the citation chain Principle-2-conformant.

## §5 — Bilateral-template inventory

The set of templates I (Imani) need ready before the first counterparty conversation lands. State labels: **drafted** (template exists in build-phase library, ready for review); **in-progress** (work begun, not finished); **planned** (scoped, not started); **TBD** (further architectural work needed before a template is drafted).

| # | Template | Purpose | Current state |
|---:|---|---|---|
| 1 | 2002 ISDA Master + SA Bilateral Schedule (SA-bank counterparty variant) | Standard SA-bank-to-SA-bank bilateral (Standard, FirstRand, Absa, Nedbank, Investec) | **planned** |
| 2 | 2002 ISDA Master + SA Bilateral Schedule (asset-manager variant, mandate-as-manager) | Asset-manager bilaterals (Allan Gray, Coronation, Ninety One, Stanlib, OMIG, Sanlam Investments) | **planned** |
| 3 | 2002 ISDA Master + SA Bilateral Schedule (life insurer variant) | Life-insurer bilaterals (Sanlam, Old Mutual, Discovery, Liberty, Momentum) | **planned** |
| 4 | 2002 ISDA Master + SA Bilateral Schedule (SOE variant) | SOE-counterparty bilaterals (Eskom, Transnet; later Tier-3 SOEs) | **planned** |
| 5 | 2002 ISDA Master + offshore overlay (foreign-bank-branch variant) | Citi, JPM, HSBC Joburg branch bilaterals papered at parent level with Multibranch Party | **planned** |
| 6 | 2002 ISDA Master + cross-jurisdictional overlay (UK-listed corporate variant) | Anglo American and similar UK / SA dual-listed corporate bilaterals | **planned** |
| 7 | VM-CSA Annex (Joint Standard 2 of 2020 compliant, ZAR-collateralised default) | Variation-margin collateral overlay for all in-scope bilaterals | **planned** |
| 8 | VM-CSA Annex (USD-collateralised variant) | For foreign-bank-branch bilaterals where USD eligible-collateral is preferred | **planned** |
| 9 | IM-CSA Annex (BCBS-IOSCO Phase-6 / Joint Standard 2 of 2020 compliant) | Initial-margin overlay for in-scope bilaterals | **planned** |
| 10 | GMRA 2011 + SA Annex | Repo bilaterals with SA Big Four, PIC, asset managers active in repo | **planned** |
| 11 | GMSLA 2010 + SA Annex | Sec-lend bilaterals with asset-manager SLB programmes | **planned** |
| 12 | Confirmation template — FX Spot | Per-trade confirmations | **planned** |
| 13 | Confirmation template — FX Forward | Per-trade confirmations | **planned** |
| 14 | Confirmation template — FX Swap | Per-trade confirmations | **planned** |
| 15 | Confirmation template — IRS (ZARONIA-linked) | Per-trade confirmations | **planned** |
| 16 | Confirmation template — FRA | Per-trade confirmations | **planned** |
| 17 | Confirmation template — OIS (ZARONIA-linked) | Per-trade confirmations | **planned** |
| 18 | Confirmation template — Basis Swap | Per-trade confirmations | **planned** |
| 19 | Counterparty CDD / KYC light-touch pack — legal-entity verification + signing-authority chain | Mira-substrate handles heavy lifting; Imani pack is the legal-side overlay | **planned** |

Honest substrate-state. Nothing is yet drafted in the build-phase library — these are all "planned". The clause-library DSL itself is design-only (per Imani.md §16). The natural next deliverable is to author Templates 1, 7, and 12–18 first, in sequence, against the clause-library v0 entries from §4.

## §6 — Engagement sequencing for Saskia's first-tier

The ordering of my (Imani's) preparation per Saskia's contact sequence. The principle is full-pack-before-call for the highest-conviction subset, light-pack-before-call for the next layer, and pre-research-only for the rest.

**Tier 1 — Imani full-pack ready before first Saskia conversation.**
Five highest-conviction bilaterals where my pack should be sitting on Saskia's desk before she dials.

1. **Standard Bank Group** — 2002 ISDA + SA Bilateral Schedule (SA-bank variant) + ZAR VM-CSA + GMRA 2011 + SA Annex.
2. **FirstRand / RMB** — same pack as Standard Bank, with explicit FirstRand Bank Limited / FirstRand Limited Specified-Entity drafting.
3. **PIC** — 2002 ISDA + SA Bilateral Schedule (asset-manager variant) with mandate-as-manager schedule and tax-exempt-counterparty drafting variant for GEPF / UIF underlying funds + ZAR VM-CSA + GMRA + GMSLA.
4. **Allan Gray** — 2002 ISDA + SA Bilateral Schedule (asset-manager variant) with mandate-as-manager schedule + ZAR VM-CSA + GMSLA.
5. **HSBC Joburg branch** — 2002 ISDA + SA Bilateral Schedule (foreign-bank-branch variant) with Multibranch Party covering Johannesburg + ZAR + GBP VM-CSA twin-track.

The choice of Tier 1 reflects the variety of bilateral *archetypes* I need to instantiate, not raw counterparty importance — getting one of each archetype drafted means the next bilateral in the same archetype is 80% prepared.

**Tier 2 — Imani light-pack (template index + clause-library status) before first Saskia conversation.**
Six next-highest-conviction bilaterals where my pack is ready in skeleton form but full negotiation of clause-library entries is parked until Tier 1 lands.

6. **Absa Group**
7. **Nedbank Group**
8. **Investec Bank Limited**
9. **Citi Joburg branch**
10. **JPMorgan Joburg branch**
11. **Coronation Fund Managers**

**Tier 3 — Imani pre-research-only; full pack on demand.**
Six remaining Y-marked Priority-A bilaterals where the work waits until Saskia's contact pipeline asks for it.

12. **Ninety One (SA book)**
13. **Stanlib** (added on review of Niko's list — Y+A, manager-archetype mature)
14. **Old Mutual Investment Group**
15. **Sanlam Investments**
16. **Eskom**
17. **Transnet**

The remaining Y+A counterparties from Niko's full list (the life insurers, the additional SA corporates, GEPF-direct, Growthpoint, the major SA listed corporates rows 22–28, and PIC's GEPF leg where directly mandated) sit in Tier 3-extended and absorb into the next iteration of this deliverable.

## §7 — What feeds back to whom

- **To Saskia.** The per-counterparty bilateral-readiness signal in §3 feeds her first-conversation framing — she walks in knowing the version, the likely re-paper risk, the SA-bespoke clauses that will surface, and the CSA posture. The Tier-1 pack discipline in §6 keeps her from being ahead of my legal infrastructure.
- **To Niko.** Refinements to his Priority class: I would not downgrade any of the 17 in §3 from Y+A. I would suggest he add a "depth of bilateral history" sub-flag to the next iteration of his list — Standard Bank and FirstRand have materially deeper bilateral panels than Investec or Discovery, and that nuance matters for his outreach prioritisation even within the Y+A subset.
- **To Helena.** Each counterparty in §3 becomes a counterparty-credit-risk pre-registration entry. Once we go live, each will be SA-CCR-relevant under CRR3-equivalent treatment; the Specified Entity drafting from §3 directly shapes how exposures are aggregated for limit-monitoring.
- **To Mira.** Each bilateral negotiation triggers FIC s.21 CDD entry. My §3 entries feed her watchlist seeding; the SOE entries (Eskom, Transnet) carry PEP-by-association nuances that her RMCP will want to surface; the foreign-bank-branch entries (Citi, JPM, HSBC) carry OFAC / UK OFSI sanctions-screening dependencies.
- **To Atlas.** Each bilateral master-counterparty becomes a legal-entity-tree entry under my curation; each gets an LEI registered into the substrate (LEIs are publicly available from GLEIF for all 17 §3 counterparties); the entity tree's Specified Entity / Multibranch / mandate-as-manager nuances per §3 directly shape the substrate schema.
- **To Owen.** Conflict / related-party flag check on the bilaterals where any of our governance seats has a prior relationship with the counterparty (none surface in public sources but the bilateral-onboarding moment is the right one to re-check); the PIC / GEPF mandate-as-manager structure may also touch the related-party register depending on cross-shareholding paths.
- **To Iris.** POPIA s.18 / s.19 lawful-processing register entry per bilateral counterparty; cross-border transfer governance under s.72 for the foreign-bank-branch and UK-listed-corporate bilaterals.
- **To Bea / Camille.** IFRS 9 hedge-accounting designation requests are likely from the life insurers and the larger corporates (Anglo American, Sasol on the corporates side; Sanlam, Old Mutual, Discovery, Liberty, Momentum on the insurer side); the bilateral confirmation-template work must support hedge-accounting designation cleanly from day one.

## §8 — Build-phase legal posture

Explicit guardrails to prevent this deliverable being mistaken for something it is not.

- **All ISDA work is template-side.** No live bilaterals exist. Every reference to "bilateral conversation" or "first contact" is a forward-looking soft-franchise step, not a current activity.
- **Clause-library work is publication-pending.** Marc's CEO-approval gate on customer-facing legal templates is not yet live because there are no customers. The clause-library §4 entries will surface for governance review (Owen's track) and for Marc's CEO-approval at the first-bilateral threshold; nothing is signed off as final library content here.
- **All counterparty research is from public sources.** No insider information, no privileged communications, no live counterparty contact. Where public signal is genuinely thin, the entry is marked "(public signal thin)" rather than papered over.
- **The clause-library ships as Imani's deliverable.** Devon is the interim governance home (until General Counsel is hired); Devon reviews; CEO approves at first-bilateral threshold; external-counsel S5 panel selection is a separate CEO-approval gate per `Team/Imani.md` §10.
- **Not legal advice.** This is engineering research feeding template substrate. Formal legal opinion on any counterparty bilateral attaches only at the moment we engage external counsel and counsel signs the opinion under their professional responsibility.

—Imani (legal-as-code engineer; build-phase ISDA-readiness research, 2026-05-07)
