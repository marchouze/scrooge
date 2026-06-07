#!/usr/bin/env python3
"""Extract BCBS section-heading -> paragraph-range structure from the layout-mode
text of BaselFramework.pdf. Headings sit flush-left (column 0) on their own line;
paragraphs are flush-left "NN.N ..."; chapter headers are centred; page footers
say "Downloaded on". A heading that wraps across lines continues on a col-0 line
that starts lowercase. Output: {std: {chapter: [{heading, fromPara, toPara, paras}]}}.
"""
import re, json, sys

STDS = ("SCO", "CAP", "CRE", "MAR", "LCR", "NSF", "LEV", "LEX", "DIS", "RBC",
        "OPE", "SRP", "BCP", "MGN", "CVA")
CHAP_RE = re.compile(r'^\s{8,}([A-Z]{2,4})(\d{2})\s*$')
PARA_RE = re.compile(r'^(\d{2})\.(\d+)\s+\S')
FOOTER_RE = re.compile(r'Downloaded on|^\s*\d+/\d{3,}\s*$')
SKIP_HEAD = re.compile(r'^(FAQ\d*|Footnotes?|Table \d|Version effective|Examples?)\b', re.I)


def is_col0(line):
    return len(line) > 0 and not line[0].isspace()


def looks_heading(s):
    s = s.strip()
    if not s or len(s) > 90:
        return False
    if SKIP_HEAD.match(s):
        return False
    if re.match(r'^[A-Z]{2,4}\d', s):     # bare cross-ref like "MAR33"
        return False
    if not re.match(r'^[A-Z(]', s):       # must start title/sentence case
        return False
    if not re.search(r'[a-z]', s):        # must contain lowercase (not a table row)
        return False
    return True


def extract(path):
    out = {}
    cur_std = cur_chap = cur_heading = None
    pending = False   # heading just set, no paragraph under it yet
    with open(path, encoding='utf-8') as f:
        for raw in f:
            line = raw.replace('\x0c', '').rstrip('\n')
            m = CHAP_RE.match(line)
            if m and m.group(1) in STDS:
                cur_std, cur_chap, cur_heading, pending = m.group(1), int(m.group(2)), None, False
                out.setdefault(cur_std, {}).setdefault(cur_chap, [])
                continue
            if FOOTER_RE.search(line):
                continue
            if cur_std is None or not is_col0(line):
                continue
            pm = PARA_RE.match(line)
            if pm:
                chap = int(pm.group(1))
                if chap != cur_chap:
                    cur_chap = chap
                    out.setdefault(cur_std, {}).setdefault(cur_chap, [])
                para = f"{pm.group(1)}.{pm.group(2)}"
                lst = out[cur_std][cur_chap]
                if not lst or lst[-1]['heading'] != cur_heading:
                    lst.append({'heading': cur_heading, 'paras': []})
                lst[-1]['paras'].append(para)
                pending = False
                continue
            # col-0, non-paragraph line
            if SKIP_HEAD.match(line.strip()):
                pending = False
                continue
            if pending and re.match(r'^[a-z]', line.strip()):   # wrapped-heading continuation
                sep = '' if cur_heading.endswith('-') else ' '
                cur_heading = f"{cur_heading}{sep}{line.strip()}"
                continue
            if looks_heading(line):
                cur_heading = line.strip()
                pending = True
    # collapse to ranges
    result = {}
    for std, chaps in out.items():
        result[std] = {}
        for chap, blocks in chaps.items():
            merged = [
                {'heading': b['heading'], 'fromPara': b['paras'][0],
                 'toPara': b['paras'][-1], 'paras': b['paras']}
                for b in blocks if b['paras']
            ]
            if merged:
                result[std][f"{std}{chap}"] = merged
    return result


if __name__ == '__main__':
    res = extract('/tmp/basel.txt')
    out_path = sys.argv[1] if len(sys.argv) > 1 else None
    if out_path:
        # flatten to {chapterId: {paragraph: heading}} for lookup at render time
        flat = {}
        for std, chaps in res.items():
            for ch, blocks in chaps.items():
                pm = {p: b['heading'] for b in blocks if b['heading'] for p in b['paras']}
                if pm:
                    flat[ch] = pm
        json.dump({'generatedFrom': 'BaselFramework.pdf', 'chapters': flat},
                  open(out_path, 'w'), indent=2, ensure_ascii=False)
        nheads = sum(len(set(v.values())) for v in flat.values())
        print(f"wrote {out_path}: {len(flat)} chapters, {nheads} distinct headings")
    else:
        for blk in res.get('MAR', {}).get('MAR30', []):
            print(f"{blk['heading']!r}: {blk['fromPara']}-{blk['toPara']} ({len(blk['paras'])} paras)")
