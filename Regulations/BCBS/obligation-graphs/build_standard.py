from pypdf import PdfReader
import re, json, sys, os

PDF=os.environ.get('BASEL_PDF', os.path.expanduser('~/Desktop/BaselFramework.pdf'))
R=PdfReader(PDF)
NAMES={'SCO':'Scope and definitions','CAP':'Definition of capital',
 'RBC':'Risk-based capital requirements','CRE':'Calculation of RWA for credit risk',
 'MAR':'Calculation of RWA for market risk','OPE':'Calculation of RWA for operational risk',
 'LEV':'Leverage ratio','LCR':'Liquidity Coverage Ratio','NSF':'Net Stable Funding Ratio',
 'LEX':'Large exposures','MGN':'Margin requirements','SRP':'Supervisory review process',
 'DIS':'Disclosure requirements','BCP':'Core Principles for effective banking supervision'}

end_marker=re.compile(r'(?<![A-Za-z])(\d{2})\.(\d{1,3})\s*$')
end_marker_pre=re.compile(r'\d{2}\.\d{1,3}\s*$')
XREF=re.compile(r'\b[A-Z]{3}\d{2}(?:\.\d+)?\b')

def is_heading(s):
    s=s.strip()
    if not s or len(s)>70: return False
    if end_marker.search(s): return False
    if s[-1] in '.,:;)': return False
    return s[0].isupper() and len(s.split())<=9 and not s.lower().split()[-1] in ('and','the','of','to','a','in','or','for')


def operative_text(page):
    """Page text with the supplementary apparatus removed by FONT.

    The BIS consolidated PDF renders FAQ blocks (question + answer, introduced by
    a 'FAQ'/'FAQ1' marker) AND footnotes in italic (…SegoeUI-Italic); the operative
    normative paragraph text is regular (…SegoeUI) and headings/markers are bold.
    Because the paragraph number prints AFTER the text, italic FAQ/footnote blocks
    frequently interleave INTO the wrong paragraph's line-range (often at the
    start, ahead of the real lead) and corrupt the obligation — the comma/list
    heuristics cannot tell italic FAQ-answer prose from normative prose, but the
    font can. We drop any line whose whole content is italic, which removes the
    apparatus while preserving operative text, bold paragraph markers, and any
    line that merely contains an italic term inside regular prose (mixed lines are
    kept — only wholly-italic lines go)."""
    ital=[]; reg=[]
    def visit(text, cm, tm, fd, fs):
        if text and text.strip():
            fn=str((fd or {}).get('/BaseFont','')) if isinstance(fd,dict) else ''
            (ital if 'Italic' in fn else reg).append(text)
    full=page.extract_text(visitor_text=visit) or ''
    nz=lambda xs: re.sub(r'\s+','',''.join(xs)).lower()
    iblob, rblob = nz(ital), nz(reg)
    out=[]; prev_dropped=False
    for ln in full.splitlines():
        s=ln.strip()
        if not s:
            out.append(ln); prev_dropped=False; continue
        if re.match(r'^FAQ\d*\.?$', s):   # FAQ block marker — never operative text
            prev_dropped=True; continue
        n=re.sub(r'\s+','',s).lower()
        # wholly-italic line → FAQ / footnote apparatus. The length gate (or, for
        # short lines, absence from the regular-font text) guards against a short
        # operative line coincidentally matching the italic blob; a short wrapped
        # tail (eg "IMA.") immediately after a dropped italic line is also apparatus.
        if n in iblob and (len(n)>=10 or n not in rblob or (prev_dropped and len(n)<8)):
            prev_dropped=True; continue
        out.append(ln); prev_dropped=False
    return '\n'.join(out)

def extract(prefix, start, end, std_name=''):
    pages=[]
    for i in range(start,end+1):
        t=operative_text(R.pages[i])
        t=re.sub(r'^\s*\d+\s*/1982','',t)
        pages.append(t)
    chap_line=re.compile(r'^'+prefix+r'(\d{2})?\s*$')
    chapters={}; order=[]; titles={}; cur=prefix
    chapters[prefix]=[]; order.append(prefix); await_title=None
    cover_skip=False   # True while inside a chapter's cover page (boilerplate)
    for pg in pages:
        for ln in pg.splitlines():
            s=ln.strip()
            m=chap_line.match(s)
            if m:
                cur=prefix+(m.group(1) or '')
                if cur not in chapters: chapters[cur]=[]; order.append(cur)
                await_title=cur; cover_skip=True; continue
            if s.startswith('Downloaded on'):
                cover_skip=False   # cover-page footer marks end of boilerplate
                continue
            if s=='Version effective as of': continue
            if await_title is not None:
                stop=(not s) or s.startswith(('This chapter','This standard','This Annex','These')) or end_marker_pre.search(s) or (s and s[-1]=='.') or len(s)>70
                if not stop:
                    titles[await_title]=(titles.get(await_title,'')+' '+s).strip(); continue
                else: await_title=None
            # Drop chapter-cover boilerplate (description, version, dates, FAQ-update
            # notes) until the cover footer — UNLESS real content (a paragraph
            # marker or a section heading) has already started on the same page.
            if cover_skip:
                if end_marker_pre.search(s) or is_heading(s):
                    cover_skip=False
                else:
                    continue
            chapters[cur].append(ln)
    records=[]
    for code in order:
        if code==prefix: continue
        NN=code[len(prefix):]
        if not NN: continue
        lines=chapters[code]
        expected=1; bounds=[]; started=False
        for idx,ln in enumerate(lines):
            m=end_marker.search(ln.rstrip())
            if m and m.group(1)==NN:
                num=int(m.group(2))
                if not started:
                    if num<=3: bounds.append((idx,num)); expected=num+1; started=True
                    continue
                if expected<=num<=expected+5:
                    bounds.append((idx,num)); expected=num+1
        # Raw line-segments per paragraph.
        segs=[]; prev=0
        for idx,num in bounds:
            segs.append(lines[prev:idx+1]); prev=idx+1
        # Re-attach trailing enumerated sub-items. BIS prints the paragraph
        # number after the lead sentence, so a paragraph's (1)/(a)/(i) sub-list
        # prints AFTER its marker and lands at the START of the next segment.
        # Peel leading bullets (and their wrap-continuations) back to the owner.
        bullet=re.compile(r'^\(\s*(?:\d{1,2}|[a-z]|[ivxl]{1,5})\s*\)')
        for i in range(1,len(segs)):
            peeled=[]
            while segs[i]:
                s0=segs[i][0].strip()
                if not s0:
                    segs[i].pop(0); continue   # blank (page-break artefact) — skip, don't break the peel
                if bullet.match(s0):
                    peeled.append(segs[i].pop(0))
                elif peeled and (s0[0].islower() or s0[0] in '“”"(),;:'):
                    # wrap-continuation of a bullet: a lowercase word, an open
                    # quote/paren, OR a punctuation-led line (eg a sentence whose
                    # subject ended on the previous physical line and wraps onto
                    # ", for which …"). Without the punctuation cases the peel
                    # stops mid-sentence and strands the tail on the NEXT paragraph.
                    peeled.append(segs[i].pop(0))
                else:
                    break
            if peeled: segs[i-1].extend(peeled)
        cur_section=None
        for (idx,num),seg in zip(bounds,segs):
            section=cur_section; body=[]; leading=True
            for sl in seg:
                if leading and is_heading(sl): section=sl.strip(); cur_section=section; continue
                leading=False; body.append(sl)
            text=re.sub(r'\s+',' ',' '.join(x.strip() for x in body)).strip()
            # remove this paragraph's own number marker wherever it sits (now mid-text
            # after re-attachment), not just at the end; cross-refs (CAPnn.n) are
            # letter-prefixed and protected by the look-behind.
            text=re.sub(r'(?<![\dA-Za-z])'+NN+r'\.'+str(num)+r'(?!\d)',' ',text)
            # backstop boilerplate strip (cover-skip removes most at segmentation).
            # Version-history / cover lines bleed into chapter-first paragraphs
            # because the cover footer is what cover-skip keys off; the lead para
            # of a chapter carries the residue. These are document metadata, never
            # regulatory content, so they are safe to remove wherever they sit.
            text=re.sub(r'First version in format of consolidated framework\.\s*','',text)
            text=re.sub(r'\bFirst version in (?:the format of )?the consolidated Basel Framework\.?\s*','',text)
            text=re.sub(r'\bVersion effective as of\s*','',text)
            text=re.sub(r'\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b\s*','',text)
            # Standalone section-header residue ("Introduction"/"Footnotes"/"FAQ")
            # that the cover page prints above the first paragraph and which is not
            # part of the duty text. Only strip when it sits at the very start.
            text=re.sub(r'^(?:Introduction|Footnotes|FAQ|Frequently asked questions)\b[ .]*','',text)
            text=re.sub(r'\s+',' ',text).strip()
            records.append({'id':f'{code}.{num}','chapter':code,'chapter_title':titles.get(code,''),
                'section':section,'paragraph':f'{NN}.{num}','number':num,
                'text':text,'cross_refs':sorted(set(XREF.findall(text)))})
    out={'standard':prefix,'standard_name':std_name,
         'source':f'The Basel Framework (BIS) consolidated PDF, pages {start+1}-{end+1}',
         'extracted':'2026-06-04','paragraph_count':len(records),
         'chapters':{c:titles.get(c,'') for c in order if c!=prefix},
         'schema':{'id':f'e.g. {prefix}10.1','chapter':f'{prefix}xx','chapter_title':'str',
                   'section':'sub-heading or null','paragraph':'NN.k','number':'int',
                   'text':'paragraph text','cross_refs':'list of Basel codes'},
         'paragraphs':records}
    json.dump(out, open(f'{prefix}_paragraphs.json','w'), indent=2, ensure_ascii=False)
    with open(f'{prefix}_paragraphs.jsonl','w') as f:
        for r0 in records: f.write(json.dumps(r0,ensure_ascii=False)+'\n')
    return out

# standard boundaries (start page index, 0-based) in document order
STD=[('SCO',6),('CAP',99),('RBC',191),('CRE',246),('MAR',726),('OPE',1022),
     ('LEV',1050),('LCR',1091),('NSF',1214),('LEX',1252),('MGN',1279),
     ('SRP',1308),('DIS',1492),('BCP',1850)]
LAST=1981
# get standard full name from the standard title page
def std_name(prefix,start):
    t=R.pages[start].extract_text() or ''
    lines=[re.sub(r'^\d+\s*/1982','',l.strip()).strip() for l in t.splitlines() if l.strip()]
    # first line is prefix, next is name (may wrap)
    name=[]
    for l in lines[1:]:
        if re.match(r'^'+prefix+r'\d{2}',l) or l.startswith('This ') or end_marker_pre.search(l): break
        name.append(l)
        if len(' '.join(name))>15: break
    return ' '.join(name)[:80]

if __name__=='__main__':
    only=sys.argv[1:] or [p for p,_ in STD]
    index=[]
    for k,(prefix,startp) in enumerate(STD):
        endp=(STD[k+1][1]-1) if k+1<len(STD) else LAST
        if prefix not in only: 
            continue
        nm=NAMES.get(prefix,std_name(prefix,startp))
        o=extract(prefix,startp,endp,nm)
        index.append({'standard':prefix,'name':nm,'pages':f'{startp+1}-{endp+1}',
                      'chapters':len(o['chapters']),'paragraphs':o['paragraph_count']})
        print(f"{prefix:5} p{startp+1}-{endp+1:4} chapters={len(o['chapters']):2} paras={o['paragraph_count']:4}  {nm}")
    json.dump(index, open('INDEX.json','w'), indent=2, ensure_ascii=False)
