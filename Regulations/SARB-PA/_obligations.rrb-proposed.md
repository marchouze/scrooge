# RRB obligation proposal - Mira (Compliance / RegTech engineer, engineering)

**Instrument:** Regulations Relating to Banks (RRB) - GN R.1029 of 2012, GG 35950, as amended, under the Banks Act 94 of 1990.  
**Source of truth:** `Regulations/SARB-PA/source-docs/rrb-structured.json` (5 chapters, 38 top-level regulations).  
**Author:** Mira | **Date:** 2026-06-19 | **Review status:** proposed-llm-unreviewed (a reviewer triages, renumbers into `ORG-PR-*`, strips `_provenance`, and merges).

## Run summary

- **Regulations analysed:** 38 of 38 (100% accounted for).
- **Applicable regulations decomposed:** 29.
- **Proposed obligations:** 46.
- **Not-applicable (scored < 0.4, skipped):** 9.
- **Gaps (unreadable / truncated):** 0.

Method: for each regulation the verbatim section + subsection text was read; applicability to the bank profile (institutional-only, trading-book-oriented - JSE bonds & equities, OTC IRD, FX spot; banking + Category I FSP licences; no retail deposits; no foreign operations; AI-agent-operated) was scored 0.0-1.0; applicable regulations were decomposed one obligation per distinct duty. Thresholds and form numbers are taken verbatim from the source; where the source defers a number or limit to the Authority, this is flagged `[TBD]` rather than invented.

## Proposed obligations

| ID | URN | Owner | Domain | Appl. | Requirement (first line) |
|----|-----|-------|:-----:|:-----:|--------------------------|
| ORG-RRB-001 | `urn:reg:za:rrb:reg1` | cfo | G | 0.45 | The bank must report all information required in every prescribed return completely and against t... |
| ORG-RRB-002 | `urn:reg:za:rrb:reg2` | cfo | G | 0.60 | The bank must prepare every prescribed return using the same principles used to prepare its manag... |
| ORG-RRB-003 | `urn:reg:za:rrb:reg3` | cfo | A | 0.70 | The bank must prepare all prescribed returns in accordance with the Financial Reporting Standards... |
| ORG-RRB-004 | `urn:reg:za:rrb:reg3` | cro | A | 0.75 | Before first applying and on an ongoing basis whenever it adopts a fair value option or approach ... |
| ORG-RRB-005 | `urn:reg:za:rrb:reg4` | cfo | G | 0.85 | The bank must, for every set of returns rendered, complete, sign and certify a form BA 099 signed... |
| ORG-RRB-006 | `urn:reg:za:rrb:reg4` | cfo | G | 0.85 | The bank must render every prescribed return, whether on the prescribed form or by electronic mea... |
| ORG-RRB-007 | `urn:reg:za:rrb:reg5` | cco | F | 0.70 | Whenever the bank fails or is unable to comply with any provision of the Regulations, it must rep... |
| ORG-RRB-008 | `urn:reg:za:rrb:reg7` | cfo | G | 0.90 | The bank must submit to the Prudential Authority every financial, risk-based and other related re... |
| ORG-RRB-009 | `urn:reg:za:rrb:reg18` | cfo | G | 0.70 | The bank must complete and submit the monthly balance-sheet return (form BA 100) in accordance wi... |
| ORG-RRB-010 | `urn:reg:za:rrb:reg23` | cro | A | 1.00 | The bank must measure its credit-risk exposure and calculate the related minimum required capital... |
| ORG-RRB-011 | `urn:reg:za:rrb:reg24` | cro | A | 0.95 | The bank must ensure that its exposure to any single counterparty or group of connected counterpa... |
| ORG-RRB-012 | `urn:reg:za:rrb:reg24` | cro | G | 0.90 | The bank must identify and report each large exposure |
| ORG-RRB-013 | `urn:reg:za:rrb:reg24` | cro | F | 0.70 | The bank must subject any transaction with a related person, and the write-off of any related-par... |
| ORG-RRB-014 | `urn:reg:za:rrb:reg26` | treasurer | A | 1.00 | The bank must calculate and continuously maintain a Liquidity Coverage Ratio |
| ORG-RRB-015 | `urn:reg:za:rrb:reg26` | treasurer | A | 1.00 | The bank must calculate and on an ongoing basis maintain a Net Stable Funding Ratio |
| ORG-RRB-016 | `urn:reg:za:rrb:reg26` | treasurer | G | 0.95 | The bank must measure and report its liquidity risk on the monthly liquidity return (form BA 300)... |
| ORG-RRB-017 | `urn:reg:za:rrb:reg27` | treasurer | A | 0.90 | The bank must hold, during each prescribed maintenance period, an average daily amount of level 1... |
| ORG-RRB-018 | `urn:reg:za:rrb:reg27` | treasurer | I | 0.90 | The bank must hold and maintain the minimum reserve balance with the South African Reserve Bank d... |
| ORG-RRB-019 | `urn:reg:za:rrb:reg28` | cro | A | 1.00 | The bank must measure its exposure to market (position) risk arising from trading activities and ... |
| ORG-RRB-020 | `urn:reg:za:rrb:reg29` | treasurer | I | 0.90 | The bank must ensure that its aggregate effective net open foreign-currency position |
| ORG-RRB-021 | `urn:reg:za:rrb:reg29` | cro | G | 0.85 | The bank must determine and report on a daily basis, on form BA 325, its selected risk exposures ... |
| ORG-RRB-022 | `urn:reg:za:rrb:reg30` | cro | A | 0.90 | The bank must measure the interest-rate risk in its banking book |
| ORG-RRB-023 | `urn:reg:za:rrb:reg31` | cro | A | 0.50 | Where the bank holds equity exposures or other relevant investments or instruments in its banking... |
| ORG-RRB-024 | `urn:reg:za:rrb:reg32` | cro | F | 0.90 | The bank must have a board-approved written policy on derivative instruments that specifies the c... |
| ORG-RRB-025 | `urn:reg:za:rrb:reg32` | cro | G | 0.90 | The bank must determine and report monthly, on form BA 350, the notional amounts of all derivativ... |
| ORG-RRB-026 | `urn:reg:za:rrb:reg33` | cro | A | 0.85 | The bank must calculate its minimum required capital and reserve funds in respect of operational ... |
| ORG-RRB-027 | `urn:reg:za:rrb:reg35` | cro | A | 0.40 | Whenever the bank invests in structured products or holds securitisation or resecuritisation expo... |
| ORG-RRB-028 | `urn:reg:za:rrb:reg36` | cfo | A | 0.50 | Where the bank forms part of a banking group with relevant subsidiaries or associates, it must ca... |
| ORG-RRB-029 | `urn:reg:za:rrb:reg38` | cfo | A | 1.00 | The bank must at all times maintain qualifying capital and reserve funds against risk-weighted ex... |
| ORG-RRB-030 | `urn:reg:za:rrb:reg38` | cfo | A | 0.95 | The bank must hold, above the minimum capital ratios, a capital conservation buffer of 2.5 per ce... |
| ORG-RRB-031 | `urn:reg:za:rrb:reg38` | cfo | A | 1.00 | The bank must calculate a Basel III leverage ratio (tier 1 capital divided by the total exposure ... |
| ORG-RRB-032 | `urn:reg:za:rrb:reg38` | cfo | A | 0.90 | The bank must hold, in addition to the minimum ratios and buffers, any further minimum capital pe... |
| ORG-RRB-033 | `urn:reg:za:rrb:reg38` | cfo | G | 1.00 | The bank must calculate its aggregate risk-weighted exposure using the approaches it has adopted ... |
| ORG-RRB-034 | `urn:reg:za:rrb:reg39` | cosec | F | 0.95 | The bank's board of directors must establish and maintain an adequate and effective process of co... |
| ORG-RRB-035 | `urn:reg:za:rrb:reg39` | cro | A | 0.95 | The bank must have in place comprehensive board-approved policies, processes and procedures to id... |
| ORG-RRB-036 | `urn:reg:za:rrb:reg39` | cro | A | 0.90 | The bank must ensure its risk-management processes are robust enough to conduct regular stress-te... |
| ORG-RRB-037 | `urn:reg:za:rrb:reg40` | cosec | F | 0.80 | The bank must ensure every director acquires a basic knowledge and understanding of the conduct o... |
| ORG-RRB-038 | `urn:reg:za:rrb:reg41` | cosec | F | 0.70 | The bank must ensure the chairperson of its board is not an employee of the bank, its subsidiarie... |
| ORG-RRB-039 | `urn:reg:za:rrb:reg43` | cfo | G | 0.85 | The bank must disclose to the public, in its annual financial statements and other disclosures, r... |
| ORG-RRB-040 | `urn:reg:za:rrb:reg43` | cfo | F | 0.80 | The bank must have in place a formal board-approved disclosure policy that specifies the approach... |
| ORG-RRB-041 | `urn:reg:za:rrb:reg44` | cfo | G | 0.80 | The bank must compile its annual financial statements in accordance with the Financial Reporting ... |
| ORG-RRB-042 | `urn:reg:za:rrb:reg46` | cfo | G | 0.70 | The bank must ensure that, within 120 days of its financial year-end, its auditor reports to the ... |
| ORG-RRB-043 | `urn:reg:za:rrb:reg48` | cae | F | 0.90 | The bank must establish an independent, objective and permanent internal audit function that eval... |
| ORG-RRB-044 | `urn:reg:za:rrb:reg49` | cco | F | 0.90 | The bank must have, as part of its risk-management framework and governance structure, an indepen... |
| ORG-RRB-045 | `urn:reg:za:rrb:reg49` | cco | F | 0.90 | The bank's compliance officer must report directly to the board, audit committee and chief execut... |
| ORG-RRB-046 | `urn:reg:za:rrb:reg55` | cosec | F | 0.50 | The bank must ensure that any acquisition of shares in the bank or its controlling company requir... |

## Not applicable (scored < 0.4 - skipped, with reason)

| Regulation | Title | Score | Reason not applicable |
|------------|-------|:-----:|-----------------------|
| reg6 | General | 0.20 | General / administrative: how to obtain and electronically render forms; no substantive standalone duty. |
| reg8 | Calculation of averages | 0.35 | Interpretation directive (calculation of average daily balances); a return-completion methodology rule, not a standalone duty - folded into the return obligations (reg7, reg18 et al). |
| reg9 | Gross balances | 0.35 | Interpretation directive (reporting on a gross-balances basis); return-completion methodology, folded into the return obligations. |
| reg10 | Maturity classification | 0.30 | Interpretation directive (maturity classification by remaining term); return-completion methodology, no standalone duty. |
| reg25 | Credit risk — Directives and interpretations for completion of six-... | 0.30 | Six-monthly return on 'assets bought-in' (form BA 220); the bank does not take in/repossess assets, so the duty does not bite. Re-test if the bank acquires assets in settlement of debt. |
| reg34 | Operational risk — Directives and interpretations for completion of... | 0.30 | Operational-risk return for AMA banks (form BA 410); applies only to a bank that adopted the advanced measurement approach for operational-risk capital, which this bank has not. Conditional - re-test if AMA is adopted. |
| reg37 | Consolidated supervision — Directives for completion of six-monthly... | 0.30 | Six-monthly return on foreign operations of SA banks (form BA 610); the bank has no foreign branch, subsidiary or operation (registered office only). Re-test if foreign operations are established. |
| reg52 | Application forms and certificates of registration | 0.30 | Form-listing / application-procedure administration (forms BA 001-BA 023); used during the licensing application, not an ongoing operating duty. |
| reg58 | Fees payable | 0.20 | Prescribed fees payable on applications (Banks Act s.86(4)); fee-administration, not a substantive ongoing duty. The bank pays the listed fee when it lodges a relevant application. |

## Gaps

None - every one of the 38 regulations was readable and is either decomposed into >=1 obligation above or listed as not-applicable with a reason. No regulation was image-only or truncated.

## Notes for the reviewer

- **Owners** use the seat slugs in the brief (`treasurer, cfo, cro, cco, ciso, coo, cae, cosec, ceo`). Capital adequacy/leverage/BA 700 -> `cfo`; LCR/NSFR/liquidity/reserve/FX -> `treasurer`; credit/market/IRRBB/op-risk/derivatives measurement -> `cro`; governance/board/audit/compliance -> `cosec`/`cae`/`cco`.
- **Thresholds are sourced verbatim:** large-exposure 25% single-counterparty limit and 10% reporting / 800% aggregate triggers (Reg 24(6)); level-1 HQLA 5% with 75/50/95% sub-limits (Reg 27(3)); CET1 4.5% / Tier 1 6% / Total 8% (Reg 38(8)); conservation buffer 2.5% and countercyclical 0-2.5% (Reg 38(8)); leverage 4% management level / 3% floor / 25x multiple (Reg 38(15)). The LCR/NSFR 100% minima are the Basel III fully phased-in levels set in writing by the Authority - flagged as such in the requirement text rather than asserted as a verbatim RRB number.
- **`[TBD]` markers** are honest gaps where the source defers a value to the Authority (the FX net-open-position limit in Reg 29(3); Pillar 2 / systemic add-on percentages in Reg 38(8)(a)).
- **Form numbers** are taken verbatim from the source (BA 099, BA 100, BA 200, BA 210, BA 220, BA 300, BA 310, BA 320, BA 325, BA 330, BA 340, BA 350, BA 400, BA 500, BA 600, BA 700, BA 900). The source records most forms as `[Deleted]` from the regulation by Notice 5802 (GG 52013, eff. 1 Feb 2025), with the completion directive retained and the form now determined in writing by the Authority - the obligations are written against the surviving directive.
- **Conditional applicability:** reg31 (banking-book equity), reg35 (securitisation/structured-product exposures) and reg36 (consolidated supervision) are scored 0.4-0.5 and written as conditional on the bank actually holding such positions or a group structure existing; the reviewer should confirm scope before adopting.
