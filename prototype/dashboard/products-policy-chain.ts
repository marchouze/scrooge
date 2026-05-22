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

import { POSTING_RULE_REGISTRY } from "../platform/accounting/posting-rule-registry";
import {
  findLifecycleForEventType,
  getLifecycleStage,
} from "../platform/lifecycle/trade-lifecycle-registry";

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

/**
 * A system capability / function that enables an event to be emitted.
 * Now a sub-row of EventRef rather than the terminal node of the chain.
 */
export interface FunctionRef {
  /** Module or capability identifier, e.g. `@platform/markets/cdm/fx`. */
  name: string;
  status: ChainItemStatus;
  /** Procedure filename this function was derived from (for back-link). */
  fromProcedure: string;
}

/**
 * An event emitted by the system as a consequence of following a procedure.
 * This is the terminal node of the Policy → Procedure → Events chain
 * (Principle 1: events are the durable proof that a procedure was followed).
 */
export interface EventRef {
  /** Registered event type name (matches event store type field). */
  eventType: string;
  /**
   * Where in the lifecycle this event sits — "opening", "in-flight", or
   * "terminal". Undefined if the event is not part of a trade lifecycle.
   */
  lifecycleStage?: "opening" | "in-flight" | "terminal";
  /**
   * When this event produces an accounting entry (from POSTING_RULE_REGISTRY),
   * or undefined if it has no GL impact.
   */
  accountingCondition?: string;
  /**
   * System capabilities / functions that enable this event to be emitted.
   * Populated from the `system-capability` frontmatter of matched procedures.
   */
  enabledBy: string[];
}

export interface DimensionPolicyChain {
  policies: PolicyRef[];
  procedures: ProcedureRef[];
  /** Terminal node: events this dimension's substrate emits. */
  events: EventRef[];
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
// Event-ref builder — terminal node of the Policy → Procedure → Events chain.
// ---------------------------------------------------------------------------

function buildEventRefs(
  emittedEventTypes: readonly string[],
  enabledByMap: Map<string, string[]> | readonly string[],
): EventRef[] {
  // Accept either a Map<eventType, capabilities[]> or a flat capabilities[]
  // (flat list applies the same capabilities to all events — used by the
  // product-level resolver where we have a declared-function list, not a
  // per-event breakdown).
  const resolveEnabledBy = (evType: string): string[] => {
    if (enabledByMap instanceof Map) return enabledByMap.get(evType) ?? [];
    return enabledByMap as string[];
  };

  return emittedEventTypes.map((evType): EventRef => {
    // Lifecycle stage from TRADE_LIFECYCLE_REGISTRY.
    const lcDef = findLifecycleForEventType(evType);
    const lifecycleStage = lcDef ? getLifecycleStage(evType, lcDef) : undefined;

    // Accounting condition from POSTING_RULE_REGISTRY — first non-stub match.
    const prEntry = POSTING_RULE_REGISTRY.find(
      (r) => r.triggerEventType === evType && r.condition !== "intentional-no-impact",
    );
    const accountingCondition = prEntry
      ? `${prEntry.postingRuleId}: ${prEntry.condition}${prEntry.conditionDetail ? ` (${prEntry.conditionDetail})` : ""}`
      : undefined;

    // exactOptionalPropertyTypes: only include optional fields when defined.
    const ref: EventRef = { eventType: evType, enabledBy: resolveEnabledBy(evType) };
    if (lifecycleStage !== undefined) ref.lifecycleStage = lifecycleStage;
    if (accountingCondition !== undefined) ref.accountingCondition = accountingCondition;
    return ref;
  });
}

// ---------------------------------------------------------------------------
// Public resolver.
// ---------------------------------------------------------------------------

export function resolveDimensionChain(args: {
  repoRoot: string;
  policyHints: readonly string[];
  /** Event types this dimension emits — becomes the terminal node of the chain. */
  emittedEventTypes?: readonly string[];
}): DimensionPolicyChain {
  const { repoRoot, policyHints, emittedEventTypes = [] } = args;
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
    return { policies: [], procedures: [], events: buildEventRefs(emittedEventTypes, []) };
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

  // 3. Events — terminal node. For each emitted event type, collect the
  // system-capability strings from matched procedures as "enabledBy".
  const enabledByMap = new Map<string, string[]>();
  for (const proc of procedures) {
    for (const parsed of parseSystemCapability(proc.systemCapabilityRaw)) {
      // Attribute the capability to every emitted event type for this dimension.
      for (const evType of emittedEventTypes) {
        const existing = enabledByMap.get(evType) ?? [];
        if (!existing.includes(parsed.name)) existing.push(parsed.name);
        enabledByMap.set(evType, existing);
      }
    }
  }

  return { policies, procedures, events: buildEventRefs(emittedEventTypes, enabledByMap) };
}

// ---------------------------------------------------------------------------
// Product-level resolver — same chain shape, scoped to one product.
// Inputs:
//   - `policyHints`: union of policyHints across the 14 NPA dimensions (every
//     dimension's anchor policy is "relevant" by virtue of the product touching
//     that dimension).
//   - `productTokens`: lower-case tokens that identify the product in
//     procedure filenames / system-capability strings (e.g. ["fx", "fx-spot"]).
//   - `productLifecycleEvents`: lifecycle event names emitted by the product
//     (used to widen the procedure match: a procedure referencing the event
//     by name in its system-capability or title is product-relevant).
//   - `declaredFunctions`: functions named directly on the product (CDM
//     primitive + extension modules, and posting-rule modules for the
//     lifecycle event family). These are added to the function list with
//     a synthetic `fromProcedure` of "product:declared".
// ---------------------------------------------------------------------------

export interface ProductDeclaredFunction {
  name: string;
  status: ChainItemStatus;
  source: string;
}

export function resolveProductChain(args: {
  repoRoot: string;
  policyHints: readonly string[];
  productTokens: readonly string[];
  productLifecycleEvents: readonly string[];
  declaredFunctions: readonly ProductDeclaredFunction[];
}): DimensionPolicyChain {
  const { repoRoot, policyHints, productTokens, productLifecycleEvents, declaredFunctions } = args;
  _indexedRepoRoot = repoRoot;
  const policyIdx = indexPolicies(repoRoot);
  const procedureIdx = indexProcedures(repoRoot);

  // 1. Anchor policies: union of hints across dimensions, dedup'd.
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
  const anchorEntries = policies
    .map((p) => policyIdx.get(p.filename))
    .filter((p): p is PolicyEntry => p !== undefined);

  // 2. Procedures — must cite an anchor policy AND be product-relevant.
  // Product-relevance = filename/path/system-capability/title contains any
  // productToken OR system-capability/title references any lifecycle event
  // from the product's family OR system-capability mentions a declared
  // function module.
  const declaredFnNames = new Set(declaredFunctions.map((f) => f.name.toLowerCase()));
  const productTokensLower = productTokens.map((t) => t.toLowerCase()).filter((t) => t.length > 0);
  const lifecycleEventsLower = productLifecycleEvents.map((e) => e.toLowerCase());

  function isProductRelevant(proc: ProcedureEntry): boolean {
    const haystack =
      `${proc.filename} ${proc.path} ${proc.title} ${proc.systemCapabilityRaw}`.toLowerCase();
    for (const t of productTokensLower) {
      if (t.length >= 2 && haystack.includes(t)) return true;
    }
    for (const e of lifecycleEventsLower) {
      if (haystack.includes(e)) return true;
    }
    for (const fn of declaredFnNames) {
      if (haystack.includes(fn)) return true;
    }
    return false;
  }

  // Fragment-level match — split the procedure's policy-cited raw on the
  // multi-policy separators commonly used in frontmatter ("·", ",", ";")
  // and require the policy to match at least one fragment. Stricter than
  // the dimension-level whole-string fuzzy match, which can collide on
  // weak token overlaps (e.g. "rate" + "risk") across unrelated policies.
  const fragmentMatchesPolicy = (citedRaw: string, p: PolicyEntry): boolean => {
    const fragments = citedRaw
      .split(/[·,;]\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (fragments.length === 0) return false;
    for (const frag of fragments) {
      if (citedMatchesPolicy(frag, p)) return true;
    }
    return false;
  };

  const procedures: ProcedureRef[] = [];
  const seenProc = new Set<string>();
  for (const proc of procedureIdx) {
    if (seenProc.has(proc.path)) continue;
    if (!isProductRelevant(proc)) continue;
    const matched = anchorEntries
      .filter((p) => fragmentMatchesPolicy(proc.policyCitedRaw, p))
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

  // 3. Events — terminal node. Collect all system capabilities from declared
  // functions and matched procedures as the flat enabledBy list (same
  // capability may enable multiple events; we surface it on all of them).
  const enabledByNames: string[] = [];
  const seenCap = new Set<string>();
  for (const df of declaredFunctions) {
    const key = df.name.toLowerCase();
    if (seenCap.has(key)) continue;
    seenCap.add(key);
    enabledByNames.push(df.name);
  }
  for (const proc of procedures) {
    for (const parsed of parseSystemCapability(proc.systemCapabilityRaw)) {
      const key = parsed.name.toLowerCase();
      if (seenCap.has(key)) continue;
      seenCap.add(key);
      enabledByNames.push(parsed.name);
    }
  }

  // Drop policies that have no procedures citing them AND aren't reachable
  // through the product — keeps the section honest about what's actually in
  // play for this product, not the universe of dimension hints.
  const citedPolicyFilenames = new Set<string>();
  for (const proc of procedures) for (const c of proc.policiesCited) citedPolicyFilenames.add(c);
  const filteredPolicies = policies.filter((p) => citedPolicyFilenames.has(p.filename));
  // If filtering would empty the policy column entirely (no matching
  // procedures yet), keep the full hint set so the user can see the
  // governance frame even when no executable procedure exists.
  const finalPolicies = filteredPolicies.length > 0 ? filteredPolicies : policies;

  return {
    policies: finalPolicies,
    procedures,
    events: buildEventRefs(productLifecycleEvents, enabledByNames),
  };
}
