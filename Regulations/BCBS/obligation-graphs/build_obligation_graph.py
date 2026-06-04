#!/usr/bin/env python3
"""
Build a regulatory obligation graph (node-link JSON) from a Basel paragraph
extract, conforming to the bank project's regulatory-graph ontology
(platform/regulatory/graph/types.ts: GraphNode / GraphEdge).

Node types used : Framework, Document, Provision, Obligation, Term
Edge types used : COMPRISES, CONTAINS, EXPRESSES, REFERENCES,
                  CONDITIONAL_ON, DEFINES, USES
extractionMethod: "rule-based"

ID conventions (mirroring the project):
  Framework  : FW-basel
  Document   : DOC-BCBS-<STD>                         (e.g. DOC-BCBS-MAR)
  Provision  : urn:reg:bcbs:<std>:<chapter.para>      (e.g. urn:reg:bcbs:mar:21.1)
               chapter-level: urn:reg:bcbs:<std>:<chapter>
  Obligation : OBL-BCBS-<STD>-s<chapter.para>-<seq>
  Term       : TERM-<slug>
"""
import json, re, sys, os, datetime

EXTRACTED_AT = "2026-06-04T00:00:00Z"
EXTRACTOR_ID = "build_obligation_graph.py"

# Provenance per the Plane-A ingestion contract
# (prototype/platform/regulatory/extraction-contract.ts). Every node carries it
# so the reference graph records who/what/how/when produced each assertion.
def prov(conf=1.0):
    return {"extractionMethod": "rule-based", "extractorId": EXTRACTOR_ID,
            "confidenceScore": round(float(conf), 2), "extractedAt": EXTRACTED_AT}

# ---- normative-language detection -----------------------------------------
RE_MUSTNOT = re.compile(r'\b(must not|shall not|may not|must never|is prohibited|are prohibited|is not permitted|may in no case)\b', re.I)
RE_MUST    = re.compile(r'\b(must|shall|is required to|are required to|is obliged to|are obliged to|will be required to|has to|have to)\b', re.I)
RE_SHOULD  = re.compile(r'\b(should|is expected to|are expected to)\b', re.I)
RE_MAY     = re.compile(r'\b(may|is permitted to|are permitted to|is allowed to|are allowed to|can elect to)\b', re.I)

# conditional / exception cues
RE_TRIGGER = re.compile(r'\b(where|if|when|subject to|provided that|in the case where|to the extent that|once|upon)\b', re.I)
RE_EXCEPT  = re.compile(r'\b(unless|except (?:where|when|that|for|as)|other than|save (?:where|that)|with the exception of|notwithstanding)\b', re.I)

# defined-term cues
RE_DEFN    = re.compile(r'(?:^|[.;]\s+)(?:the term\s+)?["“]?([A-Z][A-Za-z0-9 /\-\(\)]{2,60}?)["”]?\s+(means|is defined as|refers to|is defined to mean|are defined as)\b', re.I)

# actor detection (ordered: most specific first)
ACTORS = [
    (re.compile(r'\bnational supervisors?\b', re.I), 'national supervisor'),
    (re.compile(r'\bthe supervisor\b|\bsupervisory authorit', re.I), 'supervisor'),
    (re.compile(r'\bthe Committee\b', re.I), 'Basel Committee'),
    (re.compile(r'\b(a |the |each )?bank(?:s|’s)?\b', re.I), 'bank'),
    (re.compile(r'\b(a |the )?firm', re.I), 'bank'),
]

SENT_SPLIT = re.compile(r'(?<=[.;])\s+(?=[A-Z(])')

def sentences(text):
    return [s.strip() for s in SENT_SPLIT.split(text) if s.strip()]

def detect_actor(text):
    for rx, name in ACTORS:
        if rx.search(text):
            return name
    return 'bank'

def first_clause(text, rx):
    """Return a short conditional/exception clause if cued, else None."""
    m = rx.search(text)
    if not m:
        return None
    start = m.start()
    # take from cue to end of its sentence (next . or ; or , + 'then'/clause break)
    tail = text[start:start+220]
    tail = re.split(r'[.;]', tail, 1)[0].strip()
    return tail[:200] if len(tail) > 8 else None

# "may" only counts as a permission obligation when an actor noun is the
# nearby subject (avoids descriptive "a pricing model may be ...").
RE_MAY_ACTOR = re.compile(r'\b(banks?|supervisors?|institutions?|firms?|the Committee|the Authority)\b[^.;]{0,40}?\b(may|is permitted to|are permitted to|is allowed to|are allowed to|can elect to)\b', re.I)

def classify(text):
    """Return (obligationType, confidence) or (None,_) if not normative."""
    if RE_MUSTNOT.search(text):
        return 'must-not', 0.9
    if RE_MUST.search(text):
        return 'must', 0.9
    if RE_SHOULD.search(text):
        return 'recommended', 0.6
    if RE_MAY_ACTOR.search(text):
        return 'may', 0.55
    return None, 0.0

def action_summary(text, otype):
    rx = {'must-not':RE_MUSTNOT,'must':RE_MUST,'recommended':RE_SHOULD,'may':RE_MAY}[otype]
    for s in sentences(text):
        if rx.search(s):
            return re.sub(r'\s+',' ', s)[:300]
    return re.sub(r'\s+',' ', text)[:300]

# ---- atomic decomposition ---------------------------------------------------
# Enumeration markers: (1) (a) (iv) etc. — BIS sub-paragraph duties.
RE_ENUM = re.compile(r'(?<![\w.])\(\s*(\d{1,2}|[a-z]|[ivxl]{1,5})\s*\)', re.I)

def split_enum(text):
    """Return (stem, [(label, chunk), ...]). If <2 markers, no enumeration."""
    ms = list(RE_ENUM.finditer(text))
    if len(ms) < 2:
        return '', [(None, text)]
    stem = text[:ms[0].start()].strip()
    items = []
    for i, m in enumerate(ms):
        s = m.end()
        e = ms[i+1].start() if i+1 < len(ms) else len(text)
        items.append((m.group(0), text[s:e].strip()))
    return stem, items

def decompose(text):
    """Break a normative paragraph into atomic duty units.

    Each unit -> {text, enum, stemTrigger}. Granularity:
      - enumerated sub-items (each duty-bearing item / its sentences), and/or
      - the stem directive combined with each object item when items carry no
        modal of their own, and/or
      - sentence level for non-enumerated paragraphs.
    """
    stem, items = split_enum(text)
    enumerated = items[0][0] is not None
    stem_type = classify(stem)[0] if stem else None
    stem_trig = first_clause(stem, RE_TRIGGER) if stem else None
    units = []
    if enumerated:
        any_item_modal = any(classify(c)[0] for _, c in items)
        if any_item_modal:
            if stem_type:
                units.append({'text': stem, 'enum': None, 'stemTrigger': None})
            for label, chunk in items:
                if classify(chunk)[0]:
                    for sent in sentences(chunk):
                        if classify(sent)[0]:
                            units.append({'text': sent, 'enum': label, 'stemTrigger': stem_trig})
        elif stem_type:
            for label, chunk in items:
                combined = (stem.rstrip(' :;.,') + ': ' + chunk).strip()
                units.append({'text': combined, 'enum': label, 'stemTrigger': stem_trig})
    else:
        for sent in sentences(text):
            if classify(sent)[0]:
                units.append({'text': sent, 'enum': None, 'stemTrigger': stem_trig})
    # fallback: normative paragraph that produced no clean unit
    if not units and classify(text)[0]:
        units.append({'text': re.sub(r'\s+',' ',text)[:300], 'enum': None, 'stemTrigger': stem_trig})
    return units

def slugify(s):
    s = re.sub(r'[^A-Za-z0-9]+','-', s.strip().lower()).strip('-')
    return s[:60]

TERM_STOP = {'this','and','in','note','the','equivalent','a','for','that','where',
             'if','when','these','those','such','it','they','each','any','no','as','to','of'}
def valid_term(term):
    term = term.strip().strip('"“”')
    words = term.split()
    if not (1 <= len(words) <= 5): return None
    if words[0].lower() in TERM_STOP: return None
    # every token alphabetic (allow internal hyphen/slash), no digits/parens
    if re.search(r'[0-9()]', term): return None
    if not all(re.fullmatch(r"[A-Za-z][A-Za-z\-/']*", w) for w in words): return None
    if len(term) < 4: return None
    return term

def build(std, std_name, in_path, jurisdiction='supranational'):
    std_lc = std.lower()
    data = json.load(open(in_path))
    paras = data['paragraphs']
    chapters = data.get('chapters', {})

    nodes = {}   # id -> node
    edges = []
    def add_node(n):
        if n['id'] not in nodes:
            n.setdefault('provenance', prov(n.get('classificationConfidence', 1.0)))
            nodes[n['id']] = n
        return n['id']
    def add_edge(frm, to, etype, conf, method='rule-based', src=None, meta=None):
        eid = f"E-{etype}-{abs(hash((frm,to,etype)))%10**12:012d}"
        e = {'id':eid,'fromId':frm,'toId':to,'edgeType':etype,
             'extractionMethod':method,'confidenceScore':round(conf,2),
             'extractedAt':EXTRACTED_AT}
        if src: e['sourceProvision']=src
        if meta: e['metadata']=meta
        edges.append(e)

    # Framework + Document
    fw = add_node({'id':'FW-basel','nodeType':'Framework','label':'Basel Framework (BCBS)',
                   'metadata':{'issuer':'Basel Committee on Banking Supervision','standardGroup':'consolidated'}})
    instrument = f'BCBS-{std}'
    doc = add_node({'id':f'DOC-{instrument}','nodeType':'Document',
                    'label':f'Basel Framework — {std} ({std_name})',
                    'metadata':{'instrumentId':instrument,'standard':std,
                                'applicabilityStatus':'transposed',
                                'source':'https://www.bis.org/basel_framework/standard/'+std+'.htm'}})
    add_edge(fw, doc, 'COMPRISES', 1.0)

    def prov_id(ref):           # ref like "21.1" or chapter "21"
        return f'urn:reg:bcbs:{std_lc}:{ref}'

    # chapter provision nodes
    for code, title in chapters.items():
        ch = code[len(std):]   # MAR21 -> 21
        cid = prov_id(ch)
        add_node({'id':cid,'nodeType':'Provision','label':f'{code} — {title}',
                  'level':'chapter','metadata':{'chapter':code,'standard':std}})
        add_edge(doc, cid, 'CONTAINS', 1.0)

    # term registry (term phrase lower -> term node id)
    term_index = {}

    # first pass: provisions + terms
    for p in paras:
        ref = p['paragraph']                 # "21.1"
        ch  = p['chapter'][len(std):]        # "21"
        pid = prov_id(ref)
        text = p['text']
        add_node({'id':pid,'nodeType':'Provision',
                  'label':f"{p['chapter']} {ref}",
                  'level':'section','text':text,
                  'metadata':{'chapter':p['chapter'],'chapterTitle':p.get('chapter_title',''),
                              'section':p.get('section') or None,'paragraph':ref,
                              'standard':std,'citationUrn':pid}})
        # chapter -> paragraph containment
        add_edge(prov_id(ch), pid, 'CONTAINS', 1.0)
        # cross references
        for xref in p.get('cross_refs', []):
            m = re.match(r'^([A-Z]{3})(\d{2})\.(\d+)$', xref) or re.match(r'^([A-Z]{3})(\d{2})$', xref)
            if not m: continue
            g = m.groups()
            tgt_std = g[0].lower()
            tgt_ref = f"{g[1]}.{g[2]}" if len(g)==3 else g[1]
            tgt = f'urn:reg:bcbs:{tgt_std}:{tgt_ref}'
            if tgt == pid: continue
            # create stub node for external/unseen provisions
            if tgt not in nodes:
                add_node({'id':tgt,'nodeType':'Provision','label':xref,'level':'section',
                          'metadata':{'standard':g[0],'paragraph':tgt_ref,
                                      'external': g[0]!=std,'stub':True}})
            add_edge(pid, tgt, 'REFERENCES', 1.0, src=pid)
        # term definitions
        for dm in RE_DEFN.finditer(text):
            term = valid_term(dm.group(1))
            if not term: continue
            tslug = slugify(term)
            if not tslug: continue
            tid = f'TERM-{tslug}'
            if tid not in nodes:
                defn = text[dm.start():dm.start()+300]
                add_node({'id':tid,'nodeType':'Term','label':term,
                          'term':term,'definitionText':re.sub(r'\s+',' ',defn)[:300],
                          'metadata':{'definedIn':p['chapter'],'standard':std}})
                term_index[term.lower()] = tid
            add_edge(pid, nodes[tid]['id'], 'DEFINES', 0.85, src=pid)

    # only multiword terms used for USES matching (precision)
    multiword_terms = [(t, tid) for t, tid in term_index.items() if len(t.split()) >= 2]

    # second pass: obligations (atomic — one node per duty unit)
    obl_seq = {}
    n_obl = 0; n_paras_norm = 0
    for p in paras:
        ref = p['paragraph']; pid = prov_id(ref); text = p['text']
        if not classify(text)[0]:
            continue
        units = decompose(text)
        if units:
            n_paras_norm += 1
        for u in units:
            utext = re.sub(r'\s+', ' ', u['text']).strip()
            otype, conf = classify(utext)
            if not otype:
                continue
            n_obl += 1
            seq = obl_seq.get(ref, 0) + 1; obl_seq[ref] = seq
            oid = f'OBL-{instrument}-s{ref}-{seq}'
            actor = detect_actor(utext) if detect_actor(utext) != 'bank' else detect_actor(text)
            trig = first_clause(utext, RE_TRIGGER) or u.get('stemTrigger')
            exc  = first_clause(utext, RE_EXCEPT)
            md = {'sourceProvision':pid,'chapter':p['chapter'],'paragraph':ref,
                  'standard':std,'classificationConfidence':conf,
                  'section':p.get('section') or None,'atomicSeq':seq}
            if u.get('enum'): md['enumLabel']=u['enum']
            obl = {'id':oid,'nodeType':'Obligation',
                   'label':f"{p['chapter']} {ref}{(' '+u['enum']) if u.get('enum') else ''} — {otype}",
                   'obligationType':otype,'actor':actor,
                   'actionSummary':utext[:300],'metadata':md}
            if trig: obl['trigger']=trig[:200]
            if exc:  obl['exception']=exc[:200]
            add_node(obl)
            add_edge(pid, oid, 'EXPRESSES', 1.0, src=pid)

            # CONDITIONAL_ON: duty gated by a condition that cites a provision
            cond = trig or ''
            if cond:
                for xref in p.get('cross_refs', []):
                    if re.search(re.escape(xref), cond):
                        m = re.match(r'^([A-Z]{3})(\d{2})(?:\.(\d+))?$', xref)
                        if m:
                            tgt_std=m.group(1).lower()
                            tref=f"{m.group(2)}.{m.group(3)}" if m.group(3) else m.group(2)
                            add_edge(oid, f'urn:reg:bcbs:{tgt_std}:{tref}', 'CONDITIONAL_ON', 0.7, src=pid,
                                     meta={'condition':cond[:140]})
            # USES: defined-term usage within this duty unit
            low = utext.lower(); used = 0
            for term, tid in multiword_terms:
                if used >= 6: break
                if term in low:
                    add_edge(oid, tid, 'USES', 0.6, src=pid)
                    used += 1

    graph = {
        'standard': std,
        'standardName': std_name,
        'instrumentId': instrument,
        'ontology': 'platform/regulatory/graph/types.ts (GraphNode/GraphEdge)',
        'extractionMethod': 'rule-based',
        'provenance': prov(1.0),
        'generatedAt': EXTRACTED_AT,
        'source': data.get('source',''),
        'stats': {},
        'nodes': list(nodes.values()),
        'edges': edges,
    }
    # stats
    from collections import Counter
    nt = Counter(n['nodeType'] for n in graph['nodes'])
    et = Counter(e['edgeType'] for e in graph['edges'])
    graph['stats'] = {'nodes':len(graph['nodes']),'edges':len(graph['edges']),
                      'obligations':n_obl,'normativeParagraphs':n_paras_norm,
                      'decomposition':'atomic',
                      'nodesByType':dict(nt),'edgesByType':dict(et),
                      'obligationsByType':dict(Counter(n.get('obligationType') for n in graph['nodes'] if n['nodeType']=='Obligation'))}
    return graph

if __name__ == '__main__':
    std = sys.argv[1]; std_name = sys.argv[2]; in_path = sys.argv[3]; out_path = sys.argv[4]
    g = build(std, std_name, in_path)
    json.dump(g, open(out_path,'w'), indent=2, ensure_ascii=False)
    print(json.dumps(g['stats'], indent=2))
