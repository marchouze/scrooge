#!/usr/bin/env python3
"""Generate a SARB BA-return cell-data-requirement contract DIRECTLY from the
form's XSD/xlsx in `Regulations/SARB-PA/ba-returns/schemas/<FORM>.zip`.

This is the GENERALISED generator for the financial-family returns (BA 110,
BA 120, BA 600, BA 610) — the parametrised sibling of `gen-ba100-contract.py`
(which keeps the rich BA-100 balance-sheet line→GL→product mapping). For the
financial family the cell→source mapping is form-LEVEL (a named report fold over
the GL trial balance + the form's projection), NOT a hand-authored per-line
product map: the financial family is mostly GL-derived (per the brief), and
hand-authoring 130–2445 line→product edges without the form's regulatory
annexure in hand would be fabrication. Every cell is still emitted (an entry for
EVERY XSD leaf cell — money, ratio, count, text, enum) with honest provenance,
honest status, and an upward P2 citation to the form's CORRECTED obligation row
(post PR #1451 numbering remediation).

Run (from prototype/):
    python3 v2-core/regulatory-returns/gen-return-contract.py BA110
    python3 v2-core/regulatory-returns/gen-return-contract.py BA120
    python3 v2-core/regulatory-returns/gen-return-contract.py BA600
    python3 v2-core/regulatory-returns/gen-return-contract.py BA610

The output `<form-lower>-contract.json` is checked in and validated at import
time by the Zod schema (`cell-contract.ts`); this generator is its provenance —
the cell set is provably the full XSD leaf set (no hand-omission). The
`recon:ba-return-cell-contract` gate independently re-extracts the XSD leaf set
and asserts one contract entry per cell.

Authority: D-BA-RETURN-DATA-CONTRACT (CEO 2026-06-19), Phase C batch 1.
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
}

# ---------------------------------------------------------------------------
# XSD leaf-type → framework valueType + reporting unit + (for money) the form's
# default currency-dimension. P5: a monetary cell ALWAYS carries a dimension and
# NEVER a hard-coded currency. The schema's `unit` is a SCALE/measure, not a
# currency literal.
# ---------------------------------------------------------------------------
def value_type_for(xsd_type: str) -> str:
    t = xsd_type or ""
    if t == "Monetary1000":
        return "money"
    if t.startswith("Percentage"):
        return "ratio"
    if t == "Numeric":
        # SARB `Numeric` carries non-scaled numeric values (factors, counts,
        # ratios-as-decimal). Treated as a ratio/number cell (no currency).
        return "ratio"
    if t == "Integer":
        return "count"
    if t in ("Text", "IDType", "Currency"):
        return "text"
    if t in (
        "EnumCountry",
        "ExposureType",
        "CP_YesNo",
        "RegulatoryApproach",
        "SourceOfCapital",
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
        return "ZAR-thousands"  # Monetary1000 — amounts reported in thousands (scale, not currency)
    if value_type == "ratio":
        return "ratio"
    if value_type == "count":
        return "count"
    if value_type == "enum":
        return "enum-code"
    return "text"


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


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1].upper() in FORMS:
        generate(sys.argv[1].upper())
    elif len(sys.argv) == 2 and sys.argv[1] == "--all":
        for f in ("BA110", "BA120", "BA600", "BA610"):
            generate(f)
    else:
        raise SystemExit(
            "usage: gen-return-contract.py <BA110|BA120|BA600|BA610|--all>"
        )
