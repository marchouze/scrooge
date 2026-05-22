// platform/citation/urn.ts
//
// Canonical URN parser + per-class Zod schemas.
//
// Authority: D-URN-CANONICAL-VOCABULARY (CEO-approved 2026-05-22 via session
// delegation; event `3a3deae9-4274-46b0-9d0b-5208fbdb84a1`). Register at
// `Regulations/_urn-vocabulary.md` is the canonical source of slug-rules; the
// schemas below are the executable expression of those rules.
//
// Author: Owen (Company Secretary, governance).
//
// Design notes:
//   - The bank's URN scheme is `urn:<class>:<scope>:<slug>` where `<scope>`
//     is typically `bank` (for bank-authored artefacts) or a sub-namespace
//     for shared registers (e.g. `urn:party:natural-person:...`).
//   - The pre-existing `urn:obligation:bank:...` pattern (live since v1.0)
//     is the gold standard; every new class follows the same shape.
//   - `parseUrn(s)` returns `UrnRef` on success or `UrnParseError` on failure.
//     Discriminate via the `kind` field — `"ref"` for success, `"error"` for
//     failure. No exceptions thrown for malformed input (consumers wrap in
//     `throw` if they want fail-fast behaviour).
//   - Slug-rule regexes are anchored (`^...$`) and conservative — they
//     accept the published vocabulary and reject everything else. Tightening
//     a rule is a non-breaking change for downstream consumers (a previously
//     accepted URN becomes a `UrnParseError`); loosening a rule needs a
//     `D-URN-VOCABULARY-EXTEND-*` decision.

import { z } from "zod";

/** Discriminated union: success or error. */
export type UrnParseResult = UrnRef | UrnParseError;

/** Successful parse of a canonical URN. */
export interface UrnRef {
  readonly kind: "ref";
  /** The full input string, verbatim. */
  readonly raw: string;
  /** One of the canonical URN classes registered in `_urn-vocabulary.md`. */
  readonly urnClass: UrnClass;
  /** The portion after `urn:<class>:` — i.e. scope + slug, colon-joined. */
  readonly tail: string;
}

/** Failed parse — includes the input and a human-readable reason. */
export interface UrnParseError {
  readonly kind: "error";
  readonly raw: string;
  readonly reason: string;
}

/** Canonical URN class identifiers — must match `_urn-vocabulary.md` rows. */
export const URN_CLASSES = [
  "reg",
  "obligation",
  "policy",
  "procedure",
  "decision",
  "capability",
  "party",
  "activity",
  "product",
  "risk",
  "event",
] as const;

export type UrnClass = (typeof URN_CLASSES)[number];

const URN_CLASS_SET: ReadonlySet<string> = new Set(URN_CLASSES);

// ---------------------------------------------------------------------------
// Per-class Zod schemas — slug-rule encoded as regex.
//
// Each schema validates the *full* URN string. The patterns deliberately
// permit lowercase letters, digits, hyphens, and slashes (for `urn:reg:` and
// `urn:capability:` hierarchical paths) plus colons for sub-namespacing
// inside the tail. Versioning (`:v1`, `:v2`, ...) is encoded where the
// vocabulary specifies it.
// ---------------------------------------------------------------------------

/** `urn:reg:<jurisdiction>:<instrument-slug>[:<provision-slug>]` */
export const RegUrnSchema = z
  .string()
  .regex(
    /^urn:reg:[a-z0-9-]+:[a-z0-9./_-]+(?::[a-z0-9./_-]+)*$/,
    "urn:reg expects jurisdiction + instrument slug (+ optional provision); lowercase, digits, dot, slash, underscore, hyphen",
  );

/** `urn:obligation:bank:<tranche>:<instrument-slug>:v<n>` — existing format. */
export const ObligationUrnSchema = z
  .string()
  .regex(
    /^urn:obligation:bank:[a-z0-9-]+(?::[a-z0-9._/-]+)+:v\d+$/,
    "urn:obligation expects bank:<tranche>:<instrument>(:<...>)*:v<n>",
  );

/** `urn:policy:bank:<slug>:v<n>` */
export const PolicyUrnSchema = z
  .string()
  .regex(
    /^urn:policy:bank:[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*:v\d+$/,
    "urn:policy expects bank:<slug>:v<n>",
  );

/** `urn:procedure:bank:<slug>` */
export const ProcedureUrnSchema = z
  .string()
  .regex(/^urn:procedure:bank:[a-z0-9][a-z0-9._/-]*$/, "urn:procedure expects bank:<slug>");

/** `urn:decision:bank:D-<SLUG>` — slug is the decisionId (allowed punctuation: hyphen, dot, digits, upper- + lowercase). */
export const DecisionUrnSchema = z
  .string()
  .regex(
    /^urn:decision:bank:D-[A-Za-z0-9][A-Za-z0-9._-]*$/,
    "urn:decision expects bank:D-<SLUG> (slug starts alpha/digit)",
  );

/** `urn:capability:bank:<canonical-path-slug>` */
export const CapabilityUrnSchema = z
  .string()
  .regex(
    /^urn:capability:bank:[a-z0-9][a-z0-9._/-]*$/,
    "urn:capability expects bank:<canonical-path-slug>",
  );

/**
 * `urn:party:<kind>:<slug>` — pre-existing forms include
 * `natural-person`, `legal-entity`, `counterparty`, `agent`.
 */
export const PartyUrnSchema = z
  .string()
  .regex(
    /^urn:party:(natural-person|legal-entity|counterparty|agent):[a-z0-9][a-z0-9._-]*$/,
    "urn:party expects (natural-person|legal-entity|counterparty|agent):<slug>",
  );

/** `urn:activity:bank:ACT-<CODE>` where `<CODE>` matches the activity-taxonomy. */
export const ActivityUrnSchema = z
  .string()
  .regex(
    /^urn:activity:bank:ACT-[A-Z][A-Z0-9-]*$/,
    "urn:activity expects bank:ACT-<CODE> (uppercase)",
  );

/** `urn:product:bank:<product-code>` e.g. `fx-spot`, `listed-bond`. */
export const ProductUrnSchema = z
  .string()
  .regex(
    /^urn:product:bank:[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*$/,
    "urn:product expects bank:<product-code>",
  );

/** `urn:risk:bank:RT-<CODE>` where `<CODE>` matches the risk-taxonomy. */
export const RiskUrnSchema = z
  .string()
  .regex(
    /^urn:risk:bank:RT-[A-Z][A-Z0-9.-]*$/,
    "urn:risk expects bank:RT-<CODE> (uppercase, dot-permitted)",
  );

/** `urn:event:bank:<TypeName>` (event-class names are PascalCase TypeScript symbols). */
export const EventUrnSchema = z
  .string()
  .regex(/^urn:event:bank:[A-Z][A-Za-z0-9]*$/, "urn:event expects bank:<TypeName> (PascalCase)");

/** Registry mapping URN class -> Zod schema. */
export const URN_SCHEMAS: { readonly [K in UrnClass]: z.ZodString } = {
  reg: RegUrnSchema,
  obligation: ObligationUrnSchema,
  policy: PolicyUrnSchema,
  procedure: ProcedureUrnSchema,
  decision: DecisionUrnSchema,
  capability: CapabilityUrnSchema,
  party: PartyUrnSchema,
  activity: ActivityUrnSchema,
  product: ProductUrnSchema,
  risk: RiskUrnSchema,
  event: EventUrnSchema,
};

// ---------------------------------------------------------------------------
// parseUrn — single entry-point.
// ---------------------------------------------------------------------------

export function parseUrn(s: string): UrnParseResult {
  if (typeof s !== "string" || s.length === 0) {
    return { kind: "error", raw: String(s), reason: "URN is empty" };
  }
  if (!s.startsWith("urn:")) {
    return {
      kind: "error",
      raw: s,
      reason: "URN must start with `urn:` prefix",
    };
  }
  const parts = s.split(":");
  if (parts.length < 3) {
    return {
      kind: "error",
      raw: s,
      reason: "URN must have at least three colon-separated segments (`urn:<class>:<tail>`)",
    };
  }
  const urnClass = parts[1] ?? "";
  if (!URN_CLASS_SET.has(urnClass)) {
    return {
      kind: "error",
      raw: s,
      reason: `Unknown URN class \`${urnClass}\`; registered classes: ${URN_CLASSES.join(", ")}`,
    };
  }
  const schema = URN_SCHEMAS[urnClass as UrnClass];
  const parsed = schema.safeParse(s);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      kind: "error",
      raw: s,
      reason: issue?.message ?? `Slug-rule violation for urn:${urnClass}`,
    };
  }
  return {
    kind: "ref",
    raw: s,
    urnClass: urnClass as UrnClass,
    tail: parts.slice(2).join(":"),
  };
}

/** Convenience: returns `true` if `s` is in canonical URN shape. */
export function isUrn(s: string): boolean {
  return parseUrn(s).kind === "ref";
}
