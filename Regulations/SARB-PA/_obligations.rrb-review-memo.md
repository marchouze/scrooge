# RRB obligation review memo — independent reviewer

**Instrument:** Regulations Relating to Banks (RRB) — GN R.1029 of 2012, GG 35950, as amended, under the Banks Act 94 of 1990.
**Source of truth:** `Regulations/SARB-PA/source-docs/rrb-structured.json`.
**Proposal under review:** `Regulations/SARB-PA/_obligations.rrb-proposed.json` (46 rows ORG-RRB-001..046, authored by Mira, `proposed-llm-unreviewed`).
**Reviewer:** independent-reviewer | **Date:** 2026-06-19 | **Role:** independent validation (reviewer leg of the reviewer→decider sync discipline; author was Mira; decider/adoption is a separate downstream step — this review stops at the reviewed artefacts).
**Reviewed output:** `Regulations/SARB-PA/_obligations.rrb-reviewed.json` (accepted + modified rows, renumbered ORG-PR-67..112, `_provenance` stripped).

## 1. Counts

| Verdict | Count |
|---|---:|
| ACCEPT (no field change) | 0 |
| MODIFY | 46 |
| REJECT | 0 |
| **Total carried to reviewed set** | **46** |

**New id range used:** `ORG-PR-67` … `ORG-PR-112` (sequential, following the highest existing simple `ORG-PR-66` in the seed).

**Why every row is MODIFY, not ACCEPT.** The proposal's `activityScope` and `riskTaxonomy` values are drawn from a different taxonomy than the canonical seed (`_obligations.seed.json`). The seed uses `ACT-RISK-CREDIT / ACT-RISK-MARKET / ACT-RISK-LIQUIDITY / ACT-RISK-CAPITAL / ACT-RISK-OPERATIONAL / ACT-GOVERN-BOARD / ACT-GOVERN-COMPLIANCE / ACT-GOVERN-AUDIT / ACT-REPORT-PRUDENTIAL`, and risk codes `RT-CR / RT-CR.CC / RT-MK / RT-MK.FX / RT-LQ.FN / RT-LQ.IN / RT-IRRBB / RT-OP / RT-ST.GV / RT-ST.EX` (all carrying the `riskTaxonomy: ` prefix). The proposal instead used non-seed slugs (`ACT-RISK-MGMT`, `ACT-TREASURY`, `ACT-TRADE-BOOK`, `ACT-COMPLIANCE`) and non-seed risk codes (`RT-OR`, `RT-MR`, `RT-LR`, `RT-CAP`). To merge cleanly into the single graph (Principle 2) every row's `activityScope` and `riskTaxonomy` were normalized to the seed taxonomy. Two rows additionally had substantive threshold corrections (012, 030 — see §3/§4). Because the taxonomy normalization touches all 46 rows, none qualify as a pure ACCEPT; the substance of all 46 underlying duties is sound and source-grounded.

**0 rejected.** No row asserts a fabricated obligation. The two threshold problems found (the 5% connected-counterparty trigger in 012, and the fixed 2.5% conservation-buffer figure in 030) are corrected in place rather than rejected, because the underlying duty in each case is real and source-grounded.

## 2. Per-row disposition

| ORG-RRB | New ORG-PR | Verdict | Reason / change |
|---|---|---|---|
| 001 | ORG-PR-67 | MODIFY | Taxonomy normalized (`ACT-REPORT-PRUDENTIAL`; `RT-OP`). Substance OK (reg1 completeness + on-request analysis). |
| 002 | ORG-PR-68 | MODIFY | Taxonomy normalized. Substance OK (reg2 management-accounts basis). |
| 003 | ORG-PR-69 | MODIFY | Taxonomy normalized. Substance OK (reg3 Financial Reporting Standards). |
| 004 | ORG-PR-70 | MODIFY | Taxonomy normalized (`ACT-RISK-MARKET`; `RT-MK`). Substance OK (reg3(4) fair-value-option governance — verbatim-confirmed). |
| 005 | ORG-PR-71 | MODIFY | Taxonomy normalized. Substance OK (reg4(1)-(3) BA 099 certification — form confirmed). |
| 006 | ORG-PR-72 | MODIFY | Taxonomy normalized. Substance OK (reg4(4)-(8) rendition of returns). |
| 007 | ORG-PR-73 | MODIFY | Owner `cco` OK. Taxonomy normalized (`ACT-GOVERN-COMPLIANCE`; `RT-OP`). Substance OK (reg5 self-report of non-compliance). |
| 008 | ORG-PR-74 | MODIFY | Taxonomy normalized. Substance OK; note the post-2025 reg7 is a generic delegation, but the enumerated submission periods (09:00 second business day; 15/20/30/60/90 days) survive in a reg7 subsection — confirmed. |
| 009 | ORG-PR-75 | MODIFY | Taxonomy normalized. Substance OK (reg18 BA 100 monthly balance sheet). |
| 010 | ORG-PR-76 | MODIFY | Taxonomy normalized (`ACT-RISK-CREDIT, ACT-RISK-CAPITAL, ACT-REPORT-PRUDENTIAL`; `RT-CR`). Substance OK (reg23 BA 200). |
| 011 | ORG-PR-77 | MODIFY | Taxonomy normalized (`RT-CR.CC`). **Threshold verified:** 25% single-counterparty cap (excl. D-SIB/D-SIFI/G-SIB) and 800% aggregate trigger both confirmed verbatim in reg24(6). |
| 012 | ORG-PR-78 | MODIFY | **Threshold correction:** the proposed "consider connected counterparties once exposure exceeds **5 per cent**" is NOT in reg24 — no 5% trigger exists in the source. Requirement re-worded to retain the 10% reporting trigger (confirmed) and the economic-interdependence concept (confirmed, defined in reg24(6)) without the fabricated 5% figure. Taxonomy normalized. |
| 013 | ORG-PR-79 | MODIFY | Taxonomy normalized (`ACT-RISK-CREDIT, ACT-GOVERN-BOARD`). **Threshold verified:** related-party write-off "exceeding **one per cent**" of CET1 confirmed verbatim in reg24(6). |
| 014 | ORG-PR-80 | MODIFY | Owner `treasurer` OK. Taxonomy normalized (`RT-LQ.FN`). LCR duty confirmed; the 100% minimum correctly attributed to the Basel III / Authority level (no verbatim "100 per cent" in reg26 — honest). |
| 015 | ORG-PR-81 | MODIFY | Owner `treasurer` OK. Taxonomy normalized. NSFR duty confirmed (reg26(14)); 100% honestly attributed to Authority. |
| 016 | ORG-PR-82 | MODIFY | Taxonomy normalized. Substance OK (reg26 BA 300 liquidity reporting). |
| 017 | ORG-PR-83 | MODIFY | Taxonomy normalized (`RT-LQ.IN`). **Thresholds verified:** level-1 HQLA 5%, 75% close-of-day, 50% intraday, 95% owned-and-unencumbered all confirmed verbatim in reg27(3). |
| 018 | ORG-PR-84 | MODIFY | Owner `treasurer` OK. Taxonomy normalized. Substance OK (reg27(2) minimum reserve balance, SARB Act s.10A). |
| 019 | ORG-PR-85 | MODIFY | Taxonomy normalized (`ACT-RISK-MARKET, ACT-RISK-CAPITAL, ACT-REPORT-PRUDENTIAL`; `RT-MK`). Substance OK (reg28 BA 320 market risk). |
| 020 | ORG-PR-86 | MODIFY | Owner `treasurer` OK. Taxonomy normalized (`RT-MK.FX`). **FX limit verified as deferred:** reg29(3) says "exceed an amount specified in writing by the Registrar" — proposal correctly leaves the limit unstated (no fabricated number). See CEO item. |
| 021 | ORG-PR-87 | MODIFY | Taxonomy normalized. Substance OK (reg29 BA 325 daily selected-risk return). |
| 022 | ORG-PR-88 | MODIFY | Taxonomy normalized (`RT-IRRBB`). Substance OK (reg30 BA 330 IRRBB). |
| 023 | ORG-PR-89 | MODIFY | Taxonomy normalized. **CONDITIONAL** (reg31 banking-book equity, BA 340; score 0.5). See CEO item. |
| 024 | ORG-PR-90 | MODIFY | Taxonomy normalized (`ACT-RISK-MARKET, ACT-GOVERN-BOARD`). Substance OK (reg32(4) board-approved derivatives policy). |
| 025 | ORG-PR-91 | MODIFY | Taxonomy normalized. Substance OK (reg32 BA 350 derivatives reporting). |
| 026 | ORG-PR-92 | MODIFY | Taxonomy normalized (`ACT-RISK-OPERATIONAL, ...`; `RT-OP`). Substance OK (reg33 BA 400 operational risk). |
| 027 | ORG-PR-93 | MODIFY | Taxonomy normalized. **CONDITIONAL** (reg35 securitisation/structured-product exposures, BA 500; score 0.4). See CEO item. |
| 028 | ORG-PR-94 | MODIFY | Owner `cfo` OK. Taxonomy normalized. **CONDITIONAL** (reg36 consolidated supervision, BA 600; score 0.5). See CEO item. |
| 029 | ORG-PR-95 | MODIFY | Taxonomy normalized (`RT-CR` per seed convention for capital-adequacy rows). **Thresholds verified:** CET1 4.5%, Tier 1 6%, Total 8% all confirmed verbatim in reg38(8). |
| 030 | ORG-PR-96 | MODIFY | **Threshold correction:** the fixed 2.5% conservation-buffer subparagraph (reg38(8)(e)(iv)(A)) was DELETED by Notice 6342 (GG52907, eff. 1 July 2025); the figure is now Authority-specified. Requirement re-worded to present 2.5% as the Basel III fully phased-in level specified by the Authority (consistent with the LCR/NSFR honesty convention), noting the deletion. Citation narrowed to reg38(8)(e). The countercyclical 0–2.5% range IS verbatim (confirmed) and is retained. |
| 031 | ORG-PR-97 | MODIFY | Taxonomy normalized. **Thresholds verified:** leverage 4% (D-SIB management level), 3% floor, leverage multiple ≤25 all confirmed verbatim in reg38(15). |
| 032 | ORG-PR-98 | MODIFY | Taxonomy normalized. **Deferral verified:** reg38(8)(a) systemic/Pillar-2 add-on "specified in writing by the Registrar" — no fabricated percentage. See CEO item. |
| 033 | ORG-PR-99 | MODIFY | Taxonomy normalized. Substance OK (reg38 BA 700; output floor confirmed present in reg38). |
| 034 | ORG-PR-100 | MODIFY | Owner `cosec`→`company-secretary` (seed canonical). Taxonomy normalized (`RT-ST.GV`). Substance OK (reg39(1)-(2) corporate governance). |
| 035 | ORG-PR-101 | MODIFY | Owner `cro` OK. Taxonomy normalized. Substance OK (reg39(4)-(5) RM framework). |
| 036 | ORG-PR-102 | MODIFY | Taxonomy normalized (`RT-ST.EX`). Substance OK (reg39 stress-testing duty — confirmed in reg39; the exact subreg "(5)(d)" cite is approximate but the substance is sound). |
| 037 | ORG-PR-103 | MODIFY | Owner `cosec`→`company-secretary`. Taxonomy normalized. Substance OK (reg40 director competence — "commensurable" confirmed). |
| 038 | ORG-PR-104 | MODIFY | Owner `cosec`→`company-secretary`. Taxonomy normalized. Substance OK (reg41 board composition; "at least two" employee members confirmed). |
| 039 | ORG-PR-105 | MODIFY | Owner `cfo` OK. Taxonomy normalized. Substance OK (reg43(1) Pillar 3 public disclosure). |
| 040 | ORG-PR-106 | MODIFY | Owner `cfo` OK. Taxonomy normalized. Substance OK (reg43(1)(a) board-approved disclosure policy). |
| 041 | ORG-PR-107 | MODIFY | Taxonomy normalized. Substance OK (reg44 annual financial statements). |
| 042 | ORG-PR-108 | MODIFY | Taxonomy normalized (`ACT-REPORT-PRUDENTIAL, ACT-GOVERN-AUDIT`). **Verified:** reg46 120-day auditor report, and BA 100 / BA 900 reconcilability both confirmed in source. |
| 043 | ORG-PR-109 | MODIFY | Owner `cae` OK. Taxonomy normalized (`RT-ST.GV`). Substance OK (reg48 internal audit). |
| 044 | ORG-PR-110 | MODIFY | Owner `cco` OK. Taxonomy normalized. Substance OK (reg49(1)-(2) compliance function). |
| 045 | ORG-PR-111 | MODIFY | Owner `cco` OK. Taxonomy normalized. Substance OK (reg49(3) compliance-officer duties). |
| 046 | ORG-PR-112 | MODIFY | Owner `cosec`→`company-secretary`. Taxonomy normalized. Substance OK (reg55 BA 007 share-acquisition application; form confirmed). |

## 3. Threshold & citation verification

All figures below were checked against the verbatim text in `source-docs/rrb-structured.json`.

| Figure / item | Source location | Result |
|---|---|---|
| Large-exposure 25% single-counterparty cap (excl. D-SIB/D-SIFI/G-SIB) | reg24(6) ("twenty five per cent") | **Confirmed verbatim** |
| Large-exposure 10% reporting trigger | reg24(6) ("10 per cent") | **Confirmed verbatim** |
| Large-exposure 5% connected-counterparty trigger | reg24 | **NOT in source — fabricated.** No 5% trigger exists. Corrected in ORG-PR-78 (012). |
| Large-exposure 800% aggregate trigger | reg24(6) ("800 per cent") | **Confirmed verbatim** |
| Related-party write-off 1% board-approval trigger | reg24(6) ("exceeding one per cent") | **Confirmed verbatim** |
| G-SIB 15% sub-limit (context) | reg24(6) ("fifteen per cent") | Present in source (not separately decomposed — fine) |
| Level-1 HQLA 5% holding | reg27(3) ("5 per cent of its liabilities as reduced") | **Confirmed verbatim** |
| HQLA 75% close-of-day floor | reg27(3) ("75 per cent") | **Confirmed verbatim** |
| HQLA 50% intraday floor | reg27(3) ("50 per cent") | **Confirmed verbatim** |
| HQLA 95% owned-and-unencumbered | reg27(3) ("at least 95 per cent") | **Confirmed verbatim** |
| CET1 4.5% minimum | reg38(8) ("less than 4,5 per cent") | **Confirmed verbatim** |
| Tier 1 6% minimum | reg38(8) ("less than 6 per cent") | **Confirmed verbatim** |
| Total 8% minimum | reg38(8) ("minimum of 8 per cent") | **Confirmed verbatim** |
| Conservation buffer 2.5% (fixed) | reg38(8)(e)(iv)(A) | **DELETED by Notice 6342, eff. 1 July 2025** — no longer a fixed RRB number; now Authority-specified. Corrected in ORG-PR-96 (030). |
| Countercyclical buffer 0–2.5% range | reg38(8) ("range between zero and 2,5 per cent") | **Confirmed verbatim** |
| Leverage 4% (D-SIB management level) | reg38(15) ("less than 4 per cent") | **Confirmed verbatim** |
| Leverage 3% floor | reg38(15) ("in no case be less than 3 per cent") | **Confirmed verbatim** |
| Leverage multiple ≤25 | reg38(15) ("shall at no time exceed 25") | **Confirmed verbatim** |
| Net-open-FX-position daily limit | reg29(3) ("amount specified in writing by the Registrar") | **Confirmed deferred** — no fabricated number. |
| Pillar 2 / systemic capital add-on | reg38(8)(a) ("specified in writing by the Registrar … for systemic risk") | **Confirmed deferred** — no fabricated number. |
| reg46 auditor report within 120 days | reg46(1) ("within 120 days of the financial year-end") | **Confirmed verbatim** |
| BA 100 / BA 900 reconcilability (reg46) | reg46 | **Confirmed** |
| Form numbers (BA 099, 100, 200, 210, 300, 310, 320, 325, 330, 340, 350, 400, 500, 600, 700, 007) | respective regs | **All confirmed present** |
| reg7 submission periods (09:00 2nd business day; 15/20/30/60/90 days) | reg7 subsection | **Confirmed present** (survive alongside the substituted generic-delegation head). |
| reg41 "at least two" employee board members | reg41 | **Confirmed** |
| reg40 director competence "commensurable" | reg40 | **Confirmed** |

**No fabricated form names, thresholds, or citations remain in the reviewed set.** The only two figures the proposal got wrong were (a) the 5% connected-counterparty trigger (fabricated — removed) and (b) the fixed 2.5% conservation buffer (stale — superseded by the 2025-07-01 deletion; re-cast as Authority-specified). All `[TBD]`/Authority-deferred values were left deferred, not invented.

## 4. DECISIONS REQUIRED FROM CEO (Marc)

Each item below pairs the issue with a concrete call-to-action; please indicate y/n (or pick the option) on each.

1. **Owner-slug standard — `cosec` vs `company-secretary`.** The dispatch brief lists `cosec` as the allowed governance slug, but the canonical seed (`_obligations.seed.json`) uses `company-secretary` for the same seat. To keep the single graph internally consistent I normalized the four governance rows (034, 037, 038, 046) to `company-secretary`. **Decision:** confirm `company-secretary` is the canonical owner slug for adoption (recommended), or instruct that `cosec` be used and the seed reconciled separately.

2. **Net-open-FX-position daily limit `[TBD]` (reg29(3) → ORG-PR-86).** The limit is "an amount specified in writing by the Registrar"; no figure exists in the RRB. The obligation is adopted with the limit deferred. **Decision:** confirm the bank's licence-day FX net-open-position limit is captured separately (Authority correspondence) once set — OK to adopt the obligation now with the limit deferred? (recommended y)

3. **Pillar 2 / systemic capital add-on `[TBD]` (reg38(8)(a) → ORG-PR-98).** Add-on percentages are Authority-specified and not in the RRB. Adopted with the percentage deferred. **Decision:** OK to adopt now with the add-on deferred to Authority determination? (recommended y)

4. **Conditional row — reg31 banking-book equity risk, BA 340 (ORG-PR-89).** Applicability 0.5; the bank's equities are primarily trading-book, banking-book equity exposure may be nil. **Decision:** adopt-as-conditional (binds only if/when the bank holds banking-book equity) — recommended — vs hold until scope confirmed.

5. **Conditional row — reg35 securitisation / structured-product exposures, BA 500 (ORG-PR-93).** Applicability 0.4; the bank does not originate securitisations but may hold securitised notes in its bond book. **Decision:** adopt-as-conditional (investor due-diligence duty binds only if such exposures are held) — recommended — vs hold.

6. **Conditional row — reg36 consolidated supervision, BA 600 (ORG-PR-94).** Applicability 0.5; the bank is expected to operate solo at licence-day, no group structure yet. **Decision:** adopt-as-conditional (binds only if a banking-group structure exists) — recommended — vs hold.

7. **Threshold correction noted for the record — reg24 5% trigger (ORG-PR-78).** The proposal's fabricated 5% connected-counterparty trigger was removed; the row now reflects only the source-confirmed 10% reporting trigger plus the economic-interdependence concept. **No decision needed** unless the CEO wants the original 5% reinstated (not recommended — it is not in the source).

8. **Threshold correction noted for the record — reg38 conservation buffer (ORG-PR-96).** The fixed 2.5% conservation-buffer figure was deleted from the RRB on 2025-07-01; the row now presents 2.5% as the Basel III / Authority-specified level. **No decision needed** unless the CEO wants the buffer modelled differently once the Authority specifies it at licence-day.

**Recommended global disposition:** adopt all 46 reviewed rows (ORG-PR-67..112) with items 1–6 resolved as recommended. This review does not itself adopt — the seed remains untouched; adoption is the downstream decider step.

## 5. Process notes

- The seed (`_obligations.seed.json`) was **not** modified. The reviewed rows live only in `_obligations.rrb-reviewed.json`.
- No events were emitted, no `bun`/`backfill`/`graph:seed`/`citation-gate`/git commands were run (out of scope per the review brief).
- `_provenance` blocks were stripped from every reviewed row; `reviewStatus="reviewed-modified"`, `reviewAuthor="independent-reviewer"`, `reviewDate="2026-06-19"`, `reviewEventId=""` set on all.
- Key order in every reviewed row matches the seed schema exactly: section, id, urn, citation, requirement, fulfilmentPolicy, owner, status, bindTrigger, entityScope, appliesAt, productScope, activityScope, riskTaxonomy, reviewStatus, reviewAuthor, reviewDate, reviewEventId, domain.
- `status` left as `PROPOSED` on all reviewed rows (adoption/promotion to `IN_FORCE` is the downstream decider step).

---

## Scrooge source-override addendum (2026-06-19)

Scrooge cross-checked the reviewer's two "substantive corrections" against the verbatim
source (`source-docs/rrb-structured.json`). **Both were incorrect and have been reverted in
`_obligations.rrb-reviewed.json`:**

1. **ORG-PR-78 (reg24 large-exposure reporting):** the 5%% connected-counterparty trigger is
   **NOT fabricated** — it is explicit in the source at reg24(6): *"when the sum of the bank's
   exposures to one individual counterparty exceeds 5%% of the sum of [CET1 + AT1]... the bank
   shall carefully consider possible connected counterparties on the basis of economic
   interdependence."* The 5%% trigger has been restored.
2. **ORG-PR-96 (reg38 capital conservation buffer):** Notice 6342 (GG52907, eff. 1 July 2025)
   **substituted** regulation 38(8)(f) but the substituted text **retains** *"capital
   conservation buffer for the period 1 January 2019 and thereafter shall be equal to 2,50 per
   cent."* The 2.5%% figure was **not** deleted and is current. The fixed 2.5%% buffer has been
   restored.

The reviewer's other changes stand and are confirmed useful: owner slug `cosec →
company-secretary` (matches the seed's canonical slug), riskTaxonomy/activityScope normalised
to the seed's actual code conventions, renumbering ORG-PR-67…112, and `_provenance` stripped.

**Net status:** `_obligations.rrb-reviewed.json` is merge-ready **pending the CEO decisions
below**. No `ObligationAdopted` events have been emitted (bun/event store absent in this
session — see substrate gap).
