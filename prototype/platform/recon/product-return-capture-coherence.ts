// platform/recon/product-return-capture-coherence.ts
//
// Recon: product-return-capture-coherence — the load-bearing integrity gate for
// the capture model (D-BA-RETURN-DATA-CONTRACT "close the loop"). The capture
// gate (`npa-return-data-gate.ts`) reads two truth sources — the C engine
// (`CAPTURE_CAPABILITY_MAP` → `deriveCapturedAttributes`) and the D event
// (`ProductReturnDataCaptureDeclared`). This recon asserts those two sources are
// COHERENT, GROUNDED, and NON-REDUNDANT, so neither can quietly fabricate a pass.
//
// WHAT IT ASSERTS
// ---------------
//   (a) GROUNDED DECLARATIONS. Every DECLARED override's `attributeKey` resolves
//       to a real `product-attribute` requirement in some authored L2 return
//       contract. A declaration for an attribute no return needs is a finding.
//   (b) NON-REDUNDANT DECLARATIONS. A declared override must be GENUINELY NOT
//       C-derivable for its product. If the C engine already derives the
//       attribute from the product's composition, declaring it is a two-sources-
//       of-truth redundancy → finding. (Also: empty/whitespace
//       `outOfCompositionJustification` → finding; the schema requires non-empty,
//       so this is a defence-in-depth assertion over the folded register.)
//   (c) NON-FABRICATED CAPABILITY ROWS. Every attribute a `CAPTURE_CAPABILITY_MAP`
//       row CLAIMS must be a real `product-attribute` requirement in some authored
//       contract (a row claiming an attribute no return needs is fabricated), and
//       every row's `cites[]` must be non-empty (the schema guarantees this; the
//       assertion is explicit so a future map edit cannot silently drop it).
//   (d) REQUIRED-ATTR COVERAGE. For every currently-effective product, every
//       PRODUCT-SPECIFIC required attribute it owes is C-derivable, validly
//       declared, or gap-tracked — i.e. the gate's own `ready` verdict holds.
//       (This mirrors the binding gate; here it is asserted as a coherence
//       invariant so the two cannot drift.)
//   (e) CROSS-STREAM JOIN. Every currently-effective product that the gate would
//       enforce on resolves on BOTH the `ProductRegisterRow` stream (v1 product
//       lifecycle) AND — when it owes any product-specific required attribute —
//       the `V2ProductRegistered` stream (the composition source). A product that
//       owes required attributes but has no V2 registration cannot have its C
//       path resolved → the join is incoherent → finding.
//
// FAIL-CLOSED, blocking (non-zero exit on any FAIL). Pure assertion over real
// repository state (the event log + the authored contracts). Wired into
// `bun run ci:recon:domain`.
//
// Authority: D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19, session-
//   delegation); D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION (CEO 2026-06-18);
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO 2026-06-17).
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import type { V2ProductRegistered } from "../../v2-core/banking/events";
import {
  CAPTURE_CAPABILITY_MAP,
  type ResolvedCompositionView,
  deriveCapturedAttributes,
} from "../../v2-core/regulatory-returns/capture-capability-map";
import type { ReturnContract } from "../../v2-core/regulatory-returns/cell-contract";
import { returnDataObligationsForProduct } from "../../v2-core/regulatory-returns/inverse-index";
import { parseProductAttributeRef } from "../../v2-core/regulatory-returns/return-attribute";
import { allReturnContracts } from "../../v2-core/regulatory-returns/return-contracts";
import {
  EMPTY_REPORTING_TREATMENT_REGISTER,
  type ReportingTreatmentRegister,
  foldReportingTreatmentRegister,
} from "../../v2-core/reporting-treatments/registry";
import { resolveProductTreatments } from "../accounting/reporting-treatment-dispatcher";
import { PRODUCT_TYPED_EVENT_TYPES } from "../event-store/event-types/product";
import type { Event } from "../event-store/types";
import { checkReturnDataObligations } from "../markets/products/npa-return-data-gate";
import { buildProductRegisterView } from "../projections/products/product-register";
import { resolveEffectiveApprovals } from "./product-approval-attestation-integrity";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "product-return-capture-coherence";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  dbPath?: string;
  events?: Iterable<Event>;
  contracts?: readonly ReturnContract[];
}

/** Every `<attr>` that appears as a `product-attribute` requirement in any contract. */
function contractAttributeUniverse(contracts: readonly ReturnContract[]): Set<string> {
  const out = new Set<string>();
  for (const c of contracts) {
    for (const cell of c.cells) {
      for (const d of cell.dataRequirements) {
        if (d.sourceKind !== "product-attribute") continue;
        const parsed = parseProductAttributeRef(d.ref);
        if (parsed !== undefined) out.add(parsed.attribute);
      }
    }
  }
  return out;
}

function compositionView(
  v2: V2ProductRegistered | undefined,
  treatmentRegister: ReportingTreatmentRegister,
): { filTypeScopes: readonly string[]; resolved: ResolvedCompositionView } {
  if (v2 === undefined) {
    return {
      filTypeScopes: [],
      resolved: { regulatoryApproach: undefined, unresolvedModuleIds: ["<no-v2-registration>"] },
    };
  }
  const resolved = resolveProductTreatments(v2, treatmentRegister);
  return {
    filTypeScopes: v2.filTypeScopes,
    resolved: {
      regulatoryApproach: resolved.prudential?.regulatoryApproach,
      unresolvedModuleIds: resolved.unresolvedModuleIds,
    },
  };
}

export function runOnEvents(events: Event[], contracts: readonly ReturnContract[]): ReconResult {
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const attrUniverse = contractAttributeUniverse(contracts);

  // ---- (c) NON-FABRICATED CAPABILITY ROWS --------------------------------
  for (const row of CAPTURE_CAPABILITY_MAP) {
    result.asserted++;
    if (row.cites.length === 0) {
      violations.push({
        subject: `capability-row:${row.id}`,
        message: `capability row \`${row.id}\` has no citations — a mapping with no regulatory basis is fabricated (Charter cmd 4)`,
        severity: "fail",
      });
    }
    for (const attr of row.attributes) {
      if (!attrUniverse.has(attr)) {
        violations.push({
          subject: `capability-row:${row.id}`,
          message: `capability row \`${row.id}\` claims attribute \`${attr}\` which is NOT a product-attribute requirement in any authored return contract — fabricated/stale mapping (Charter cmd 4)`,
          severity: "fail",
        });
      }
    }
  }

  // ---- Join surfaces -----------------------------------------------------
  const v2ByV1Id = new Map<string, V2ProductRegistered>();
  const v2ById = new Map<string, V2ProductRegistered>();
  const treatmentPayloads: unknown[] = [];
  const approvedEvents: Event[] = [];
  const supersessionEvents: Event[] = [];
  for (const ev of events) {
    if (ev.type === "V2ProductRegistered") {
      const v2 = ev.payload as unknown as V2ProductRegistered;
      v2ById.set(v2.productId, v2);
      if (typeof v2.v1ProductId === "string" && v2.v1ProductId.length > 0) {
        v2ByV1Id.set(v2.v1ProductId, v2);
      }
    } else if (ev.type === "ReportingTreatmentDeclared") {
      treatmentPayloads.push(ev.payload);
    } else if (ev.type === "ProductApproved") {
      approvedEvents.push(ev);
    } else if (ev.type === "ProductWithheld" || ev.type === "ProductRetired") {
      supersessionEvents.push(ev);
    }
  }
  const treatmentRegister: ReportingTreatmentRegister =
    treatmentPayloads.length > 0
      ? foldReportingTreatmentRegister(treatmentPayloads)
      : EMPTY_REPORTING_TREATMENT_REGISTER;

  const productEventTypeSet = new Set<string>(PRODUCT_TYPED_EVENT_TYPES);
  const productEvents = events.filter((ev) => productEventTypeSet.has(ev.type));
  const register = buildProductRegisterView(productEvents);

  const { effective } = resolveEffectiveApprovals(approvedEvents, supersessionEvents);

  for (const [productId] of [...effective].sort((a, b) => a[0].localeCompare(b[0]))) {
    const row = register.get(productId);
    if (!row) continue; // the binding gate reports this as its own integrity bug.

    const v2 = v2ByV1Id.get(productId) ?? v2ById.get(productId);
    const comp = compositionView(v2, treatmentRegister);
    const derived = deriveCapturedAttributes({
      filTypeScopes: comp.filTypeScopes,
      resolved: comp.resolved,
    });

    const obligations = returnDataObligationsForProduct(productId, contracts);

    // Required product-specific attributes this product owes.
    const requiredAttrs: string[] = [];
    for (const datum of obligations.requiredData) {
      if (datum.sourceKind !== "product-attribute" || !datum.required) continue;
      const parsed = parseProductAttributeRef(datum.ref);
      if (parsed === undefined || parsed.productId !== productId) continue;
      requiredAttrs.push(parsed.attribute);
    }

    // ---- (e) CROSS-STREAM JOIN ------------------------------------------
    result.asserted++;
    if (requiredAttrs.length > 0 && v2 === undefined) {
      violations.push({
        subject: productId,
        message: `\`${productId}\` owes ${requiredAttrs.length} product-specific required return attribute(s) but has NO V2ProductRegistered — composition cannot be resolved; cross-stream join incoherent (the C path cannot run). Register the product on the V2 stream or track the gap.`,
        severity: "fail",
      });
    }

    // ---- (a) GROUNDED + (b) NON-REDUNDANT DECLARATIONS ------------------
    for (const [attrKey, decl] of row.declaredReturnDataCaptures) {
      result.asserted++;
      // (a) grounded: attribute resolves to a real authored requirement.
      if (!attrUniverse.has(attrKey)) {
        violations.push({
          subject: productId,
          message: `\`${productId}\` declares capture for \`${attrKey}\` which is NOT a product-attribute requirement in any authored return contract — ungrounded declaration (clause a)`,
          severity: "fail",
        });
      }
      // (b) non-redundant: must NOT be C-derivable for this product.
      if (derived.attributes.has(attrKey)) {
        violations.push({
          subject: productId,
          message: `\`${productId}\` declares capture for \`${attrKey}\` which IS already derivable from its composition (rows: ${(
            derived.provenance.find((p) => p.attribute === attrKey)?.rowIds ?? []
          ).join(", ")}) — redundant override, two-sources-of-truth (clause b)`,
          severity: "fail",
        });
      }
      // (b) defence-in-depth: justification non-empty/non-whitespace.
      if (decl.outOfCompositionJustification.trim() === "") {
        violations.push({
          subject: productId,
          message: `\`${productId}\` declares capture for \`${attrKey}\` with an empty outOfCompositionJustification — a declaration must state why it is not composition-derivable (clause b)`,
          severity: "fail",
        });
      }
    }

    // ---- (d) REQUIRED-ATTR COVERAGE (gate-ready invariant) --------------
    const check = checkReturnDataObligations(row, obligations, comp);
    if (!check.ready) {
      violations.push({
        subject: productId,
        message: `\`${productId}\` is not capture-coherent — ${check.missing.length} required attribute(s) neither C-derivable, validly declared, nor gap-tracked: ${check.missing
          .map((a) => `\`${a}\``)
          .join(", ")} (clause d — mirrors the binding gate)`,
        severity: "fail",
      });
    } else {
      const derivedN = check.checks.filter((c) => c.disposition === "captured-derived").length;
      const declaredN = check.checks.filter((c) => c.disposition === "captured-declared").length;
      const deferredN = check.checks.filter((c) => c.disposition === "deferred").length;
      violations.push({
        subject: productId,
        message: `\`${productId}\` capture-coherent — ${requiredAttrs.length} required attr(s): ${derivedN} derived, ${declaredN} declared, ${deferredN} deferred`,
        severity: "info",
      });
    }
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.ok = failCount === 0;
  result.violations = violations;
  return result;
}

export function run(opts: RunOpts = {}): ReconResult {
  const contracts: readonly ReturnContract[] = opts.contracts ?? allReturnContracts();

  if (opts.events !== undefined) {
    return runOnEvents([...opts.events], contracts);
  }

  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");

  if (!existsSync(dbPath)) return emptyResult(PIPELINE);

  const store = new EventStore(dbPath);
  const events: Event[] = [...store.replay()];
  return runOnEvents(events, contracts);
}

if (import.meta.main) {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");
  const warns = result.violations.filter((v) => v.severity === "warn");
  const infos = result.violations.filter((v) => v.severity === "info");

  for (const v of infos) console.log(`  info  [${v.subject}] ${v.message}`);
  for (const v of warns) console.warn(`  warn  [${v.subject}] ${v.message}`);
  for (const v of fails) console.error(`  FAIL  [${v.subject}] ${v.message}`);

  console.log(
    `\nrecon:${PIPELINE} — ${result.asserted} assertion(s), ` +
      `${fails.length} fail, ${warns.length} warn, ${infos.length} info`,
  );

  if (!result.ok) {
    console.error(`recon:${PIPELINE} FAILED — ${fails.length} failure(s)`);
    process.exit(1);
  } else {
    console.log(`recon:${PIPELINE} OK`);
  }
}
