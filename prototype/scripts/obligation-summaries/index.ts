// prototype/scripts/obligation-summaries/index.ts
//
// Aggregator for the P4-SCALE per-domain reviewed-requirement-summary modules
// (D-OBLIGATIONS-REGISTER-CLEANUP Phase 4 SCALE). One module per non-A domain
// (B..J); the generic author (`author-obligation-summaries.ts`) and the seed
// editor read this single map so the review-event audit trail and the corrected
// `ObligationAdopted.requirement` cannot drift apart.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { DOMAIN_B } from "./domain-b-summaries";
import { DOMAIN_C } from "./domain-c-summaries";
import { DOMAIN_D } from "./domain-d-summaries";
import { DOMAIN_E } from "./domain-e-summaries";
import { DOMAIN_F } from "./domain-f-summaries";
import { DOMAIN_G } from "./domain-g-summaries";
import { DOMAIN_H } from "./domain-h-summaries";
import { DOMAIN_I } from "./domain-i-summaries";
import { DOMAIN_J } from "./domain-j-summaries";
import type { SummaryModule } from "./summary-types";

export const DOMAIN_SUMMARIES: Record<string, SummaryModule> = {
  B: DOMAIN_B,
  C: DOMAIN_C,
  D: DOMAIN_D,
  E: DOMAIN_E,
  F: DOMAIN_F,
  G: DOMAIN_G,
  H: DOMAIN_H,
  I: DOMAIN_I,
  J: DOMAIN_J,
};
