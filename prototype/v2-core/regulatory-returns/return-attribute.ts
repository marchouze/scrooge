// v2-core/regulatory-returns/return-attribute.ts
//
// The return-data ATTRIBUTE KEY — the vocabulary the capture model speaks.
//
// A return cell's `product-attribute` data requirement carries a ref of the
// form `<productId>#<attribute>` (e.g. `prd:bank:credit:loan#exposureClass`).
// The `<attribute>` tail is the RETURN-DATA ATTRIBUTE KEY: the piece of
// product-level data the product must be able to supply for the cell to
// populate. THIS module is the single home for that key's type.
//
// WHY A SEPARATE MODULE (and why a string today, not an enum)
// -----------------------------------------------------------
// The attribute vocabulary is GROUNDED in the authored L2 return contracts —
// it is whatever set of `<attr>` tails the authored forms actually reference
// (`exposureClass`, `pdEstimate`, `lgdEstimate`, `counterpartyIdentity`,
// `hqlaLevel`, …). That set GROWS as Bea authors more returns. Hard-coding a
// closed enum here would drift behind the contracts and force a code edit per
// new return — the wrong coupling.
//
// So the key is `z.string().min(1)` TODAY, and the GROUNDING is enforced at
// RECON time instead (Engineering Charter cmd 4 — source, don't hardcode):
// `recon:product-return-capture-coherence` asserts that every attribute key a
// product DECLARES (the D path) or that a capability-map row CLAIMS (the C
// path) actually resolves to a `product-attribute` requirement in some authored
// return contract. A fabricated or stale key is therefore a loud recon failure,
// not a silent pass. When the contract set stabilises this can be tightened to
// a contract-DERIVED enum (built from `allReturnContracts()`); the recon makes
// that a safe, mechanical follow-on.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19, session-
//   delegation) — the "close the loop" capture-generalisation track.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

/**
 * A return-data attribute key — the `<attr>` tail of a `<productId>#<attr>`
 * product-attribute requirement ref. A plain non-empty string today; the
 * coherence recon grounds every used key against the authored L2 contracts so
 * an unbacked key cannot pass (see module header).
 */
export const returnAttributeKeySchema = z.string().min(1);
export type ReturnAttributeKey = z.infer<typeof returnAttributeKeySchema>;

/**
 * Split a `product-attribute` requirement ref (`<productId>#<attr>`) into its
 * productId and attribute-key parts. Returns `undefined` for a bare
 * (product-agnostic, no `#`) ref. This is the ONE canonical parser the capture
 * model + the coherence recon share, so the gate and the recon never disagree
 * on what a ref means (fail-closed: a malformed ref with an empty tail returns
 * `undefined`, never a half-parsed key).
 */
export function parseProductAttributeRef(
  ref: string,
): { readonly productId: string; readonly attribute: ReturnAttributeKey } | undefined {
  const hash = ref.indexOf("#");
  if (hash <= 0) return undefined; // bare ref, or `#` at position 0 → no product
  const productId = ref.slice(0, hash);
  const attribute = ref.slice(hash + 1);
  if (productId.length === 0 || attribute.length === 0) return undefined;
  return { productId, attribute };
}
