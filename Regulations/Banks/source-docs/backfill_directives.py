#!/usr/bin/env python3
"""
backfill_directives.py
======================
Batch-downloads SARB Banks Act directive and circular PDFs from resbank.co.za,
extracts full section content, and updates structured JSON files in-place.

Usage:
    python3 backfill_directives.py [--dry-run] [--slug SLUG] [--workers N]

Options:
    --dry-run       Show what would happen without downloading or writing
    --slug SLUG     Process only a specific slug (e.g. banks-d2-2024)
    --workers N     Parallel workers for URL probing (default: 8)
"""

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent.resolve()
PDF_CACHE = Path("/tmp/sarb-pdfs")
PDF_CACHE.mkdir(parents=True, exist_ok=True)

DIRECTIVES_BASE = (
    "https://www.resbank.co.za/content/dam/sarb/publications/"
    "prudential-authority/pa-deposit-takers/banks-directives"
)
CIRCULARS_BASE = (
    "https://www.resbank.co.za/content/dam/sarb/publications/"
    "prudential-authority/pa-deposit-takers/banks-circulars"
)

MIN_TEXT_CHARS = 200  # reject PDF if extracted text shorter than this

# ---------------------------------------------------------------------------
# Title catalog: slug → short title used in filename generation
# ---------------------------------------------------------------------------

TITLE_CATALOG = {
    # Circulars
    "banks-c3-2013": "Interpretation and application of criteria relating to effective maturity",
    "banks-c4-2013": "Treatment of investments in banking financial securities insurance and commercial entities",
    "banks-c5-2013": "Reporting of items subject to thresholds that do not constitute a full deduction from qualifying capital and reserve funds",
    "banks-c2-2014": "Interpretation of definition of default as outlined in regulation 67",
    "banks-c7-2014": "External auditors of newly acquired or established entities",
    "banks-c4-2015": "Matters related to banks compliance with LCR and HQLA",
    "banks-c5-2015": "Matters related to the use of support in a bank credit risk rating process",
    "banks-c8-2015": "Countercyclical capital buffer for South Africa",
    "banks-c4-2016": "Matters relating to the implementation of the capital conservation buffer",
    "banks-c5-2016": "Matters of interpretation relating to the liquidity coverage ratio",
    "banks-c7-2016": "Matters related to specified minority interests",
    "banks-c2-2018": "Requirements related to a due diligence audit of the financial condition of a bank",
    "banks-c2-2020": "Classification of Land Bank bills under LCR framework",
    "banks-c3-2020": "Disclosure of capital-related matters",
    "banks-c2-2023": "Matters related to the fitness and propriety assessment",
    "banks-c3-2023": "Eligibility of a Sukuk bond issuance",
    "banks-c1-2026": "Status of Previously Issued Circulars and Directives",
    # Directives
    "banks-d1-2008": "Use of divisional names",
    "banks-d2-2008": "Procedure to be followed in respect of applications under sections 37 52 and or 54",
    "banks-d3-2008": "Appointment of directors or executive officers and completion of form BA 020",
    "banks-d4-2008": "Disclosure of repurchase and resale agreements and similar transactions",
    "banks-d6-2008": "Auditor rotation",
    "banks-d2-2011": "Reporting daily value-at-risk amounts for market risk using specified items of form BA 325",
    "banks-d5-2011": "Exemption from certain minimum disclosure requirements for branches",
    "banks-d1-2012": "Information to be included in securitisation applications",
    "banks-d9-2013": "Investments and loans and advances by controlling companies",
    "banks-d10-2013": "Limit in respect of effective net open foreign currency position",
    "banks-d13-2013": "Clarification of requirements for approval of acquisition of an interest outside SA",
    "banks-d2-2014": "Matters related to changes to internal rating systems",
    "banks-d8-2014": "Matters related to compliance with the liquidity coverage ratio",
    "banks-d1-2015": "Minimum requirements for recovery plans",
    "banks-d2-2015": "Effective risk data aggregation and risk reporting",
    "banks-d4-2015": "Amendments to the Regulations relating to Banks",
    "banks-d7-2015": "Restructured credit exposures",
    "banks-d10-2015": "Matters related to changes to the AMA operational risk system",
    "banks-d5-2016": "Compliance with principles for effective risk data aggregation",
    "banks-d7-2016": "Assessment of instruments issued by D-SIBs",
    "banks-d8-2016": "Reporting requirements relating to material outsourced service providers",
    "banks-d1-2017": "Matters related to qualifying capital instruments issued by subsidiaries",
    "banks-d2-2017": "Matters relating to communication of key audit matters",
    "banks-d3-2017": "Assets lodged or pledged to secure liabilities",
    "banks-d4-2017": "Matters related to securitisation vehicles",
    "banks-d6-2017": "Process in terms of specific capital issuances and redemptions",
    "banks-d2-2018": "Materiality threshold for countercyclical capital buffer",
    "banks-d3-2018": "Cloud computing and the offshoring of data",
    "banks-d2-2019": "Reporting of material IT and or cyber incidents",
    "banks-d5-2020": "Prudent Valuation Adjustments Framework",
    "banks-d7-2020": "Calculation of derivative exposure amount for leverage ratio",
    "banks-d2-2021": "AT1 capital instruments with contingent must-pay clauses",
    "banks-d4-2021": "Externally facilitated liquidity stress simulations",
    "banks-d5-2021": "Capital framework for South Africa based on the Basel III framework",
    "banks-d6-2021": "Credit risk models for specialised lending and project finance",
    "banks-d9-2021": "Principles for the sound management of operational risk",
    "banks-d1-2022": "LCR scope of application and matters related to calculation and disclosure",
    "banks-d2-2022": "Requirements for conducting the business of a representative office",
    "banks-d4-2022": "Requirement to submit AML CFT risk returns periodically",
    "banks-d5-2022": "Matters relating to liquidity risk",
    "banks-d6-2022": "Matters related to fit-and-proper assessment for beneficial owners",
    "banks-d7-2022": "Matters related to fit-and-proper assessment for directors",
    "banks-d9-2022": "Matters relating to domestic money or value transfer services",
    "banks-d10-2022": "Criteria for identifying STC term and short-term securitisations",
    "banks-d11-2022": "National discretion related to the LCR",
    "banks-d1-2023": "Matters related to the net stable funding ratio",
    "banks-d2-2023": "Directive for the completion of form BA 330",
    "banks-d3-2023": "Regulatory treatment of accounting provisions",
    "banks-d4-2023": "Directive on operational resilience",
    "banks-d7-2023": "Directive on matters relating to eligible external credit assessment institutions",
    "banks-d1-2024": "Pillar 3 disclosure requirements for IRRBB",
    "banks-d2-2024": "Reporting requirements in terms of regulation 46",
    "banks-d3-2024": "Minimum regulatory requirements relating to covered deposits",
    "banks-d5-2024": "Loss absorbency requirements for AT1 and T2 capital instruments",
    "banks-d6-2024": "Implementation of a positive cycle-neutral countercyclical capital buffer",
    "banks-d2-2025": "Capital treatment of significant investments in insurance entities",
    "banks-d3-2025": "Matters related to the leverage ratio buffer for D-SIBs",
    "banks-d4-2025": "Completion of regulatory return form BA 701",
    "banks-d5-2025": "Returns to be submitted to the Prudential Authority",
    "banks-d6-2025": "Returns to be submitted to the PA with effect from 1 July 2025",
    "banks-d7-2025": "D-SIBs to submit consolidated information",
    "banks-d8-2025": "Threshold amounts related to standardised and IRB approaches",
    "banks-d9-2025": "Prudential treatment of credit exposures secured by forest and agricultural land",
    "banks-d10-2025": "Matters related to Pillar 3 disclosure requirements under regulation 43",
    "banks-d11-2025": "Prudential treatment of distressed restructured credit exposures",
    "banks-d12-2025": "Basel III post-crisis reforms implementation roadmap",
    "banks-d13-2025": "Appointment of auditors under section 61(2)",
    "banks-d14-2025": "Large exposures committee composition",
    "banks-d1-2026": "Promotion of sound corporate governance",
}

# ---------------------------------------------------------------------------
# Explicit URL overrides (where PDF filename ≠ catalog title or uses unusual path)
# ---------------------------------------------------------------------------

# Maps slug → exact URL (confirmed working via HEAD requests or web search).
# Add entries here when auto-discovery fails due to non-standard filenames.
_B = "https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority"
_D = f"{_B}/pa-deposit-takers/banks-directives"
_C = f"{_B}/pa-deposit-takers/banks-circulars"

URL_OVERRIDES: dict[str, str] = {
    # --- 2026 circulars ---
    "banks-c1-2026": f"{_C}/2026/C1-2026.pdf",
    # --- 2025 directives ---
    "banks-d2-2025": (
        f"{_D}/2025/d2-of-2025/"
        "D2-2025%20Matters%20related%20to%20the%20Capital%20treatment%20of%20significant%20investments%20in%20Insurance%20entities.pdf"
    ),
    "banks-d3-2025": f"{_D}/2025/D3-2025%20-%20Matters%20relating%20to%20Leverage%20Buffer%20requirements.pdf",
    "banks-d5-2025": f"{_D}/2025/D5-2025%20-Directive%20replacing%20D1%20of%202025%20returns%20to%20be%20submitted%20to%20the%20PA.pdf",
    "banks-d9-2025": f"{_D}/2025/D9-2025%20-%20Prudential%20treatment%20of%20credit%20exposures%20secured%20by%20forest%20and%20agricultural%20land.pdf",
    "banks-d10-2025": f"{_D}/2025/d10-2025/D10-2025%20-%20Directive%20on%20Pillar%203%20disclosure%20requirements.pdf",
    "banks-d11-2025": f"{_D}/2025/d11/D11-2025%20-%20Prudential%20treatment%20of%20distressed%20restructured%20credit%20exposures.pdf",
    # --- 2025 circulars ---
    "banks-c3-2025": f"{_C}/2025/C3-2025.pdf",
    "banks-c4-2025": f"{_C}/2025/C4-2025-Basel%20III%20post-crisis%20reforms%20reporting.pdf",
    # --- 2024 directives ---
    "banks-d2-2024": (
        f"{_D}/2024/d2-of-2024/"
        "D2%20-%202024%20-%20Directive_Reporting%20requirements%20in%20terms%20of%20regulation%2046.pdf"
    ),
    "banks-d3-2024": f"{_D}/2024/d3-of-2024/D3-2024%20-%20Minimum%20regulatory%20requirements%20relating%20to%20covered%20deposits.pdf",
    "banks-d5-2024": f"{_D}/2024/d5-of-2024/D5%20-%202024%20-%20Loss%20absorbency%20requirements%20for%20additional%20tier%201%20and%20tier%202%20capital%20instruments.pdf",
    "banks-d6-2024": f"{_D}/2024/d6-of-2024/D6-2024%20-%20Positive%20cycle-neutral%20countercyclical%20capital%20buffer.pdf",
    # --- 2024 circulars ---
    "banks-c1-2024": f"{_C}/2024/C1-2024%20-%20Status%20of%20Previously%20issues%20circulars.pdf",
    "banks-c2-2024": f"{_C}/2024/C2-2024_Basel%20III%20post-crisis%20reforms%20reporting.pdf",
    # --- 2023 directives ---
    "banks-d1-2023": f"{_D}/2023/D1_2023%20Matters%20related%20to%20the%20NSFR.pdf",
    "banks-d2-2023": f"{_D}/2023/d2/D2-2023%20-%20Directive%20for%20the%20completion%20of%20the%20form%20BA330.pdf",
    "banks-d3-2023": f"{_D}/2023/D3-2023-Regulatory%20treatment%20of%20accounting%20provisions.pdf",
    "banks-d4-2023": f"{_D}/2023/D4-2023%20-%20Directive%20on%20operational%20resilience.pdf",
    "banks-d6-2023": f"{_D}/2023/D6-2023%20-%20Directive%20to%20replace%20D1%20of%202021.pdf",
    "banks-d7-2023": f"{_D}/2023/D7-2023%20-%20Directive%20on%20Matters%20relating%20to%20eligible%20%20ECAIs.pdf",
    "banks-d8-2023": f"{_D}/2023/D8-2023%20-%20Threshold%20amounts%20related%20to%20the%20revised%20standardised%20and%20IRB%20approaches%20for%20credit%20risk%20and%20the%20liquidity%20risk%20framework.pdf",
    # --- 2022 directives ---
    "banks-d1-2022": f"{_D}/2022/D1-2022%20-%20Liquidity%20coverage%20ratio_%20scope%20of%20application%20and%20matters%20related%20to%20calculation%20and%20disclosure_.pdf",
    "banks-d2-2022": f"{_D}/2022/D2-2022%20-%20Consistent%20applications%20requirements%20across%20representative%20offices.pdf",
    "banks-d4-2022": f"{_D}/2022/d4-2022/D4%20-%202022%20-%20Directive%20on%20Risk%20Return.pdf",
    "banks-d5-2022": f"{_D}/2022/D5-2022%20-%20Matters%20relating%20to%20liquidity%20risk.pdf",
    "banks-d6-2022": f"{_D}/2022/D6-2022%20-%20Banks%20CBC%20Directive%20-%20Benefical%20owners.pdf",
    "banks-d7-2022": f"{_D}/2022/D7-2022%20-%20Banks%20CBC%20Directive%20-%20Directors%20and%20executive%20officers.pdf",
    "banks-d10-2022": f"{_D}/2022/D10-2022-Criteria%20for%20identifying%20simple%20transparent%20and%20comparable%20term%20and%20short%20term%20securitisations.pdf",
    "banks-d11-2022": f"{_D}/2022/D11-2022%20-%20National%20discretion%20related%20to%20the%20liquidity%20coverage%20ratio.pdf",
    # --- 2021 directives ---
    "banks-d2-2021": f"{_D}/2021/D2%20-%202021%20-%20Matters%20related%20to%20the%20issuance%20of%20additional%20tier%201%20capital%20instruments%20that%20contain%20contingent.pdf",
    "banks-d4-2021": f"{_D}/2021/D4%20-%202021%20-%20Externally-facilitated%20liquidity%20stress%20simulation.pdf",
    "banks-d5-2021": f"{_D}/2021/D5%20-%202021%20-%20Capital%20Framework%20for%20South%20Africa%20based%20on%20the%20Basel%20III%20framework.pdf",
    "banks-d6-2021": f"{_D}/2021/D6%20-%202021%20-%20Matters%20related%20to%20the%20use%20of%20credit%20risk%20models.pdf",
    "banks-d9-2021": f"{_D}/2021/D9-2021%20-%20Principles%20for%20the%20Sound%20Management%20of%20Operational%20Risk.pdf",
    # --- 2020 directives ---
    "banks-d5-2020": f"{_D}/2020/10218/D5-of-2020---Matters-related-to-the-Prudential-Valuation-Adjustment-Framework.pdf",
    "banks-d7-2020": f"{_B}/pa-banks/banks-directives/2020/D7%20of%202020.pdf",
    # --- 2019 directives ---
    "banks-d2-2019": f"{_D}/2019/9487/01-D2-of-2019-1-.pdf",
    # --- 2018 directives ---
    "banks-d2-2018": f"{_D}/2018/8705/D2-of-2018.pdf",
    # --- 2017 directives ---
    "banks-d3-2017": f"{_D}/2017/7959/D3-of-2017.pdf",
    "banks-d4-2017": f"{_D}/2017/8012/D4-of-2017.pdf",
    "banks-d6-2017": f"{_D}/2017/8101/D6-of-2017.pdf",
    # --- 2016 directives ---
    "banks-d5-2016": f"{_D}/2016/7465/D5-of-2016.pdf",
    "banks-d7-2016": f"{_D}/2016/7574/D7-of-2016.pdf",
    "banks-d8-2016": f"{_D}/2016/7602/D8-of-2016.pdf",
    # --- 2015 directives ---
    "banks-d1-2015": f"{_D}/2015/6602/D1-of-2015.pdf",
    "banks-d2-2015": f"{_D}/2015/6629/D2-of-2015.pdf",
    "banks-d4-2015": f"{_D}/2015/6664/D4-of-2015.pdf",
    "banks-d7-2015": f"{_D}/2015/6716/D7-of-2015.pdf",
    "banks-d10-2015": f"{_D}/2015/6995/D10-of-2015.pdf",
    # --- 2014 directives ---
    "banks-d2-2014": f"{_D}/2014/6356/D2-of-2014.pdf",
    "banks-d8-2014": f"{_D}/2014/6474/D8-of-2014.pdf",
    # --- 2013 directives ---
    "banks-d9-2013": f"{_D}/2013/5792/D9-of-2013.pdf",
    # --- 2011 directives ---
    "banks-d5-2011": f"{_D}/2011/4890/D52011.pdf",
    # --- 2020 circulars ---
    "banks-c3-2020": f"{_C}/2020/10203/C3-of-2020---Disclosure-of-capital-related-matters.pdf",
    # --- 2018 circulars ---
    "banks-c2-2018": f"{_C}/2018/8645/C2-of-2018.pdf",
    # --- 2016 circulars ---
    "banks-c4-2016": f"{_C}/2016/7251/C4-of-2016.pdf",
}

# ---------------------------------------------------------------------------
# URL candidate generation
# ---------------------------------------------------------------------------


def parse_slug(slug: str) -> tuple[str, int, int]:
    """Return (instrument_type, number, year) from slug like 'banks-d2-2024'."""
    m = re.match(r"banks-([a-z]+?)(\d+)-(\d{4})$", slug)
    if not m:
        raise ValueError(f"Cannot parse slug: {slug}")
    prefix, num_str, year_str = m.group(1), m.group(2), m.group(3)
    # prefix is 'd', 'c', 'gn' etc.
    return prefix, int(num_str), int(year_str)


def make_url_candidates(slug: str) -> list[str]:
    """
    Generate candidate URLs to probe for a given slug.
    Returns a list ordered from most-likely to least-likely.
    """
    try:
        prefix, num, year = parse_slug(slug)
    except ValueError:
        return []

    title = TITLE_CATALOG.get(slug, "")
    short_code = slug.replace("banks-", "")  # e.g. 'd2-2024', 'c3-2013'

    is_directive = prefix.startswith("d")
    is_circular = prefix == "c"

    if is_directive:
        base = DIRECTIVES_BASE
        type_letter = "D"
        pub_type = "directive"  # noqa: F841 (unused but kept for clarity)
    elif is_circular:
        base = CIRCULARS_BASE
        type_letter = "C"
    else:
        # Government notices / other – not handled here
        return []

    year_base = f"{base}/{year}"

    # Build filename variants (without URL encoding; we encode later)
    # Pattern 1: "D2 - 2024 - Directive_<title>" (2024 specific oddity)
    # Pattern 2: "D3-2024 - <title>"
    # Pattern 3: "D2-2025 <title>"
    # Pattern 4: "D10-2025 - <title>"
    # Pattern 5: "C1-2024 - <title>"
    # Pattern 6: "C2-2024_<title>"
    # Pattern 7: bare "D5-2021" (no title)
    # Pattern 8: "D5-2021 - <title>"

    code_dash = f"{type_letter}{num}-{year}"   # D2-2024
    code_space = f"{type_letter}{num} - {year}"  # D2 - 2024

    filenames = []
    if title:
        filenames += [
            f"{code_dash} - {title}.pdf",
            f"{code_dash} - {title.capitalize()}.pdf",
            f"{code_dash} - {type_letter}irective {title}.pdf" if is_directive else None,
            f"{code_space} - {type_letter}irective_{title}.pdf" if is_directive else None,
            f"{code_dash}_{title}.pdf",
            f"{code_dash} {title}.pdf",
            f"{code_dash}-{title}.pdf",
        ]
    filenames += [
        f"{code_dash}.pdf",
        f"{type_letter}{num} of {year}.pdf",
        f"{type_letter}{num}-of-{year}.pdf",
    ]
    # Remove None entries
    filenames = [f for f in filenames if f]

    # Subdirectory variants
    subdirs = [
        "",                               # no subdir
        f"d{num}-of-{year}",             # d2-of-2024
        f"d{num}-{year}",                # d2-2024
        f"{type_letter.lower()}{num}-of-{year}",  # same but lowercase
        f"{type_letter.lower()}{num}-{year}",
    ]
    if not is_directive:
        subdirs = [
            "",
            f"c{num}-of-{year}",
            f"c{num}-{year}",
        ]

    candidates = []
    for subdir in subdirs:
        prefix_url = f"{year_base}/{subdir}/" if subdir else f"{year_base}/"
        for fn in filenames:
            candidates.append(prefix_url + urllib.parse.quote(fn, safe="/-_."))

    return candidates


# ---------------------------------------------------------------------------
# HTTP probing
# ---------------------------------------------------------------------------


def probe_url(url: str, timeout: int = 8) -> bool:
    """Return True if URL returns HTTP 200."""
    result = subprocess.run(
        ["curl", "-sI", "--max-time", str(timeout), url],
        capture_output=True,
        text=True,
    )
    return "HTTP/2 200" in result.stdout or "HTTP/1.1 200" in result.stdout


def find_pdf_url(slug: str, workers: int = 8) -> str | None:
    """Probe candidate URLs in parallel; return first 200 URL or None."""
    # Check explicit overrides first (no probe needed)
    if slug in URL_OVERRIDES:
        url = URL_OVERRIDES[slug]
        if probe_url(url):
            return url
        # Override failed — fall through to discovery

    candidates = make_url_candidates(slug)
    if not candidates:
        return None

    # Use thread pool for parallel probing
    with ThreadPoolExecutor(max_workers=workers) as ex:
        future_to_url = {ex.submit(probe_url, url): url for url in candidates}
        # We want the first valid one *in candidate order*, not arbitrary first done
        results = {}
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            results[url] = future.result()

    # Return first candidate that was 200, preserving order
    for url in candidates:
        if results.get(url):
            return url
    return None


# ---------------------------------------------------------------------------
# PDF download
# ---------------------------------------------------------------------------


def download_pdf(url: str, dest: Path, timeout: int = 60) -> bool:
    """Download PDF to dest. Returns True on success."""
    result = subprocess.run(
        ["curl", "-sL", "--max-time", str(timeout), "-o", str(dest), url],
        capture_output=True,
    )
    return result.returncode == 0 and dest.exists() and dest.stat().st_size > 1000


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------


PDFTOTEXT = "/opt/homebrew/bin/pdftotext"


def extract_text(pdf_path: Path) -> str:
    """Extract text from PDF using pdftotext -layout."""
    result = subprocess.run(
        [PDFTOTEXT, "-layout", str(pdf_path), "-"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    return result.stdout


# ---------------------------------------------------------------------------
# Section parsing
# ---------------------------------------------------------------------------


def clean_line(line: str) -> str:
    """Collapse multiple spaces and strip."""
    return re.sub(r"  +", " ", line).strip()


def strip_cover_page(text: str) -> str:
    """
    Remove the SARB letterhead/cover page boilerplate before the first
    top-level section or the directive reference line.
    """
    lines = text.splitlines()
    start_idx = 0

    # Find the first numbered section (e.g. "1." or "1 " at start of a non-empty line)
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Match section "1." or "1 " at start, possibly with some leading spaces
        if re.match(r"^\d+[\.\)]\s+\w", stripped):
            start_idx = i
            break
        # Also accept "Introduction" as the start if there's no number
        if re.match(r"^Introduction\b", stripped, re.IGNORECASE) and i > 5:
            start_idx = i
            break

    if start_idx == 0:
        # Fallback: skip past letterhead by looking for "CONFIDENTIAL", address blocks
        # Try to find first blank line after reference/subject line
        for i, line in enumerate(lines):
            if re.match(r"^Ref\.\s*:", line.strip()) or re.match(r"^[DC]\d+/\d{4}", line.strip()):
                # Skip forward to first numbered section
                for j in range(i, len(lines)):
                    if re.match(r"^\s*\d+[\.\)]\s+\w", lines[j]):
                        start_idx = j
                        break
                break

    return "\n".join(lines[start_idx:])


def parse_sections(text: str, slug: str) -> list[dict]:
    """
    Parse numbered sections from extracted PDF text.
    Returns a list of section dicts compatible with the structured JSON schema.
    """
    text = strip_cover_page(text)
    lines = text.splitlines()

    # Collect all section boundaries
    # Top-level: "1." "2." "10." etc. at start of line (with optional whitespace)
    # Subsection: "1.1" "1.2.3" etc.
    # Annexure: "Annexure" or "Annexure 1" or "Annex A"

    # Top-level: "1." or "1 " at start, number 1-30, heading starts with capital or digit
    # Must have at least minimal whitespace column alignment (col <= 4 for top-level)
    top_section_re = re.compile(
        r"^(\s{0,4})(\d{1,2})\.\s{2,}([A-Z].{2,})$"
    )
    # Subsection: "1.1  heading" or "1.1.2  heading"
    sub_section_re = re.compile(
        r"^(\s{0,8})(\d{1,2})(\.\d{1,2})+\.?\s{2,}([A-Z].{2,})$"
    )
    # Also catch subsections that start with lowercase (body text but numbered)
    sub_section_re2 = re.compile(
        r"^(\s{0,8})(\d{1,2})(\.\d{1,2})+\.?\s{2,}(\S.{2,})$"
    )
    annex_re = re.compile(
        r"^\s*(Annex(?:ure)?(?:\s+[A-Z0-9]\b)?)\s*[:\-]?\s*(.*)?$", re.IGNORECASE
    )

    # Build a flat list of (line_idx, number_str, heading, indent_level)
    boundaries = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue

        # Annexure (standalone line, not too long, at start of line area)
        if re.match(r"^\s{0,8}Annex", line):
            m_annex = annex_re.match(stripped)
            if m_annex and len(stripped) < 80:
                annex_label = m_annex.group(1).strip()
                annex_rest = (m_annex.group(2) or "").strip()
                heading = f"{annex_label}: {annex_rest}" if annex_rest else annex_label
                boundaries.append((i, "annex", heading, 0))
                continue

        # Top-level section
        m = top_section_re.match(line)
        if m:
            num_str = m.group(2)
            heading = clean_line(m.group(3))
            num_int = int(num_str)
            # Validate: section numbers should be sequential-ish (1-30)
            # and heading should not look like a date or continuation
            if 1 <= num_int <= 30 and len(heading) >= 3:
                # Skip if heading starts with a month name or year (false positive)
                month_names = r"^(January|February|March|April|May|June|July|August|September|October|November|December)\b"
                if re.match(month_names, heading, re.IGNORECASE):
                    continue
                # Skip if heading starts with a digit (table continuation)
                if heading[0].isdigit():
                    continue
                boundaries.append((i, num_str, heading, 0))
                continue

        # Subsection
        m2 = sub_section_re.match(line) or sub_section_re2.match(line)
        if m2:
            num_str = m2.group(2)
            sub_str = "".join(re.findall(r"\.\d+", line.split()[0]))
            full_num = num_str + sub_str
            # Heading is the last group
            heading = clean_line(m2.groups()[-1])
            depth = full_num.count(".")
            if 1 <= int(num_str) <= 30 and len(heading) >= 3 and depth <= 3:
                # Skip month/year false positives
                month_names = r"^(January|February|March|April|May|June|July|August|September|October|November|December)\b"
                if re.match(month_names, heading, re.IGNORECASE):
                    continue
                boundaries.append((i, full_num, heading, depth))

    if not boundaries:
        # Fall back: treat the whole text as a single section
        return [
            {
                "id": f"s-{slug}-1-body",
                "number": "1",
                "heading": "Body",
                "text": text.strip(),
                "verbatim": True,
                "subsections": [],
            }
        ]

    # Group into top-level sections with subsections
    sections = []
    top_sections = [(i, num, h, d) for (i, num, h, d) in boundaries if "." not in str(num) or num == "annex"]

    # Build section index for text extraction
    all_starts = [b[0] for b in boundaries]

    def text_between(start_line: int, end_line: int | None) -> str:
        end = end_line if end_line is not None else len(lines)
        chunk = "\n".join(lines[start_line:end]).strip()
        return chunk

    # Re-index all boundaries for lookup
    for idx, (line_i, num, heading, depth) in enumerate(boundaries):
        if depth > 0:
            continue  # handled as subsections
        if num == "annex":
            depth_key = "annex"
        else:
            depth_key = "top"

        # Find end of this top-level section = start of next top-level
        next_top_line = None
        for j in range(idx + 1, len(boundaries)):
            bj_line, bj_num, bj_h, bj_d = boundaries[j]
            if bj_d == 0:
                next_top_line = bj_line
                break

        # Extract subsections (depth=1) that belong to this section
        subsections = []
        my_prefix = str(num) + "."
        for j in range(idx + 1, len(boundaries)):
            bj_line, bj_num, bj_h, bj_d = boundaries[j]
            if bj_d == 0:
                break
            if bj_d == 1 and str(bj_num).startswith(my_prefix):
                # Find end of this subsection
                next_sub_line = None
                for k in range(j + 1, len(boundaries)):
                    bk_line, bk_num, bk_h, bk_d = boundaries[k]
                    if bk_d <= 1:
                        next_sub_line = bk_line
                        break
                sub_text = text_between(bj_line, next_sub_line)
                subsections.append(
                    {
                        "id": f"s-{slug}-{bj_num.replace('.', '-')}",
                        "number": bj_num,
                        "heading": bj_h,
                        "text": sub_text,
                        "verbatim": True,
                        "subsections": [],
                    }
                )

        # Section text: everything from section start to next top-level start
        section_text = text_between(line_i, next_top_line)

        num_safe = str(num).replace(".", "-")
        sections.append(
            {
                "id": f"s-{slug}-{num_safe}",
                "number": str(num),
                "heading": heading,
                "text": section_text,
                "verbatim": True,
                "subsections": subsections,
            }
        )

    return sections if sections else [
        {
            "id": f"s-{slug}-1-body",
            "number": "1",
            "heading": "Body",
            "text": text.strip(),
            "verbatim": True,
            "subsections": [],
        }
    ]


# ---------------------------------------------------------------------------
# JSON update
# ---------------------------------------------------------------------------


def update_json(json_path: Path, sections: list[dict], dry_run: bool = False) -> None:
    """Load the structured JSON, replace chapters, write back."""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    slug = data["slug"]
    instrument_type = data.get("instrumentType", "directive")
    short_title = data.get("shortTitle", slug)

    data["chapters"] = [
        {
            "id": f"ch-{slug}-main",
            "title": short_title,
            "sections": sections,
        }
    ]

    if dry_run:
        print(f"  [DRY-RUN] Would write {len(sections)} sections to {json_path.name}")
        return

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------


def process_slug(
    slug: str,
    json_path: Path,
    dry_run: bool = False,
    workers: int = 8,
) -> tuple[str, str]:
    """
    Process one slug. Returns (slug, status) where status is one of:
      'ok', 'cached', 'url_not_found', 'download_failed',
      'text_too_short', 'no_sections', 'dry_run'
    """
    pdf_path = PDF_CACHE / f"{slug}.pdf"

    # Check cache
    if pdf_path.exists() and pdf_path.stat().st_size > 1000:
        print(f"  [{slug}] Using cached PDF")
    else:
        # Find URL
        print(f"  [{slug}] Probing URL candidates...")
        url = find_pdf_url(slug, workers=workers)
        if url is None:
            print(f"  [{slug}] URL not found")
            return slug, "url_not_found"

        print(f"  [{slug}] Found: {url}")

        if dry_run:
            print(f"  [{slug}] [DRY-RUN] Would download to {pdf_path}")
            return slug, "dry_run"

        # Download
        print(f"  [{slug}] Downloading...")
        if not download_pdf(url, pdf_path):
            print(f"  [{slug}] Download failed")
            return slug, "download_failed"
        print(f"  [{slug}] Downloaded ({pdf_path.stat().st_size:,} bytes)")

    # Extract text
    text = extract_text(pdf_path)
    if len(text.strip()) < MIN_TEXT_CHARS:
        print(f"  [{slug}] Text too short ({len(text.strip())} chars) — skipping")
        return slug, "text_too_short"

    # Parse sections
    sections = parse_sections(text, slug)
    if not sections:
        print(f"  [{slug}] No sections parsed — skipping")
        return slug, "no_sections"

    print(f"  [{slug}] Parsed {len(sections)} top-level sections")

    # Update JSON
    update_json(json_path, sections, dry_run=dry_run)

    if dry_run:
        return slug, "dry_run"

    return slug, "ok"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen, no writes")
    parser.add_argument("--slug", help="Process only this slug")
    parser.add_argument("--workers", type=int, default=8, help="Parallel URL probe workers")
    args = parser.parse_args()

    # Collect all structured JSON files for directives and circulars
    all_jsons = sorted(SCRIPT_DIR.glob("banks-[dc]*-structured.json"))

    if args.slug:
        all_jsons = [j for j in all_jsons if j.stem.replace("-structured", "") == args.slug]
        if not all_jsons:
            print(f"No JSON file found for slug: {args.slug}")
            sys.exit(1)

    print(f"Processing {len(all_jsons)} structured JSON file(s)")
    print(f"PDF cache: {PDF_CACHE}")
    if args.dry_run:
        print("*** DRY RUN — no files will be modified ***")
    print()

    results = {"ok": [], "cached": [], "url_not_found": [], "download_failed": [],
               "text_too_short": [], "no_sections": [], "dry_run": []}

    for json_path in all_jsons:
        slug = json_path.stem.replace("-structured", "")
        print(f"[{slug}]")
        _, status = process_slug(slug, json_path, dry_run=args.dry_run, workers=args.workers)
        results.setdefault(status, []).append(slug)
        print()

    # Summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    ok_count = len(results.get("ok", [])) + len(results.get("cached", []))
    print(f"Succeeded:       {len(results.get('ok', []))}")
    print(f"From cache:      {len(results.get('cached', []))}")
    print(f"URL not found:   {len(results.get('url_not_found', []))}")
    print(f"Download failed: {len(results.get('download_failed', []))}")
    print(f"Text too short:  {len(results.get('text_too_short', []))}")
    print(f"No sections:     {len(results.get('no_sections', []))}")
    if args.dry_run:
        print(f"Dry-run (would): {len(results.get('dry_run', []))}")

    failed = (
        results.get("url_not_found", [])
        + results.get("download_failed", [])
        + results.get("text_too_short", [])
        + results.get("no_sections", [])
    )
    if failed:
        print()
        print("Failed slugs:")
        for s in failed:
            print(f"  {s}")


if __name__ == "__main__":
    main()
