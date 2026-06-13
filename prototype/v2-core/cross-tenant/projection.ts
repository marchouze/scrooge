// v2-core/cross-tenant/projection.ts
//
// CSI BLOCKLIST PROJECTION — V2 S12.
//
// Folds the CSI blocklist event family (`CsiCategoryRegistered` /
// `CsiCategoryRetired`) into a queryable register. LATEST state per
// `categoryId` wins (Principle 1): a registration followed by a retirement
// folds to a retired (inactive) category. The cross-tenant learning gate
// (`./gate.ts`) screens against the ACTIVE categories of this register.
//
// PACKAGE BOUNDARY: no v1 imports. See `recon:v2-no-v1-import`.
//
// Authority: D-W7-VENDOR-ENTITY-STRUCTURE; D-V2-TENANCY-ARCHITECTURE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Atlas (Substrate Architect, engineering).

import type {
  CsiBlocklistEventPayload,
  CsiCategoryClass,
  CsiCategoryRegisteredPayload,
  CsiCategoryRetiredPayload,
} from "./csi-blocklist";

// ---------------------------------------------------------------------------
// Projected types
// ---------------------------------------------------------------------------

/**
 * A CSI category as projected from the event stream.
 *
 * `active` — `true` while registered and not retired. The gate screens only
 * against active categories.
 */
export interface CsiCategory {
  readonly categoryId: string;
  readonly categoryClass: CsiCategoryClass;
  readonly description: string;
  readonly lawBasis: string;
  readonly registeredBy: string;
  readonly active: boolean;
}

/** A fold-integrity violation surfaced during projection. */
export interface CsiFoldViolation {
  readonly categoryId: string;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// CsiBlocklist register
// ---------------------------------------------------------------------------

/**
 * The folded CSI blocklist register. Build with `foldCsiBlocklist(payloads)`.
 *
 * The register exposes:
 *   - `listCategories()`     — all categories (active and retired).
 *   - `activeCategories()`   — only the active categories (what the gate screens).
 *   - `getCategory(id)`      — single-category lookup or `null`.
 *   - `activeClasses()`      — the set of active category CLASSES (coverage gate).
 *   - `violations`           — fold-integrity violations (orphan retire, dup register).
 */
export class CsiBlocklist {
  private readonly categories = new Map<string, CsiCategory>();
  readonly violations: readonly CsiFoldViolation[];

  private constructor(categories: Map<string, CsiCategory>, violations: CsiFoldViolation[]) {
    this.categories = categories;
    this.violations = violations;
  }

  static fold(payloads: readonly CsiBlocklistEventPayload[]): CsiBlocklist {
    const categories = new Map<string, CsiCategory>();
    const violations: CsiFoldViolation[] = [];

    for (const p of payloads) {
      switch (p.kind) {
        case "CsiCategoryRegistered": {
          const reg = p as { kind: "CsiCategoryRegistered" } & CsiCategoryRegisteredPayload;
          if (categories.has(reg.categoryId) && categories.get(reg.categoryId)?.active) {
            violations.push({
              categoryId: reg.categoryId,
              message: `duplicate registration of an already-active category: ${reg.categoryId}`,
            });
          }
          categories.set(reg.categoryId, {
            categoryId: reg.categoryId,
            categoryClass: reg.categoryClass,
            description: reg.description,
            lawBasis: reg.lawBasis,
            registeredBy: reg.registeredBy,
            active: true,
          });
          break;
        }
        case "CsiCategoryRetired": {
          const ret = p as { kind: "CsiCategoryRetired" } & CsiCategoryRetiredPayload;
          const existing = categories.get(ret.categoryId);
          if (!existing) {
            violations.push({
              categoryId: ret.categoryId,
              message: `retirement of an unregistered category: ${ret.categoryId}`,
            });
            break;
          }
          categories.set(ret.categoryId, { ...existing, active: false });
          break;
        }
        default: {
          // Forward-compatible: ignore unknown kinds.
          break;
        }
      }
    }

    return new CsiBlocklist(categories, violations);
  }

  listCategories(): CsiCategory[] {
    return [...this.categories.values()];
  }

  activeCategories(): CsiCategory[] {
    return this.listCategories().filter((c) => c.active);
  }

  getCategory(categoryId: string): CsiCategory | null {
    return this.categories.get(categoryId) ?? null;
  }

  /** The set of active category CLASSES — used by the coverage assertion. */
  activeClasses(): Set<CsiCategoryClass> {
    return new Set(this.activeCategories().map((c) => c.categoryClass));
  }
}

/** Convenience: fold a payload stream into a `CsiBlocklist`. */
export function foldCsiBlocklist(payloads: readonly CsiBlocklistEventPayload[]): CsiBlocklist {
  return CsiBlocklist.fold(payloads);
}

/** An empty CSI blocklist (no categories). */
export function emptyCsiBlocklist(): CsiBlocklist {
  return CsiBlocklist.fold([]);
}
