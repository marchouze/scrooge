#!/usr/bin/env python3
"""
Fix section structure in banks-gn*-structured.json files.

Problems addressed:
1. Long headings: heading contains section title + body text concatenated
2. Missing sections: gn5-2014 missing sections 2 and 4
3. Section-0 dump: entire doc in one section with number=0
4. TOC-parsed sections: gn4-2015 used TOC as section list

Run from any directory with absolute paths.
"""

import json
import re
from pathlib import Path

SOURCE_DIR = Path("/Users/marc/code/Bank/Regulations/Banks/source-docs")

# Files known to have section-0 dump format (subsection-only numbering)
SECTION_0_DUMP_SLUGS = {"banks-gn3-2010", "banks-gn3-2011", "banks-gn5-2018", "banks-gn7-2016", "banks-gn7-2022"}

# Files with section-0 dump but inline single-page format (gn7-2022)
INLINE_DUMP_SLUGS = {"banks-gn7-2022"}

# Files known to have TOC-parsed sections
TOC_PARSED_SLUGS = {"banks-gn4-2015"}

# Files known to have missing sections
MISSING_SECTIONS_SLUGS = {"banks-gn5-2014"}


# ---------------------------------------------------------------------------
# Page parsing
# ---------------------------------------------------------------------------

def get_pages(txt_content):
    """Split txt content into pages. Returns list of (page_num, page_text)."""
    pages = []
    parts = re.split(r'--- Page (\d+) ---', txt_content)
    i = 1
    while i < len(parts) - 1:
        page_num = int(parts[i])
        page_text = parts[i + 1]
        pages.append((page_num, page_text))
        i += 2
    return pages


def get_all_lines_skip_cover(txt_content):
    """Return all lines from all pages except page 1 (cover page)."""
    all_lines = []
    for page_num, page_text in get_pages(txt_content):
        if page_num == 1:
            continue
        all_lines.extend(page_text.split('\n'))
    return all_lines


def is_toc_page(page_text):
    """Detect if a page is a table of contents."""
    if re.search(r'table of contents', page_text, re.IGNORECASE):
        return True
    # Require MULTIPLE section+page entries to avoid false positives
    matches = re.findall(r'\d+\.\s+\w[^.]*?\s+(?:Page\s+\d+|Annexure)', page_text, re.IGNORECASE)
    if len(matches) >= 2:
        return True
    return False


# ---------------------------------------------------------------------------
# Heading extraction
# ---------------------------------------------------------------------------

def build_heading_map_from_txt(txt_content, skip_toc=False):
    """
    Build a map {section_number_str: heading_text} from the txt file.

    Handles two patterns:
    - Pattern A: "N. Title text" on same line (standalone section heading line)
    - Pattern B: "N." alone, next non-blank/non-number line is the title
    - Pattern C: inline format "N. Title N.1 ..." (heading followed by subsection)

    Skips page 1 and optionally TOC pages. Only stores first occurrence per number.
    """
    pages = get_pages(txt_content)
    heading_map = {}

    # Detect if this is an inline format document (few lines per page, long lines)
    # Exclude cover (page 1) and TOC pages from this check
    non_cover_pages = [(n, t) for n, t in pages if n > 1 and not is_toc_page(t)]
    is_inline = (non_cover_pages and
                 all(len(t.strip().split('\n')) <= 4 and len(t.strip()) > 500
                     for n, t in non_cover_pages[:5] if t.strip()))

    if is_inline:
        # Extract headings from inline text using N. Title N.1 pattern
        all_text = re.sub(r'\n', ' ', re.sub(r'--- Page \d+ ---\n?', ' ', txt_content))
        # Find all unique section numbers
        top_nums = set()
        for m in re.finditer(r'(?<![.\d])(\d+)\.(\d+)', all_text):
            top_nums.add(int(m.group(1)))
        for top_num in sorted(top_nums):
            if str(top_num) in heading_map:
                continue
            m1 = re.search(rf'(?<![.\d]){top_num}\.1\b', all_text)
            if m1:
                before = all_text[max(0, m1.start() - 150):m1.start()]
                # Pattern: "N. Title" where Title ends before N.1
                m2 = re.search(r'(?<![.\d])' + str(top_num) + r'\.\s+([^.]+?)(?=\s+\d+\.\d+|\s*$)', before)
                if m2:
                    title = m2.group(1).strip()
                    if title and len(title) < 100:
                        heading_map[str(top_num)] = title
        return heading_map

    for page_num, page_text in pages:
        if page_num == 1:
            continue
        if skip_toc and is_toc_page(page_text):
            continue

        lines = page_text.split('\n')
        for idx, line in enumerate(lines):
            stripped = line.strip()
            # Skip subsections (N.M patterns)
            if re.match(r'^\d+\.\d+', stripped):
                continue

            # Pattern A: "N. Title" on same line
            m = re.match(r'^(\d+)\.\s+(.+)$', stripped)
            if m:
                num = m.group(1)
                heading = m.group(2).strip()
                if num not in heading_map and heading:
                    heading_map[num] = heading
                continue

            # Pattern B: "N." alone, look at next non-blank line for the title
            m = re.match(r'^(\d+)\.\s*$', stripped)
            if m:
                num = m.group(1)
                if num not in heading_map:
                    for j in range(idx + 1, min(len(lines), idx + 4)):
                        next_stripped = lines[j].strip()
                        if not next_stripped:
                            continue
                        if re.match(r'^\d+\.', next_stripped) or re.match(r'^\d+$', next_stripped):
                            break
                        heading_map[num] = next_stripped
                        break

    return heading_map


def is_heading_long(heading, correct_heading):
    """
    Return True if the heading looks like title + body text concatenated.
    The heading should start with the correct heading but be much longer.
    """
    if not correct_heading or heading == correct_heading:
        return False
    # The heading starts with the correct title and has extra body text
    if heading.startswith(correct_heading) and len(heading) > len(correct_heading) + 5:
        return True
    return False


def fix_heading_long(sections, heading_map):
    """
    Fix headings that are title+body concatenations.
    Only fixes when heading starts with the correct heading but is longer.
    Returns (fixed_sections, changes).
    """
    changes = []
    for section in sections:
        num = section.get('number', '')
        if num not in heading_map:
            continue
        correct = heading_map[num]
        current = section.get('heading', '')
        if is_heading_long(current, correct):
            changes.append(f"  section {num}: '{current[:60]}...' -> '{correct[:60]}'")
            section['heading'] = correct
    return sections, changes


# ---------------------------------------------------------------------------
# Section-0 dump rebuilding
# ---------------------------------------------------------------------------

def looks_like_heading(text):
    """
    Return True if a line of text looks like a section heading.
    Headings are:
    - Short (< 100 chars)
    - Start with a capital letter
    - Not continuation text (don't end mid-sentence with lowercase)
    - Not pure digits, dates, or partial sentences starting with lowercase
    """
    if not text or len(text) > 100:
        return False
    if text[0].islower():
        return False  # Continuation of previous sentence
    if text[0] in ('"', '(', '[', "'"):
        return False  # Quotation or parenthetical, likely body text
    if re.match(r'^\d+$', text):
        return False  # Pure number
    if text.endswith(','):
        return False  # Incomplete sentence
    # Body text usually ends with period and continues, or is mid-sentence
    # Headings typically don't end with a period OR end with just one sentence
    return True


def find_section_heading_in_vicinity(all_lines, top_num, first_sub_idx):
    """
    Given the index of the first N.M subsection in all_lines (all pages),
    find the section heading.

    Strategy:
    1. Find the cluster end (consecutive subsection number lines)
    2. Check forward: first text line after cluster (may be heading)
    3. Check backward: last text line before first_sub_idx (may be heading)
    4. Prefer whichever looks more like a heading

    Returns the best candidate heading string, or None.
    """
    # Find the end of the cluster of subsection number-only lines
    cluster_end = first_sub_idx
    for k in range(first_sub_idx, min(len(all_lines), first_sub_idx + 10)):
        stripped = all_lines[k].strip()
        if re.match(r'^\d+\.', stripped) or re.match(r'^\d+$', stripped) or not stripped:
            cluster_end = k + 1
        else:
            break

    # Forward scan: first non-empty, non-number line after the cluster
    forward_candidate = None
    for k in range(cluster_end, min(len(all_lines), cluster_end + 3)):
        candidate = all_lines[k].strip()
        if not candidate or re.match(r'^\d+$', candidate) or candidate.startswith('---'):
            continue
        if re.match(r'^\d+\.', candidate):
            break  # Hit another section number
        forward_candidate = candidate
        break

    # Backward scan: collect candidate lines (may be multi-line heading)
    backward_lines = []
    for k in range(first_sub_idx - 1, max(0, first_sub_idx - 8), -1):
        candidate = all_lines[k].strip()
        if not candidate or candidate.startswith('---'):
            if backward_lines:
                break  # Gap after collecting lines
            continue
        if re.match(r'^\d+$', candidate):
            continue  # Page number
        if re.match(r'^\d+\.', candidate):
            break  # Hit another section/subsection
        backward_lines.insert(0, candidate)
        # Stop if we've hit a line that starts with uppercase (likely heading start)
        if candidate[0].isupper():
            break

    # Build backward candidate from collected lines
    backward_candidate = ' '.join(backward_lines).strip() if backward_lines else None

    # Decision: prefer heading-like candidate
    fwd_is_heading = forward_candidate and looks_like_heading(forward_candidate)
    bwd_is_heading = backward_candidate and looks_like_heading(backward_candidate)

    if bwd_is_heading and not fwd_is_heading:
        return backward_candidate
    if fwd_is_heading and not bwd_is_heading:
        return forward_candidate
    if bwd_is_heading and fwd_is_heading:
        # Both look like headings — always prefer backward because it immediately
        # precedes the section (it's the title that introduces the section).
        # The forward candidate is the first line of subsection body content.
        return backward_candidate
    # Neither looks like a heading
    return None


def get_all_lines_all_pages(txt_content):
    """Return all lines from ALL pages (including page 1), stripping page markers."""
    lines = []
    for line in txt_content.split('\n'):
        if not line.startswith('--- Page'):
            lines.append(line)
    return lines


def build_subsection_heading_map(all_lines, top_nums):
    """
    For subsection-only format docs: build {num_str: heading_text} map
    by finding heading lines near each section's first subsection.

    Also handles bare "N." markers with the title on the next line.
    """
    heading_map = {}

    for top_num in sorted(top_nums):
        num_str = str(top_num)

        # First check for bare "N." marker pattern
        bare_marker_pat = re.compile(r'^' + str(top_num) + r'\.\s*$')
        sub_pat = re.compile(r'^' + str(top_num) + r'\.\d+')

        for i, line in enumerate(all_lines):
            stripped = line.strip()

            # Bare marker "N." with title on next line(s) after subsection cluster
            if bare_marker_pat.match(stripped):
                # Find cluster end
                cluster_end = i + 1
                for k in range(i + 1, min(len(all_lines), i + 10)):
                    s = all_lines[k].strip()
                    if re.match(r'^\d+\.', s) or re.match(r'^\d+$', s) or not s:
                        cluster_end = k + 1
                    else:
                        break
                # First text line after cluster
                for j in range(cluster_end, min(len(all_lines), cluster_end + 3)):
                    c = all_lines[j].strip()
                    if not c or re.match(r'^\d+$', c) or c.startswith('---'):
                        continue
                    if re.match(r'^\d+\.', c):
                        break
                    if looks_like_heading(c):
                        heading_map[num_str] = c
                    break
                if num_str in heading_map:
                    break
                continue

            # First N.M subsection
            if sub_pat.match(stripped):
                # Check if this section has its own heading or shares the cluster
                # with the next section (i.e., N.1 is immediately followed by (N+1).x)
                # In that case, the forward scan "heading" belongs to N+1, not N
                next_top_follows_immediately = False
                for k in range(i + 1, min(len(all_lines), i + 5)):
                    s = all_lines[k].strip()
                    if not s or re.match(r'^\d+$', s):
                        continue
                    # If N.x (same top-level), still in cluster
                    if sub_pat.match(s):
                        continue
                    # If (N+1).x immediately follows, the heading after the cluster
                    # belongs to (N+1), not N
                    next_sub = re.match(r'^(\d+)\.', s)
                    if next_sub and int(next_sub.group(1)) == top_num + 1:
                        next_top_follows_immediately = True
                    break

                if next_top_follows_immediately:
                    # Section N has no explicit heading
                    pass
                else:
                    h = find_section_heading_in_vicinity(all_lines, top_num, i)
                    if h:
                        heading_map[num_str] = h
                break

    return heading_map


def build_inline_section_heading_map(txt_content):
    """
    For gn7-2022-style docs where everything is inline on single-line pages.
    Finds section headings by looking for 'N TitleText N.1' patterns.
    """
    all_text = re.sub(r'\n', ' ', re.sub(r'--- Page \d+ ---\n?', ' ', txt_content))

    heading_map = {}

    # Find all top-level numbers referenced in subsections
    top_nums = set()
    for m in re.finditer(r'(?<![.\d])(\d+)\.(\d+)', all_text):
        top_nums.add(int(m.group(1)))

    for top_num in sorted(top_nums):
        # Find the first N.1 occurrence
        sub1_m = re.search(rf'(?<![.\d]){top_num}\.1\b', all_text)
        if not sub1_m:
            continue

        # Get text before N.1 (up to 200 chars)
        before = all_text[max(0, sub1_m.start() - 200):sub1_m.start()]

        # Find 'N Title' where N is top_num and Title is the section heading
        # The heading appears as "top_num TitleText" just before "top_num.1"
        # There may be a footnote number between the heading and top_num.1
        # Pattern: standalone top_num, then heading text, then end of 'before'
        pat = re.compile(
            r'(?<![.\d])' + str(top_num) + r'\s+'
            r'([A-Z][^.]*?)'             # Title text: starts uppercase, up to period
            r'\s*(?:\d{1,3})?\s*$'       # Optional footnote number at end
        )
        m = pat.search(before)
        if m:
            title = m.group(1).strip()
            # Clean up trailing footnote numbers
            title = re.sub(r'\s+\d{1,3}$', '', title).strip()
            if title and len(title) < 100:
                heading_map[str(top_num)] = title

    return heading_map


def build_sections_for_dump(txt_content, heading_map, inline_format=False):
    """
    Rebuild top-level sections from a section-0 dump file.
    Groups subsections by top-level number.
    """
    if inline_format:
        # For inline format, use the full text as-is (single blob)
        all_text = re.sub(r'--- Page \d+ ---\n?', ' ', txt_content)
        # Remove the cover page content
        pages = get_pages(txt_content)
        if pages:
            cover_text = pages[0][1]
            all_text = all_text.replace(cover_text, ' ', 1)
    else:
        all_lines = get_all_lines_all_pages(txt_content)
        all_text = '\n'.join(all_lines)

    # Find all top-level numbers
    top_nums = set()
    for m in re.finditer(r'(?<![.\d])(\d+)\.(\d+)', all_text):
        top_nums.add(int(m.group(1)))

    sections = []
    for top_num in sorted(top_nums):
        num_str = str(top_num)
        heading = heading_map.get(num_str, f"Section {num_str}")

        # Find all subsections for this top-level number in the text
        subsections = []
        if not inline_format:
            all_lines = get_all_lines_all_pages(txt_content)
            current_sub_num = None
            current_sub_lines = []

            def flush_sub():
                nonlocal current_sub_num, current_sub_lines
                if current_sub_num is None:
                    return
                sub_text = '\n'.join(current_sub_lines).strip()
                non_blank = [l for l in current_sub_lines if l.strip()]
                sub_heading = non_blank[0].strip()[:100] if non_blank else current_sub_num
                subsections.append({
                    "id": f"s{current_sub_num.replace('.', '-')}",
                    "number": current_sub_num,
                    "heading": sub_heading,
                    "text": sub_text,
                    "verbatim": sub_text,
                })
                current_sub_num = None
                current_sub_lines = []

            sub_pat = re.compile(r'^(' + str(top_num) + r'\.\d+(?:\.\d+)*)\s*(.*)')
            for line in all_lines:
                stripped = line.strip()
                m = sub_pat.match(stripped)
                if m:
                    flush_sub()
                    current_sub_num = m.group(1)
                    rest = m.group(2).strip()
                    current_sub_lines = [rest] if rest else []
                elif current_sub_num is not None:
                    # Stop if we hit a subsection of a different top-level
                    new_top = re.match(r'^(\d+)\.\d+', stripped)
                    if new_top and int(new_top.group(1)) != top_num:
                        flush_sub()
                    else:
                        current_sub_lines.append(line.rstrip())
            flush_sub()

        section_text = heading
        if subsections:
            section_text = heading + '\n' + '\n'.join(s['text'] for s in subsections)

        sections.append({
            "id": f"s{top_num}",
            "number": num_str,
            "heading": heading,
            "text": section_text.strip(),
            "verbatim": section_text.strip(),
            "subsections": subsections,
        })

    return sections


# ---------------------------------------------------------------------------
# Missing section insertion (gn5-2014)
# ---------------------------------------------------------------------------

def find_missing_sections_from_txt(sections, txt_content):
    """
    Compare top-level numbers in the txt subsections against sections in JSON.
    Returns sorted list of missing number strings.
    """
    all_lines = get_all_lines_skip_cover(txt_content)
    txt_top_nums = set()
    for line in all_lines:
        m = re.match(r'^(\d+)\.(\d+)', line.strip())
        if m:
            txt_top_nums.add(m.group(1))

    existing_nums = {s.get('number', '') for s in sections}
    missing = txt_top_nums - existing_nums
    return sorted(missing, key=lambda x: int(x))


def extract_missing_section_text(txt_content, miss_num, all_sorted_nums):
    """
    Extract text for a missing section from the txt.
    """
    all_lines = get_all_lines_skip_cover(txt_content)

    # Find where this section starts
    bare_pat = re.compile(r'^' + miss_num + r'\.\s*$')
    sub_pat = re.compile(r'^' + miss_num + r'\.\d+')
    start_idx = None
    end_idx = len(all_lines)

    for i, line in enumerate(all_lines):
        stripped = line.strip()
        if bare_pat.match(stripped) or sub_pat.match(stripped):
            start_idx = i
            # Look back for heading
            for j in range(i - 1, max(0, i - 5), -1):
                c = all_lines[j].strip()
                if not c or c.startswith('---') or re.match(r'^\d+$', c):
                    continue
                if re.match(r'^\d+\.', c):
                    break
                start_idx = j
            break

    if start_idx is None:
        return ""

    # Find end of section
    idx_in_sorted = all_sorted_nums.index(miss_num) if miss_num in all_sorted_nums else -1
    if idx_in_sorted >= 0 and idx_in_sorted + 1 < len(all_sorted_nums):
        next_num = all_sorted_nums[idx_in_sorted + 1]
        next_pat = re.compile(r'^' + next_num + r'\.')
        for i in range(start_idx + 1, len(all_lines)):
            if next_pat.match(all_lines[i].strip()):
                end_idx = i
                break

    return '\n'.join(all_lines[start_idx:end_idx]).strip()


# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------

def process_file(json_path, txt_path):
    """Process a single JSON/txt pair. Returns change summary string."""
    slug = json_path.stem.replace('-structured', '')

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    with open(txt_path, 'r', encoding='utf-8') as f:
        txt_content = f.read()

    changes = []
    chapters = data.get('chapters', [])
    if not chapters:
        return f"{slug}: SKIP (no chapters)"

    chapter = chapters[0]
    sections = chapter.get('sections', [])

    # ---- CASE 1: Section-0 dump ----
    if slug in SECTION_0_DUMP_SLUGS:
        old_count = len(sections)
        inline = slug in INLINE_DUMP_SLUGS

        if inline:
            # gn7-2022 style: all content is inline
            heading_map = build_inline_section_heading_map(txt_content)
        else:
            # Standard subsection-only format — use ALL pages (incl. page 1)
            # so we can find headings on the first page
            all_lines = get_all_lines_all_pages(txt_content)
            top_nums = set()
            for line in all_lines:
                m = re.match(r'^(\d+)\.(\d+)', line.strip())
                if m:
                    top_nums.add(int(m.group(1)))
            heading_map = build_subsection_heading_map(all_lines, top_nums)

        new_sections = build_sections_for_dump(txt_content, heading_map, inline_format=inline)

        if new_sections:
            chapter['sections'] = new_sections
            changes.append(f"  Rebuilt from section-0 dump: {old_count} -> {len(new_sections)} sections")
            for s in new_sections:
                changes.append(f"    Section {s['number']}: '{s['heading'][:60]}'")
        else:
            changes.append(f"  WARN: Could not rebuild sections from section-0 dump")

    # ---- CASE 2: TOC-parsed sections ----
    elif slug in TOC_PARSED_SLUGS:
        toc_sections = [s for s in sections if re.search(r'Page \d+|Annexure', s.get('heading', ''))]
        real_sections = [s for s in sections if not re.search(r'Page \d+|Annexure', s.get('heading', ''))]

        if toc_sections:
            changes.append(f"  Removed {len(toc_sections)} TOC-parsed sections")

        heading_map = build_heading_map_from_txt(txt_content, skip_toc=True)
        real_sections, hchanges = fix_heading_long(real_sections, heading_map)
        changes.extend(hchanges)
        chapter['sections'] = real_sections

    # ---- CASE 3: Missing sections (gn5-2014) ----
    elif slug in MISSING_SECTIONS_SLUGS:
        heading_map = build_heading_map_from_txt(txt_content)
        sections, hchanges = fix_heading_long(sections, heading_map)
        changes.extend(hchanges)

        missing_nums = find_missing_sections_from_txt(sections, txt_content)
        if missing_nums:
            changes.append(f"  Missing sections detected: {missing_nums}")

            all_nums = sorted(
                {s.get('number', '') for s in sections} | set(missing_nums),
                key=lambda x: int(x)
            )

            all_lines = get_all_lines_skip_cover(txt_content)
            all_lines_int = [int(m.group(1)) for line in all_lines
                             for m in [re.match(r'^(\d+)\.(\d+)', line.strip())] if m]

            for miss_num in missing_nums:
                # Get heading
                heading = heading_map.get(miss_num)
                if not heading:
                    # Try to find unnumbered heading near the first N.1
                    bare_idx = next(
                        (i for i, l in enumerate(all_lines)
                         if re.match(r'^' + miss_num + r'\.\s*$', l.strip())
                         or re.match(r'^' + miss_num + r'\.\d+', l.strip())),
                        None
                    )
                    if bare_idx is not None:
                        heading = find_section_heading_in_vicinity(all_lines, int(miss_num), bare_idx)
                if not heading:
                    heading = f"Section {miss_num}"

                text = extract_missing_section_text(txt_content, miss_num, all_nums)
                new_section = {
                    "id": f"s{miss_num}",
                    "number": miss_num,
                    "heading": heading,
                    "text": text,
                    "verbatim": text,
                    "subsections": [],
                }
                changes.append(f"  Inserted section {miss_num}: '{heading[:60]}'")
                sections.append(new_section)

            sections.sort(key=lambda s: int(s.get('number', '0')))
        chapter['sections'] = sections

    # ---- CASE 4: Normal files with long headings ----
    else:
        heading_map = build_heading_map_from_txt(txt_content)
        sections, hchanges = fix_heading_long(sections, heading_map)
        changes.extend(hchanges)
        chapter['sections'] = sections

    if not changes:
        return f"{slug}: no changes needed"

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

    return f"{slug}:\n" + '\n'.join(changes)


def main():
    results = []
    json_files = sorted(SOURCE_DIR.glob("banks-gn*-structured.json"))

    for json_path in json_files:
        slug = json_path.stem.replace('-structured', '')
        txt_path = SOURCE_DIR / f"{slug}.txt"

        if not txt_path.exists():
            results.append(f"{slug}: SKIP (no txt file)")
            continue

        try:
            result = process_file(json_path, txt_path)
            results.append(result)
        except Exception as e:
            results.append(f"{slug}: ERROR - {e}")
            import traceback
            traceback.print_exc()

    print('\n'.join(results))
    print(f"\nProcessed {len(json_files)} files.")


if __name__ == '__main__':
    main()
