#!/usr/bin/env python3
"""Extract clean BCBS chapter text — full paragraph bodies + section headings —
from the layout-mode text of BaselFramework.pdf. Supersedes the noisier graph-DB
Provision text (which scrambled cross-refs and mis-split paragraph boundaries,
e.g. MAR20.4's tail bleeding into 20.5).

Layout rules: chapter headers are centred ("        MAR30"); paragraph numbers
("20.4   ...") and section headings sit flush-left (column 0); sub-points
("(1)", "(a)") and continuations are indented; page footers say "Downloaded on";
FAQ / Footnotes / Tables are supplementary and dropped from the paragraph body.

Output: { generatedFrom, chapters: { <chapterId>: [ {paragraph, heading, text} ] } }
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
    chapters = {}            # chapterId -> [ {paragraph, heading, lines:[]} ]
    cur_std = cur_chap = cur_heading = None
    cur_para = None          # the paragraph dict currently accumulating text
    pending = False          # heading just set, no paragraph under it yet

    def chap_id():
        return f"{cur_std}{cur_chap}"

    with open(path, encoding='utf-8') as f:
        for raw in f:
            line = raw.replace('\x0c', '').rstrip('\n')
            m = CHAP_RE.match(line)
            if m and m.group(1) in STDS:
                cur_std, cur_chap, cur_heading, pending, cur_para = (
                    m.group(1), int(m.group(2)), None, False, None)
                chapters.setdefault(chap_id(), [])
                continue
            if FOOTER_RE.search(line):
                continue
            if cur_std is None:
                continue
            if not is_col0(line):
                # indented continuation / sub-point — part of the current paragraph
                s = line.strip()
                if cur_para is not None and s:
                    cur_para['lines'].append(s)
                continue
            # column-0 line
            pm = PARA_RE.match(line)
            if pm:
                chap = int(pm.group(1))
                if chap != cur_chap:
                    cur_chap = chap
                    chapters.setdefault(chap_id(), [])
                rest = re.sub(r'^\d{2}\.\d+\s+', '', line).strip()
                cur_para = {'paragraph': f"{pm.group(1)}.{pm.group(2)}",
                            'heading': cur_heading, 'lines': [rest] if rest else []}
                chapters[chap_id()].append(cur_para)
                pending = False
                continue
            if SKIP_HEAD.match(line.strip()):
                pending = False
                cur_para = None      # stop folding supplementary FAQ/table text in
                continue
            if pending and re.match(r'^[a-z]', line.strip()):   # wrapped-heading line
                sep = '' if cur_heading.endswith('-') else ' '
                cur_heading = f"{cur_heading}{sep}{line.strip()}"
                continue
            if looks_heading(line):
                cur_heading = line.strip()
                pending = True
                cur_para = None      # heading ends the previous paragraph's body
                continue

    out = {}
    for ch, paras in chapters.items():
        rows = []
        for p in paras:
            text = re.sub(r'\s+', ' ', ' '.join(p['lines'])).strip()
            rows.append({'paragraph': p['paragraph'], 'heading': p['heading'], 'text': text})
        if rows:
            out[ch] = rows
    return out


if __name__ == '__main__':
    res = extract('/tmp/basel.txt')
    out_path = sys.argv[1] if len(sys.argv) > 1 else None
    if out_path:
        json.dump({'generatedFrom': 'BaselFramework.pdf', 'chapters': res},
                  open(out_path, 'w'), indent=2, ensure_ascii=False)
        npara = sum(len(v) for v in res.values())
        print(f"wrote {out_path}: {len(res)} chapters, {npara} paragraphs")
    else:
        for row in res.get('MAR20', []):
            print(f"[{row['heading']}] {row['paragraph']}: {row['text'][:90]}")
