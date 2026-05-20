// dashboard/products-policy-chain.ts
//
// Resolves the Policy → Procedure → Function chain for an NPA dimension.
// Hybrid model (selected 2026-05-20):
//   - Per-dimension `policyHints` (declared in DIMENSION_METADATA) anchor
//     the chain on the 0–2 policies that are intrinsically applicable to
//     that dimension regardless of product.
//   - The resolver then walks the existing graph: policy filename →
//     procedures whose `policy-cited` frontmatter mentions that policy →
//     functions parsed from the procedure's `system-capability` field.
//   - Statuses come straight from the frontmatter — no duplicated state.
//
// Authority chain (Principle 2 upward):
//   - Principles/2-single-graph-discipline.md — one citable graph; no
//     hand-curated facts that drift from the canonical source.
//   - D-NEW-PRODUCT-APPROVAL-POLICY §5 — dimensions are the leaf nodes
//     where the chain surfaces for product-approval review.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Public types — exported for products-detail.ts to embed in the view.
// ---------------------------------------------------------------------------

export type ChainItemStatus =
  | "in-force"
  | "active"
  | "populated"
  | "planned"
  | "stub"
  | "draft"
  | "unknown";

export interface PolicyRef {
  /** File basename, e.g. `credit-risk-policy-v1.md`. */
  filename: string;
  /** Frontmatter `title`, or filename if absent. */
  title: string;
  /** Owner string straight from frontmatter (may include name + position). */
  owner: string;
  status: ChainItemStatus;
  /** "hint" if listed in dimension's policyHints; "graph" if derived. */
  source: "hint" | "graph";
}

export interface ProcedureRef {
  filename: string;
  /** Repo-relative path (Procedures/<area>/<file>.md). */
  path: string;
  title: string;
  owner: string;
  status: ChainItemStatus;
  /** The policy filenames this procedure cites (resolved). */
  policiesCited: string[];
  /** Raw system-capability string from frontmatter, for footnote display. */
  systemCapabilityRaw: string;
}

export interface FunctionRef {
  /** Module or capability identifier, e.g. `@platform/markets/cdm/fx`. */
  name: string;
  status: ChainItemStatus;
  /** Procedure filename this function was derived from (for back-link). */
  fromProcedure: string;
}

export interface DimensionPolicyChain {
  policies: PolicyRef[];
  procedures: ProcedureRef[];
  functions: FunctionRef[];
}

// ---------------------------------------------------------------------------
// Frontmatter parsing — minimal, regex-driven, no YAML lib.
// ---------------------------------------------------------------------------

const FM_DELIM = /^---\s*$/;

interface RawFrontmatter {
  raw: string;
  bodyStart: number;
}

function parseFrontmatter(content: string): RawFrontmatter | null {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || !FM_DELIM.test(lines[0] ?? "")) return null;
  let closing = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FM_DELIM.test(lines[i] ?? "")) {
      closing = i;
      break;
    }
  }
  if (closing === -1) return null;
  return { raw: lines.slice(1, closing).join("\n"), bodyStart: closing + 1 };
}

function fmField(raw: string, key: string): string | undefined {
  const m = raw.match(new RegExp(`^${key}\\s*:\\s*(.+?)\\s*$`, "im"));
  if (!m?.[1]) return undefined;
  return m[1].replace(/^["']|["']$/g, "").trim();
}

// ---------------------------------------------------------------------------
// Status normalisation — frontmatter uses a mix of casings + tokens.
// ---------------------------------------------------------------------------

function normaliseStatus(raw: string | undefined): ChainItemStatus {
  if (!raw) return "unknown";
  const v = raw.toLowerCase();
  if (v.includes("in force") || v === "in-force") return "in-force";
  if (v === "active" || v === "live") return "active";
  if (v === "populated") return "populated";
  if (v === "planned" || v === "draft-planned") return "planned";
  if (v === "stub") return "stub";
  if (v === "draft") return "draft";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Policy / procedure indexes — built once per process, lazily.
// ---------------------------------------------------------------------------

interface PolicyEntry {
  filename: string;
  title: string;
  status: ChainItemStatus;
  owner: string;
  policyId: string | undefined;
}

interface ProcedureEntry {
  filename: string;
  path: string;
  title: string;
  status: ChainItemStatus;
  owner: string;
  policyCitedRaw: string;
  systemCapabilityRaw: string;
}

let _policyIndex: Map<string, PolicyEntry> | null = null;
let _procedureIndex: ProcedureEntry[] | null = null;
let _indexedRepoRoot: string | null = null;

function indexPolicies(repoRoot: string): Map<string, PolicyEntry> {
  if (_policyIndex && _indexedRepoRoot === repoRoot) return _policyIndex;
  const dir = resolve(repoRoot, "Policies");
  const out = new Map<string, PolicyEntry>();
  if (!existsSync(dir)) {
    _policyIndex = out;
    return out;
  }
  for (const filename of readdirSync(dir)) {
    if (!filename.endsWith(".md") || filename === "README.md") continue;
    const path = join(dir, filename);
    let content: string;
    try {
      content = readFileSync(path, "utf-8");
    } catch {
      continue;
    }
    const fm = parseFrontmatter(content);
    const raw = fm?.raw ?? "";
    const h1 = content.match(/^#\s+(.+)$/m);
    const title = fmField(raw, "title") ?? h1?.[1]?.trim() ?? basename(filename, ".md");
    out.set(filename, {
      filename,
      title,
      status: normaliseStatus(fmField(raw, "status")),
      owner: fmField(raw, "owner") ?? "",
      policyId: fmField(raw, "policy-id"),
    });
  }
  _policyIndex = out;
  return out;
}

function indexProcedures(repoRoot: string): ProcedureEntry[] {
  if (_procedureIndex && _indexedRepoRoot === repoRoot) return _procedureIndex;
  const dir = resolve(repoRoot, "Procedures");
  const out: ProcedureEntry[] = [];
  if (!existsSync(dir)) {
    _procedureIndex = out;
    return out;
  }
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (entry === "templates") continue;
        walk(full);
        continue;
      }
      if (!entry.endsWith(".md")) continue;
      if (entry.startsWith("_") || entry === "README.md") continue;
      let content: string;
      try {
        content = readFileSync(full, "utf-8");
      } catch {
        continue;
      }
      const fm = parseFrontmatter(content);
      const raw = fm?.raw ?? "";
      const h1 = content.match(/^#\s+(.+)$/m);
      const title = fmField(raw, "title") ?? h1?.[1]?.trim() ?? basename(entry, ".md");
      out.push({
        filename: entry,
        path: full.slice(repoRoot.length + 1),
        title,
        status: normaliseStatus(fmField(raw, "status")),
        owner: fmField(raw, "owner") ?? "",
        policyCitedRaw: fmField(raw, "policy-cited") ?? "",
        systemCapabilityRaw: fmField(raw, "system-capability") ?? "",
      });
    }
  };
  walk(dir);
  _procedureIndex = out;
  return out;
}

/** Test/CI hook: drops the cache so subsequent calls re-read disk. */
export function resetPolicyChainCacheForTests(): void {
  _policyIndex = null;
  _procedureIndex = null;
  _indexedRepoRoot = null;
}

// ---------------------------------------------------------------------------
// Register-shaped listings — used by /api/rms to surface Policies + Procedures
// alongside the seven event-derived RMS registers. Same shape as the existing
// register rows (id + title + owner + status + path).
// ---------------------------------------------------------------------------

export interface PolicyRegisterRow {
  policyId: string;
  filename: string;
  title: string;
  owner: string;
  status: ChainItemStatus;
  path: string;
}

export interface ProcedureRegisterRow {
  procedureId: string;
  filename: string;
  title: string;
  owner: string;
  status: ChainItemStatus;
  policyCited: string;
  systemCapability: string;
  path: string;
}

export function listPolicies(repoRoot: string): PolicyRegisterRow[] {
  _indexedRepoRoot = repoRoot;
  const idx = indexPolicies(repoRoot);
  const out: PolicyRegisterRow[] = [];
  for (const p of idx.values()) {
    out.push({
      policyId: p.policyId ?? "",
      filename: p.filename,
      title: p.title,
      owner: p.owner,
      status: p.status,
      path: `Policies/${p.filename}`,
    });
  }
  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

export function listProcedures(repoRoot: string): ProcedureRegisterRow[] {
  _indexedRepoRoot = repoRoot;
  const idx = indexProcedures(repoRoot);
  const out: ProcedureRegisterRow[] = [];
  for (const p of idx) {
    out.push({
      procedureId: "",
      filename: p.filename,
      title: p.title,
      owner: p.owner,
      status: p.status,
      policyCited: p.policyCitedRaw,
      systemCapability: p.systemCapabilityRaw,
      path: p.path,
    });
  }
  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

// ---------------------------------------------------------------------------
// Matching helpers.
// ---------------------------------------------------------------------------

/**
 * Normalise a free-form policy reference for fuzzy match against the
 * policy index. Procedures cite policies in any of several shapes:
 *   - `AML-CFT-POLICY-V1` (policy-id, upper)
 *   - `Policies/risk-management-policy-v1.md` (path)
 *   - `Settlement and Reconciliation Policy (planned)` (prose)
 *   - `TRADING-MANDATE-V1` (decision-ref masquerading as policy)
 * We tokenise both sides and accept a match if the procedure's tokens
 * are a non-trivial subset of the policy's filename/title/id tokens.
 */
function tokenise(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/\bpolicy\b|\bpolicies\b|\bv\d+\b|\bplanned\b|\.md\b/g, " ")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3),
  );
}

function policyTokens(p: PolicyEntry): Set<string> {
  const combined = `${p.filename} ${p.title} ${p.policyId ?? ""}`;
  return tokenise(combined);
}

function citedMatchesPolicy(cited: string, p: PolicyEntry): boolean {
  if (!cited) return false;
  const c = cited.trim().toLowerCase();
  if (c.endsWith(p.filename.toLowerCase())) return true;
  if (p.policyId && c === p.policyId.toLowerCase()) return true;
  if (p.policyId && c.includes(p.policyId.toLowerCase())) return true;
  // Token-subset fuzzy: every meaningful token on the cited side must
  // appear in the policy side. Conservative — avoids weak matches like
  // "Conduct Policy" pulling every policy with "policy" in its name.
  const ct = tokenise(cited);
  const pt = policyTokens(p);
  if (ct.size === 0) return false;
  let hits = 0;
  for (const t of ct) if (pt.has(t)) hits += 1;
  return hits >= 2 || (ct.size === 1 && hits === 1);
}

// ---------------------------------------------------------------------------
// system-capability parser.
// ---------------------------------------------------------------------------

const FUNCTION_STATUS_RX = /\(([A-Z][A-Z\-]+)\)\s*$/;
const FRAGMENT_SPLIT_RX = /\s*[+·,&]\s+|\s+and\s+/g;

interface ParsedFunction {
  name: string;
  status: ChainItemStatus;
}

export function parseSystemCapability(raw: string): ParsedFunction[] {
  if (!raw.trim()) return [];
  // Detect a trailing "(STATUS)" that applies to all fragments (e.g.
  // "@platform/screening · @platform/case-management (PLANNED)" — the
  // PLANNED tag binds the case-management fragment specifically, not
  // the whole chain, per current authoring convention).
  const fragments = raw
    .split(FRAGMENT_SPLIT_RX)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  const out: ParsedFunction[] = [];
  for (const frag of fragments) {
    const sm = frag.match(FUNCTION_STATUS_RX);
    const status: ChainItemStatus = sm?.[1] ? normaliseStatus(sm[1]) : "unknown";
    const name = sm ? frag.slice(0, sm.index).trim() : frag;
    if (name.length === 0) continue;
    out.push({ name, status });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public resolver.
// ---------------------------------------------------------------------------

export function resolveDimensionChain(args: {
  repoRoot: string;
  policyHints: readonly string[];
}): DimensionPolicyChain {
  const { repoRoot, policyHints } = args;
  _indexedRepoRoot = repoRoot;
  const policyIdx = indexPolicies(repoRoot);
  const procedureIdx = indexProcedures(repoRoot);

  // 1. Anchor policies: hint set first, in declared order, dedup'd.
  const policies: PolicyRef[] = [];
  const seen = new Set<string>();
  for (const hint of policyHints) {
    const p = policyIdx.get(hint);
    if (!p || seen.has(p.filename)) continue;
    seen.add(p.filename);
    policies.push({
      filename: p.filename,
      title: p.title,
      owner: p.owner,
      status: p.status,
      source: "hint",
    });
  }

  if (policies.length === 0) {
    return { policies: [], procedures: [], functions: [] };
  }

  // 2. Procedures whose policy-cited matches any anchor policy.
  const anchorEntries = policies
    .map((p) => policyIdx.get(p.filename))
    .filter((p): p is PolicyEntry => p !== undefined);

  const procedures: ProcedureRef[] = [];
  const seenProc = new Set<string>();
  for (const proc of procedureIdx) {
    if (seenProc.has(proc.path)) continue;
    const matched = anchorEntries
      .filter((p) => citedMatchesPolicy(proc.policyCitedRaw, p))
      .map((p) => p.filename);
    if (matched.length === 0) continue;
    seenProc.add(proc.path);
    procedures.push({
      filename: proc.filename,
      path: proc.path,
      title: proc.title,
      owner: proc.owner,
      status: proc.status,
      policiesCited: matched,
      systemCapabilityRaw: proc.systemCapabilityRaw,
    });
  }

  // 3. Functions from system-capability fields of matched procedures.
  const functions: FunctionRef[] = [];
  const seenFn = new Set<string>();
  for (const proc of procedures) {
    for (const parsed of parseSystemCapability(proc.systemCapabilityRaw)) {
      const key = `${parsed.name}|${proc.filename}`;
      if (seenFn.has(key)) continue;
      seenFn.add(key);
      functions.push({
        name: parsed.name,
        status: parsed.status,
        fromProcedure: proc.filename,
      });
    }
  }

  return { policies, procedures, functions };
}
