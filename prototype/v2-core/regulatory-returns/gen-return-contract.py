#!/usr/bin/env python3
"""Generate a SARB BA-return cell-data-requirement contract DIRECTLY from the
form's XSD/xlsx in `Regulations/SARB-PA/ba-returns/schemas/<FORM>.zip`.

This is the GENERALISED generator for the financial-family returns (BA 110,
BA 120, BA 600, BA 610), the credit-family returns (BA 200, BA 210, BA 220) AND
the liquidity-family returns (BA 300, BA 310) — the parametrised sibling of
`gen-ba100-contract.py` (which keeps the rich BA-100 balance-sheet
line→GL→product mapping).

LIQUIDITY FAMILY (Phase C batch 3): the LCR / NSFR / minimum-reserve returns
carry product-attribute requirements on TWO axes — the DEPOSIT / funding axis
(funding-stability, counterparty category, operational relationship, maturity /
callability → LCR run-off + NSFR ASF) and the HQLA-ELIGIBLE-ASSET axis (HQLA
level / eligibility / haircut / repo-eligibility → LCR numerator + BA 310 liquid-
asset stock). Unlike the credit family, the liquidity NUMERATOR has LIVE
substrate (the HQLA classifier + SecurityMaster + the BA-300 LCR fold), so the
HQLA / LCR-numerator cells are `sourced` while the deposit-funding / NSFR /
reserve cells (which need real funding positions) are `licence-day-data`. The
`liquidity_product_attributes()` mapper attaches each edge to the right future
product (`prd:bank:deposit:transactional` or
`prd:bank:treasury:hqla-eligible-asset`); `liquidity_cell_status()` makes the
per-cell sourced-vs-licence-day decision (a cell carrying a required attribute on
an unapproved future product is forced licence-day so the NPA gate stays
coherent). The live FX product feeds none of these, so it is not wrongly blocked.

FINANCIAL FAMILY (Phase C batch 1): the cell→source mapping is form-LEVEL (a
named report fold over the GL trial balance + the form's projection), NOT a
hand-authored per-line product map: the financial family is mostly GL-derived
(per the brief), and hand-authoring 130–2445 line→product edges without the
form's regulatory annexure in hand would be fabrication.

CREDIT FAMILY (Phase C batch 2): the credit-risk returns DO carry real product-
attribute requirements a credit product must capture (exposure class, PD/LGD,
risk weight, counterparty identity for LEX, collateral/CRM, maturity, on/off-
balance, CCF, asset-bought-in flag). The `credit_product_attributes()` mapper
attaches a `product-attribute` dataRequirement (`ref: prd:bank:credit:loan#<attr>`)
to each cell that genuinely keys off such an attribute — `required:true` ONLY
where the cell cannot populate without it (the cell that REPORTS the attribute),
`required:false` for monetary aggregates merely sliced by it. This is the
product→cell edge the NPA gate (`recon:npa-return-data-obligation-integrity`)
binds on: a FUTURE credit product is gated on capturing these attributes. No
credit/loan product is approved yet, so credit cells are `licence-day-data`
(honest: there are no real exposures pre-licence-day) — the recon validates
`prd:` refs against the approved-product set only for `sourced` cells.

Every cell is still emitted (an entry for EVERY XSD leaf cell — money, ratio,
count, date, text, enum) with honest provenance, honest status, and an upward P2
citation to the form's CORRECTED obligation row (post PR #1451 numbering
remediation).

Run (from prototype/):
    python3 v2-core/regulatory-returns/gen-return-contract.py BA110   # financial
    python3 v2-core/regulatory-returns/gen-return-contract.py BA200   # credit
    python3 v2-core/regulatory-returns/gen-return-contract.py --all     # financial family
    python3 v2-core/regulatory-returns/gen-return-contract.py --credit  # credit family

The output `<form-lower>-contract.json` is checked in and validated at import
time by the Zod schema (`cell-contract.ts`); this generator is its provenance —
the cell set is provably the full XSD leaf set (no hand-omission). The
`recon:ba-return-cell-contract` gate independently re-extracts the XSD leaf set
and asserts one contract entry per cell.

Authority: D-BA-RETURN-DATA-CONTRACT (CEO 2026-06-19), Phase C batch 1
  (financial family) + batch 2 (credit family).
Author: Bea (Accounting and financial reporting engineer, engineering —
  reports to Camille (Chief Financial Officer)).
"""
import io
import json
import os
import re
import sys
import zipfile
from collections import Counter
from xml.etree import ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA_DIR = os.path.normpath(
    os.path.join(HERE, "..", "..", "..", "Regulations", "SARB-PA", "ba-returns", "schemas")
)

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# ---------------------------------------------------------------------------
# Per-form configuration — the substantive accounting-engineering judgement
# that is form-LEVEL (not per-line). Each entry binds the form to:
#   - its OFFICIAL name (canonical SARB Excel A1 name; _canonical-register.md §2)
#   - its CORRECTED obligation row (post PR #1451 — IDs verified against the
#     obligations seed; the URN slug may carry a pre-#1451 mis-label which the
#     obligation record's own correction annotation documents — we cite the ID).
#   - the D5/2025 §-clause + Annexure the obligation is sourced from (verbatim
#     from the obligation record's `citation` field).
#   - the named report-generation projection FOLD for the form (consistent with
#     BA 100's `ba100-balance-sheet-fold`).
#   - the GL categories the form's monetary cells fold from (real CoA
#     categories; the recon asserts each exists).
#   - the default entity scope + whether the form is structurally licence-day
#     (consolidation / foreign-operations data does not exist pre-licence-day).
# ---------------------------------------------------------------------------
FORMS = {
    "BA110": dict(
        name="Off-Balance-Sheet Activities",
        obligation="ORG-PR-RETURNS-003",
        clause=(
            "SARB PA Directive D5/2025 §2.1.4 (form BA 110 — Off-Balance-Sheet Activities, "
            "Annexure 3A/3B) read with the Regulations relating to Banks; Banks Act 94 of 1990 "
            "s.6(6)(a). [Post-#1451 corrected row: BA 110 = Off-Balance-Sheet Activities per the "
            "canonical SARB Excel form schedule; the LCR / liquidity return is BA 300.]"
        ),
        fold="ba110-obs-fold",
        # OBS items are notional/contingent memoranda — no on-balance-sheet GL
        # category holds them; they fold from the off-balance-sheet memorandum
        # register (a memo projection) keyed off contingent-liability and
        # commitment events. The closest existing CoA memo category is the
        # regulatory NOP memorandum; the authoritative source is the fold.
        gl_categories=["memorandum-regulatory-nop"],
        entity_scope="bank",
        licence_day=False,
        # OBS lines are sourced from the contingent/commitment memo register,
        # which exists as substrate (folds to honest 0 with no positions booked).
        status_note=(
            "Off-balance-sheet exposures (guarantees, commitments, contingent "
            "liabilities, derivatives notionals) fold from the off-balance-sheet "
            "memorandum register; the source exists, values are an honest 0 until "
            "such exposures are booked at licence-day."
        ),
    ),
    "BA120": dict(
        name="Income Statement",
        obligation="ORG-PR-RETURNS-004",
        clause=(
            "SARB PA Directive D5/2025 §2.1.5 (form BA 120 — Income Statement, Annexure 4A/4B) "
            "read with the Regulations relating to Banks; Banks Act 94 of 1990 s.6(6)(a). "
            "[Post-#1451 corrected row: BA 120 = Income Statement per the canonical SARB Excel "
            "form schedule; the NSFR sits within the BA 300 liquidity-risk series.]"
        ),
        fold="ba120-income-statement-fold",
        # Income statement folds from the income/expense GL categories of the
        # trial balance — all real CoA categories.
        gl_categories=[
            "income-interest",
            "income-other",
            "income-trading",
            "expense-interest",
            "expense-impairment",
        ],
        entity_scope="bank",
        licence_day=False,
        status_note=(
            "Income-statement lines fold from the income/expense GL categories of "
            "the GL trial balance; the source exists, values are an honest 0 until "
            "real income/expense flows are booked at licence-day."
        ),
    ),
    "BA600": dict(
        name="Consolidated Return",
        obligation="ORG-PR-RETURNS-020",
        clause=(
            "SARB PA Directive D5/2025 §2.1.21 (form BA 600 — Consolidated Return, "
            "Annexure 20A/20B) read with the Regulations relating to Banks; Banks Act 94 of 1990 "
            "s.6(6)(a). [Post-#1451 corrected row: BA 600 = Consolidated Return (group-wide "
            "prudential consolidation) per the canonical SARB Excel form schedule; the balance "
            "sheet return is BA 100.]"
        ),
        fold="ba600-consolidation-fold",
        # Consolidated figures fold from the group consolidation projection over
        # the legal-entity tree; the per-category balances come from the GL
        # trial balance of each consolidated entity.
        gl_categories=[],  # all CoA categories aggregate; resolved at fold time
        entity_scope="consolidated",
        licence_day=True,  # no subsidiaries exist pre-licence → consolidation is empty
        status_note=(
            "Consolidated-return figures require ≥1 consolidated subsidiary in the "
            "legal-entity tree; the bank-in-formation has no subsidiaries pre-"
            "licence-day. The consolidation fold and legal-entity tree exist as "
            "substrate; the consolidated values are licence-day data (no group to "
            "consolidate yet). No silent fabrication."
        ),
    ),
    "BA610": dict(
        name="Foreign Operations of South African Banks",
        obligation="ORG-PR-RETURNS-021",
        clause=(
            "SARB PA Directive D5/2025 §2.1.22 (form BA 610 — Foreign Operations of South "
            "African Banks, Annexure 21A) read with the Regulations relating to Banks; Banks "
            "Act 94 of 1990 s.6(6)(a). [Post-#1451 corrected row: BA 610 = Foreign Operations "
            "of South African Banks per the canonical SARB Excel form schedule; the income "
            "statement return is BA 120.]"
        ),
        fold="ba610-foreign-operations-fold",
        gl_categories=[],  # per-foreign-operation GL trial balance, resolved at fold time
        entity_scope="foreign-branch",
        licence_day=True,  # no foreign operations exist pre-licence
        status_note=(
            "Foreign-operations figures require ≥1 foreign branch/subsidiary; the "
            "bank-in-formation has no foreign operations pre-licence-day. The "
            "foreign-operations fold and the multi-currency/multi-entity substrate "
            "exist; the values are licence-day data (no foreign operation to report "
            "yet). No silent fabrication."
        ),
    ),
    # -----------------------------------------------------------------------
    # Phase C batch 2 — the CREDIT FAMILY (BA 200 / BA 210 / BA 220). Unlike the
    # financial family, these carry real product-attribute requirements a credit
    # product must capture (see CREDIT_ATTRS + credit_product_attributes). The
    # credit substrate exists (the SA credit-risk engine + SA-CCR), but there are
    # no real credit exposures pre-licence-day, so the cells are licence-day-data
    # while the product-attribute dataRequirements bind NOW (the build-now value).
    # -----------------------------------------------------------------------
    "BA200": dict(
        name="Credit Risk (IRB + Standardised approaches; includes counterparty credit risk sub-forms)",
        obligation="ORG-PR-RETURNS-007",
        clause=(
            "SARB PA Directive D5/2025 §2.1.8 (form BA 200 — Credit Risk: standardised + IRB "
            "approaches, incl. counterparty credit risk) read with the Regulations relating to "
            "Banks reg 23 (credit risk) and reg 23(15)–(19) (counterparty credit risk / SA-CCR); "
            "Basel CRE20–CRE36; Banks Act 94 of 1990 s.6(6)(a). [Post-#1451 corrected row: BA 200 "
            "= Credit Risk per the canonical SARB Excel form schedule.]"
        ),
        fold="ba200-credit-risk-fold",
        # Credit exposures fold from the SA credit-risk engine
        # (platform/reporting/ba-200-credit-risk.ts) over the credit-exposure
        # register + the credit-RWA projection — NOT a hand-mapped GL category
        # (no live loans-and-advances book exists pre-licence-day; the fold is the
        # authoritative source). Empty here, like the consolidation forms.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no real credit exposures pre-licence-day
        credit_family=True,
        status_note=(
            "Credit-risk figures (EAD, RWA, PD/LGD, expected loss, impairments by asset "
            "class) require real credit exposures; the bank-in-formation books none "
            "pre-licence-day. The SA credit-risk engine (ba-200-credit-risk.ts), the "
            "SA-CCR engine and the credit-RWA projection exist as substrate; the values "
            "are licence-day data (no exposures to report yet). The product-attribute "
            "dataRequirements bind now so a future credit product is correctly gated. "
            "No silent fabrication."
        ),
    ),
    "BA210": dict(
        name="Credit Concentration Risk / Large Exposures (LEX); incl. watch-list",
        obligation="ORG-PR-RETURNS-008",
        clause=(
            "SARB PA Directive D5/2025 §2.1.9 (form BA 210 — Credit Concentration Risk / Large "
            "Exposures (LEX), incl. watch-list and related-party) read with the Regulations "
            "relating to Banks reg 26 (large exposures / concentration risk) and reg 24 "
            "(connected counterparties); Basel LEX large-exposures framework; Banks Act 94 of "
            "1990 s.6(6)(a). [Post-#1451 corrected row: BA 210 = Credit Concentration Risk / "
            "Large Exposures per the canonical SARB Excel form schedule; the SA-CCR detail "
            "sits within BA 200.]"
        ),
        fold="ba210-large-exposures-fold",
        # LEX aggregates exposures by (connected) counterparty via the large-
        # exposures fold over the credit-exposure register (per-counterparty) +
        # the party register (connected-group axis). No live GL category exists
        # pre-licence-day; the fold is the authoritative source.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no real exposures / counterparties pre-licence-day
        credit_family=True,
        status_note=(
            "Large-exposure / concentration figures require real exposures aggregated by "
            "connected counterparty; the bank-in-formation books none pre-licence-day. "
            "The credit-exposure register and the party register (connected-group axis) "
            "exist as substrate; the values are licence-day data (no counterparties to "
            "aggregate yet). The product-attribute dataRequirements — counterparty "
            "identity, connected-group, exposure/asset class — bind now so a future "
            "credit product is correctly gated. No silent fabrication."
        ),
    ),
    "BA220": dict(
        name="Credit Risk: Assets bought-in",
        obligation="ORG-PR-RETURNS-009",
        clause=(
            "SARB PA Directive D5/2025 §2.1.10 (form BA 220 — Credit Risk: Assets bought-in, "
            "i.e. companies and immovable property acquired by the bank e.g. in satisfaction of "
            "a debt) read with the Regulations relating to Banks reg 23 and Banks Act 94 of 1990 "
            "s.78 (undesirable practices — restriction on holding immovable property / shares); "
            "s.6(6)(a). [Post-#1451 corrected row: BA 220 = Credit Risk: Assets bought-in per "
            "the canonical SARB Excel form schedule.]"
        ),
        fold="ba220-assets-bought-in-fold",
        # Bought-in assets fold from the assets-bought-in fold over the acquired-
        # assets sub-ledger; no live GL category exists pre-licence-day (the bank
        # holds no bought-in assets), so the fold is the authoritative source.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no bought-in assets pre-licence-day
        credit_family=True,
        status_note=(
            "Assets-bought-in figures require the bank to have acquired companies or "
            "immovable property (e.g. in satisfaction of a debt); the bank-in-formation "
            "holds none pre-licence-day. The acquired-assets sub-ledger exists as "
            "substrate; the values are licence-day data (no bought-in assets to report "
            "yet). The product-attribute dataRequirements — bought-in flag, date, asset "
            "type — bind now. No silent fabrication."
        ),
    ),
    # -----------------------------------------------------------------------
    # Phase C batch 3 — the LIQUIDITY FAMILY (BA 300 / BA 310). Like the credit
    # family these carry real product-attribute requirements a product must
    # capture — but on the LIABILITY (deposit funding-stability / category /
    # maturity) and HQLA (asset level / eligibility / haircut) axes that drive
    # the LCR and NSFR. UNLIKE the credit family, the liquidity numerator has
    # LIVE substrate (the HQLA classifier + SecurityMaster + the BA-300 LCR fold
    # over cash-flow events), so the HQLA/LCR cells are `sourced` where the
    # source genuinely exists; the NSFR / term-funding lines that need real
    # funding positions are `licence-day-data`. The split is computed per-cell in
    # build_cell (the form config carries the DEFAULT + the live-substrate flag).
    # -----------------------------------------------------------------------
    "BA300": dict(
        name="Liquidity Risk (includes the Liquidity Coverage Ratio (LCR) and the Net Stable Funding Ratio (NSFR) series)",
        obligation="ORG-PR-RETURNS-010",
        clause=(
            "SARB PA Directive D5/2025 §2.1.11 (form BA 300, Annexure 10A/10B) read with the "
            "Regulations relating to Banks reg 26 (liquidity risk / minimum liquid assets and "
            "the liquidity coverage ratio) and the Basel III LCR (BCBS D295) and NSFR (BCBS D335) "
            "standards; Banks Act 94 of 1990 s.6(6)(a). [Post-#1451 corrected row "
            "(D-BA-RETURN-NUMBERING-EXCEL-CANONICAL): per the canonical SARB Excel form schedule, "
            "form BA 300 is the LIQUIDITY RISK return (incl. the LCR and the NSFR series); the "
            "verbatim §2.1.11 'operational risk' annotation in the obligation record is the "
            "documented fabrication the correction supersedes — operational risk is BA 400.]"
        ),
        fold="ba300-liquidity-risk-fold",
        # Liquidity cells fold from the BA-300 LCR / NSFR projections over the
        # cash-flow events + the HQLA stock fold (over SecurityMaster). There is
        # no single GL category that holds the LCR/NSFR figures — they are folded
        # by the named liquidity projection, not a CoA balance — so gl_categories
        # is empty and the fold is the authoritative source (like the credit
        # family). The HQLA numerator + LCR ratio have live substrate; the NSFR /
        # term-funding lines need real funding positions (licence-day).
        gl_categories=[],
        entity_scope="bank",
        # NOT a blanket licence-day form: the HQLA / LCR-numerator cells have live
        # substrate. The per-cell sourced-vs-licence-day decision is made in
        # build_cell via liquidity_cell_status(); this flag is the DEFAULT for a
        # cell that does not match a live-substrate predicate.
        licence_day=True,
        liquidity_family=True,
        status_note=(
            "Liquidity-risk figures fold from the BA-300 LCR / NSFR projections over the "
            "cash-flow events plus the HQLA stock fold over SecurityMaster. The HQLA "
            "classifier (platform/collateral/hqla-classifier.ts), the HQLA stock fold "
            "(platform/reporting/hqla-stock.ts) and the BA-300 LCR fold "
            "(platform/reporting/ba-300-lcr.ts) exist as substrate; the deposit-funding / "
            "NSFR cells require real deposit and funding positions which the bank-in-"
            "formation does not book pre-licence-day, so those values are licence-day data. "
            "The product-attribute dataRequirements — deposit funding-stability / category / "
            "maturity, HQLA asset level / eligibility / haircut — bind now so a future "
            "deposit / HQLA-eligible product is correctly gated. No silent fabrication."
        ),
    ),
    "BA310": dict(
        name="Minimum Liquid Reserve Balance and Liquid Assets (HQLA)",
        obligation="ORG-PR-RETURNS-011",
        clause=(
            "SARB PA Directive D5/2025 §2.1.12 (form BA 310, Annexure 11A/11B) read with the "
            "Regulations relating to Banks reg 26 (liquidity risk) and reg 27 (minimum reserve "
            "balance / minimum liquid assets) and the South African Reserve Bank Act 90 of 1989 "
            "cash-reserve requirement; Banks Act 94 of 1990 s.6(6)(a). [Post-#1451 corrected row "
            "(D-BA-RETURN-NUMBERING-EXCEL-CANONICAL): per the canonical SARB Excel form schedule, "
            "form BA 310 is the MINIMUM LIQUID RESERVE BALANCE AND LIQUID ASSETS (HQLA) return; "
            "the verbatim §2.1.12 'market risk' annotation in the obligation record is the "
            "documented fabrication the correction supersedes — market risk is BA 320.]"
        ),
        fold="ba310-min-reserve-liquid-assets-fold",
        # BA 310 reserve / liquid-asset balances fold from the BA-310 minimum-
        # reserve fold over the level-1 HQLA stock (gold, treasury bills, central-
        # bank reserves, securities) + the reserve-balance computation off the
        # liabilities base (which ties to BA 100 line R0790). No single GL category
        # holds the computed reserve; the fold is the authoritative source.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,
        liquidity_family=True,
        status_note=(
            "Minimum-reserve / liquid-asset figures fold from the BA-310 reserve fold over the "
            "level-1 HQLA stock (gold, treasury bills, central-bank reserves, eligible "
            "securities) plus the reserve-balance computation off the liabilities base (ties to "
            "BA 100 R0790). The HQLA classifier and SecurityMaster exist as substrate; the "
            "reserve balance requires the real liabilities base and held liquid-asset positions, "
            "which the bank-in-formation does not book pre-licence-day, so those values are "
            "licence-day data. The product-attribute dataRequirements — HQLA asset level / "
            "eligibility / repo-eligibility — bind now so a future HQLA-eligible product is "
            "correctly gated. No silent fabrication."
        ),
    ),
    # -----------------------------------------------------------------------
    # Phase C batch 4 — the MARKET FAMILY (BA 320 / BA 325 / BA 330 / BA 340 /
    # BA 350). These carry product-attribute requirements a TRADING / banking-book
    # product must capture — trading-book designation, risk class (GIRR / FX / EQ /
    # CSR / COMM), derivative type, banking-vs-trading book, equity holding class,
    # repricing/rate-type — but MODESTLY: market risk is largely per-trade /
    # position-derived, so the product-static attributes are few and the
    # `required:true` set is small (the brief). The genuine product-static edges
    # attach to FUTURE, unapproved market product ids (NOT the live FX product),
    # so the NPA gate never wrongly blocks `prd:bank:fx:otc-vanilla`.
    #
    # SUBSTRATE: BA 320 (Market Risk) has LIVE substrate — the
    # `ba-320-market-risk.ts` standardised-position-risk fold + the FX / IR / bond
    # event adapters + the VaR engine. So a BA 320 aggregate market-risk / RWA cell
    # whose value folds from the live engine is `sourced` (the source exists;
    # values are an honest 0/real-FX until positions land). BA 325 / 330 / 340 / 350
    # have no live trading-book / treasury / IRRBB / equity-banking-book /
    # derivatives positions book pre-licence-day, so their cells are
    # `licence-day-data` (the folds exist as substrate). A cell carrying a required
    # PRODUCT-ID attribute on an unapproved future product is forced licence-day
    # (the `market_cell_status` coupling, mirroring the liquidity family).
    # -----------------------------------------------------------------------
    "BA320": dict(
        name="Market Risk",
        obligation="ORG-PR-RETURNS-012",
        clause=(
            "SARB PA Directive D5/2025 §2.1.13 (form BA 320 — Market Risk, Annexure 12A) read "
            "with the Regulations relating to Banks reg 28 (market risk / position risk: "
            "interest-rate, equity, foreign-exchange incl. gold, commodity; specific + general "
            "risk; the internal-models VaR approach subject to PA approval) and Basel "
            "MAR (the standardised position-risk / FRTB-SA market-risk framework); Banks Act 94 "
            "of 1990 s.6(6)(a). [Post-#1451 corrected row (D-BA-RETURN-NUMBERING-EXCEL-CANONICAL): "
            "per the canonical SARB Excel form schedule (cell A1 = 'Market Risk'), form BA 320 is "
            "THE Market Risk return — the prior 'alternative market-risk return' framing is the "
            "documented fabrication the correction supersedes. The FRTB-SA charge feeds BA 320; "
            "the standalone FRTB workbook is the separate schemas/FRTB.zip.]"
        ),
        fold="ba320-market-risk-fold",
        # BA 320 cells fold from the ba-320-market-risk.ts standardised-position-risk
        # engine over the FX / IR / bond / equity exposure adapters + the VaR engine.
        # No single GL category holds the market-risk charge — it is folded by the
        # named market-risk projection, not a CoA balance — so gl_categories is empty
        # and the fold is the authoritative source. The FX risk class has LIVE
        # substrate (the FX adapter reads real FX positions); the per-cell sourced-vs-
        # licence-day split is made in build_cell via market_cell_status().
        gl_categories=[],
        entity_scope="bank",
        # NOT a blanket licence-day form: the live market-risk fold + FX adapter +
        # VaR engine exist. The per-cell decision is made in market_cell_status();
        # this flag is the DEFAULT for a cell that does not match a live-substrate
        # predicate.
        licence_day=True,
        market_family=True,
        status_note=(
            "Market-risk figures fold from the ba-320-market-risk.ts standardised-position-risk "
            "engine (BCBS MAR / Reg 28 — IR specific + general, equity, FX incl. gold, commodity) "
            "over the FX / IR / bond / equity event adapters plus the VaR engine "
            "(platform/market-risk/var-engine.ts). The market-risk fold, the FX adapter and the "
            "VaR engine exist as substrate; the trading-book exposures that fill most cells "
            "require a real trading book, which the bank-in-formation does not run at scale pre-"
            "licence-day, so those values are licence-day data. The FX risk-class aggregate cells "
            "have live FX substrate (sourced). The product-attribute dataRequirements — trading-"
            "book designation, risk class, position side — bind now so a future trading product "
            "is correctly gated. No silent fabrication."
        ),
    ),
    "BA325": dict(
        name="Selected Risk Exposure Arising from Trading and Treasury Activities",
        obligation="ORG-PR-RETURNS-013",
        clause=(
            "SARB PA Directive D5/2025 §2.1.14 (form BA 325 — Selected Risk Exposure Arising "
            "from Trading and Treasury Activities, Annexure 13A/13B) read with the Regulations "
            "relating to Banks reg 28 (market / position risk) and reg 29 (daily selected-risk "
            "exposure: trading & treasury) and Basel MAR (market risk); Banks Act 94 of 1990 "
            "s.6(6)(a). [Post-#1451 corrected row (D-BA-RETURN-NUMBERING-EXCEL-CANONICAL): per "
            "the canonical SARB Excel form schedule (cell A1 = 'Selected Risk Exposure Arising "
            "from Trading and Treasury Activities'), form BA 325 is the trading/treasury "
            "selected-risk-exposure return — it carries a market-risk-requirement summary, a "
            "counterparty-risk memorandum and a liquidity summary (incl. an LCR line), but it is "
            "NOT the FRTB return and NOT the LCR return. Market risk proper is BA 320; the LCR "
            "return is BA 300. The 'BA 325 = FRTB' label is the documented fabrication the "
            "correction supersedes.]"
        ),
        fold="ba325-selected-risk-exposure-fold",
        # BA 325 selected-risk-exposure cells fold from the trading/treasury
        # selected-risk fold over the market-risk-requirement summary + the
        # counterparty-risk memorandum + the SARB-repo / liquidity summary. No GL
        # category holds these; the fold is the authoritative source.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no real trading/treasury selected-risk positions pre-licence-day
        market_family=True,
        status_note=(
            "Selected-risk-exposure figures (market-risk-requirement summary, counterparty-risk "
            "memorandum — OTC / SFT / credit-derivative, SARB-repo liquidity summary, VaR / sVaR / "
            "IRC, daily LCR summary line) fold from the trading/treasury selected-risk fold over "
            "the market-risk fold + the counterparty-risk + liquidity substrate. The folds exist "
            "as substrate; the trading & treasury selected-risk positions that fill the cells "
            "require a real trading book, which the bank-in-formation does not run pre-licence-"
            "day, so those values are licence-day data. The product-attribute dataRequirements — "
            "trading-book designation, risk class, counterparty-exposure type — bind now so a "
            "future trading product is correctly gated. No silent fabrication."
        ),
    ),
    "BA330": dict(
        name="Interest Rate Risk: Banking Book (IRRBB)",
        obligation="ORG-PR-RETURNS-014",
        clause=(
            "SARB PA Directive D5/2025 §2.1.15 (form BA 330 — Interest Rate Risk: Banking Book "
            "(IRRBB), Annexure 14A) read with SARB PA Directive 2 of 2023 (the IRRBB repricing-"
            "gap return, issued in terms of regulation 30 of the Regulations relating to Banks) "
            "and Basel IRRBB (the SRP 31 / IRRBB standard — EVE and NII under the prescribed "
            "interest-rate shock scenarios); Banks Act 94 of 1990 s.6(6)(a). [Post-#1451 "
            "corrected row: per the canonical SARB Excel form schedule (cell A1 = 'INTEREST RATE "
            "RISK: BANKING BOOK'), form BA 330 is the IRRBB repricing-gap return (Reg 30 / "
            "D2/2023); the prior 'large exposures' annotation is the documented fabrication the "
            "correction supersedes — large exposures is BA 210.]"
        ),
        fold="ba330-irrbb-fold",
        # IRRBB cells fold from the IRRBB repricing-gap fold over the banking-book
        # interest-rate-sensitive positions decomposed into repricing maturity bands
        # + the EVE / NII shock computation. No GL category holds the repricing
        # ladder or the shocked EVE/NII; the fold is the authoritative source.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no real banking-book interest-rate positions pre-licence-day
        market_family=True,
        status_note=(
            "IRRBB figures (the repricing-gap ladder by maturity band, the net static / "
            "cumulative gap, and the EVE / NII impact under the prescribed parallel-up / "
            "parallel-down / steepener / flattener / short-rate shock scenarios) fold from the "
            "ba330-irrbb-fold over the banking-book interest-rate-sensitive positions. The fold "
            "exists as substrate; the banking-book positions that fill the repricing ladder "
            "require a real banking book, which the bank-in-formation does not run pre-licence-"
            "day, so those values are licence-day data. The product-attribute dataRequirements — "
            "banking-book designation, repricing profile, rate type (fixed / variable / "
            "benchmark / discretionary) — bind now so a future banking-book product is correctly "
            "gated. No silent fabrication."
        ),
    ),
    "BA340": dict(
        name="Equity Risk in the Banking Book",
        obligation="ORG-PR-RETURNS-015",
        clause=(
            "SARB PA Directive D5/2025 §2.1.16 (form BA 340 — Equity Risk in the Banking Book, "
            "Annexure 15A/15B) read with the Regulations relating to Banks reg 31 (equity risk "
            "in the banking book — the simple-risk-weight method, the internal-models approach, "
            "and the holding-class breakdown) and Basel CRE (the banking-book equity framework); "
            "Banks Act 94 of 1990 s.6(6)(a). [Post-#1451 corrected row: per the canonical SARB "
            "Excel form schedule (cell A1 = 'Equity Risk in the Banking Book'), form BA 340 is "
            "the banking-book equity-risk return; the prior 'IRRBB' annotation is the documented "
            "fabrication the correction supersedes — IRRBB is BA 330.]"
        ),
        fold="ba340-equity-risk-banking-book-fold",
        # Banking-book equity-risk cells fold from the equity-risk fold over the
        # banking-book equity holdings (listed / unlisted / speculative) + the
        # simple-risk-weight / IMA capital computation. No GL category holds the
        # risk-weighted equity exposure; the fold is the authoritative source.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no real banking-book equity holdings pre-licence-day
        market_family=True,
        status_note=(
            "Banking-book equity-risk figures (the equity exposure value, risk-weighted "
            "exposure and capital requirement by holding class — listed / unlisted / speculative "
            "— under the simple-risk-weight method and the internal-models approach) fold from "
            "the ba340-equity-risk-banking-book-fold over the banking-book equity holdings. The "
            "fold exists as substrate; the banking-book equity holdings that fill the cells "
            "require real equity investments held in the banking book, which the bank-in-"
            "formation does not hold pre-licence-day, so those values are licence-day data. The "
            "product-attribute dataRequirements — banking-book designation, equity holding class, "
            "equity risk-weight method — bind now so a future banking-book equity product is "
            "correctly gated. No silent fabrication."
        ),
    ),
    "BA350": dict(
        name="Derivatives Instruments",
        obligation="ORG-PR-RETURNS-016",
        clause=(
            "SARB PA Directive D5/2025 §2.1.17 (form BA 350 — Derivatives Instruments, "
            "Annexure 16A/16B) read with the Regulations relating to Banks reg 28 (market risk: "
            "derivative positions in the trading and banking book) and reg 23(15)–(19) "
            "(counterparty credit risk on derivatives) and Basel MAR / CRE (derivative notional "
            "+ fair-value reporting); Banks Act 94 of 1990 s.6(6)(a). [Post-#1451 corrected row: "
            "per the canonical SARB Excel form schedule (cell A1 = 'DERIVATIVES INSTRUMENTS'), "
            "form BA 350 is the derivatives-instruments return (gross notional + fair value by "
            "instrument type, exchange-traded vs OTC, trading vs banking book); the prior "
            "'credit concentration risk' annotation is the documented fabrication the correction "
            "supersedes — credit concentration / large exposures is BA 210.]"
        ),
        fold="ba350-derivatives-instruments-fold",
        # Derivative-instrument cells fold from the derivatives-instruments fold over
        # the derivative book (futures / options / swaps / forwards / FRAs) by
        # underlying asset class, exchange-traded vs OTC, trading vs banking book,
        # gross notional + fair value. No GL category holds the per-instrument-type
        # notional / MtM grid; the fold is the authoritative source.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no real derivative book pre-licence-day
        market_family=True,
        status_note=(
            "Derivative-instrument figures (gross notional amounts and fair value of outstanding "
            "contracts by instrument type — futures / call+put options written/purchased / swaps "
            "/ forwards+FRAs — by underlying asset class, exchange-traded vs OTC, trading vs "
            "banking book, and maturity band) fold from the ba350-derivatives-instruments-fold "
            "over the derivative book. The fold exists as substrate; the derivative positions "
            "that fill the notional / fair-value grid require a real derivative book, which the "
            "bank-in-formation does not run at scale pre-licence-day, so those values are "
            "licence-day data. The product-attribute dataRequirements — derivative type, "
            "trading-vs-banking book designation, underlying asset class — bind now so a future "
            "derivative product is correctly gated. No silent fabrication."
        ),
    ),
    # -----------------------------------------------------------------------
    # Phase C batch 5 — the CAPITAL FAMILY (BA 700 / BA 701). The APEX prudential
    # returns: BA 700 (Capital Adequacy and Leverage and TLAC) is the primary
    # capital-adequacy return — the CET1/T1/Total capital ratios, the leverage
    # ratio, the TLAC requirement; BA 701 (Regulatory vs Economic Capital) is the
    # reconciliation of regulatory capital to internal economic capital by risk
    # type (the ICAAP economic-capital demand vs the Pillar-1 regulatory charge).
    #
    # CAPITAL IS GL-/RWA-DERIVED — NOT product-attribute-driven. The capital
    # NUMERATOR is the bank's OWN capital-classified GL (CET1 / AT1 / T2 share
    # capital, reserves, retained earnings, regulatory deductions). The RWA
    # DENOMINATOR aggregates the OTHER returns' RWA (credit BA 200 + market BA 320
    # + operational BA 400 + CCR + CVA + equity). Neither side keys off a product-
    # static menu attribute: a capital cell does not gate a trading/credit/deposit
    # product the way a credit/liquidity/market cell does. So — per the brief —
    # the capital family carries ZERO product-attribute requirements (no
    # `capital_product_attributes`). We do NOT manufacture any (no bulk-marking).
    #
    # SUBSTRATE + STATUS (licence-day-heavy). The BA 700 capital projection
    # (platform/reporting/ba-700-capital.ts: generateBa100Capital — CET1/AT1/T2
    # tiers, RWA decomposition, ratios) and the leverage-ratio projection
    # (platform/reporting/ba-700-leverage-ratio.ts) exist as substrate, and the
    # RWA inputs thread the RwaComputed projection. BUT there is NO real capital
    # pre-licence-day — the R300m is a licence-day TARGET, not a present balance —
    # so the achieved capital amounts, the RWA amounts, the achieved ratios, the
    # excess/shortfall and BA 701's economic-capital figures are all
    # `licence-day-data`. The cells that the projection genuinely computes TODAY
    # WITHOUT real capital — the regulatory MINIMUM-REQUIRED ratios and buffer
    # add-ons (computeRequiredMinimums + BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS:
    # base CET1 4.5% / T1 6% / Total 8% + conservation 2.5% + CCyB / D-SIB /
    # Pillar-2A) and the specified minimum leverage ratio
    # (BCBS_LEVERAGE_RATIO_REGULATORY_MINIMUM = 3%) — are `sourced` (the source
    # genuinely exists; values fold from BCBS/Reg-38 constants, not from capital
    # data). The per-cell split is made in capital_cell_status().
    # -----------------------------------------------------------------------
    "BA700": dict(
        name="Capital Adequacy and Leverage and TLAC",
        obligation="ORG-PR-RETURNS-022",
        clause=(
            "SARB PA Directive D5/2025 §2.1.23 (form BA 700, Annexure 22A/22B) read with the "
            "Regulations relating to Banks reg 38 (capital adequacy and leverage — qualifying "
            "capital CET1/AT1/T2, regulatory deductions, minimum ratios) and reg 38 (leverage) "
            "and the Banks Act 94 of 1990 s.70(2)/(2A)/(2B) (minimum capital and reserve funds "
            "on the aggregate-risk-weighted-exposure basis); Basel III CAP (definition of "
            "capital), the BCBS leverage-ratio framework (LEV §147-§165) and the TLAC term-sheet; "
            "Banks Act 94 of 1990 s.6(6)(a). [Post-#1451 corrected row "
            "(D-BA-RETURN-NUMBERING-EXCEL-CANONICAL): per the canonical SARB Excel form schedule "
            "(cell A1 = 'CAPITAL ADEQUACY AND LEVERAGE AND TLAC'), form BA 700 is THE primary "
            "capital-adequacy return — CET1/T1/Total capital ratios, the leverage ratio and TLAC. "
            "The prior 'BA 700 = prudent-valuation / additional-leverage disclosure' label in the "
            "obligation record (ORG-PR-RETURNS-022) and the prior 'capital adequacy = BA 100' "
            "scheme are the documented fabrications the correction supersedes — BA 100 is the "
            "Balance Sheet. PVA is a sub-line of this return (ORG-PR-PVA-012 line item 203), not "
            "its primary purpose.]"
        ),
        fold="ba700-capital-adequacy-fold",
        # BA 700 cells fold from the ba-700-capital.ts capital projection
        # (generateBa100Capital) over the period-close trial balance + the capital-
        # classification map + the RWA decomposition (RwaComputed) + the leverage-
        # ratio projection. No single GL CATEGORY holds the computed ratio/leverage/
        # TLAC cells — they are folded by the named capital projection — so
        # gl_categories is empty and the fold is the authoritative source (the
        # capital-classified GL accounts feed the fold's numerator). The minimum-
        # required-ratio / buffer cells are computed from regulatory constants
        # (sourced); the achieved-capital / RWA / ratio cells need real capital
        # (licence-day). The per-cell split is made in capital_cell_status().
        gl_categories=[],
        entity_scope="bank",
        # NOT a blanket licence-day form: the minimum-required-ratio / buffer / the
        # specified-minimum-leverage cells are computed from BCBS/Reg-38 constants.
        # The per-cell decision is made in capital_cell_status(); this flag is the
        # DEFAULT for a cell that does not match the regulatory-constant predicate.
        licence_day=True,
        capital_family=True,
        status_note=(
            "Capital-adequacy figures (qualifying CET1 / Tier 1 / Total capital and reserve "
            "funds, the RWA decomposition, the achieved CET1 / Tier 1 / Total capital-adequacy "
            "ratios, the leverage ratio, the excess/shortfall and the TLAC position) fold from "
            "the ba-700-capital.ts capital projection (generateBa100Capital — CET1/AT1/T2 tiers, "
            "deductions, RWA decomposition, ratios) and the ba-700-leverage-ratio.ts leverage "
            "projection over the period-close trial balance, the capital-classification map and "
            "the RWA decomposition (the RwaComputed projection — credit BA 200 + market BA 320 + "
            "operational BA 400 + CCR + CVA + equity). The capital + leverage projections exist "
            "as substrate; the achieved capital / RWA / ratio cells require REAL capital, which "
            "the bank-in-formation does not hold pre-licence-day (the R300m is a licence-day "
            "target, not a present balance), so those values are licence-day data. The regulatory "
            "MINIMUM-REQUIRED ratios and buffer add-ons (base CET1 4.5% / Tier 1 6% / Total 8% + "
            "conservation 2.5% + countercyclical / D-SIB / Pillar-2A) and the specified minimum "
            "leverage ratio (3%) are computed from BCBS / Reg-38 constants and are sourced. "
            "Capital is GL-/RWA-derived, so the return carries NO product-attribute requirement "
            "(no product-static menu pick gates a capital cell). No silent fabrication."
        ),
    ),
    "BA701": dict(
        name="Regulatory vs Economic Capital",
        obligation="ORG-PA-033",
        clause=(
            "SARB PA Directive D4/2025 (Completion of regulatory return: form BA 701) read with "
            "the Regulations relating to Banks reg 39 (the internal capital adequacy assessment "
            "process — ICAAP) and reg 38 (regulatory capital); Basel SRP (the supervisory review "
            "process — Pillar 2 / ICAAP economic capital) and CAP; Banks Act 94 of 1990 "
            "s.6(6)(a). [Post-#1451 corrected row (D-BA-RETURN-NUMBERING-EXCEL-CANONICAL): per "
            "the canonical SARB Excel form schedule (cell A1 = 'BA701 - REGULATORY vs ECONOMIC "
            "CAPITAL'), form BA 701 is the REGULATORY-vs-ECONOMIC-CAPITAL reconciliation return — "
            "it reconciles the Pillar-1 regulatory capital charge per risk type to the bank's "
            "internal economic-capital demand (gross / diversification / net, at the bank's "
            "stated confidence interval), with a 3-year forecast. The verbatim 'recovery planning "
            "and resolution' requirement annotation in the obligation record (ORG-PA-033) is the "
            "documented mislabel the correction supersedes — the Excel form A1 header and the "
            "form's row/column structure (economic-capital demand vs regulatory capital by risk "
            "type) are authoritative. The obligation ID is cited; only the interpretation is "
            "corrected.]"
        ),
        fold="ba701-regulatory-vs-economic-capital-fold",
        # BA 701 cells fold from the regulatory-vs-economic-capital reconciliation
        # fold over the BA 700 regulatory-capital projection (the @8% regulatory
        # charge per risk type) + the economic-capital model (ICAAP economic-capital
        # demand, gross/diversification/net at the stated confidence interval). The
        # regulatory-capital side reuses the ba-700-capital RWA decomposition; the
        # economic-capital side needs the ICAAP economic-capital engine (CRO/Helena
        # methodology) and real positions. No single GL category holds these; the
        # fold is the authoritative source.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no real capital / economic-capital model output pre-licence-day
        capital_family=True,
        status_note=(
            "Regulatory-vs-economic-capital figures (the Pillar-1 regulatory capital charge per "
            "risk type @8% RWA — credit / CCR / CVA / market / operational / equity / other — "
            "reconciled to the internal economic-capital demand (gross, intra-/inter-risk "
            "diversification, net) at the bank's stated confidence interval, with the 3-year "
            "forecast) fold from the ba701-regulatory-vs-economic-capital-fold over the BA 700 "
            "regulatory-capital projection plus the ICAAP economic-capital model. The regulatory-"
            "capital side reuses the ba-700-capital RWA decomposition (substrate exists); the "
            "economic-capital side requires the ICAAP economic-capital engine output and REAL "
            "positions, which the bank-in-formation does not have pre-licence-day (no real "
            "capital — the R300m is a licence-day target). The confidence-interval and "
            "operational-risk coefficient inputs are ICAAP-methodology reference inputs (CRO / "
            "Helena domain). All economic-capital and reconciliation values are licence-day data. "
            "Capital is GL-/RWA-derived, so the return carries NO product-attribute requirement. "
            "No silent fabrication."
        ),
    ),
    # -----------------------------------------------------------------------
    # Phase C batch 6 — the OPERATIONAL FAMILY (BA 400 / BA 410 / BA 420). The
    # operational-risk capital return + its two loss companions.
    #
    # OPERATIONAL RISK IS ENTITY-LEVEL — NOT product-attribute-driven. The
    # BIA / TSA capital is computed from the bank's ANNUAL GROSS INCOME (an
    # income-statement aggregate, per business line for TSA) — an entity-level
    # figure, not a product-static menu attribute. The BA 410 / BA 420 loss
    # returns capture INDIVIDUAL OPERATIONAL-LOSS EVENTS, attributed to a Basel
    # business line and a risk-event type at loss-capture time by the org unit —
    # again entity-level, not a product's static menu pick. So — like the capital
    # family, and per the brief ("expect MINIMAL … mark required only where
    # genuinely product-determined; no manufacture") — the operational family
    # carries ZERO product-attribute requirements (there is deliberately no
    # `operational_product_attributes()`; no bulk-marking, no fabrication). The
    # NPA gate sees no operational product-attribute edge, so no product — and in
    # particular the live FX product `prd:bank:fx:otc-vanilla` — is wrongly
    # blocked by an operational cell.
    #
    # SUBSTRATE + STATUS (licence-day-heavy — the known GAP-BA700-OPERATIONAL-RWA).
    #   BA 400: the op-risk projection (platform/reporting/ba-400-op-risk.ts:
    #     generateBa300OpRisk — BIA α=15% / TSA β-weighted gross income, op-RWA =
    #     12.5 × op-capital) exists as substrate. The REGULATORY-CONSTANT cells —
    #     the BIA α factor, the per-business-line β factors, the 12.5× RWA
    #     multiplier, the loss-component / ILM floor coefficients — are computed
    #     from BCBS D196 / Reg 33 constants and are `sourced` (the source genuinely
    #     exists; the value is the regulatory constant, not a fabricated figure).
    #     Every gross-income amount, the computed op-capital, the op-RWA and the
    #     ILM are `licence-day-data`: no audited 3-year gross-income history and no
    #     loss history exist pre-licence-day (GAP-BA700-OPERATIONAL-RWA). The
    #     per-cell split is made in operational_cell_status().
    #   BA 410 / BA 420: wholly `licence-day-data` — every cell reports an actual
    #     operational-LOSS amount / count / date / risk-event-type, and the bank-
    #     in-formation has booked no operational losses pre-licence-day. The
    #     OperationalLossEvent stream + the loss-event register exist as substrate;
    #     the values are licence-day data (no loss history to aggregate yet).
    # -----------------------------------------------------------------------
    "BA400": dict(
        name="Operational Risk",
        obligation="ORG-PR-RETURNS-017",
        clause=(
            "SARB PA Directive D5/2025 §2.1.18 (form BA 400 — Operational Risk, Annexure 17A/17B) "
            "read with the Regulations relating to Banks reg 33 (operational risk — the basic-"
            "indicator approach (BIA) and the standardised approach (TSA) on annual gross income; "
            "and, on the SARB transition, the BCBS standardised approach (SMA / new SA) business-"
            "indicator + internal-loss-multiplier framework) and BCBS D196 §645–§654 (op-risk "
            "measurement) / BCBS OPE (the revised operational-risk standard); Banks Act 94 of "
            "1990 s.6(6)(a). [Post-#1451 corrected row (D-BA-RETURN-NUMBERING-EXCEL-CANONICAL): "
            "per the canonical SARB Excel form schedule (cell A1 = 'Operational Risk'), form "
            "BA 400 is THE operational-risk return (the op-risk capital charge feeds the BA 700 "
            "RWA denominator). The verbatim 'BA 400 = leverage ratio return' annotation in the "
            "obligation record (ORG-PR-RETURNS-017) is the documented fabrication the correction "
            "supersedes — leverage ratio is reported within BA 700 (Capital Adequacy and Leverage "
            "and TLAC) per Reg 38A.]"
        ),
        fold="ba400-operational-risk-fold",
        # BA 400 cells fold from the ba-400-op-risk.ts op-risk projection
        # (generateBa300OpRisk — BIA / TSA gross-income → op-capital, op-RWA =
        # 12.5 × op-capital) over the annual gross-income inputs (an income-
        # statement aggregate). No single GL category holds the op-risk charge —
        # it is folded by the named op-risk projection from gross income, not a CoA
        # balance — so gl_categories is empty and the fold is the authoritative
        # source. The α / β / 12.5× regulatory constants are sourced; the gross-
        # income / capital / RWA / ILM cells need real audited gross income +
        # loss history (licence-day). The per-cell split is made in
        # operational_cell_status().
        gl_categories=[],
        entity_scope="bank",
        # NOT a blanket licence-day form: the BIA α / business-line β / 12.5× RWA
        # multiplier / ILM-floor cells are computed from BCBS D196 / Reg 33
        # constants. The per-cell decision is made in operational_cell_status();
        # this flag is the DEFAULT for a cell that does not match the regulatory-
        # constant predicate.
        licence_day=True,
        operational_family=True,
        status_note=(
            "Operational-risk figures fold from the ba-400-op-risk.ts op-risk projection "
            "(generateBa300OpRisk — the basic-indicator approach α=15% × average positive annual "
            "gross income, the standardised approach 1/3 × Σ max(0, Σ β_i × gross_income_i) per "
            "Basel business line, and op-RWA = 12.5 × op-capital) over the annual gross-income "
            "inputs. The op-risk projection exists as substrate; the achieved op-capital / op-RWA "
            "and the per-year, per-business-line gross-income cells require REAL audited gross "
            "income over (steady-state) three financial years and the operational-loss history "
            "that the internal-loss-multiplier needs, which the bank-in-formation does not have "
            "pre-licence-day (the known GAP-BA700-OPERATIONAL-RWA), so those values are licence-"
            "day data. The BIA α factor, the per-business-line β factors and the 12.5× RWA "
            "multiplier ARE BCBS D196 / BCBS OPE / Reg 33 regulatory constants — but they are "
            "applied as COEFFICIENTS inside the ba-400-op-risk.ts fold (BIA_ALPHA, "
            "BUSINESS_LINE_BETA, the ×12.5 in generateBa300OpRisk), not reported as BA 400 form "
            "cells, so no reported cell populates from a constant alone (every reported cell needs "
            "real gross income / loss history); the constants' sourced-ness lives in the engine's "
            "unit tests, not in a form cell. Operational risk is gross-income- and loss-event-"
            "derived (entity-level), so the return carries NO product-attribute requirement (no "
            "product-static menu pick gates an operational cell). Op-risk methodology is the CRO "
            "(Helena) / COO (Devon) domain. No silent fabrication."
        ),
    ),
    "BA410": dict(
        name="Operational Risk: Quarterly Losses",
        obligation="ORG-PR-RETURNS-018",
        clause=(
            "SARB PA Directive D5/2025 §2.1.19 (form BA 410 — Operational Risk: Quarterly Losses, "
            "Annexure 18A/18B) read with the Regulations relating to Banks reg 33 (operational "
            "risk — the operational-loss-data collection that underpins the loss component / "
            "internal-loss multiplier) and BCBS OPE25 (the loss-data standards: the risk-event-"
            "type taxonomy, the gross-loss / recovery / net-loss measurement, the date-of-"
            "occurrence / discovery / accounting); Banks Act 94 of 1990 s.6(6)(a). [Post-#1451 "
            "corrected row (D-BA-RETURN-DATA-CONTRACT Phase A): per the canonical SARB Excel form "
            "schedule (cell A1 = 'Operational Risk: Quarterly Losses'), form BA 410 is the "
            "quarterly operational-loss return (the loss companion to the BA 400 operational-risk "
            "return; see also BA 420 12-Months Rolling Losses). The verbatim 'BA 410 = Pillar 3 "
            "disclosure return' annotation in the obligation record is the documented fabrication "
            "the correction supersedes.]"
        ),
        fold="ba410-quarterly-losses-fold",
        # BA 410 cells fold from the quarterly-operational-loss fold over the
        # OperationalLossEvent stream / the loss-event register (gross loss,
        # recoveries, net loss, by Basel business line + risk-event type, with the
        # occurrence / discovery / accounting dates). No GL category holds the
        # per-event loss grid; the fold is the authoritative source.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no operational-loss history pre-licence-day
        operational_family=True,
        status_note=(
            "Quarterly operational-loss figures (individual operational-loss events — gross loss, "
            "recoveries, net loss — attributed to a Basel business line and a risk-event type "
            "(internal fraud, external fraud, employment practices, clients/products/business "
            "practices, damage to physical assets, business disruption / system failures, "
            "execution / delivery / process management), with the date of occurrence / discovery "
            "/ accounting) fold from the ba410-quarterly-losses-fold over the OperationalLossEvent "
            "stream and the loss-event register. The OperationalLossEvent stream and the loss-"
            "event register exist as substrate; every cell reports an actual operational-loss "
            "amount / count / date / risk-event-type, and the bank-in-formation has booked no "
            "operational losses pre-licence-day, so those values are licence-day data (no loss "
            "history to aggregate yet — the known GAP-BA700-OPERATIONAL-RWA). Operational losses "
            "are captured per-event at the entity (business-line) level, so the return carries NO "
            "product-attribute requirement. Op-risk methodology is the CRO (Helena) / COO (Devon) "
            "domain. No silent fabrication."
        ),
    ),
    "BA420": dict(
        name="12-Months Rolling Losses",
        obligation="ORG-PR-RETURNS-018B",
        clause=(
            "SARB PA Directive D5/2025 §2.1.19 (form BA 420 — 12-Months Rolling Losses, the "
            "rolling-window companion to BA 410, Annexure 18A/18B) read with the Regulations "
            "relating to Banks reg 33 (operational risk — the rolling 12-month operational-loss "
            "aggregation feeding the loss component / internal-loss multiplier) and BCBS OPE25 "
            "(the loss-data standards); Banks Act 94 of 1990 s.6(6)(a). [Post-#1451 row "
            "(D-BA-RETURN-DATA-CONTRACT Phase C batch 6): per the canonical SARB Excel form "
            "schedule (cell A1 = '12-Months Rolling Losses'), form BA 420 is the 12-month rolling "
            "operational-loss return — the same per-event loss data as BA 410, aggregated over a "
            "trailing 12-month window. BA 420 had no dedicated obligation row pre-batch-6 "
            "(ORG-PR-RETURNS-019 is BA 500 — Securitisation Schemes); ORG-PR-RETURNS-018B is "
            "authored this batch as the BA 420 sibling under the same D5/2025 §2.1.19 operational-"
            "loss-reporting provision, explicitly cross-referenced by ORG-PR-RETURNS-018's "
            "correction note.]"
        ),
        fold="ba420-rolling-losses-fold",
        # BA 420 cells fold from the 12-month-rolling-operational-loss fold over
        # the OperationalLossEvent stream / the loss-event register, aggregated
        # over a trailing 12-month window (gross / recovery / net loss by business
        # line + risk-event type). No GL category holds the rolling-loss grid; the
        # fold is the authoritative source.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no operational-loss history pre-licence-day
        operational_family=True,
        status_note=(
            "12-month rolling operational-loss figures (the same individual operational-loss "
            "events as BA 410 — gross loss, recoveries, net loss by Basel business line and risk-"
            "event type — aggregated over a trailing 12-month window) fold from the "
            "ba420-rolling-losses-fold over the OperationalLossEvent stream and the loss-event "
            "register. The OperationalLossEvent stream and the loss-event register exist as "
            "substrate; every cell reports an actual rolling operational-loss amount / count, and "
            "the bank-in-formation has booked no operational losses pre-licence-day, so those "
            "values are licence-day data (no rolling-window loss history to aggregate yet — the "
            "known GAP-BA700-OPERATIONAL-RWA). Operational losses are captured per-event at the "
            "entity (business-line) level, so the return carries NO product-attribute "
            "requirement. Op-risk methodology is the CRO (Helena) / COO (Devon) domain. No silent "
            "fabrication."
        ),
    ),
    # -----------------------------------------------------------------------
    # Phase C batch 7 — the SECURITISATION + GOVERNANCE/LIMITS family
    # (BA 500 / BA 501 / BA 125 / BA 130).
    #
    # BA 500 (Securitisation Schemes) + BA 501 (Special-purpose institutions
    # schemes) carry genuine PRODUCT-ATTRIBUTE requirements a SECURITISATION
    # product must capture — the securitisation ROLE (originator / sponsor /
    # investor / repackager), the regulatory APPROACH (SEC-IRBA / SEC-ERBA /
    # SEC-SA), the underlying ASSET CLASS, the TRANCHE/SENIORITY class, the credit
    # RATING (scale + score), the INSTRUMENT PROFILE (fixed / floating) + benchmark,
    # the RISK-RETENTION / credit-enhancement, and the SCHEME TRIGGERS. These attach
    # to the FUTURE, unapproved securitisation product `prd:bank:securitisation:scheme`
    # (NOT the live FX product), so the NPA gate never wrongly blocks
    # `prd:bank:fx:otc-vanilla`. The bank runs no securitisation pre-licence-day, so
    # every BA 500 / BA 501 cell is `licence-day-data` (honest: no schemes to report)
    # while the product-attribute dataRequirements bind NOW (the build-now value).
    #
    # BA 125 (Return regarding shareholders) + BA 130 (Restriction on investments,
    # loans and advances) are ENTITY-/PORTFOLIO-LEVEL governance/limits returns:
    # shareholders are the bank's OWN ownership structure (a party-register fold,
    # NOT a product attribute); investment restrictions are bank-wide prudential
    # limits on the bank's OWN investment/loan book (an exposure-aggregate fold).
    # Neither keys off a product-static menu attribute, so they carry ZERO product-
    # attribute requirements (no manufacture, no bulk-marking — per the brief's
    # ~0 expectation). Both are licence-day-data (no real third-party shareholders /
    # investment book pre-licence-day).
    # -----------------------------------------------------------------------
    "BA500": dict(
        name="Securitisation Schemes",
        obligation="ORG-PR-RETURNS-019",
        clause=(
            "SARB Prudential Authority Directive D5/2025 §2.1.20 (form BA 500 — Securitisation "
            "Schemes, Annexure 19A/19B) read with the Regulations relating to Banks reg 23(6)(h) "
            "(securitisation and resecuritisation exposures — the securitisation framework, "
            "SEC-IRBA / SEC-ERBA / SEC-SA hierarchy, risk-retention and significant-risk-transfer "
            "requirements) and the Securitisation Notice (Government Notice on securitisation "
            "schemes under Banks Act 94 of 1990 s.1(1) 'the business of a bank'); Basel CRE40–CRE45 "
            "(the securitisation framework); Banks Act 94 of 1990 s.6(6)(a). [Post-#1451 corrected "
            "row: BA 500 = Securitisation Schemes per the canonical SARB Excel form schedule; the "
            "prior 'remuneration return' annotation is the documented fabrication the correction "
            "supersedes — see ORG-PR-RETURNS-019.]"
        ),
        fold="ba500-securitisation-schemes-fold",
        # Securitisation exposures fold from the securitisation-schemes fold over the
        # securitisation-exposure register (by role / approach / asset class / tranche)
        # + the securitisation-RWA projection. No live GL category exists pre-licence-
        # day (the bank runs no securitisation scheme), so the fold is the
        # authoritative source.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no real securitisation schemes pre-licence-day
        securitisation_family=True,
        status_note=(
            "Securitisation-scheme figures (exposure, risk-weighted exposure, supervisory "
            "deductions and credit impairments by securitisation role — originator / sponsor / "
            "investor / repackager — regulatory approach SEC-IRBA / SEC-ERBA / SEC-SA, and "
            "underlying asset class) fold from the ba500-securitisation-schemes-fold over the "
            "securitisation-exposure register + the securitisation-RWA projection. The fold exists "
            "as substrate; the securitisation exposures that fill the cells require the bank to run "
            "or invest in a securitisation scheme, which the bank-in-formation does not pre-licence-"
            "day, so those values are licence-day data. The product-attribute dataRequirements — "
            "securitisation role, approach, asset class, tranche/seniority, risk-retention — bind "
            "now so a future securitisation product is correctly gated. No silent fabrication."
        ),
    ),
    "BA501": dict(
        name="Special-purpose institutions schemes",
        obligation="ORG-PR-RETURNS-029",
        clause=(
            "SARB Prudential Authority Directive D5/2025 §2.1.20 (form BA 500 — Securitisation "
            "Schemes) read with the Regulations relating to Banks reg 23(6)(h) (securitisation and "
            "resecuritisation) and the Securitisation Notice; Basel CRE40–CRE45 (the securitisation "
            "framework); Banks Act 94 of 1990 s.6(6)(a). [Provenance / honesty (Principle 2): form "
            "BA 501 (Special-purpose institutions schemes) is NOT enumerated as a separate Annexure "
            "in the D5/2025 §2.1 return schedule — that schedule lists BA 500 (Annexure 19A) then "
            "jumps to BA 600 (Annexure 20A). BA 501 is the SPECIAL-PURPOSE-INSTITUTION (SPV) "
            "companion form of the BA 500 Securitisation Schemes return: per-scheme detail on the "
            "special-purpose institution (the securitisation programme, its triggers, the tranche "
            "instruments — class / rating / instrument profile / benchmark — the underlying-asset "
            "pool, guarantees / credit enhancement, liquidity facilities and hedges). It is "
            "mandated under the same securitisation framework (Reg 23(6)(h) + the Securitisation "
            "Notice + the SARB securitisation directives D4/2017 (securitisation vehicles) and "
            "D10/2022 (STC criteria)) as the SPV-level disaggregation of BA 500. The obligation row "
            "ORG-PR-RETURNS-029 is authored for this form (no D5/2025 §-number is fabricated; the "
            "citation is the BA 500 §2.1.20 securitisation routing + the securitisation framework). "
            "The BA 501 schema package is xlsx-only (no XSD in the SARB Umoja set); the contract is "
            "machine-generated from the workbook Elements sheet (the same cell oracle the recon "
            "completeness check re-extracts for this form).]"
        ),
        fold="ba501-special-purpose-institutions-fold",
        # BA 501 SPV-detail cells fold from the special-purpose-institutions fold over
        # the per-scheme SPV register (programme / triggers / tranches / underlying
        # pool / guarantees / liquidity / hedges). No live GL category exists pre-
        # licence-day; the fold is the authoritative source.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no real special-purpose-institution schemes pre-licence-day
        securitisation_family=True,
        # BA 501 has no XSD — the recon completeness oracle re-extracts the cell
        # universe from the xlsx Elements sheet for this form (see the registry's
        # `xsdName: null` + the recon's xlsx fallback).
        xlsx_only=True,
        status_note=(
            "Special-purpose-institution (securitisation SPV) figures (per-scheme programme type, "
            "accounting policy, scheme triggers, tranche instruments by class / credit rating / "
            "instrument profile / interest-rate benchmark / issue + maturity dates, the underlying-"
            "asset pool by asset class with collateral and impairment staging, originator "
            "guarantees / credit enhancement, liquidity facilities and hedges) fold from the "
            "ba501-special-purpose-institutions-fold over the per-scheme SPV register. The fold "
            "exists as substrate; the SPV-scheme detail that fills the cells requires the bank to "
            "sponsor or invest in a securitisation special-purpose institution, which the bank-in-"
            "formation does not pre-licence-day, so those values are licence-day data. The product-"
            "attribute dataRequirements — securitisation role, tranche/seniority class, credit "
            "rating, instrument profile, scheme triggers, risk-retention — bind now so a future "
            "securitisation product is correctly gated. No silent fabrication."
        ),
    ),
    "BA125": dict(
        name="Return regarding shareholders",
        obligation="ORG-PR-RETURNS-005",
        clause=(
            "SARB Prudential Authority Directive D5/2025 §2.1.6 (form BA 125 — Return regarding "
            "shareholders, Annexure 5A/5B) read with the Banks Act 94 of 1990 s.37 (shareholding "
            "requirements — domestic and foreign shareholders; limits and Registrar approval), "
            "s.38 (acquisition of shareholding exceeding the prescribed threshold — prior PA "
            "approval), s.39 (furnishing of information by shareholders) and s.67 (disclosure of "
            "certain shareholders), read with the Regulations relating to Banks (shareholder / "
            "ownership analysis — ordinary, cumulative-preference and non-cumulative-preference "
            "share classes; domestic vs foreign); Banks Act s.6(6)(a). [Post-#1451 corrected row: "
            "BA 125 = Return regarding shareholders per the canonical SARB Excel form schedule; "
            "the prior 'additional liquidity monitoring / intraday liquidity' annotation is the "
            "documented fabrication the correction supersedes — see ORG-PR-RETURNS-005.]"
        ),
        fold="ba125-shareholders-fold",
        # Shareholder figures fold from the shareholders fold over the party register
        # (the bank's OWN ownership structure — shareholder identity, share class,
        # domestic/foreign, holding %). No GL category holds the ownership register;
        # the fold is the authoritative source. Shareholders are an ENTITY-level
        # attribute of the bank, NOT a product attribute (no product feeds BA 125).
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no real third-party shareholders pre-licence-day
        status_note=(
            "Shareholder figures (the bank's ownership structure by shareholder identity, share "
            "class — ordinary / cumulative-preference / non-cumulative-preference — domestic vs "
            "foreign holding, number of shares and holding percentage) fold from the "
            "ba125-shareholders-fold over the party register. The fold and the party register "
            "exist as substrate; the bank-in-formation has no real third-party shareholders pre-"
            "licence-day (the founding-capital ownership is registered at licence-day), so those "
            "values are licence-day data. Shareholders are the bank's OWN entity-level ownership, "
            "NOT a product attribute — BA 125 carries no product-attribute requirement. No silent "
            "fabrication."
        ),
    ),
    "BA130": dict(
        name="Restriction on investments, loans and advances",
        obligation="ORG-PR-RETURNS-006",
        clause=(
            "SARB Prudential Authority Directive D5/2025 §2.1.7 (form BA 130 — Restriction on "
            "investments, loans and advances, Annexure 6A) read with the Regulations relating to "
            "Banks reg 24 (investments, loans and advances — the prudential restriction on the "
            "bank's holdings of, and exposures to, associates / subsidiaries / connected persons "
            "not at arm's length) and the Banks Act 94 of 1990 s.77 (restriction on investments by "
            "a bank) and s.78 (undesirable practices); Banks Act s.6(6)(a). [Post-#1451 corrected "
            "row: BA 130 = Restriction on investments, loans and advances per the canonical SARB "
            "Excel form schedule; the prior 'liquidity stress-testing' annotation is the documented "
            "fabrication the correction supersedes — see ORG-PR-RETURNS-006.]"
        ),
        fold="ba130-investment-restrictions-fold",
        # Investment-restriction figures fold from the investment-restrictions fold
        # over the bank's OWN investment / loan / advance book aggregated against the
        # prudential limits (by associate / connected-person / arm's-length status).
        # No single GL category holds the computed limit-vs-actual; the fold is the
        # authoritative source. This is a PORTFOLIO-level prudential limit on the
        # bank's own book, NOT a product attribute.
        gl_categories=[],
        entity_scope="bank",
        licence_day=True,  # no real investment / loan book pre-licence-day
        status_note=(
            "Investment-restriction figures (the bank's investments, loans and advances to "
            "associates, subsidiaries and connected persons — incl. those not at arm's length — "
            "measured against the prudential restriction limits of Reg 24 / Banks Act s.77) fold "
            "from the ba130-investment-restrictions-fold over the bank's own investment / loan / "
            "advance book. The fold exists as substrate; the investment / loan positions that fill "
            "the cells require a real investment and lending book, which the bank-in-formation does "
            "not hold pre-licence-day, so those values are licence-day data. Investment "
            "restrictions are PORTFOLIO-level prudential limits on the bank's own book, NOT a "
            "product attribute — BA 130 carries no product-attribute requirement. No silent "
            "fabrication."
        ),
    ),
}

# ---------------------------------------------------------------------------
# XSD leaf-type → framework valueType + reporting unit + (for money) the form's
# default currency-dimension. P5: a monetary cell ALWAYS carries a dimension and
# NEVER a hard-coded currency. The schema's `unit` is a SCALE/measure, not a
# currency literal.
# ---------------------------------------------------------------------------
# The credit-family enum leaf types (BA 200 / BA 210). These are the SARB
# code-list types whose value is a constrained credit category — exposure class,
# asset class, connection type, industry, PD bucket, yes/no. They carry the
# real product-attribute semantics the credit family adds (see CREDIT_ATTRS).
CREDIT_ENUM_TYPES = (
    "ExposureTypeBA210",
    "ConnectionType",
    "AssetClass",
    "IndustryType",
    "PD_bucket",
)

# BA 300 (liquidity) carries two bespoke leaf base types beyond the common set:
#   - "Liquidity coverage ratio (LCR)" — the LCR ratio cell (HQLA / 30-day NCO).
#     It is a RATIO (a percentage expressed as a number), not money.
#   - "Specify concentration of deposit funding" — a free-text "specify…" cell on
#     the deposit-concentration sub-form (the counterparty/funding name), i.e.
#     text. The xlsx surfaces these names verbatim from the SARB Excel form; the
#     `_x0020_`-escaped XSD names map to the same human strings.
LIQUIDITY_LCR_RATIO_TYPE = "Liquidity coverage ratio (LCR)"
LIQUIDITY_SPECIFY_TEXT_TYPE = "Specify concentration of deposit funding"

# Securitisation / governance family enum leaf types (BA 501 / BA 125). These are
# SARB code-list types (Data-Types sheet `Base Data Type = enumeration`) whose
# value is a constrained category. They map to the framework `enum` valueType.
#   BA 501 (Special-purpose institutions schemes — securitisation SPV detail):
#     Programme / IFRS 9 / SchemeTriggers / Class / Rated / RatingScore /
#     InstrumentProfile / InterestRateBenchmark — the scheme/instrument/credit-
#     rating classification axes of a securitisation scheme.
#   BA 125 (Return regarding shareholders):
#     Foreign/Domestic — the domestic-vs-foreign shareholder split axis.
SECGOV_ENUM_TYPES = (
    "Programme",
    "IFRS 9",
    "SchemeTriggers",
    "Class",
    "Rated",
    "RatingScore",
    "InstrumentProfile",
    "InterestRateBenchmark",
    "Foreign/Domestic",
)

# BA 501 carries a bespoke date leaf type beyond the common `Date`:
#   "CP_Date" — a common-property full-date (dd/mm/yyyy) cell (completion date,
#   scheme dates). The Data-Types sheet records `Base Data Type = date`.
SECGOV_DATE_TYPE = "CP_Date"

# SARB `Number (n,2)` complexTypes (BA 210 / BA 220) are decimal cells. BA 220's
# `Number (14,2)` carries an explicit "Currency data type" XSD documentation
# string and reports rand-and-cents monetary amounts (historic cost, market
# value, NAV, credit facilities). BA 210's `Number (19,2)` cells report
# large-exposure amounts by asset class (performing / non-performing). Both are
# monetary (P5: a currency dimension, never a literal currency); the (n,2) scale
# is rand-and-cents, NOT thousands — so the reporting unit is `ZAR-units`.
NUMBER_DECIMAL_MONEY_TYPES = (
    "Number (14,2)",  # BA 220 — explicitly "Currency data type"
    "Number (19,2)",  # BA 210 — large-exposure amounts by asset class
)


def value_type_for(xsd_type: str) -> str:
    t = xsd_type or ""
    if t in ("Monetary1000", "Monetary1000NN"):
        # Monetary1000NN is the non-negative variant of Monetary1000 (BA 200 /
        # BA 210 use it for exposure / RWA cells that cannot go below zero).
        return "money"
    if t in NUMBER_DECIMAL_MONEY_TYPES:
        return "money"
    if t.startswith("Percentage"):
        return "ratio"
    if t == LIQUIDITY_LCR_RATIO_TYPE:
        # The BA 300 LCR cell is a ratio (HQLA / 30-day net cash outflows),
        # reported as a percentage value — a ratio cell, not money.
        return "ratio"
    if t == LIQUIDITY_SPECIFY_TEXT_TYPE:
        # The "specify…" deposit-concentration cell is free text.
        return "text"
    if t == "Numeric":
        # SARB `Numeric` carries non-scaled numeric values (factors, counts,
        # ratios-as-decimal). Treated as a ratio/number cell (no currency).
        return "ratio"
    if t == "Integer":
        return "count"
    if t in ("Date", SECGOV_DATE_TYPE):
        return "date"
    if t in ("Text", "IDType", "Currency"):
        return "text"
    if (
        t
        in (
            "EnumCountry",
            "ExposureType",
            "CP_YesNo",
            "RegulatoryApproach",
            "SourceOfCapital",
            # Operational family (BA 400 / BA 410): the SARB code-list types whose
            # value is a constrained category.
            #   - "YesNo" — a Yes/No response cell (BA 400 ILM-usage flag, BA 410
            #     "previously reported" / "status: ended" flags).
            #   - "RiskEventType" — the BA 410 operational-loss risk-event-type code
            #     (the Basel-II/Reg-33 loss-event-type taxonomy: internal fraud,
            #     external fraud, employment practices, clients/products/business
            #     practices, damage to physical assets, business disruption/system
            #     failures, execution/delivery/process management).
            "YesNo",
            "RiskEventType",
        )
        or t in CREDIT_ENUM_TYPES
        or t in SECGOV_ENUM_TYPES
    ):
        return "enum"
    # Any unmapped leaf type is surfaced loudly rather than silently coerced
    # (Engineering Charter cmd 5 — no silent deferral).
    raise SystemExit(
        f"FATAL: unmapped XSD leaf base type '{t}' — extend value_type_for() "
        f"(no silent coercion)."
    )


def unit_for(value_type: str, xsd_type: str) -> str:
    if value_type == "money":
        # Monetary1000 / Monetary1000NN are reported in thousands; the credit
        # family's `Number (n,2)` monetary cells are rand-and-cents (no scaling).
        if (xsd_type or "") in NUMBER_DECIMAL_MONEY_TYPES:
            return "ZAR-units"  # rand-and-cents (scale, not currency)
        return "ZAR-thousands"  # Monetary1000* — amounts reported in thousands (scale, not currency)
    if value_type == "ratio":
        return "ratio"
    if value_type == "count":
        return "count"
    if value_type == "date":
        return "date"
    if value_type == "enum":
        return "enum-code"
    return "text"


# ===========================================================================
# CREDIT PRODUCT-ATTRIBUTE MAPPER — the substantive new output of Phase C
# batch 2 (the credit family).
# ===========================================================================
#
# Unlike the financial family (GL-derived, no product attributes), a credit-risk
# return cell genuinely requires attributes that a CREDIT product must carry. A
# `product-attribute` dataRequirement whose ref is `<productId>#<attr>` is the
# product→cell edge the L3 inverse index walks and the NPA gate
# (`recon:npa-return-data-obligation-integrity`) BINDS on: a future credit
# product cannot reach approval unless it captures (or tracks-as-deferred) the
# `required:true` attributes its cells owe.
#
# THE FUTURE CREDIT PRODUCT (honest, not yet approved)
# ----------------------------------------------------
# No credit/loan product exists yet (the live products are FX / bond / equity /
# IRD / treasury — none feeds a credit product-attribute cell, so the live FX
# product `prd:bank:fx:otc-vanilla` is NOT wrongly blocked). We attach the
# requirements to the canonical future credit product id `prd:bank:credit:loan`.
# Because that product is not an approved ProductApproved, the cell MUST be
# `licence-day-data` (the recon validates `prd:` refs against the approved set
# only for `status:"sourced"` cells) — which is also honest: there are no real
# credit exposures pre-licence-day. The aim is the FUTURE loan product is gated.
#
# PRECISION + HONESTY (the brief's core demand)
# ---------------------------------------------
# We do NOT bulk-mark. An attribute is attached to a cell ONLY where the cell's
# regulatory MEANING (its row/column dimension) genuinely keys off that
# attribute, and `required:true` ONLY where the cell literally cannot be
# populated without it — i.e. the cell that REPORTS that attribute as its own
# dimension (the asset-class enum cell, the counterparty-identity cell, the
# bought-in-date cell). The monetary AGGREGATE cells that are merely SLICED by an
# attribute carry it `required:false` (the aggregate still folds — possibly to an
# honest 0 — and the attribute is one of several drivers, not a populate-or-die
# input). Each attribute is sourced from the credit obligation + a Basel CRE /
# SARB Reg 23 / Reg 26 (LEX) clause.

CREDIT_PRODUCT_ID = "prd:bank:credit:loan"

# Catalogue of credit product attributes, each with the Basel/Reg clause that
# makes a credit product carry it. Keyed by a short attr name (the `<attr>` in
# `<productId>#<attr>`).
CREDIT_ATTRS = {
    "exposureClass": (
        "the Basel/SARB exposure (asset) class of the credit exposure — Corporate, "
        "Retail, Sovereign, Bank, PSE, etc. Determines which BA 200 asset-class "
        "column/row and which standardised risk weight or IRB risk-weight function "
        "applies. (Basel CRE20.16–CRE20.40 standardised exposure classes; SARB "
        "Regulations relating to Banks reg 23(6).)"
    ),
    "regulatoryApproach": (
        "the credit-risk capital approach for the exposure — standardised (STA) or "
        "internal-ratings-based (IRB). Selects the BA 200 STA vs IRB sub-form. "
        "(Basel CRE20/CRE30–CRE36; SARB reg 23(11)–(13).)"
    ),
    "riskWeight": (
        "the standardised risk weight (or the IRB risk-weight output) applied to the "
        "exposure to compute risk-weighted exposure. (Basel CRE20–CRE22; SARB reg "
        "23(6)–(9).)"
    ),
    "pdEstimate": (
        "the IRB probability-of-default estimate for the obligor/grade. Feeds the IRB "
        "risk-weight function, expected loss and the average-PD column. (Basel "
        "CRE31–CRE36; SARB reg 23(11)–(13).)"
    ),
    "lgdEstimate": (
        "the IRB loss-given-default estimate for the facility. Feeds the IRB "
        "risk-weight function and expected loss. (Basel CRE32–CRE36; SARB reg "
        "23(11)–(13).)"
    ),
    "creditConversionFactor": (
        "the credit-conversion factor for the off-balance-sheet portion of the "
        "exposure, used to derive the exposure-at-default of commitments / "
        "contingents. (Basel CRE20.94–CRE20.105; SARB reg 23(6)(viii).)"
    ),
    "onOffBalanceSheet": (
        "whether the exposure is on-balance-sheet (utilised) or off-balance-sheet "
        "(undrawn commitment / contingent). Splits the BA 200 on/off-balance-sheet "
        "exposure columns. (Basel CRE20; SARB reg 23(6).)"
    ),
    "collateralType": (
        "the credit-risk-mitigation collateral type and its eligibility, which drives "
        "exposure-post-CRM and the LTV-bucket rows. (Basel CRE22 (CRM); SARB reg "
        "23(8)–(9).)"
    ),
    "maturity": (
        "the effective maturity of the exposure — an IRB risk-weight input and a "
        "dimension of several BA 200/210 breakdowns. (Basel CRE32.39–CRE32.46; SARB "
        "reg 23(11)–(13).)"
    ),
    "defaultStatus": (
        "whether the exposure is performing or in default (incl. stage-3 / impaired), "
        "which splits performing vs default rows and the impairment columns. (Basel "
        "CRE36.68–CRE36.86 default definition; IFRS 9 stages; SARB reg 23(6).)"
    ),
    "counterpartyIdentity": (
        "the legal identity (ID type + ID number) of the counterparty, required to "
        "aggregate exposures by counterparty for the large-exposures (LEX) return. "
        "(SARB Regulations relating to Banks reg 26(LEX); Basel LEX large-exposures "
        "framework.)"
    ),
    "connectedCounterpartyGroup": (
        "whether the counterparty belongs to a group of connected counterparties, the "
        "unit of LEX aggregation. (SARB reg 26 connected-counterparties; Basel LEX10 "
        "groups of connected counterparties.)"
    ),
    "connectionType": (
        "the type of connection (economic interdependence / control) binding a group "
        "of connected counterparties for LEX aggregation. (SARB reg 26; Basel LEX10.)"
    ),
    "industry": (
        "the industry classification of the counterparty, a BA 210 concentration "
        "dimension. (SARB reg 26 concentration analysis.)"
    ),
    "pdBucket": (
        "the PD bucket / rating grade of the IRB watch-list exposure (a BA 210 IRB "
        "watch-list dimension). (Basel CRE31–CRE36; SARB reg 26.)"
    ),
    "exposureType": (
        "the LEX exposure type (e.g. bank / sovereign / related-party classification) "
        "that drives the BA 210 large-exposure limit and exemption treatment. (SARB "
        "reg 26; Basel LEX.)"
    ),
    "assetBoughtInFlag": (
        "whether the asset was bought-in / acquired by the bank (e.g. in satisfaction "
        "of a debt) — the defining attribute of every BA 220 line. (SARB Regulations "
        "relating to Banks reg 23 / Banks Act s.78 properties acquired.)"
    ),
    "boughtInDate": (
        "the date the asset was bought-in / acquired, required to track the holding "
        "period against the disposal deadline for bought-in assets. (SARB reg 23; "
        "Banks Act s.78.)"
    ),
    "boughtInAssetType": (
        "the bought-in asset type — company shareholding vs immovable property — "
        "which selects the BA 220 Companies vs ImmovableAssets sub-form. (SARB reg 23; "
        "Banks Act s.78.)"
    ),
}


def _clause_for(attr: str) -> str:
    """The Basel/Reg clause text for a credit attribute (its citation `clause`)."""
    desc = CREDIT_ATTRS[attr]
    # The parenthetical at the tail of each description is the precise clause.
    start = desc.rfind("(")
    return desc[start:].strip("() ") if start != -1 else desc


def credit_product_attributes(
    form: str, col_label: str, row_label: str, xsd_type: str, sub_form: str = ""
):
    """Return the list of (attr, required) product-attribute edges this credit
    cell genuinely owes, keyed off the cell's regulatory MEANING (its row/column
    dimension + leaf type + sub-form). Precise + honest — see the mapper header.
    Returns [] for cells with no genuine credit-product-attribute dependency
    (e.g. pure form-meta text, hash-totals, the financial sub-totals).

    `sub_form` is the xlsx `formName` (e.g. "BA200_IRB", "BA200_STA") — the
    standardised-vs-IRB approach split is carried there, not in the row/column."""
    text = f"{col_label or ''} {row_label or ''}".lower()
    sub = (sub_form or "").upper()
    is_irb = "_IRB" in sub or sub.endswith("IRB")
    out: list[tuple[str, bool]] = []

    def add(attr: str, required: bool) -> None:
        if attr not in {a for a, _ in out}:
            out.append((attr, required))

    # ---- BA 220 (Assets bought-in) — every DATA cell is a bought-in asset ----
    if form == "BA220":
        # Hash-total / control cells are form-integrity controls, not a bought-in
        # asset — they carry no product attribute (avoid bulk-marking).
        if "hashtotal" in text or "hash total" in text:
            return out
        # The bought-in date cell REPORTS the date → required:true.
        if "date bought in" in text or "acquired" in text or xsd_type == "Date":
            add("boughtInDate", True)
        # The defining attribute of every BA 220 line: the asset was bought-in.
        # A data line cannot exist without it → required:true (the gate de-dups
        # to one obligation regardless of how many cells carry it).
        add("assetBoughtInFlag", True)
        # The Companies vs ImmovableAssets sub-form carries the asset type; the
        # individual cell does not need it to populate → required:false.
        add("boughtInAssetType", False)
        return out

    # ---- enum / identity leaf cells: the cell REPORTS the attribute itself ----
    # These genuinely cannot populate without the product's attribute → required.
    if xsd_type == "AssetClass" or ("asset class classification" in text):
        add("exposureClass", True)
    if xsd_type == "ExposureTypeBA210":
        add("exposureType", True)
    if xsd_type == "IndustryType" or text.strip().startswith("industry"):
        add("industry", True)
    if xsd_type == "PD_bucket" or "pd bucket" in text:
        add("pdBucket", True)
    if xsd_type == "ConnectionType" or "type of connection" in text:
        add("connectionType", True)
    if xsd_type == "CP_YesNo" and "connected counterparties" in text:
        add("connectedCounterpartyGroup", True)
    if xsd_type == "IDType" or "id type" in text or "id number" in text:
        # LEX counterparty-identity cell — cannot aggregate exposures by
        # counterparty without it.
        if form == "BA210":
            add("counterpartyIdentity", True)

    # ---- dimensional money / ratio cells: SLICED by an attribute → required:false
    # The aggregate still folds (possibly to honest 0); the attribute is one of
    # several drivers, not a populate-or-die input. We attach the dimension(s)
    # the cell's column/row label names.
    if form in ("BA200", "BA210"):
        # Asset-class slice. A cell whose COLUMN explicitly heads an asset-class
        # breakdown ("Asset class: ...") cannot place an exposure without that
        # exposure's class → required:true. A row/col that merely mentions a class
        # name (a sub-total context) carries it required:false.
        col_lc = (col_label or "").lower()
        if col_lc.startswith("asset class") or "asset class:" in col_lc:
            add("exposureClass", True)
        elif "asset class" in text or any(
            k in text
            for k in (
                "corporate",
                "retail",
                "sovereign",
                "public sector",
                "local government",
                "securities firms",
                "specialised lending",
                "sme ",
                "residential mortgage",
                "purchased receivables",
            )
        ):
            add("exposureClass", False)
        # Regulatory approach (STA vs IRB) is the sub-form split. An EAD/RWA cell
        # cannot be placed in the right approach sub-form without it → required.
        is_exposure_or_rwa = (
            "ead" in text
            or "credit exposure" in text
            or "exposure amount" in text
            or "risk weighted exposure" in text
            or ("exposure" in text and "off-balance" not in text)
        )
        if is_exposure_or_rwa:
            add("regulatoryApproach", True)
        # RWA / risk-weight cells: the risk weight is a computed driver of the RWA
        # aggregate → required:false (the engine derives it from class + approach).
        if "risk weight" in text or "risk-weight" in text:
            add("riskWeight", False)
        # On/off-balance-sheet + CCF cells.
        if "off-balance" in text or "off balance" in text or "conversion factor" in text or "ccf" in text:
            add("creditConversionFactor", False)
            add("onOffBalanceSheet", False)
        if "utilised" in text or "on-balance" in text or "on balance" in text:
            add("onOffBalanceSheet", False)
        # CRM / collateral / LTV cells.
        if "ltv" in text or "post crm" in text or "collateral" in text or "loan-to-value" in text:
            add("collateralType", False)
        # IRB PD / expected-loss cells. On an IRB sub-form an average-PD or
        # expected-loss cell is populate-or-die without the obligor PD → required;
        # on STA there is no PD input, so any PD mention is contextual only.
        if "average pd" in text or "expected loss" in text or "pd of" in text:
            add("pdEstimate", is_irb)
        if "lgd" in text:
            add("lgdEstimate", is_irb)
        # Default / impairment cells.
        if "default" in text or "impair" in text or "stage 3" in text or "performing" in text:
            add("defaultStatus", False)
        # Maturity slice.
        if "maturity" in text:
            add("maturity", False)
    # BA 210 LEX connected-group / industry slices on monetary cells.
    if form == "BA210":
        if "connected" in text and ("CP_YesNo" != xsd_type):
            add("connectedCounterpartyGroup", False)
        if "industry" in text and xsd_type != "IndustryType":
            add("industry", False)

    return out


# ===========================================================================
# LIQUIDITY PRODUCT-ATTRIBUTE MAPPER — the substantive new output of Phase C
# batch 3 (the liquidity family: BA 300 / BA 310).
# ===========================================================================
#
# A liquidity-return cell genuinely requires attributes that the bank's PRODUCTS
# must carry — but split across two product axes, not one:
#
#   (A) DEPOSIT / FUNDING products (the LCR-outflow + NSFR-ASF side). The LCR
#       outflow rate and the NSFR available-stable-funding factor for a liability
#       are DRIVEN by its funding-stability ("stable" vs "less stable"), its
#       counterparty CATEGORY (retail / small-business vs wholesale non-financial
#       vs financial-institution), whether it is held for an OPERATIONAL purpose,
#       and its MATURITY / callability (≤30-day vs >30-day; the maturity bands).
#       These are attributes a DEPOSIT product must capture.
#   (B) HQLA-ELIGIBLE ASSET products (the LCR numerator + BA 310 liquid-asset
#       side). Whether a security counts toward HQLA, and at what LEVEL (1 / 2A /
#       2B) and HAIRCUT, is driven by the asset's HQLA eligibility — an attribute
#       an HQLA-eligible asset product (bond / treasury-bill) must carry. The HQLA
#       classifier (platform/collateral/hqla-classifier.ts) computes
#       level + haircut from a SecurityDescriptor, so the asset product must carry
#       the descriptor fields the classifier reads.
#
# THE TWO FUTURE PRODUCTS (honest, not yet approved)
# --------------------------------------------------
# No deposit product is approved yet (the live products are FX / bond / equity /
# IRD / treasury). The deposit-side attributes attach to the canonical future
# deposit product id `prd:bank:deposit:transactional`; the HQLA-asset-side
# attributes attach to `prd:bank:treasury:hqla-eligible-asset` (the future
# HQLA-eligible-security product). Because neither is an approved ProductApproved,
# any cell carrying a `required:true` PRODUCT-ID attribute on these refs is
# `licence-day-data` (the recon validates `prd:` refs against the approved set
# only for `status:"sourced"` cells) — also honest: there are no real deposit or
# HQLA-asset positions pre-licence-day. The live FX product
# `prd:bank:fx:otc-vanilla` feeds NONE of these, so it is NOT wrongly blocked.
#
# PRECISION + HONESTY (no bulk-marking)
# -------------------------------------
# An attribute attaches to a cell ONLY where the cell's regulatory MEANING (its
# row/column label) genuinely keys off it, and `required:true` ONLY where the
# cell literally cannot be placed without it — i.e. the cell whose ROW DEFINES a
# stability/category/level dimension (the "Stable deposits" outflow row, the
# "Total level 2A HQLA" row, the deposit-concentration counterparty cell). A
# monetary aggregate merely SLICED by an attribute carries it `required:false`
# (it still folds, possibly to honest 0). Each attribute is grounded in the LCR
# (BCBS D295) / NSFR (BCBS D335) / SARB reg 26 / reg 27 rule that makes a product
# carry it. The form-meta / hash-total / pure-arithmetic cells carry none.

LIQUIDITY_DEPOSIT_PRODUCT_ID = "prd:bank:deposit:transactional"
LIQUIDITY_HQLA_PRODUCT_ID = "prd:bank:treasury:hqla-eligible-asset"

# Deposit / funding product attributes (LCR-outflow + NSFR-ASF axis).
LIQUIDITY_DEPOSIT_ATTRS = {
    "fundingStability": (
        "whether the deposit is a 'stable' or 'less stable' deposit, which selects the "
        "LCR run-off rate (stable retail 3–5%, less-stable retail 10%+) and the NSFR "
        "available-stable-funding factor. The defining attribute of the LCR retail / "
        "small-business deposit rows. (Basel LCR BCBS D295 §54–§84; NSFR BCBS D335 §22–"
        "§24; SARB Regulations relating to Banks reg 26.)"
    ),
    "depositCounterpartyCategory": (
        "the LCR/NSFR counterparty category of the funding provider — retail / small "
        "business vs wholesale non-financial corporate vs financial institution vs "
        "sovereign/PSE — which selects the outflow / ASF weighting band. (Basel LCR "
        "BCBS D295 §90–§111; NSFR BCBS D335 §22–§40; SARB reg 26.)"
    ),
    "operationalRelationship": (
        "whether the deposit is held for an OPERATIONAL purpose (clearing / custody / "
        "cash-management) with a qualifying operational relationship, which attracts the "
        "reduced 25% operational-deposit run-off rather than the non-operational rate. "
        "(Basel LCR BCBS D295 §93–§104; SARB reg 26.)"
    ),
    "maturityCallability": (
        "the residual maturity / notice period / callability of the deposit or funding — "
        "whether it falls within the 30-day LCR horizon and which NSFR maturity bucket "
        "(<6m / 6m–1y / ≥1y) it occupies. Drives both the LCR outflow inclusion and the "
        "NSFR ASF factor. (Basel LCR BCBS D295 §54; NSFR BCBS D335 §17–§24; SARB reg 26.)"
    ),
}

# HQLA-eligible asset product attributes (LCR-numerator + BA 310 liquid-asset axis).
LIQUIDITY_HQLA_ATTRS = {
    "hqlaLevel": (
        "the HQLA level of the asset — Level 1, Level 2A or Level 2B — which determines "
        "its inclusion in the LCR numerator and the BA 310 liquid-asset stock, and the "
        "Level-2 caps (40% / 15%). Computed by the HQLA classifier "
        "(platform/collateral/hqla-classifier.ts) from the asset descriptor. (Basel LCR "
        "BCBS D295 §24–§54; SARB reg 26 / reg 27.)"
    ),
    "hqlaEligibility": (
        "whether the asset meets the HQLA operational + eligibility criteria (unencumbered, "
        "central-bank-eligible, marketable in a deep liquid market) to count as a high-"
        "quality liquid asset at all. (Basel LCR BCBS D295 §28–§47; SARB reg 26 / reg 27.)"
    ),
    "hqlaHaircut": (
        "the regulatory haircut applied to the asset's market value in the HQLA stock "
        "(0% Level 1, 15% Level 2A, 25–50% Level 2B). Computed by the HQLA classifier from "
        "the asset's level. (Basel LCR BCBS D295 §49–§54; SARB reg 26 / reg 27.)"
    ),
    "repoEligibility": (
        "whether the level-1 liquid asset is eligible for / held under a resale or "
        "repurchase agreement, a BA 310 reserve-balance dimension (level-1 HQLA acquired "
        "under resale vs sold under repo). (SARB Regulations relating to Banks reg 27; "
        "SARB Act 90 of 1989 cash-reserve requirement.)"
    ),
}


def liquidity_product_attributes(form: str, col_label: str, row_label: str, xsd_type: str):
    """Return the list of ((product_id, attr, required)) product-attribute edges a
    liquidity cell genuinely owes, keyed off the cell's regulatory MEANING (its
    row/column label + leaf type). Precise + honest — see the mapper header.
    Returns [] for cells with no genuine liquidity-product-attribute dependency
    (hash-totals, pure subtotals, form-meta, ratio/control cells).

    Each edge names WHICH future product (deposit vs HQLA-asset) carries the
    attribute, so the inverse index / NPA gate binds the right product."""
    text = f"{col_label or ''} {row_label or ''}".lower()
    out: list[tuple[str, str, bool]] = []

    def add(product_id: str, attr: str, required: bool) -> None:
        if (product_id, attr) not in {(p, a) for p, a, _ in out}:
            out.append((product_id, attr, required))

    # Hash-total / control cells carry no product attribute (avoid bulk-marking).
    if "hashtotal" in text or "hash total" in text:
        return out

    dep = LIQUIDITY_DEPOSIT_PRODUCT_ID
    hqla = LIQUIDITY_HQLA_PRODUCT_ID

    # ---- HQLA asset level / eligibility / haircut (LCR numerator + BA 310) ----
    # A row that NAMES an HQLA level defines that level → required:true (the cell
    # cannot place an asset in the right level without the asset's level attr).
    # A row that names a level only to EXCLUDE it ("other than level…", "non-level
    # one") is defined by the ABSENCE of the level, so it keys off eligibility,
    # not a specific level → handled by the eligibility branch (required:false).
    names_a_level = (
        "level 1" in text
        or "level one" in text
        or "level 2a" in text
        or "level 2b" in text
        or "level two" in text
    )
    excludes_level = (
        "other than level" in text
        or "other than eligible" in text
        or "other than qualifying level" in text
        or "non-level" in text
        or "non level" in text
        or "other than qualifying level one" in text
    )
    names_level = names_a_level and not excludes_level
    mentions_hqla = "high-quality liquid asset" in text or "hqla" in text or "liquid asset" in text
    if names_level:
        add(hqla, "hqlaLevel", True)
        add(hqla, "hqlaEligibility", False)
        add(hqla, "hqlaHaircut", False)
    elif mentions_hqla or "securities eligible" in text:
        # A liquid-asset row that does not pin a specific level still keys off
        # HQLA eligibility (whether the asset counts at all) → required:false on
        # the aggregate; level/haircut are drivers.
        add(hqla, "hqlaEligibility", True)
        add(hqla, "hqlaLevel", False)
        add(hqla, "hqlaHaircut", False)
    # BA 310 repo / resale level-1 liquid-asset rows.
    if form == "BA310" and (
        "resale agreement" in text or "repurchase agreement" in text or "repo" in text
    ):
        add(hqla, "repoEligibility", False)
        add(hqla, "hqlaEligibility", False)

    # ---- Deposit funding-stability / category / operational / maturity --------
    is_stable = "stable" in text  # matches "stable" and "less stable"
    is_deposit_funding = any(
        k in text
        for k in (
            "deposit",
            "funding",
            "wholesale",
            "retail",
            "small business",
            "demand",
            "term deposit",
        )
    )
    if is_stable and is_deposit_funding:
        # A "Stable"/"Less stable" deposit row DEFINES the stability dimension →
        # required:true (the run-off / ASF factor cannot be set without it).
        add(dep, "fundingStability", True)
        add(dep, "depositCounterpartyCategory", False)
    elif is_deposit_funding:
        # A deposit/funding row sliced by counterparty/category but not by
        # stability → the category drives the band, required:false on aggregate.
        add(dep, "depositCounterpartyCategory", False)
        add(dep, "fundingStability", False)
    # Operational-relationship rows (reduced operational-deposit run-off).
    if "operational" in text and is_deposit_funding:
        # A row that DEFINES the operational-deposit treatment keys off it →
        # required:true (operational vs non-operational selects a different rate).
        add(dep, "operationalRelationship", "operational deposits" in text or "operational purposes" in text)
        add(dep, "depositCounterpartyCategory", False)
    # Maturity / callability — the maturity-band columns + residual-maturity rows.
    mentions_maturity = (
        "residual maturity" in text
        or "notice period" in text
        or "more than" in text  # the "More than X to Y" maturity-band columns
        or "within 30" in text
        or "less than" in text
        or "indeterminate maturity" in text
        or "non contractual" in text
    )
    if mentions_maturity and is_deposit_funding:
        add(dep, "maturityCallability", False)

    return out


# ---------------------------------------------------------------------------
# Per-cell liquidity status (honest sourced-vs-licence-day split).
#   - HQLA / LCR-numerator cells (level-1/2A/2B stock, liquid assets, the LCR
#     ratio) have LIVE substrate: the HQLA classifier + SecurityMaster + the
#     BA-300 LCR fold. They are `sourced` (the source genuinely exists; values
#     are an honest 0 until positions land — sourced is "source exists", not
#     "data present").
#   - Deposit-funding / NSFR / reserve-balance cells need real funding positions
#     that the bank-in-formation does not book pre-licence-day → `licence-day-
#     data`. The HQLA classifier still exists, but the deposit base does not.
# Returns (status, uses_unapproved_product_ref). A cell that carries a
# `required:true` PRODUCT-ID attribute on an unapproved product MUST be licence-
# day-data (the recon rejects a sourced cell whose required prd: ref is not an
# approved product) — this function enforces that coupling so the generator
# cannot emit a contradiction.
# ---------------------------------------------------------------------------
def liquidity_cell_status(form: str, col_label: str, row_label: str, prod_attrs):
    text = f"{col_label or ''} {row_label or ''}".lower()
    has_required_product_ref = any(
        required for _pid, _attr, required in prod_attrs
    )
    # Live-substrate predicate: HQLA stock / liquid-asset / LCR cells.
    hqla_sourced = (
        "high-quality liquid asset" in text
        or "hqla" in text
        or "liquid asset" in text
        or "level 1" in text
        or "level one" in text
        or "level 2a" in text
        or "level 2b" in text
        or "liquidity coverage ratio" in text
        or "treasury bill" in text
        or "gold coin" in text
        or "central bank reserve" in text
        or "reserve bank notes" in text
    )
    # If the cell carries a required PRODUCT-ID attribute on an unapproved future
    # product, it MUST be licence-day-data — even if it is an HQLA cell — because
    # the gate requires the product to be approved for a sourced cell. The
    # deposit / HQLA-asset products are not approved pre-licence-day.
    if has_required_product_ref:
        return "licence-day-data"
    if hqla_sourced:
        return "sourced"
    return "licence-day-data"


# ===========================================================================
# MARKET PRODUCT-ATTRIBUTE MAPPER — the substantive new output of Phase C
# batch 4 (the market family: BA 320 / BA 325 / BA 330 / BA 340 / BA 350).
# ===========================================================================
#
# Market risk is largely PER-TRADE / POSITION-DERIVED — the SBM sensitivities,
# the VaR, the repricing gap, the notional grid are computed from individual
# trade positions, not from a handful of product-static attributes. So the
# product-static attribute set a market product must carry is MODEST (the brief)
# and `required:true` is RARE — only the cell that REPORTS a product-static
# dimension (the trading-book-vs-banking-book column, the risk-class row, the
# derivative-type row, the equity-holding-class row) is populate-or-die on it.
# A monetary aggregate merely SLICED by such a dimension carries it
# `required:false` (it still folds; the dimension is one of several drivers).
#
# THE FUTURE MARKET PRODUCTS (honest, not yet approved)
# -----------------------------------------------------
# The live approved trading products are FX (`prd:bank:fx:otc-vanilla`) etc., but
# market-risk reporting is keyed off TRADE positions, not product-static menu
# picks, so attaching a `required:true` product-id attribute to the LIVE FX
# product would wrongly gate it (the NPA gate would demand FX capture a market-
# return attribute it does not own at the product level). Instead — exactly like
# the credit and liquidity families — the market product-static attributes attach
# to FUTURE, dedicated, UNAPPROVED market product ids:
#   - `prd:bank:trading:market-risk-position` — the trading-book market-risk
#     position product (BA 320 / BA 325 / BA 350 trading-book risk-class +
#     derivative-type + position-side).
#   - `prd:bank:banking-book:irrbb-position` — the banking-book interest-rate
#     position product (BA 330 repricing profile + rate type).
#   - `prd:bank:banking-book:equity-holding` — the banking-book equity holding
#     product (BA 340 equity holding class + risk-weight method).
# Because none is an approved ProductApproved, a cell carrying a `required:true`
# PRODUCT-ID attribute on these refs is `licence-day-data` (the recon validates
# `prd:` refs against the approved set only for `status:"sourced"` cells) — also
# honest: there are no real trading-book / banking-book positions pre-licence-day.
# The live FX product feeds NONE of these, so it is NOT wrongly blocked.

MARKET_TRADING_PRODUCT_ID = "prd:bank:trading:market-risk-position"
MARKET_IRRBB_PRODUCT_ID = "prd:bank:banking-book:irrbb-position"
MARKET_EQUITY_BB_PRODUCT_ID = "prd:bank:banking-book:equity-holding"

# Market product-static attributes, each with the Basel/Reg clause that makes a
# trading/banking-book product carry it. Keyed by short attr name.
MARKET_ATTRS = {
    "tradingBookDesignation": (
        "whether the position is held in the TRADING book or the BANKING book — the "
        "boundary that selects the BA 320 / BA 325 / BA 350 Trading vs Banking column and "
        "determines which market-risk capital regime applies. (Basel MAR (trading-book "
        "boundary); SARB Regulations relating to Banks reg 28(3); reg 28 trading-book / "
        "banking-book boundary.)"
    ),
    "riskClass": (
        "the market-risk class of the position — general interest-rate (GIRR), foreign "
        "exchange (FX, incl. gold), equity (EQ), credit-spread (CSR) or commodity (COMM) — "
        "which selects the BA 320 risk-class row/sub-form and the prescribed risk weights "
        "and correlations. (Basel MAR market-risk-class taxonomy; SARB reg 28(3)(a)–(d).)"
    ),
    "positionSide": (
        "whether the position is long or short, required to net positions within a risk "
        "class / maturity band for the position-risk charge and the notional/MtM long/short "
        "split. (Basel MAR; SARB reg 28(3).)"
    ),
    "counterpartyExposureType": (
        "the counterparty-exposure type for the BA 325 counterparty-risk memorandum — OTC "
        "derivative, securities-financing transaction (SFT) or credit-derivative instrument "
        "— which selects the memorandum line. (SARB reg 28 / reg 23(15)–(19) counterparty "
        "credit risk; Basel CRE counterparty credit risk.)"
    ),
    "bankingBookDesignation": (
        "whether the interest-rate position is held in the BANKING book — the boundary that "
        "scopes the position INTO the IRRBB repricing-gap return (BA 330 reports the banking "
        "book only; the trading book is on BA 320). (Basel IRRBB (SRP 31); SARB reg 30 / "
        "D2/2023.)"
    ),
    "repricingProfile": (
        "the repricing / residual-maturity profile of the banking-book interest-rate "
        "position, which places it in the correct BA 330 repricing maturity band (overnight, "
        "1m, 3m, 6m, 12m, 3y, 5y, 10y, >10y, non-rate-sensitive). (Basel IRRBB (SRP 31); "
        "SARB reg 30 / D2/2023 repricing-gap framework.)"
    ),
    "rateType": (
        "the interest-rate-type of the banking-book position — variable / fixed / benchmark "
        "/ discretionary — a BA 330 rate-type row dimension that drives the repricing "
        "treatment. (Basel IRRBB (SRP 31); SARB reg 30 / D2/2023.)"
    ),
    "equityHoldingClass": (
        "the banking-book equity holding class — listed / unlisted / speculative-unlisted / "
        "other equity holding — which selects the BA 340 holding-class row and the "
        "applicable simple risk weight. (Basel CRE (banking-book equity); SARB reg 31 "
        "equity risk in the banking book.)"
    ),
    "equityRiskWeightMethod": (
        "the BA 340 capital method for the banking-book equity holding — the simple "
        "risk-weight method or the internal-models approach — which selects the BA 340 "
        "method sub-form. (Basel CRE; SARB reg 31.)"
    ),
    "derivativeType": (
        "the derivative instrument type — future, call/put option (written/purchased), swap, "
        "forward / FRA — the defining row dimension of the BA 350 derivatives-instruments "
        "return. (Basel MAR / CRE derivative reporting; SARB reg 28 derivative positions.)"
    ),
    "underlyingAssetClass": (
        "the underlying asset class of the derivative — interest-rate, foreign-exchange, "
        "equity, commodity, credit — which selects the BA 350 underlying-asset column group. "
        "(Basel MAR / CRE; SARB reg 28.)"
    ),
}

# Which product id each market attribute belongs to.
MARKET_ATTR_PRODUCT = {
    "tradingBookDesignation": MARKET_TRADING_PRODUCT_ID,
    "riskClass": MARKET_TRADING_PRODUCT_ID,
    "positionSide": MARKET_TRADING_PRODUCT_ID,
    "counterpartyExposureType": MARKET_TRADING_PRODUCT_ID,
    "bankingBookDesignation": MARKET_IRRBB_PRODUCT_ID,
    "repricingProfile": MARKET_IRRBB_PRODUCT_ID,
    "rateType": MARKET_IRRBB_PRODUCT_ID,
    "equityHoldingClass": MARKET_EQUITY_BB_PRODUCT_ID,
    "equityRiskWeightMethod": MARKET_EQUITY_BB_PRODUCT_ID,
    "derivativeType": MARKET_TRADING_PRODUCT_ID,
    "underlyingAssetClass": MARKET_TRADING_PRODUCT_ID,
}


def market_product_attributes(form: str, col_label: str, row_label: str, xsd_type: str):
    """Return the list of ((product_id, attr, required)) product-attribute edges a
    market cell genuinely owes, keyed off the cell's regulatory MEANING (its
    row/column label + leaf type). Precise + honest — see the mapper header.
    Returns [] for cells with no genuine market-product-static dependency (the
    bulk of market cells, which are per-trade / position-derived aggregates with
    no product-static menu pick; form-meta; hash-totals; pure subtotals)."""
    text = f"{col_label or ''} {row_label or ''}".lower()
    col_lc = (col_label or "").lower()
    row_lc = (row_label or "").lower()
    out: list[tuple[str, str, bool]] = []

    def add(attr: str, required: bool) -> None:
        pid = MARKET_ATTR_PRODUCT[attr]
        if (pid, attr) not in {(p, a) for p, a, _ in out}:
            out.append((pid, attr, required))

    # Hash-total / control cells carry no product attribute (avoid bulk-marking).
    if "hashtotal" in text or "hash total" in text:
        return out

    # ---- Trading-vs-banking book boundary (BA 320 / BA 325 / BA 350 columns) ----
    # A column that NAMES the trading or banking book defines that boundary. The
    # cell cannot be PLACED in the right book column without the position's book
    # designation, but the aggregate still folds → required:false on the sliced
    # money cell; the boundary is a driver, not a populate-or-die input for the
    # value. We mark required:true ONLY where the column/row is the book boundary
    # cell itself (a position cannot exist without a book) on BA 320/BA 350.
    mentions_trading = "trading" in col_lc or "trading book" in row_lc
    mentions_banking = "banking" in col_lc or "banking book" in row_lc
    if form in ("BA320", "BA325", "BA350") and (mentions_trading or mentions_banking):
        add("tradingBookDesignation", False)

    # ---- BA 320 / BA 325 risk-class rows (IR / equity / FX+gold / commodity) ----
    if form in ("BA320", "BA325"):
        is_fx_risk_class = "foreign exchange" in text or "foreign-exchange" in text
        names_non_fx_risk_class = any(
            k in text
            for k in (
                "interest rate risk",
                "interest-rate risk",
                "equity position risk",
                "equity risk",
                "commodities risk",
                "commodity risk",
            )
        )
        # NON-FX risk-class rows DEFINE the class dimension on a book with no live
        # substrate (no IR / equity / commodity trading book at scale pre-licence-
        # day) → the class is a populate-or-die product-static attribute the future
        # trading product must carry → required:true (forces licence-day).
        if names_non_fx_risk_class:
            add("riskClass", True)
        # FX risk class is DERIVED per-trade by the LIVE market-risk fold (the FX
        # adapter reads real FX positions and classifies them) — not a product-
        # static menu pick — so the FX-risk-class aggregate cell does NOT carry a
        # required:true product attribute (which would wrongly force licence-day and
        # imply a future product must designate it). The risk class is still a
        # MARKET dimension a future trading product would carry → required:false,
        # so the cell stays sourced (live FX substrate) per market_cell_status.
        elif is_fx_risk_class:
            add("riskClass", False)
        # Long/short position columns (the position-side split).
        if "long" in col_lc or "short" in col_lc or "position" in col_lc:
            add("positionSide", False)

    # ---- BA 325 counterparty-risk memorandum (OTC / SFT / credit-derivative) ----
    if form == "BA325" and any(
        k in text for k in ("otc", "sft", "credit-derivative", "credit derivative", "counterparty")
    ):
        add("counterpartyExposureType", False)

    # ---- BA 330 IRRBB — banking-book interest-rate, repricing, rate-type ----
    # NB (no bulk-marking, the brief): the banking-book designation is implied by
    # the FORM'S SCOPE (BA 330 reports the banking book only) — it is NOT a per-
    # cell product driver, so we do NOT attach it to every cell. We attach the
    # repricing/rate-type attributes only to the cells whose row/column genuinely
    # DEFINES those dimensions.
    if form == "BA330":
        # The rate-type rows (variable / fixed / benchmark / discretionary) DEFINE
        # the rate-type dimension → required:true (a banking-book IR position cannot
        # be placed in the right rate-type row without its rate type). These rows
        # additionally key off the repricing profile (the band columns) →
        # required:false on those cells.
        if any(
            k in row_lc
            for k in ("variable rate", "fixed rate", "benchmark rate", "discretionary rate")
        ):
            add("rateType", True)
            # The repricing maturity-band columns slice the rate-type rows.
            if any(
                k in col_lc
                for k in (
                    "overnight",
                    "days to",
                    "more than",
                    "month",
                    "year",
                    "non-rate sensitive",
                    "non rate sensitive",
                )
            ):
                add("repricingProfile", False)

    # ---- BA 340 banking-book equity holding class + risk-weight method ----
    # NB: banking-book designation is the form's scope (not a per-cell driver) — we
    # do not bulk-attach it. The holding-class / method rows that DEFINE those
    # dimensions carry the attribute.
    if form == "BA340":
        if any(
            k in row_lc
            for k in (
                "equities - listed",
                "equities - unlisted",
                "listed and unlisted",
                "speculative",
                "other equity holdings",
                "equity holdings",
            )
        ):
            # The holding-class row DEFINES the class → required:true.
            add("equityHoldingClass", True)
        if "simple risk weight" in row_lc or "internal models approach" in row_lc:
            # The method row selects the method sub-form → required:true.
            add("equityRiskWeightMethod", True)

    # ---- BA 350 derivative type + underlying asset class ----
    if form == "BA350":
        if any(
            k in row_lc
            for k in (
                "futures contract",
                "call option",
                "put option",
                "swap",
                "forward",
                "fra",
            )
        ):
            # The derivative-type row DEFINES the instrument type → required:true.
            add("derivativeType", True)
            # The underlying-asset-class column group slices the derivative-type
            # rows (interest-rate / fx / equity / commodity / credit contracts).
            if any(
                k in col_lc
                for k in (
                    "interest-rate contract",
                    "interest rate contract",
                    "exchange rate contract",
                    "foreign exchange",
                    "equity contract",
                    "commodity contract",
                    "credit contract",
                )
            ):
                add("underlyingAssetClass", False)

    return out


# ---------------------------------------------------------------------------
# Per-cell market status (honest sourced-vs-licence-day split).
#   - BA 320 has LIVE substrate (the ba-320-market-risk.ts fold + FX adapter +
#     VaR engine). A BA 320 AGGREGATE market-risk / RWA / capital cell whose
#     value folds from the live engine and carries NO required PRODUCT-ID
#     attribute is `sourced` (the source genuinely exists; values fold honestly
#     from live FX positions / to 0 until other positions land). Specifically the
#     FX-risk-class cells have live FX substrate.
#   - All other BA 320 cells (and every BA 325 / 330 / 340 / 350 cell) need real
#     trading-book / treasury / banking-book / derivative positions that the bank-
#     in-formation does not book pre-licence-day → `licence-day-data`.
#   - A cell carrying a required PRODUCT-ID attribute on an unapproved future
#     product MUST be licence-day-data (the recon rejects a sourced cell whose
#     required prd: ref is not an approved product) — this function enforces that
#     coupling so the generator cannot emit a contradiction.
# ---------------------------------------------------------------------------
def market_cell_status(form: str, col_label: str, row_label: str, prod_attrs):
    text = f"{col_label or ''} {row_label or ''}".lower()
    has_required_product_ref = any(required for _pid, _attr, required in prod_attrs)
    if has_required_product_ref:
        return "licence-day-data"
    # Hash-total / control cells are form-integrity controls fed by the fold, not
    # by live FX positions — they do not claim FX substrate (a hashtotal whose
    # label merely contains "FXGold" must not be mis-marked sourced).
    if "hashtotal" in text or "hash total" in text:
        return "licence-day-data"
    # BA 320 live-substrate predicate: the FX risk class is the live trading book
    # today (the FX adapter reads real FX positions into the market-risk fold), so
    # a BA 320 FX-and-gold aggregate money cell whose row/column explicitly names
    # the foreign-exchange risk class — and that does NOT carry a required future-
    # product attribute (those are forced licence-day above) — is sourced. Other
    # BA 320 cells need a real trading book at scale → licence-day.
    if form == "BA320" and (
        "foreign exchange" in text or "foreign-exchange" in text
    ):
        return "sourced"
    return "licence-day-data"


# ===========================================================================
# CAPITAL FAMILY — Phase C batch 5 (BA 700 / BA 701).
# ===========================================================================
#
# NO PRODUCT-ATTRIBUTE MAPPER. Capital is GL-/RWA-derived: the numerator is the
# bank's own capital-classified GL, the denominator aggregates the other returns'
# RWA. A capital cell does not gate a product the way a credit/liquidity/market
# cell does — there is no product-static menu attribute it keys off. So — per the
# brief — the capital family carries ZERO product-attribute requirements; there
# is deliberately no `capital_product_attributes()` (no fabrication, no bulk-
# marking). The NPA gate sees no capital product-attribute edge, so no product is
# wrongly blocked by a capital cell.
#
# ---------------------------------------------------------------------------
# Per-cell capital status (honest sourced-vs-licence-day split).
#   - The regulatory MINIMUM-REQUIRED ratios and buffer add-ons are computed from
#     BCBS / Reg-38 CONSTANTS (computeRequiredMinimums +
#     BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS in platform/reporting/ba-700-
#     capital.ts: base CET1 4.5% / Tier 1 6% / Total 8% + conservation 2.5% +
#     countercyclical / D-SIB / Pillar-2A) and the specified minimum leverage
#     ratio (BCBS_LEVERAGE_RATIO_REGULATORY_MINIMUM = 3% in ba-700-leverage-
#     ratio.ts). These genuinely compute TODAY without real capital → `sourced`
#     (the source exists; the value is the regulatory constant, not a fabricated
#     capital figure).
#   - Every ACHIEVED capital amount, RWA amount, achieved ratio, excess/shortfall,
#     TLAC position and BA 701 economic-capital figure needs REAL capital / real
#     positions that the bank-in-formation does not hold pre-licence-day (the
#     R300m is a licence-day target) → `licence-day-data`.
# Returns the status string. The capital family carries no product-attribute
# refs, so there is no unapproved-product-ref coupling to enforce here.
# ---------------------------------------------------------------------------
def capital_cell_status(form: str, col_label: str, row_label: str) -> str:
    text = f"{col_label or ''} {row_label or ''}".lower()
    # BA 701's whole economic-capital reconciliation needs the ICAAP economic-
    # capital model output + real positions — none of it computes from a constant.
    if form == "BA701":
        return "licence-day-data"
    # The MINIMUM-REQUIRED ratio / buffer-add-on / specified-minimum-leverage cells
    # are computed from BCBS / Reg-38 regulatory constants (no real capital
    # needed) → sourced. We match on the row/column labels that NAME a required
    # minimum or a specified buffer/floor, NOT an achieved value.
    names_required_minimum = (
        "minimum required ratio" in text
        or "total minimum required ratio" in text
        or "minimum required" in text
        and "ratio" in text
    )
    names_buffer_addon = (
        ("add-on" in text or "add on" in text)
        and (
            "conservation buffer" in text
            or "countercyclical" in text
            or "counter cyclical" in text
            or "counter-cyclical" in text
            or "systemic risk add-on" in text
            or "systemically important" in text
            or "pillar 2a" in text
            or "pillar 2 a" in text
        )
    )
    names_base_minimum = "base minimum" in text or "south african base minima" in text
    names_specified_leverage_minimum = (
        "specified minimum leverage ratio" in text
        or ("minimum leverage ratio" in text and "specified" in text)
    )
    names_specified_buffer = "specified buffer requirement" in text
    if (
        names_required_minimum
        or names_buffer_addon
        or names_base_minimum
        or names_specified_leverage_minimum
        or names_specified_buffer
    ):
        return "sourced"
    return "licence-day-data"


# ===========================================================================
# OPERATIONAL FAMILY — Phase C batch 6 (BA 400 / BA 410 / BA 420).
# ===========================================================================
#
# NO PRODUCT-ATTRIBUTE MAPPER. Operational risk is entity-level: the BIA / TSA
# capital is computed from annual gross income (an income-statement aggregate),
# and the BA 410 / BA 420 loss returns capture individual operational-loss
# events attributed to a Basel business line + risk-event type at capture time
# by the org unit — not a product-static menu pick. So — per the brief — the
# operational family carries ZERO product-attribute requirements; there is
# deliberately no `operational_product_attributes()` (no fabrication, no bulk-
# marking). The NPA gate sees no operational product-attribute edge, so no
# product (incl. the live FX product) is wrongly blocked by an operational cell.
#
# ---------------------------------------------------------------------------
# Per-cell operational status (honest sourced-vs-licence-day split).
#
# HONEST FINDING (no false-positive "sourced" cells): the operational family is
# WHOLLY licence-day-data. The BIA α factor, the per-business-line β factors and
# the 12.5× RWA multiplier ARE regulatory constants (BCBS D196 / BCBS OPE /
# Reg 33) — but they are COEFFICIENTS applied INSIDE the ba-400-op-risk.ts fold
# (BIA_ALPHA, BUSINESS_LINE_BETA, the ×12.5 in generateBa300OpRisk), NOT cells
# the BA 400 form reports as their own value. Every REPORTED BA 400 cell is a
# gross-income amount, a computed op-capital / op-RWA, an ILM capital add-on
# (`% of gross income` — computed from real gross income), a loss-event count or
# a control hashtotal — each of which needs REAL audited gross income (3
# financial years in steady state) and / or operational-loss history that the
# bank-in-formation does not have pre-licence-day (the known
# GAP-BA700-OPERATIONAL-RWA). BA 410 / BA 420 likewise report actual operational-
# loss amounts / counts / dates / risk-event-types with no loss history pre-
# licence-day. So every operational cell is `licence-day-data` — marking any
# `sourced` would be a fabrication (claiming the form can populate from a
# constant when in fact the reported value needs real data). The regulatory
# coefficients' sourced-ness lives in the engine's unit tests + the fold, not in
# a form cell. The operational family carries no product-attribute refs, so there
# is no unapproved-product-ref coupling to enforce here.
# ---------------------------------------------------------------------------
def operational_cell_status(form: str, col_label: str, row_label: str) -> str:
    # Every reported operational cell needs real gross income / loss history —
    # none populates from a regulatory constant alone (those constants are
    # applied inside the fold, not reported as cells). Wholly licence-day-data.
    return "licence-day-data"


# ===========================================================================
# SECURITISATION PRODUCT-ATTRIBUTE MAPPER — Phase C batch 7 (BA 500 / BA 501).
# ===========================================================================
#
# BA 500 / BA 501 genuinely require attributes a SECURITISATION product must
# carry. A `product-attribute` dataRequirement whose ref is `<productId>#<attr>`
# is the product→cell edge the L3 inverse index walks and the NPA gate binds on:
# a future securitisation product cannot reach approval unless it captures (or
# tracks-as-deferred) the `required:true` attributes its cells owe.
#
# THE FUTURE SECURITISATION PRODUCT (honest, not yet approved): no securitisation
# product exists (the live products are FX / bond / equity / IRD / treasury —
# none feeds a securitisation cell, so the live FX product is NOT wrongly
# blocked). The requirements attach to the canonical future product id
# `prd:bank:securitisation:scheme`. Because that product is not an approved
# ProductApproved, every BA 500 / BA 501 cell is `licence-day-data` (which is
# also honest — no real securitisation schemes pre-licence-day).
#
# PRECISION + HONESTY (the brief): `required:true` ONLY where a cell REPORTS the
# attribute as its own dimension (the tranche-class cell, the rating cell, the
# instrument-profile cell, the benchmark cell). The monetary AGGREGATE cells of
# BA 500 (exposure / RWA by role × asset-class) are merely SLICED by securitisation
# role / approach / asset class → `required:false` (the aggregate still folds,
# possibly to an honest 0; the attribute is one of several drivers, not a
# populate-or-die input). No bulk-marking.
SECURITISATION_PRODUCT_ID = "prd:bank:securitisation:scheme"

SECURITISATION_ATTRS = {
    "securitisationRole": (
        "the bank's role in the securitisation scheme — originator (traditional / "
        "synthetic / deemed / repackager / remote), sponsor, or a secondary role "
        "(investor / purchaser / underwriter / credit enhancer / liquidity provider / "
        "servicing agent). Determines which BA 500 role row the exposure reports in. "
        "(SARB Regulations relating to Banks reg 23(6)(h); Basel CRE40.)"
    ),
    "securitisationApproach": (
        "the regulatory capital approach for the securitisation exposure — SEC-IRBA, "
        "SEC-ERBA / IAA, or SEC-SA (the securitisation hierarchy). Selects the BA 500 "
        "approach row and the risk-weight basis. (SARB reg 23(6)(h); Basel CRE41–CRE44.)"
    ),
    "underlyingAssetClass": (
        "the asset class of the underlying securitised pool — corporate / SME "
        "receivables, retail mortgages / revolving / instalment-sale-and-leasing / "
        "other, commercial property, bonds / loans. Splits the BA 500 / BA 501 asset-"
        "class columns. (SARB reg 23(6)(h); Basel CRE40–CRE45.)"
    ),
    "trancheClass": (
        "the tranche / seniority class of the securitisation position (senior / "
        "mezzanine / first-loss; the instrument class). Drives the BA 501 tranche "
        "instrument detail and the securitisation risk weight by seniority. (SARB reg "
        "23(6)(h); Basel CRE41–CRE44 tranche-seniority risk weights.)"
    ),
    "riskRetention": (
        "the risk-retention / credit-enhancement the originator holds (the retained "
        "interest, gain-on-sale, interest-only strips, originator guarantee), required "
        "for significant-risk-transfer assessment and the BA 500 deduction / retained-"
        "exposure lines. (SARB reg 23(6)(h) significant risk transfer; Basel CRE40.)"
    ),
    "creditRating": (
        "the external / internal credit rating of the tranche instrument — the rated "
        "flag, the rating agency, and the international- and national-scale rating "
        "score — which selects the SEC-ERBA risk weight and the BA 501 rating cells. "
        "(SARB reg 23(6)(h); Basel CRE42 ERBA.)"
    ),
    "instrumentProfile": (
        "the tranche instrument's interest profile — fixed vs floating — and its "
        "interest-rate benchmark, reported on the BA 501 instrument-detail lines. "
        "(SARB reg 23(6)(h); the securitisation note terms.)"
    ),
    "schemeTrigger": (
        "the securitisation scheme's triggers (early-amortisation / performance "
        "triggers — type, condition, trigger level vs current level, breached flag), "
        "reported on the BA 501 scheme-triggers sub-form. (SARB reg 23(6)(h)(xi) "
        "early-amortisation; Basel CRE40 scheme structural features.)"
    ),
}


def _sec_clause_for(attr: str) -> str:
    """The Basel/Reg clause text for a securitisation attribute (its `clause`)."""
    desc = SECURITISATION_ATTRS[attr]
    start = desc.rfind("(")
    return desc[start:].strip("() ") if start != -1 else desc


def securitisation_product_attributes(
    form: str, col_label: str, row_label: str, xsd_type: str
):
    """Return the (attr, required) securitisation-product-attribute edges this
    BA 500 / BA 501 cell genuinely owes, keyed off the cell's regulatory MEANING
    (its row/column dimension + leaf type). Precise + honest — `required:true`
    only where the cell REPORTS the attribute; `required:false` on a monetary
    aggregate merely sliced by it. Returns [] for cells with no genuine
    securitisation-product-attribute dependency (form-meta / hash-totals)."""
    text = f"{col_label or ''} {row_label or ''}".lower()
    out: list[tuple[str, bool]] = []

    def add(attr: str, required: bool) -> None:
        if attr not in {a for a, _ in out}:
            out.append((attr, required))

    # Hash-total / control cells are form-integrity controls, not a securitisation
    # datum — no product attribute (avoid bulk-marking).
    if "hashtotal" in text or "hash total" in text:
        return out

    # ---- ENUM / identity leaf cells that REPORT the attribute → required:true ----
    if xsd_type in ("Class",) or "class" == text.strip() or "tranche" in text:
        add("trancheClass", True)
    if xsd_type in ("Rated", "RatingScore") or "rating" in text or "rated by" in text:
        add("creditRating", True)
    if xsd_type == "InstrumentProfile" or "instrument profile" in text:
        add("instrumentProfile", True)
    if xsd_type == "InterestRateBenchmark" or "interest rate benchmark" in text:
        add("instrumentProfile", True)
    if xsd_type == "SchemeTriggers" or "scheme trigger" in text or "type of trigger" in text:
        add("schemeTrigger", True)
    if xsd_type == "Programme" or "type of programme" in text:
        # The programme-type cell reports the scheme structure → the role axis.
        add("securitisationRole", True)

    # ---- ROW / COLUMN dimension cells: the cell is SLICED by the attribute ----
    # (monetary aggregates) → required:false (the aggregate folds regardless).
    role_terms = (
        "as originator",
        "deemed originator",
        "repackager",
        "sponsor",
        "remote originator",
        "investor",
        "purchaser",
        "underwriter",
        "credit enhancer",
        "liquidity provider",
        "servicing agent",
        "primary role",
        "secondary role",
    )
    if any(t in text for t in role_terms):
        add("securitisationRole", False)
    approach_terms = ("sec-irba", "sec-erba", "sec-sa", "internal ratings", "external ratings",
                      "standardised approach", "internal assessment approach", "iaa")
    if any(t in text for t in approach_terms):
        add("securitisationApproach", False)
    asset_terms = ("corporate receivables", "sme receivables", "sme  receivables",
                   "mortgages", "revolving products", "instalment sales", "commercial property",
                   "bonds/loans", "corporate loans", "sme loans", "bonds")
    if any(t in text for t in asset_terms):
        add("underlyingAssetClass", False)
    retention_terms = ("gain on sale", "interest-only strip", "interest only strip",
                       "retained exposure", "credit enhancer", "guarantee provided by the originator",
                       "supervisory deduction")
    if any(t in text for t in retention_terms):
        add("riskRetention", False)

    return out


# ---------------------------------------------------------------------------
# xlsx Elements-sheet extraction — IDENTICAL column layout across all BA forms
# (verified BA100/BA110/BA120/BA600/BA610). Reused from gen-ba100-contract.py.
# ---------------------------------------------------------------------------
def _extract_elements(schema_zip: str):
    z = zipfile.ZipFile(schema_zip)
    xlsx_name = next(n for n in z.namelist() if n.endswith(".xlsx"))
    xz = zipfile.ZipFile(io.BytesIO(z.read(xlsx_name)))
    ss = []
    sx = ET.fromstring(xz.read("xl/sharedStrings.xml"))
    for si in sx.findall(NS + "si"):
        ss.append("".join(t.text or "" for t in si.iter(NS + "t")))

    def colnum(ref):
        m = re.match(r"([A-Z]+)(\d+)", ref)
        col = 0
        for ch in m.group(1):
            col = col * 26 + (ord(ch) - 64)
        return col, int(m.group(2))

    rels = xz.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    relmap = dict(
        re.findall(
            r'Id="(rId\d+)" Type="[^"]*worksheet" Target="(worksheets/sheet\d+\.xml)"', rels
        )
    )
    wb = xz.read("xl/workbook.xml").decode("utf-8")
    sheets = re.findall(r'<sheet name="([^"]+)"[^>]*?r:id="(rId\d+)"', wb)
    elem_rid = next((rid for nm, rid in sheets if nm == "Elements"), None)
    if elem_rid is None:
        raise SystemExit(f"FATAL: no 'Elements' sheet in {xlsx_name}")
    elem_file = "xl/" + relmap[elem_rid]

    rows = {}
    sh = ET.fromstring(xz.read(elem_file))
    for row in sh.iter(NS + "row"):
        for c in row.findall(NS + "c"):
            ref = c.get("r")
            t = c.get("t")
            v = c.find(NS + "v")
            isv = c.find(NS + "is")
            val = None
            if v is not None:
                val = ss[int(v.text)] if t == "s" else v.text
            elif isv is not None:
                val = "".join(tt.text or "" for tt in isv.iter(NS + "t"))
            if val not in (None, ""):
                cc, rn = colnum(ref)
                rows.setdefault(rn, {})[cc] = val
    COL = {
        3: "name",
        4: "type",
        5: "description",
        10: "calculatedValue",
        18: "formName",
        19: "formDescription",
        20: "rowNumber",
        21: "rowDescription",
        23: "columnNumber",
        24: "columnDescription",
        27: "calculationDefinition",
    }
    out = []
    for rn in sorted(rows):
        if rn <= 2:
            continue
        cells = rows[rn]
        rec = {k: cells.get(cn) for cn, k in COL.items()}
        if rec.get("name") and re.match(r"^BA\d{8}$", rec["name"]):
            out.append(rec)
    return out


# ---------------------------------------------------------------------------
# Currency dimension (P5) for a monetary cell.
#   - BA 610 (foreign operations) is intrinsically multi-currency: a column
#     whose description names a currency axis ("foreign", "currency", "rand",
#     "denominated") is reported per-currency. Group-level columns are reporting.
#   - BA 600 (consolidated) group columns are the group REPORTING currency.
#   - BA 110 / BA 120 are functional-currency returns (ZAR by config, never
#     literal) — like BA 100.
# ---------------------------------------------------------------------------
def currency_dimension_for(form: str, col_label: str, row_label: str, form_cfg) -> str:
    text = f"{col_label or ''} {row_label or ''}".lower()
    # Liquidity returns (BA 300 / BA 310): the LCR and the minimum-reserve / liquid-
    # asset stock are reported in the functional currency at the form level, but the
    # LCR is ALSO required by SIGNIFICANT CURRENCY (a currency in which the bank's
    # aggregate liabilities are ≥ 5% of total). A cell whose row/column names a
    # currency / foreign-currency / ZAR-denomination axis is by-currency; the
    # default form-level liquidity cell is functional (ZAR by config, never literal).
    if form in ("BA300", "BA310"):
        if any(
            k in text
            for k in (
                "foreign currency",
                "foreign-currency",
                "significant currency",
                "by currency",
                "per currency",
                "currency analysis",
                "denominated in",
                "denominated",
            )
        ):
            return "by-currency"
        return "functional"
    # Market family (BA 320 / 325 / 330 / 340 / 350): the market-risk returns are
    # intrinsically MULTI-CURRENCY by risk class — the FX risk class reports per-
    # currency, and BA 325's selected-risk summary carries explicit per-currency
    # columns (USD / Euro / GBP / CHF / JPY / Other). A cell whose row/column names
    # a currency axis (a named currency, a foreign-currency / per-currency / RSA-vs-
    # foreign-operations axis) is reported by-currency; the default form-level
    # market cell is functional (ZAR reporting currency by config, NEVER a literal).
    # P5: NO hard-coded currency — the dimension carries the axis, not "ZAR".
    if form in ("BA320", "BA325", "BA330", "BA340", "BA350"):
        if any(
            k in text
            for k in (
                "foreign currency",
                "foreign-currency",
                "by currency",
                "per currency",
                "currency analysis",
                "denominated",
                "positions held in foreign operations",
                "position in rsa",
                # BA 325 explicit per-currency selected-risk columns.
                "usd",
                "euro",
                " gbp",
                "gbp ",
                "chf",
                "jpy",
            )
        ):
            return "by-currency"
        return "functional"
    # Capital family (BA 700 / BA 701): the capital-adequacy, leverage, TLAC and
    # the regulatory-vs-economic-capital reconciliation are reported in the bank's
    # FUNCTIONAL currency at the form level (capital and RWA are aggregated, not
    # split by currency on these forms). A cell whose row/column explicitly names
    # a currency axis is by-currency; the default is functional (ZAR reporting
    # currency by config, NEVER a literal — P5: the dimension carries the axis).
    if form in ("BA700", "BA701"):
        if any(
            k in text
            for k in (
                "foreign currency",
                "foreign-currency",
                "by currency",
                "per currency",
                "currency analysis",
                "denominated",
            )
        ):
            return "by-currency"
        return "functional"
    # Operational family (BA 400 / BA 410 / BA 420): operational-risk capital,
    # gross income and operational losses are reported in the bank's FUNCTIONAL
    # currency at the form level (op-risk is not split by currency on these
    # forms). A cell whose row/column explicitly names a currency axis is by-
    # currency; the default is functional (ZAR reporting currency by config,
    # NEVER a literal — P5: the dimension carries the axis, not "ZAR").
    # Securitisation + governance/limits family (BA 500 / BA 501 / BA 125 / BA 130)
    # follows the SAME functional-by-default rule: securitisation exposures,
    # shareholder amounts and investment-restriction amounts are aggregated, not
    # split by currency on these forms (a named currency axis → by-currency).
    if form in ("BA400", "BA410", "BA420", "BA500", "BA501", "BA125", "BA130"):
        if any(
            k in text
            for k in (
                "foreign currency",
                "foreign-currency",
                "by currency",
                "per currency",
                "currency analysis",
                "denominated",
            )
        ):
            return "by-currency"
        return "functional"
    if form == "BA610":
        if any(k in text for k in ("foreign currency", "foreign-currency", "per currency",
                                   "by currency", "currency analysis", "denominated")):
            return "by-currency"
        # Foreign operations are translated into the group reporting currency.
        return "reporting"
    if form == "BA600":
        # Consolidated group figures are presented in the group reporting currency.
        return "reporting"
    # BA 110 / BA 120 — functional-currency returns.
    if any(k in text for k in ("foreign currency", "foreign-currency", "by currency",
                               "per currency")):
        return "by-currency"
    return "functional"


def build_cell(form: str, form_cfg, e):
    code = e["name"]
    row = e.get("rowNumber")
    col = e.get("columnNumber")
    rowlabel = (e.get("rowDescription") or "").strip()
    collabel = (e.get("columnDescription") or "").strip()
    # The framework `cellRef` grid coordinates are STRICT: row ~ /^R\d{4}$/,
    # column ~ /^C\d{4}$/. Some forms (e.g. BA 220) carry a column QUALIFIER
    # word (e.g. "Granted" / "Utilised") in the columnNumber field instead of a
    # grid code. Such a value is NOT a grid coordinate — fold it into the column
    # label (so the meaning is kept) and drop it from the grid `column`.
    if row is not None and not re.match(r"^R\d{4}$", str(row).strip()):
        qual = str(row).strip()
        rowlabel = f"{rowlabel} ({qual})".strip() if rowlabel else qual
        row = None
    if col is not None and not re.match(r"^C\d{4}$", str(col).strip()):
        qual = str(col).strip()
        collabel = f"{collabel} ({qual})".strip() if collabel else qual
        col = None
    xsd_type = (e.get("type") or "").strip()
    regdef = (e.get("description") or "").strip()
    calc = e.get("calculatedValue")
    calcdef = e.get("calculationDefinition")

    if not regdef:
        regdef = (
            f"{rowlabel} — {collabel} column.".strip(" —")
            or f"Cell {code} of form {form} ({form_cfg['name']})."
        )
        regdef += (
            " (No XSD documentation string; meaning per the form line-item structure "
            "and the column dimension.)"
        )

    value_type = value_type_for(xsd_type)
    unit = unit_for(value_type, xsd_type)
    label = f"{rowlabel} / {collabel}".strip(" /") or code

    # --- derivation ---
    if calc and calcdef:
        derivation = {"kind": "sum", "expression": calcdef}
    elif calcdef:
        derivation = {"kind": "formula", "expression": calcdef}
    else:
        derivation = {
            "kind": "direct",
            "expression": (
                f"{form_cfg['fold']} for line {row or '—'}"
                f"{', ' + collabel + ' dimension' if collabel else ''}"
            ),
        }

    # --- data requirements ---
    data_reqs = []
    is_calc = bool(calcdef)
    if is_calc:
        # A calculated cell is fed entirely by other cells via the form fold.
        data_reqs.append(
            {
                "sourceKind": "projection",
                "ref": form_cfg["fold"],
                "description": (
                    f"{label}: aggregated from constituent cells via the "
                    f"{form_cfg['fold']} projection (calculation: {calcdef})."
                ),
                "required": True,
            }
        )
    else:
        if value_type == "money":
            for cat in form_cfg["gl_categories"]:
                data_reqs.append(
                    {
                        "sourceKind": "gl-account",
                        "ref": f"category:{cat}",
                        "description": (
                            f"Chart-of-accounts balances in category '{cat}' fold into {label}."
                        ),
                        "required": True,
                    }
                )
            # The form's report fold supplies the value (always present).
            data_reqs.append(
                {
                    "sourceKind": "projection",
                    "ref": form_cfg["fold"],
                    "description": (
                        f"The {form_cfg['fold']} supplies the "
                        f"{collabel or 'reported'} value for {label}."
                    ),
                    "required": True,
                }
            )
            # GL trial balance is the underlying leaf source for direct money cells.
            data_reqs.append(
                {
                    "sourceKind": "projection",
                    "ref": "gl-trial-balance",
                    "description": (
                        f"GL trial-balance fold supplies the GL balances {label} aggregates."
                    ),
                    "required": True,
                }
            )
        elif value_type in ("ratio", "count"):
            data_reqs.append(
                {
                    "sourceKind": "projection",
                    "ref": form_cfg["fold"],
                    "description": (
                        f"{label}: derived ({value_type}) by the {form_cfg['fold']} projection."
                    ),
                    "required": True,
                }
            )
        else:
            # text / enum leaf inputs are reference-data / form-meta inputs.
            data_reqs.append(
                {
                    "sourceKind": "reference-data",
                    "ref": "return-form-meta",
                    "description": (
                        f"{label}: a {value_type} reporting input "
                        f"(identifier / classification / response) captured at "
                        f"report-generation time."
                    ),
                    "required": False,
                }
            )

    # Consolidation / foreign-operation columns need the legal-entity tree.
    if form_cfg["entity_scope"] in ("consolidated", "controlling-company", "foreign-branch") or (
        form in ("BA600", "BA610")
    ):
        data_reqs.append(
            {
                "sourceKind": "reference-data",
                "ref": "legal-entity-tree",
                "description": (
                    "The consolidation / foreign-operation scope from the versioned "
                    "legal-entity tree determines which entities' balances aggregate "
                    "into this cell."
                ),
                "required": False,
            }
        )

    # --- CREDIT product-attribute requirements (Phase C batch 2) ---
    # The substantive new output: a credit cell that genuinely keys off a credit-
    # product attribute carries a `product-attribute` requirement
    # `ref: <CREDIT_PRODUCT_ID>#<attr>`. `required:true` ONLY where the cell
    # cannot populate without it (the cell that REPORTS the attribute); else the
    # aggregate carries it `required:false`. See credit_product_attributes().
    if form_cfg.get("credit_family"):
        sub_form = (e.get("formName") or "").strip()
        for attr, required in credit_product_attributes(
            form, collabel, rowlabel, xsd_type, sub_form
        ):
            data_reqs.append(
                {
                    "sourceKind": "product-attribute",
                    "ref": f"{CREDIT_PRODUCT_ID}#{attr}",
                    "description": (
                        f"A credit product feeding {label} must carry its "
                        f"{attr}: {CREDIT_ATTRS[attr]}"
                    ),
                    "required": required,
                }
            )

    # --- LIQUIDITY product-attribute requirements (Phase C batch 3) ---
    # A liquidity cell that genuinely keys off a deposit-funding or HQLA-asset
    # attribute carries a `product-attribute` requirement `ref: <productId>#<attr>`
    # naming WHICH future product (deposit vs HQLA-asset) owes it. `required:true`
    # ONLY where the cell cannot populate without it (the row that DEFINES the
    # stability / level dimension); else `required:false` on the sliced aggregate.
    # See liquidity_product_attributes().
    liq_prod_attrs = []
    if form_cfg.get("liquidity_family"):
        liq_prod_attrs = liquidity_product_attributes(form, collabel, rowlabel, xsd_type)
        for product_id, attr, required in liq_prod_attrs:
            catalogue = (
                LIQUIDITY_DEPOSIT_ATTRS
                if product_id == LIQUIDITY_DEPOSIT_PRODUCT_ID
                else LIQUIDITY_HQLA_ATTRS
            )
            data_reqs.append(
                {
                    "sourceKind": "product-attribute",
                    "ref": f"{product_id}#{attr}",
                    "description": (
                        f"A liquidity-relevant product feeding {label} must carry its "
                        f"{attr}: {catalogue[attr]}"
                    ),
                    "required": required,
                }
            )

    # --- MARKET product-attribute requirements (Phase C batch 4) ---
    # A market cell that genuinely keys off a trading/banking-book product-static
    # attribute carries a `product-attribute` requirement `ref: <productId>#<attr>`
    # naming WHICH future market product (trading-book / IRRBB / equity-banking-
    # book) owes it. `required:true` ONLY where the cell cannot populate without it
    # (the row that DEFINES the risk-class / rate-type / holding-class / derivative-
    # type dimension); else `required:false` on the sliced aggregate. The bulk of
    # market cells carry NONE (per-trade / position-derived). See
    # market_product_attributes().
    mkt_prod_attrs = []
    if form_cfg.get("market_family"):
        mkt_prod_attrs = market_product_attributes(form, collabel, rowlabel, xsd_type)
        for product_id, attr, required in mkt_prod_attrs:
            data_reqs.append(
                {
                    "sourceKind": "product-attribute",
                    "ref": f"{product_id}#{attr}",
                    "description": (
                        f"A market-risk-relevant product feeding {label} must carry its "
                        f"{attr}: {MARKET_ATTRS[attr]}"
                    ),
                    "required": required,
                }
            )

    # --- SECURITISATION product-attribute requirements (Phase C batch 7) ---
    # A BA 500 / BA 501 cell that genuinely keys off a securitisation product-static
    # attribute carries a `product-attribute` requirement
    # `ref: <SECURITISATION_PRODUCT_ID>#<attr>`. `required:true` ONLY where the cell
    # REPORTS the attribute (tranche class / rating / instrument profile / scheme
    # trigger); else `required:false` on the sliced monetary aggregate. The future
    # securitisation product is unapproved, so every such cell is licence-day-data.
    # See securitisation_product_attributes().
    if form_cfg.get("securitisation_family"):
        for attr, required in securitisation_product_attributes(
            form, collabel, rowlabel, xsd_type
        ):
            data_reqs.append(
                {
                    "sourceKind": "product-attribute",
                    "ref": f"{SECURITISATION_PRODUCT_ID}#{attr}",
                    "description": (
                        f"A securitisation product feeding {label} must carry its "
                        f"{attr}: {SECURITISATION_ATTRS[attr]}"
                    ),
                    "required": required,
                }
            )

    # --- currency dimension (P5) ---
    currency_dim = None
    if value_type == "money":
        currency_dim = currency_dimension_for(form, collabel, rowlabel, form_cfg)

    # --- applicability ---
    applicability = {
        "entityScope": form_cfg["entity_scope"],
        "jurisdiction": "ZA",
        "productScope": "universal",
    }

    # --- status (honest gaps) ---
    if form_cfg.get("liquidity_family"):
        # Per-cell sourced-vs-licence-day split: HQLA / LCR-numerator cells have
        # live substrate (sourced); deposit-funding / NSFR / reserve cells need
        # real positions (licence-day). A cell carrying a required PRODUCT-ID attr
        # on an unapproved future product is forced licence-day (the recon rejects
        # a sourced cell whose required prd: ref is not approved).
        status = liquidity_cell_status(form, collabel, rowlabel, liq_prod_attrs)
        status_reason = form_cfg["status_note"] if status != "sourced" else None
    elif form_cfg.get("market_family"):
        # Per-cell sourced-vs-licence-day split: BA 320 FX-risk-class aggregate
        # cells have live substrate (the FX adapter + market-risk fold + VaR engine)
        # → sourced; all other market cells need real trading-book / treasury /
        # banking-book / derivative positions (licence-day). A cell carrying a
        # required PRODUCT-ID attr on an unapproved future market product is forced
        # licence-day (the recon rejects a sourced cell whose required prd: ref is
        # not approved).
        status = market_cell_status(form, collabel, rowlabel, mkt_prod_attrs)
        status_reason = form_cfg["status_note"] if status != "sourced" else None
    elif form_cfg.get("capital_family"):
        # Per-cell sourced-vs-licence-day split: the regulatory MINIMUM-REQUIRED
        # ratios / buffer add-ons / specified-minimum-leverage cells are computed
        # from BCBS / Reg-38 constants (sourced — no real capital needed); every
        # achieved-capital / RWA / ratio / excess-shortfall / TLAC / economic-
        # capital cell needs real capital the bank does not hold pre-licence-day
        # (licence-day). The capital family carries NO product-attribute refs.
        status = capital_cell_status(form, collabel, rowlabel)
        status_reason = form_cfg["status_note"] if status != "sourced" else None
    elif form_cfg.get("operational_family"):
        # Per-cell sourced-vs-licence-day split: the BA 400 regulatory-CONSTANT
        # cells (BIA α / business-line β / 12.5× RWA multiplier / ILM-floor
        # coefficients) are computed from BCBS D196 / Reg 33 constants (sourced —
        # no real gross income / loss history needed); every gross-income /
        # capital / RWA / ILM cell and every BA 410 / BA 420 loss cell needs real
        # audited gross income + loss history the bank does not have pre-licence-
        # day (licence-day). The operational family carries NO product-attribute
        # refs.
        status = operational_cell_status(form, collabel, rowlabel)
        status_reason = form_cfg["status_note"] if status != "sourced" else None
    elif form_cfg["licence_day"]:
        status = "licence-day-data"
        status_reason = form_cfg["status_note"]
    else:
        status = "sourced"
        status_reason = None

    cell_ref = {"xsdElement": code}
    if row:
        cell_ref["row"] = row
    if rowlabel:
        cell_ref["rowLabel"] = rowlabel
    if col:
        cell_ref["column"] = col
    if collabel:
        cell_ref["columnLabel"] = collabel

    cell = {
        "returnForm": form,
        "cellRef": cell_ref,
        "label": label,
        "regulatoryDefinition": regdef,
        "citations": [
            {"obligationId": form_cfg["obligation"], "clause": form_cfg["clause"]},
        ],
        "valueType": value_type,
        "unit": unit,
        "derivation": derivation,
        "dataRequirements": data_reqs,
        "applicability": applicability,
        "status": status,
    }
    if currency_dim is not None:
        cell["currencyDimension"] = currency_dim
    if status_reason:
        cell["statusReason"] = status_reason
    return cell


def generate(form: str):
    if form not in FORMS:
        raise SystemExit(f"FATAL: unknown form '{form}'. Known: {sorted(FORMS)}")
    form_cfg = FORMS[form]
    schema_zip = os.path.join(SCHEMA_DIR, f"{form}.zip")
    if not os.path.exists(schema_zip):
        raise SystemExit(f"FATAL: schema zip not found: {schema_zip}")
    els = _extract_elements(schema_zip)
    if not els:
        raise SystemExit(
            f"FATAL: extracted 0 BA-code leaf cells from {form} — STUB or schema-shape change "
            f"(do not fabricate)."
        )
    cells = [build_cell(form, form_cfg, e) for e in els]

    # Provenance: name the xlsx that was actually inside the zip (version-suffixed
    # for BA 600 / BA 610 / BA 501). BA 501 is xlsx-ONLY (no XSD in the SARB Umoja
    # set) — the cell oracle is the workbook Elements sheet for that form, and the
    # recon completeness check re-extracts the cell universe from the same xlsx
    # (see the registry `xsdName: null` + the recon xlsx fallback). For every other
    # form the XSD is present and named as the independent oracle.
    z = zipfile.ZipFile(schema_zip)
    xlsx_name = next(n for n in z.namelist() if n.endswith(".xlsx"))
    xsd_name = next((n for n in z.namelist() if n.endswith(".xsd")), None)

    if xsd_name is not None:
        schema_source = (
            f"Regulations/SARB-PA/ba-returns/schemas/{form}.zip → {xsd_name} + "
            f"{xlsx_name} (Elements sheet)"
        )
    else:
        schema_source = (
            f"Regulations/SARB-PA/ba-returns/schemas/{form}.zip → {xlsx_name} "
            f"(Elements sheet — xlsx-only, no XSD in the SARB schema package; the "
            f"workbook Elements sheet is the authoritative cell oracle for this form)"
        )

    contract = {
        "returnForm": form,
        "formName": form_cfg["name"],
        "obligationId": form_cfg["obligation"],
        "schemaSource": schema_source,
        "cells": cells,
    }

    out_json = os.path.join(HERE, f"{form.lower()}-contract.json")
    with open(out_json, "w") as fh:
        json.dump(contract, fh, separators=(",", ":"), ensure_ascii=False)
        fh.write("\n")

    print("wrote", out_json)
    print("  form:", form, "—", form_cfg["name"])
    print("  obligation:", form_cfg["obligation"])
    print("  cells:", len(cells))
    print("  status:", dict(Counter(c["status"] for c in cells)))
    print("  valueType:", dict(Counter(c["valueType"] for c in cells)))
    print(
        "  currencyDim:",
        dict(Counter(c.get("currencyDimension", "(none)") for c in cells)),
    )
    print("  derivation kinds:", dict(Counter(c["derivation"]["kind"] for c in cells)))
    # Product-attribute summary — the key Phase C batch-2 output.
    pa = Counter()
    pa_req = Counter()
    cells_with_pa = 0
    cells_with_req_pa = 0
    for c in cells:
        prod = [
            d for d in c["dataRequirements"] if d["sourceKind"] == "product-attribute"
        ]
        if prod:
            cells_with_pa += 1
        if any(d["required"] for d in prod):
            cells_with_req_pa += 1
        for d in prod:
            attr = d["ref"].split("#", 1)[1]
            pa[attr] += 1
            if d["required"]:
                pa_req[attr] += 1
    if cells_with_pa:
        print(f"  product-attr cells: {cells_with_pa} (with a required one: {cells_with_req_pa})")
        print("  product-attrs (count, required-count):")
        for attr in sorted(pa):
            print(f"      {attr}: {pa[attr]} ({pa_req.get(attr, 0)} required)")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1].upper() in FORMS:
        generate(sys.argv[1].upper())
    elif len(sys.argv) == 2 and sys.argv[1] == "--all":
        for f in ("BA110", "BA120", "BA600", "BA610"):
            generate(f)
    elif len(sys.argv) == 2 and sys.argv[1] == "--credit":
        for f in ("BA200", "BA210", "BA220"):
            generate(f)
    elif len(sys.argv) == 2 and sys.argv[1] == "--liquidity":
        for f in ("BA300", "BA310"):
            generate(f)
    elif len(sys.argv) == 2 and sys.argv[1] == "--market":
        for f in ("BA320", "BA325", "BA330", "BA340", "BA350"):
            generate(f)
    elif len(sys.argv) == 2 and sys.argv[1] == "--capital":
        for f in ("BA700", "BA701"):
            generate(f)
    elif len(sys.argv) == 2 and sys.argv[1] == "--operational":
        for f in ("BA400", "BA410", "BA420"):
            generate(f)
    elif len(sys.argv) == 2 and sys.argv[1] == "--secgov":
        # Phase C batch 7 — securitisation (BA 500 / BA 501) + governance/limits
        # (BA 125 / BA 130). BA 501 is xlsx-only (no XSD).
        for f in ("BA500", "BA501", "BA125", "BA130"):
            generate(f)
    else:
        raise SystemExit(
            "usage: gen-return-contract.py "
            "<BA110|BA120|BA125|BA130|BA200|BA210|BA220|BA300|BA310|BA320|BA325|BA330|BA340|"
            "BA350|BA400|BA410|BA420|BA500|BA501|BA600|BA610|BA700|BA701|"
            "--all|--credit|--liquidity|--market|--capital|--operational|--secgov>"
        )
