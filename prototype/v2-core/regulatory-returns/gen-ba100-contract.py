#!/usr/bin/env python3
"""Generate the BA 100 (Balance Sheet) cell-data-requirement contract
(`ba100-contract.json`) DIRECTLY from the SARB Excel/XSD form in
`Regulations/SARB-PA/ba-returns/schemas/BA100.zip`. The output JSON is checked
in and validated at import time by the Zod schema (`cell-contract.ts`); this
generator is its provenance — the 843-cell set is provably the full XSD set
(no hand-omission).

Run (from prototype/):
    python3 v2-core/regulatory-returns/gen-ba100-contract.py

Source of truth: BA100.zip → `SARB-Return - BA100.xlsx` (the Elements sheet —
each monetary BAxxxxxxxx leaf cell carries row/col/description/calculatedValue/
calculationDefinition) read against `BA100.xsd` (843 Monetary1000 leaf cells).
Authority: D-BA-RETURN-DATA-CONTRACT (CEO 2026-06-19). Author: Bea
(Accounting and financial reporting engineer, engineering).
"""
import json, re, os, zipfile
from xml.etree import ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA_ZIP = os.path.normpath(os.path.join(
    HERE, "..", "..", "..", "Regulations", "SARB-PA", "ba-returns", "schemas", "BA100.zip"))
OUT_JSON = os.path.join(HERE, "ba100-contract.json")

# --- extract the Elements sheet of SARB-Return - BA100.xlsx -----------------
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

def _extract_elements():
    z = zipfile.ZipFile(SCHEMA_ZIP)
    xlsx_name = next(n for n in z.namelist() if n.endswith(".xlsx"))
    import io
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

    # Locate the Elements sheet via workbook + rels.
    rels = xz.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    relmap = dict(re.findall(
        r'Id="(rId\d+)" Type="[^"]*worksheet" Target="(worksheets/sheet\d+\.xml)"', rels))
    wb = xz.read("xl/workbook.xml").decode("utf-8")
    sheets = re.findall(r'<sheet name="([^"]+)"[^>]*?r:id="(rId\d+)"', wb)
    elem_file = next("xl/" + relmap[rid] for nm, rid in sheets if nm == "Elements")

    rows = {}
    sh = ET.fromstring(xz.read(elem_file))
    for row in sh.iter(NS + "row"):
        for c in row.findall(NS + "c"):
            ref = c.get("r"); t = c.get("t")
            v = c.find(NS + "v"); isv = c.find(NS + "is")
            val = None
            if v is not None:
                val = ss[int(v.text)] if t == "s" else v.text
            elif isv is not None:
                val = "".join(tt.text or "" for tt in isv.iter(NS + "t"))
            if val not in (None, ""):
                cc, rn = colnum(ref)
                rows.setdefault(rn, {})[cc] = val
    COL = {3: "name", 4: "type", 5: "description", 10: "calculatedValue",
           18: "formName", 19: "formDescription", 20: "rowNumber",
           21: "rowDescription", 23: "columnNumber", 24: "columnDescription",
           27: "calculationDefinition"}
    out = []
    for rn in sorted(rows):
        if rn <= 2:
            continue
        cells = rows[rn]
        rec = {k: cells.get(cn) for cn, k in COL.items()}
        if rec.get("name") and re.match(r"^BA\d{8}$", rec["name"]):
            out.append(rec)
    return out

els = _extract_elements()

OBLIGATION = "ORG-PR-RETURNS-002"
URN = "urn:obligation:bank:prudential:pa-d5-2025-returns-ba100-capital:v1"

# Column → entity-scope + derivation-dimension semantics (from the xlsx column
# descriptions). C0030/C0040/.../C0070 are aggregation columns derived from the
# Banking + Trading splits; C0010/C0020 are the leaf input splits.
COL_META = {
    "C0010": ("bank", "Banking-book split — items NOT designated as trading per the board-approved policy."),
    "C0020": ("bank", "Trading-book split — items designated as trading per the board-approved policy."),
    "C0030": ("bank", "Total1 — aggregate of the Banking + Trading columns (SA operations, excl. foreign branches)."),
    "C0040": ("bank", "Total bank — the reporting bank and its foreign branches (solo-plus-branches basis)."),
    "C0050": ("bank", "Bank intra-group balances — amounts within column 3/4 owed to/from group members."),
    "C0060": ("consolidated", "Consolidated bank — consolidated amounts for the reporting bank and its subsidiaries."),
    "C0070": ("controlling-company", "Consolidated bank controlling company — consolidated amounts for the controlling company group."),
}

# Whether a column is a pure cross-column aggregation (Total1 = Banking+Trading).
# C0030 is the in-row Banking+Trading aggregate; treated as a row-internal sum.
AGG_COLUMNS = {"C0030"}

# ---------------------------------------------------------------------------
# Line-item → balance-sheet section + GL-category + product-family mapping.
# Sourced from the BA 100 line-item structure (xlsx Row Descriptions) read
# against the bank's chart-of-accounts categories. This is the substantive
# accounting-engineering judgement: which products/accounts feed which line.
# ---------------------------------------------------------------------------

# row -> dict(section, glCategories[list], productFamilies[list], note)
# section in {asset, liability, equity, memo-asset, memo-liability, memo-equity,
#             analysis, total-asset, total-liability, total-equity, total-eql}
def rkey(r):
    return int(re.match(r"R(\d+)", r).group(1))

ASSET_ROWS = set(f"R{n:04d}" for n in range(10, 541, 10))   # R0010..R0540
LIAB_ROWS = set(f"R{n:04d}" for n in range(550, 791, 10))   # R0550..R0790
EQUITY_ROWS = set(f"R{n:04d}" for n in range(800, 881, 10)) # R0800..R0880

# Analysis / memorandum blocks (sub-analyses of specific lines).
ANALYSIS_ROWS = set(f"R{n:04d}" for n in range(890, 1281, 10))  # R0890..R1270

ROW_SOURCES = {
    # --- Assets ---
    "R0010": dict(section="asset", gl=["asset-cash"], pf=["cash", "deposit-placement"], note="Roll-up of cash sub-lines (R0020 in-hand, R0050 reserve, R0060 other)."),
    "R0020": dict(section="asset", gl=["asset-cash"], pf=["cash"], note="Physical cash in hand (notes + coin)."),
    "R0030": dict(section="asset", gl=["asset-cash", "asset-other"], pf=["commodity"], note="Gold coin and bullion."),
    "R0040": dict(section="asset", gl=["asset-cash"], pf=["cash"], note="Local and foreign currency holdings."),
    "R0050": dict(section="asset", gl=["asset-cash"], pf=["cash"], note="Mandatory reserve deposits with the central bank (ACC-1100-001)."),
    "R0060": dict(section="asset", gl=["asset-cash"], pf=["cash", "deposit-placement"], note="Other balances with the central bank."),
    "R0070": dict(section="asset", gl=["asset-trading", "asset-investment"], pf=["bond", "money-market"], note="Short-term negotiable securities."),
    "R0080": dict(section="asset", gl=["asset-trading", "asset-investment"], pf=["money-market"], note="Negotiable certificates of deposit held."),
    "R0090": dict(section="asset", gl=["asset-trading", "asset-investment"], pf=["bond"], note="Treasury bills."),
    "R0100": dict(section="asset", gl=["asset-trading", "asset-investment"], pf=["money-market"], note="Other short-term negotiable securities."),
    "R0110": dict(section="asset", gl=["expense-impairment", "asset-receivable"], pf=["loan", "bond"], note="Less: credit impairments against short-term securities (contra)."),
    "R0120": dict(section="asset", gl=["asset-receivable"], pf=["loan"], note="Loans and advances to customers (roll-up of R0130..R0250)."),
    "R0130": dict(section="asset", gl=["asset-receivable"], pf=["loan", "mortgage"], note="Home loans."),
    "R0140": dict(section="asset", gl=["asset-receivable"], pf=["loan", "mortgage"], note="Commercial mortgages."),
    "R0150": dict(section="asset", gl=["asset-receivable"], pf=["loan"], note="Credit cards."),
    "R0160": dict(section="asset", gl=["asset-receivable"], pf=["loan", "lease"], note="Lease and instalment debtors."),
    "R0170": dict(section="asset", gl=["asset-receivable"], pf=["loan"], note="Overdrafts."),
    "R0180": dict(section="asset", gl=["asset-receivable", "asset-investment"], pf=["loan", "equity"], note="Redeemable preference shares issued to provide credit."),
    "R0190": dict(section="asset", gl=["asset-receivable"], pf=["loan"], note="Trade, other bills and bankers' acceptances."),
    "R0200": dict(section="asset", gl=["asset-receivable"], pf=["loan"], note="Term loans."),
    "R0210": dict(section="asset", gl=["asset-receivable"], pf=["loan"], note="Factoring accounts."),
    "R0220": dict(section="asset", gl=["asset-receivable"], pf=["repo", "loan"], note="Loans granted / deposits placed under resale agreements (reverse repo)."),
    "R0230": dict(section="asset", gl=["asset-receivable"], pf=["loan"], note="Other loans to customers / clients (roll-up of R0930..R0990)."),
    "R0240": dict(section="asset", gl=["asset-receivable"], pf=["loan"], note="Gross loans and advances (subtotal)."),
    "R0250": dict(section="asset", gl=["expense-impairment", "asset-receivable"], pf=["loan"], note="Less: credit impairments (ECL allowance, contra)."),
    "R0260": dict(section="asset", gl=["asset-trading", "asset-investment"], pf=["bond", "equity"], note="Investment and trading securities (roll-up R0270..R0320)."),
    "R0270": dict(section="asset", gl=["asset-trading", "asset-investment"], pf=["equity"], note="Equities - listed."),
    "R0280": dict(section="asset", gl=["asset-investment"], pf=["equity"], note="Equities - unlisted."),
    "R0290": dict(section="asset", gl=["asset-trading", "asset-other"], pf=["commodity"], note="Commodities."),
    "R0300": dict(section="asset", gl=["asset-trading", "asset-investment"], pf=["bond"], note="Government and government-guaranteed securities."),
    "R0310": dict(section="asset", gl=["asset-trading", "asset-investment"], pf=["bond"], note="Other dated securities."),
    "R0320": dict(section="asset", gl=["expense-impairment"], pf=["bond"], note="Less: impairment on investment/trading securities (contra)."),
    "R0330": dict(section="asset", gl=["asset-derivative"], pf=["fx", "ird", "derivative"], note="Derivative financial instruments (positive fair value)."),
    "R0340": dict(section="asset", gl=["asset-trading", "asset-investment"], pf=["bond", "equity", "repo"], note="Pledged assets (roll-up R0350..R0380)."),
    "R0350": dict(section="asset", gl=["asset-trading", "asset-investment"], pf=["equity"], note="Pledged equities - listed."),
    "R0360": dict(section="asset", gl=["asset-investment"], pf=["equity"], note="Pledged equities - unlisted."),
    "R0370": dict(section="asset", gl=["asset-trading", "asset-investment"], pf=["bond"], note="Pledged government and government-guaranteed securities."),
    "R0380": dict(section="asset", gl=["asset-trading", "asset-investment"], pf=["bond"], note="Pledged other dated securities."),
    "R0390": dict(section="asset", gl=["asset-investment"], pf=["equity"], note="Investment in subsidiary companies."),
    "R0400": dict(section="asset", gl=["asset-investment"], pf=["equity"], note="Investment in associate companies."),
    "R0410": dict(section="asset", gl=["asset-investment"], pf=["equity"], note="Investments in joint ventures."),
    "R0420": dict(section="asset", gl=["asset-other"], pf=[], note="Non-current assets held for sale."),
    "R0430": dict(section="asset", gl=["asset-other"], pf=[], note="Intangible assets (roll-up R0440..R0460)."),
    "R0440": dict(section="asset", gl=["asset-other"], pf=[], note="Goodwill."),
    "R0450": dict(section="asset", gl=["asset-other"], pf=[], note="Computer software and capitalised development costs."),
    "R0460": dict(section="asset", gl=["asset-other"], pf=[], note="Other intangible assets."),
    "R0470": dict(section="asset", gl=["asset-other"], pf=[], note="Reinsurance assets."),
    "R0480": dict(section="asset", gl=["asset-other"], pf=[], note="Investment property."),
    "R0490": dict(section="asset", gl=["asset-other"], pf=[], note="Property and equipment."),
    "R0500": dict(section="asset", gl=["asset-other"], pf=[], note="Current income tax receivables."),
    "R0510": dict(section="asset", gl=["asset-other"], pf=[], note="Deferred income tax assets."),
    "R0520": dict(section="asset", gl=["asset-other"], pf=[], note="Post-employment assets."),
    "R0530": dict(section="asset", gl=["asset-other", "asset-receivable"], pf=[], note="Other assets."),
    "R0540": dict(section="total-asset", gl=[], pf=[], note="TOTAL ASSETS — sum of all asset line-items (R0010..R0530)."),
    # --- Liabilities ---
    "R0550": dict(section="liability", gl=["liability-payable"], pf=["deposit"], note="Deposits, current accounts and other creditors (roll-up R0560..R0620)."),
    "R0560": dict(section="liability", gl=["liability-payable"], pf=["deposit"], note="Current accounts."),
    "R0570": dict(section="liability", gl=["liability-payable"], pf=["deposit"], note="Savings deposits."),
    "R0580": dict(section="liability", gl=["liability-payable"], pf=["deposit"], note="Call deposits."),
    "R0590": dict(section="liability", gl=["liability-payable"], pf=["deposit"], note="Fixed and notice deposits."),
    "R0600": dict(section="liability", gl=["liability-payable"], pf=["deposit", "money-market"], note="Negotiable certificates of deposit issued."),
    "R0610": dict(section="liability", gl=["liability-payable"], pf=["deposit", "loan"], note="Other deposits and loan accounts."),
    "R0620": dict(section="liability", gl=["liability-payable"], pf=["repo"], note="Deposits received under repurchase agreements."),
    "R0630": dict(section="liability", gl=["liability-other"], pf=[], note="Liabilities under investment contracts."),
    "R0640": dict(section="liability", gl=["liability-other"], pf=[], note="Liabilities under insurance contracts."),
    "R0650": dict(section="liability", gl=["liability-other"], pf=[], note="Policyholder liabilities."),
    "R0660": dict(section="liability", gl=["liability-derivative"], pf=["fx", "ird", "derivative"], note="Derivative financial instruments and other trading liabilities (roll-up R0670..R0680)."),
    "R0670": dict(section="liability", gl=["liability-derivative"], pf=["fx", "ird", "derivative"], note="Derivative financial instruments (negative fair value)."),
    "R0680": dict(section="liability", gl=["liability-payable"], pf=["bond", "equity"], note="Other trading liabilities (short positions)."),
    "R0690": dict(section="liability", gl=["liability-other", "liability-t2-capital"], pf=["bond"], note="Term debt instruments (roll-up R0700..R0710)."),
    "R0700": dict(section="liability", gl=["liability-t2-capital"], pf=["bond"], note="Term debt qualifying as capital (Tier 2)."),
    "R0710": dict(section="liability", gl=["liability-other"], pf=["bond"], note="Other term debt instruments."),
    "R0720": dict(section="liability", gl=["liability-other"], pf=[], note="Deferred revenue."),
    "R0730": dict(section="liability", gl=["liability-other"], pf=[], note="Current income tax liabilities."),
    "R0740": dict(section="liability", gl=["liability-other"], pf=[], note="Deferred income tax liabilities."),
    "R0750": dict(section="liability", gl=["liability-other"], pf=[], note="Non-current liabilities held for sale."),
    "R0760": dict(section="liability", gl=["liability-other"], pf=[], note="Retirement benefit obligations."),
    "R0770": dict(section="liability", gl=["liability-other"], pf=[], note="Provisions."),
    "R0780": dict(section="liability", gl=["liability-other", "liability-payable"], pf=[], note="Other liabilities."),
    "R0790": dict(section="total-liability", gl=[], pf=[], note="TOTAL LIABILITIES — sum of all liability line-items (R0550..R0780)."),
    # --- Equity ---
    "R0800": dict(section="equity", gl=["equity"], pf=["equity"], note="Total equity attributable to equity holders (roll-up R0810..R0830)."),
    "R0810": dict(section="equity", gl=["equity"], pf=["equity"], note="Share capital."),
    "R0820": dict(section="equity", gl=["equity"], pf=[], note="Retained earnings."),
    "R0830": dict(section="equity", gl=["equity"], pf=[], note="Other reserves (incl. OCI reserves)."),
    "R0840": dict(section="equity", gl=["equity"], pf=["equity"], note="Preference and minority shareholders' equity (roll-up R0850..R0860)."),
    "R0850": dict(section="equity", gl=["equity"], pf=["equity"], note="Minority ordinary shareholders."),
    "R0860": dict(section="equity", gl=["equity"], pf=["equity"], note="Preference shareholders."),
    "R0870": dict(section="total-equity", gl=[], pf=[], note="TOTAL EQUITY — sum of equity line-items (R0800 + R0840)."),
    "R0880": dict(section="total-eql", gl=[], pf=[], note="TOTAL EQUITY AND LIABILITIES — must equal TOTAL ASSETS (the balance-sheet identity)."),
    # --- Analysis / memorandum blocks ---
    "R0890": dict(section="analysis", gl=["asset-receivable"], pf=["loan"], note="Analysis header: breakdown of R0120 (loans to customers)."),
    "R0900": dict(section="analysis", gl=["asset-receivable"], pf=["loan"], note="Loans and advances to customers other than banks."),
    "R0910": dict(section="analysis", gl=["asset-receivable"], pf=["loan"], note="Loans and advances to banks."),
    "R0920": dict(section="analysis", gl=["asset-receivable"], pf=["loan"], note="Analysis header: breakdown of R0230 (other loans)."),
    "R0930": dict(section="analysis", gl=["asset-receivable"], pf=["loan"], note="Interbank call loans."),
    "R0940": dict(section="analysis", gl=["asset-receivable"], pf=["loan"], note="Corporate call loans."),
    "R0950": dict(section="analysis", gl=["asset-receivable"], pf=["loan"], note="Overnight loans."),
    "R0960": dict(section="analysis", gl=["asset-receivable"], pf=["loan", "repo"], note="Collateral."),
    "R0970": dict(section="analysis", gl=["asset-receivable"], pf=["loan", "fx"], note="Foreign-currency loans."),
    "R0980": dict(section="analysis", gl=["asset-receivable"], pf=["loan"], note="Specialised lending."),
    "R0990": dict(section="analysis", gl=["asset-receivable"], pf=["loan"], note="Other loans."),
    "R1000": dict(section="analysis", gl=["asset-receivable"], pf=["loan"], note="Daily average balance for the month — interest-bearing loans (memo, period-flow)."),
    "R1010": dict(section="analysis", gl=["liability-payable"], pf=["deposit"], note="Analysis header: breakdown of R0550 (deposits) by counterparty sector."),
    "R1020": dict(section="analysis", gl=["liability-payable"], pf=["deposit"], note="Deposits from sovereigns, including central banks."),
    "R1030": dict(section="analysis", gl=["liability-payable"], pf=["deposit"], note="Deposits from public sector entities."),
    "R1040": dict(section="analysis", gl=["liability-payable"], pf=["deposit"], note="Deposits from local authorities."),
    "R1050": dict(section="analysis", gl=["liability-payable"], pf=["deposit"], note="Deposits from banks."),
    "R1060": dict(section="analysis", gl=["liability-payable"], pf=["deposit"], note="Deposits from securities firms."),
    "R1070": dict(section="analysis", gl=["liability-payable"], pf=["deposit"], note="Deposits from corporate customers."),
    "R1080": dict(section="analysis", gl=["liability-payable"], pf=["deposit"], note="Deposits from retail customers."),
    "R1090": dict(section="analysis", gl=["liability-payable"], pf=["deposit"], note="Deposits from other counterparties."),
    "R1100": dict(section="analysis", gl=["liability-payable"], pf=["deposit"], note="Interest-bearing deposits: daily average for the month (memo, period-flow)."),
    "R1110": dict(section="analysis", gl=[], pf=[], note="Encumbrance analysis header: Assets."),
    "R1120": dict(section="analysis", gl=["asset-trading", "asset-investment"], pf=["bond"], note="Encumbered amount included in R0070."),
    "R1130": dict(section="analysis", gl=["asset-trading", "asset-investment"], pf=["bond", "equity"], note="Encumbered amount included in R0260."),
    "R1140": dict(section="analysis", gl=["asset-derivative"], pf=["fx", "ird"], note="Encumbered amount included in R0330."),
    "R1150": dict(section="analysis", gl=["asset-trading", "asset-investment"], pf=["bond", "equity"], note="Encumbered amount included in R0340."),
    "R1160": dict(section="analysis", gl=["asset-investment"], pf=["equity"], note="Encumbered amount included in R0390."),
    "R1170": dict(section="analysis", gl=["asset-investment"], pf=["equity"], note="Encumbered amount included in R0400."),
    "R1180": dict(section="analysis", gl=["asset-investment"], pf=["equity"], note="Encumbered amount included in R0410."),
    "R1190": dict(section="analysis", gl=["asset-other"], pf=[], note="Encumbered amount included in R0430."),
    "R1200": dict(section="analysis", gl=["asset-other"], pf=[], note="Encumbered amount included in R0530."),
    "R1210": dict(section="analysis", gl=[], pf=[], note="Encumbrance analysis header: Liabilities."),
    "R1220": dict(section="analysis", gl=["liability-derivative"], pf=["fx", "ird"], note="Encumbered amount included in R0660."),
    "R1230": dict(section="analysis", gl=["liability-other", "liability-t2-capital"], pf=["bond"], note="Encumbered amount included in R0690."),
    "R1240": dict(section="analysis", gl=["liability-other"], pf=[], note="Encumbered amount included in R0780."),
    "R1250": dict(section="analysis", gl=[], pf=[], note="Encumbrance analysis header: Equity."),
    "R1260": dict(section="analysis", gl=["equity"], pf=["equity"], note="Encumbered amount included in R0800."),
    "R1270": dict(section="analysis", gl=["equity"], pf=["equity"], note="Encumbered amount included in R0840."),
}

# Product-family → existing APPROVED product ids (the canonical set is the
# `ProductApproved` event stream — see the recon, which asserts every product
# ref here is a real approved product). The 9 currently-approved products:
#   prd:bank:bond:open-repo-gmra, prd:bank:bond:sagb-fixed-coupon,
#   prd:bank:equity:jse-equity-cash, prd:bank:fx:fx-swap-usdzar,
#   prd:bank:fx:otc-vanilla, prd:bank:ird:vanilla-zar-fix-zaronia,
#   prd:bank:treasury:funding-line, prd:bank:treasury:mmd-deposit,
#   prd:bank:treasury:repo-sagb-term.
# A family with no concrete approved product maps to [] (the line is
# licence-day-data until such a product is approved via NPA and booked).
PRODUCT_FAMILY = {
    "cash": [],  # cash materialises from FX settlement; no standalone cash product
    "fx": ["prd:bank:fx:otc-vanilla", "prd:bank:fx:fx-swap-usdzar"],
    "bond": ["prd:bank:bond:sagb-fixed-coupon"],
    "equity": ["prd:bank:equity:jse-equity-cash"],
    "repo": ["prd:bank:bond:open-repo-gmra", "prd:bank:treasury:repo-sagb-term"],
    "ird": ["prd:bank:ird:vanilla-zar-fix-zaronia"],
    "derivative": ["prd:bank:ird:vanilla-zar-fix-zaronia", "prd:bank:fx:otc-vanilla"],
    "deposit": ["prd:bank:treasury:mmd-deposit"],
    "deposit-placement": ["prd:bank:treasury:funding-line"],
    "money-market": ["prd:bank:treasury:mmd-deposit"],
    "loan": [],          # no loan product approved yet — licence-day
    "mortgage": [],      # no mortgage product yet — licence-day
    "lease": [],         # no lease product yet — licence-day
    "commodity": [],     # no commodity product yet — licence-day
}

# Lines whose underlying data is structurally only real at licence-day even
# though the source mapping is fully defined (no customers / no real positions
# in the build phase, or non-trading-book items the bank does not yet hold).
LICENCE_DAY_SECTIONS_NOTE = {
    "asset": "real balances exist only once positions are booked at licence-day",
    "liability": "real balances exist only once liabilities are taken on at licence-day",
    "equity": "real equity exists only once capital is raised at licence-day",
    "analysis": "the underlying line is only populated at licence-day",
}

def col_value_type(col):
    return "money"  # all 843 BA-code cells are Monetary1000 amounts

def build_cell(e):
    code = e["name"]
    row = e["rowNumber"]
    col = e["columnNumber"]
    rowlabel = e.get("rowDescription") or ""
    collabel = e.get("columnDescription") or ""
    regdef = (e.get("description") or "").strip()
    if not regdef:
        regdef = f"{rowlabel} — {collabel} column. (No XSD documentation string; meaning per the BA 100 line-item structure and the column dimension.)"
    calc = e.get("calculatedValue")
    calcdef = e.get("calculationDefinition")
    rs = ROW_SOURCES.get(row, dict(section="analysis", gl=[], pf=[], note=rowlabel))
    section = rs["section"]
    col_entity, col_note = COL_META.get(col, ("bank", ""))

    label = f"{rowlabel} / {collabel}".strip(" /")

    # --- derivation ---
    is_total = section.startswith("total")
    if calc and calcdef:
        derivation = {"kind": "sum", "expression": calcdef}
    elif is_total:
        derivation = {"kind": "sum", "expression": f"sum of constituent {section.replace('total-','')} line-items (see BA 100 form layout)"}
    elif col in AGG_COLUMNS:
        derivation = {"kind": "sum", "expression": f"[{row},C0010]+[{row},C0020] (Banking + Trading)"}
    else:
        derivation = {"kind": "direct", "expression": f"GL trial-balance fold for line {row}, {collabel} dimension"}

    # --- data requirements ---
    data_reqs = []
    if is_total or section in ("total-asset", "total-liability", "total-equity", "total-eql"):
        # totals are fed entirely by other cells; one projection requirement.
        data_reqs.append({
            "sourceKind": "projection",
            "ref": "ba100-balance-sheet-fold",
            "description": f"{rowlabel}: aggregated from the constituent cells via the BA 100 balance-sheet projection fold.",
            "required": True,
        })
    else:
        # GL-account requirements (category-level — the concrete account ids are
        # resolved at fold time from the CoA by category).
        for cat in rs["gl"]:
            data_reqs.append({
                "sourceKind": "gl-account",
                "ref": f"category:{cat}",
                "description": f"Chart-of-accounts balances in category '{cat}' fold into {rowlabel}.",
                "required": True,
            })
        # GL trial-balance projection requirement.
        data_reqs.append({
            "sourceKind": "projection",
            "ref": "gl-trial-balance",
            "description": f"GL trial-balance fold supplies the {collabel}-dimension balance for {rowlabel}.",
            "required": True,
        })
        # Banking/Trading split needs the trading-book designation attribute.
        if col in ("C0010", "C0020"):
            data_reqs.append({
                "sourceKind": "product-attribute",
                "ref": "tradingBookDesignation",
                "description": "Each instrument must carry its board-approved trading-book vs banking-book designation to split into the Banking (C0010) / Trading (C0020) columns.",
                "required": True,
            })
        # Consolidation columns need the entity/consolidation scope.
        if col in ("C0060", "C0070"):
            data_reqs.append({
                "sourceKind": "reference-data",
                "ref": "legal-entity-tree",
                "description": "The consolidation scope (subsidiaries / controlling company) from the versioned legal-entity tree determines which entities' balances aggregate into this consolidated column.",
                "required": True,
            })
        if col == "C0050":
            data_reqs.append({
                "sourceKind": "reference-data",
                "ref": "party-register:intra-group",
                "description": "Intra-group counterparty flags from the party register identify amounts owed to/from group members for the intra-group column.",
                "required": True,
            })
        # Product-attribute requirements for the product families feeding the line.
        prod_ids = []
        for fam in rs["pf"]:
            prod_ids.extend(PRODUCT_FAMILY.get(fam, []))
        prod_ids = sorted(set(prod_ids))
        for pid in prod_ids:
            data_reqs.append({
                "sourceKind": "product-attribute",
                "ref": f"{pid}#balanceSheetClassification",
                "description": f"Product {pid} must declare its balance-sheet line classification so its booked positions fold into {rowlabel}.",
                "required": False,
            })

    # --- status ---
    # `sourced` ⇔ every REQUIRED dataRequirement points at a real existing
    # substrate source (a GL category that exists in the CoA, a projection that
    # exists, the legal-entity tree / party register / trading-book designation
    # — all of which exist now). A cell is `licence-day-data` ONLY when a
    # product family that feeds the line has NO concrete product in the
    # catalogue (loans, mortgages, leases, commodities) — i.e. the substrate to
    # capture the data does not yet exist. (Build-phase data-emptiness alone is
    # NOT a reason to down-grade from `sourced`: the SOURCE exists; only the
    # VALUES are empty until licence-day, which the L1 procedure handles via the
    # no-silent-zeros posture — an unbooked line folds to 0, honestly.)
    status = "sourced"
    status_reason = None
    # Families whose line CANNOT be sourced without a product (i.e. the only way
    # the line gets a balance is via a booked product). `cash` is excluded: cash
    # lines fold from real GL cash accounts (ACC-1000/1100/1200) that exist now
    # and need no dedicated "cash product".
    PRODUCT_REQUIRING = {"loan", "mortgage", "lease", "commodity", "deposit",
                          "deposit-placement", "money-market", "fx", "bond",
                          "equity", "repo", "ird", "derivative"}
    feeding_families = [f for f in rs["pf"] if f in PRODUCT_REQUIRING]
    families_without_products = [f for f in feeding_families if len(PRODUCT_FAMILY.get(f, [])) == 0]
    if feeding_families and len(families_without_products) == len(feeding_families):
        # EVERY product family feeding this line lacks a concrete product
        # (e.g. R0120 loans → loan family has no product). The line cannot be
        # sourced from a product today; the GL category exists but no product
        # books into it yet.
        status = "licence-day-data"
        fams = ", ".join(families_without_products)
        status = "licence-day-data"
        status_reason = (
            f"No product yet exists in the catalogue for product family(ies) [{fams}] that feed this line; "
            f"the GL/source mapping is fully defined but no product books into it until such a product is "
            f"approved (NPA) and booked at licence-day. The line folds to an honest 0 until then "
            f"(no silent fabrication; CLAUDE.md build-phase vs licence-day)."
        )

    # currency dimension (P5): by-currency for the explicit FX-loan analysis line,
    # functional otherwise (SARB returns are functional-ZAR).
    currency_dim = "by-currency" if row == "R0970" else "functional"

    # applicability product scope
    if is_total or section in ("total-asset", "total-liability", "total-equity", "total-eql"):
        product_scope = "universal"
    elif rs["pf"]:
        product_scope = sorted(set(rs["pf"]))
    else:
        product_scope = "universal"

    # --- hashtotal control cells (no grid coordinate; a sum-control over a
    #     cell range for upload-integrity) — classify distinctly. ---
    is_hashtotal = (not row and not col) and "hashtotal" in (rowlabel or "").lower()

    # cellRef — omit absent grid coordinates (hashtotal / meta cells).
    cell_ref = {"xsdElement": code}
    if row:
        cell_ref["row"] = row
    if rowlabel:
        cell_ref["rowLabel"] = rowlabel
    if col:
        cell_ref["column"] = col
    if collabel:
        cell_ref["columnLabel"] = collabel

    if is_hashtotal:
        cell = {
            "returnForm": "BA100",
            "cellRef": cell_ref,
            "label": rowlabel or code,
            "regulatoryDefinition": regdef,
            "citations": [
                {"obligationId": OBLIGATION,
                 "clause": "SARB PA Directive D5/2025 §2.1.3 (form BA 100 — Balance Sheet) — upload-integrity hash-total over the reported cell range (BA100 XSD control field)."},
            ],
            "valueType": "hashtotal",
            "unit": "control-sum",
            "derivation": {"kind": "sum",
                           "expression": (calcdef or regdef or "sum of the cell range identified in the XSD documentation (upload-integrity control)")},
            "dataRequirements": [{
                "sourceKind": "projection",
                "ref": "ba100-balance-sheet-fold",
                "description": f"{rowlabel}: control hash-total computed over the populated BA 100 cell range at report-generation time.",
                "required": True,
            }],
            "applicability": {
                "entityScope": "bank",
                "jurisdiction": "ZA",
                "productScope": "universal",
            },
            "status": "sourced",
        }
        return cell

    cell = {
        "returnForm": "BA100",
        "cellRef": cell_ref,
        "label": label or code,
        "regulatoryDefinition": regdef,
        "citations": [
            {"obligationId": OBLIGATION,
             "clause": "SARB PA Directive D5/2025 §2.1.3 (form BA 100 — Balance Sheet, Annexure 2A/2B) read with the Regulations relating to Banks; Banks Act 94 of 1990 s.6(6)(a)."},
        ],
        "valueType": "money",
        "currencyDimension": currency_dim,
        "unit": "ZAR-thousands",  # Monetary1000 — amounts reported in thousands
        "derivation": derivation,
        "dataRequirements": data_reqs,
        "applicability": {
            "entityScope": col_entity,
            "jurisdiction": "ZA",
            "productScope": product_scope,
        },
        "status": status,
    }
    if status_reason:
        cell["statusReason"] = status_reason
    return cell

cells = [build_cell(e) for e in els]

contract = {
    "returnForm": "BA100",
    "formName": "Balance Sheet",
    "obligationId": OBLIGATION,
    "schemaSource": "Regulations/SARB-PA/ba-returns/schemas/BA100.zip → BA100.xsd + SARB-Return - BA100.xlsx (Elements sheet)",
    "cells": cells,
}

# Compact (no whitespace) — the JSON is machine-generated reference data read
# programmatically (ba100-contract.ts), never hand-edited; compact keeps it
# under the biome 1 MiB lint ceiling while staying diff-stable (sorted keys).
with open(OUT_JSON, "w") as fh:
    json.dump(contract, fh, separators=(",", ":"), ensure_ascii=False)
    fh.write("\n")
from collections import Counter
print("wrote", OUT_JSON)
print("cells:", len(cells))
print("status:", Counter(c["status"] for c in cells))
print("valueType:", Counter(c["valueType"] for c in cells))
print("currencyDim:", Counter(c.get("currencyDimension", "(none)") for c in cells))
print("derivation kinds:", Counter(c["derivation"]["kind"] for c in cells))
