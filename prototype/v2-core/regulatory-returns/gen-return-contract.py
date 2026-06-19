#!/usr/bin/env python3
"""Generate a SARB BA-return cell-data-requirement contract DIRECTLY from the
form's XSD/xlsx in `Regulations/SARB-PA/ba-returns/schemas/<FORM>.zip`.

This is the GENERALISED generator for the financial-family returns (BA 110,
BA 120, BA 600, BA 610) AND the credit-family returns (BA 200, BA 210, BA 220) —
the parametrised sibling of `gen-ba100-contract.py` (which keeps the rich BA-100
balance-sheet line→GL→product mapping).

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
    if t == "Numeric":
        # SARB `Numeric` carries non-scaled numeric values (factors, counts,
        # ratios-as-decimal). Treated as a ratio/number cell (no currency).
        return "ratio"
    if t == "Integer":
        return "count"
    if t == "Date":
        return "date"
    if t in ("Text", "IDType", "Currency"):
        return "text"
    if t in (
        "EnumCountry",
        "ExposureType",
        "CP_YesNo",
        "RegulatoryApproach",
        "SourceOfCapital",
    ) or t in CREDIT_ENUM_TYPES:
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
    if form_cfg["licence_day"]:
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
    # for BA 600 / BA 610).
    z = zipfile.ZipFile(schema_zip)
    xlsx_name = next(n for n in z.namelist() if n.endswith(".xlsx"))
    xsd_name = next(n for n in z.namelist() if n.endswith(".xsd"))

    contract = {
        "returnForm": form,
        "formName": form_cfg["name"],
        "obligationId": form_cfg["obligation"],
        "schemaSource": (
            f"Regulations/SARB-PA/ba-returns/schemas/{form}.zip → {xsd_name} + "
            f"{xlsx_name} (Elements sheet)"
        ),
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
    else:
        raise SystemExit(
            "usage: gen-return-contract.py "
            "<BA110|BA120|BA200|BA210|BA220|BA600|BA610|--all|--credit>"
        )
