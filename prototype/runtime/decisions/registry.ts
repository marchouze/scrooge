// runtime/decisions/registry.ts
//
// Slug minting + validation for the unified `Decision` event family.
// Authority: `D-DECISIONS-FRAMEWORK-REDESIGN` (CEO-approved 2026-05-16),
// Slice B scope per the rollout plan.
//
// The "registry" is event-derived — there is no separate file. The
// universe of known ids comes from the decisions projection
// (`projections/decisions.ts`), which folds `Decision` + (transition)
// `CeoDecision` events.
//
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../../projections/decisions";

// ---------------------------------------------------------------------------
// Format / placeholder rules — mirror `decision-id-hygiene` recon at write-time
// ---------------------------------------------------------------------------

const PLACEHOLDER_RE = /^D-(XXX|IN|FX-?|TBD|TODO|\d{1,3})$/;
const VALID_SLUG_RE = /^D-[A-Z][A-Z0-9-]{1,58}[A-Z0-9]$/;
const MAX_LEN = 60;
const MIN_LEN = 3;

export interface SlugValidationResult {
  readonly ok: boolean;
  readonly reason?: string;
}

/**
 * Validate the structural shape of a decision id. Rejects placeholders,
 * out-of-range lengths, and slugs that don't match the canonical regex.
 * Does NOT check collisions / shadows — `mintDecisionId` does.
 */
export function validateDecisionSlug(id: string): SlugValidationResult {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, reason: "id is empty" };
  }
  if (id.length < MIN_LEN) {
    return { ok: false, reason: `id is shorter than ${MIN_LEN} chars` };
  }
  if (id.length > MAX_LEN) {
    return { ok: false, reason: `id exceeds ${MAX_LEN}-char limit (${id.length} chars)` };
  }
  if (PLACEHOLDER_RE.test(id)) {
    return {
      ok: false,
      reason: `id \`${id}\` is a placeholder — pick a semantic slug`,
    };
  }
  if (!VALID_SLUG_RE.test(id)) {
    return {
      ok: false,
      reason: `id \`${id}\` violates slug format /^D-[A-Z][A-Z0-9-]{1,58}[A-Z0-9]$/ (uppercase, hyphen-separated, leading letter, no trailing hyphen)`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Slug minting
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "as",
  "is",
  "are",
  "be",
  "or",
]);

function slugifyTitle(title: string): string {
  const tokens = title
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t.toLowerCase()));
  return tokens.join("-");
}

function clampLen(base: string, maxBody: number): string {
  if (base.length <= maxBody) return base;
  let s = base.slice(0, maxBody);
  // trim a trailing partial-hyphen segment so we don't end on `-` or chop a word.
  s = s.replace(/-[A-Z0-9]*$/, "");
  return s;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  let prev = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    const curr = new Array<number>(bl + 1);
    curr[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = curr;
  }
  return prev[bl] ?? 0;
}

export interface MintResult {
  readonly id: string;
  readonly alternatives: readonly string[];
}

export interface MintOpts {
  /** Optional hint appended/prefixed to the base slug. */
  readonly hint?: string;
  /** Inject the universe of known ids — defaults to the live projection. */
  readonly knownIds?: ReadonlySet<string>;
}

function knownIdsFromStore(): Set<string> {
  try {
    const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
    return new Set(register.byId.keys());
  } catch {
    return new Set();
  }
}

/**
 * Propose a canonical decision id from a free-form title, with collision
 * + near-collision (Levenshtein ≤ 2) + prefix-shadow checks against the
 * live projection.
 *
 * Returns one chosen id (guaranteed unique against the supplied universe)
 * plus 2–3 alternatives the caller can show in a picker.
 *
 * Authority: `D-DECISIONS-FRAMEWORK-REDESIGN`, Slice B.
 */
export function mintDecisionId(title: string, opts: MintOpts = {}): MintResult {
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("mintDecisionId: title is required");
  }
  const known = opts.knownIds ?? knownIdsFromStore();
  const base = slugifyTitle(title);
  if (base.length === 0) {
    throw new Error("mintDecisionId: title produced an empty slug after tokenisation");
  }
  const hint = opts.hint ? slugifyTitle(opts.hint) : "";
  const maxBody = MAX_LEN - 2; // account for the `D-` prefix.

  // Candidate pool: base, hint-base, base-V2, base-2026, etc.
  const candidates: string[] = [];
  const push = (raw: string) => {
    const slug = `D-${clampLen(raw.replace(/^D-?/, ""), maxBody)}`;
    const v = validateDecisionSlug(slug);
    if (!v.ok) return;
    if (candidates.includes(slug)) return;
    candidates.push(slug);
  };

  push(base);
  if (hint) push(`${hint}-${base}`);
  if (hint) push(`${base}-${hint}`);
  push(`${base}-V2`);
  push(`${base}-NEW`);

  // Filter against known + near-collision + prefix-shadow.
  const accepted: string[] = [];
  for (const c of candidates) {
    if (known.has(c)) continue;
    let shadow = false;
    for (const k of known) {
      if (k.startsWith(`${c}-`)) {
        shadow = true;
        break;
      }
      if (c.startsWith(`${k}-`)) {
        shadow = true;
        break;
      }
      if (levenshtein(c, k) <= 2) {
        shadow = true;
        break;
      }
    }
    if (!shadow) accepted.push(c);
  }

  if (accepted.length === 0) {
    // Fallback — disambiguate with an incrementing suffix.
    let n = 2;
    while (n < 100) {
      const candidate = `D-${clampLen(base, maxBody - 3)}-V${n}`;
      const v = validateDecisionSlug(candidate);
      if (v.ok && !known.has(candidate)) {
        return { id: candidate, alternatives: [] };
      }
      n++;
    }
    throw new Error(`mintDecisionId: exhausted suffix space for base \`${base}\``);
  }

  const chosen = accepted[0] as string;
  const alternatives = accepted.slice(1, 4);
  return { id: chosen, alternatives };
}
