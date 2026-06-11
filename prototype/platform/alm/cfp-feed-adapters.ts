// platform/alm/cfp-feed-adapters.ts
//
// Live-feed adapter interfaces for the two externally-sourced CFP EWI inputs:
//   - ExternalCreditEventDetected  — Tier 2 trigger per LRM Policy v1 §5.2
//   - RecoveryEarlyWarningTriggered — Tier 3 trigger per LRM Policy v1 §5.2
//
// Build-phase posture: both adapters return null — no external feed is wired.
// At licence-day, replace the stub implementations with live-feed bindings:
//   - ExternalCreditFeedAdapter: Moody's/S&P/Fitch webhook, SARB risk-notification
//     channel, or an internal counterparty-watchlist event subscription.
//   - RecoveryPlanFeedAdapter: Helena's (Chief Risk Officer, governance) recovery-plan
//     indicator substrate when it lands; until then the stub is the correct posture.
//
// Injection point: `loadCfpEwiInputs` in `platform/alm/cfp-ewi.ts` currently
// hardcodes empty arrays for `externalCreditEvents` and `recoveryEwiTrips`.
// Replace those with adapter calls at licence-day:
//   ```ts
//   const creditAdapter: ExternalCreditFeedAdapter = new StubExternalCreditFeedAdapter();
//   // Replace StubExternalCreditFeedAdapter with a live-feed implementation at
//   // licence-day; set via constructor injection or CREDIT_FEED_ADAPTER env.
//   const recoveryAdapter: RecoveryPlanFeedAdapter = new StubRecoveryPlanFeedAdapter();
//   // Replace StubRecoveryPlanFeedAdapter with Helena's recovery-plan indicator
//   // substrate at licence-day; set via constructor injection or RECOVERY_FEED_ADAPTER env.
//   const creditEvent = await creditAdapter.fetchCreditEvent(entityId, asOf);
//   const recoveryWarning = await recoveryAdapter.fetchRecoveryWarning(entityId, asOf);
//   ```
//
// Authority: D-TREASURER-WAVE2-SUBSTRATE (CEO-approved 2026-06-11);
//   LRM Policy v1 §5.2 + §4.5; BCBS 144 Principle 11.
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

// ---------------------------------------------------------------------------
// ExternalCreditFeedAdapter
// ---------------------------------------------------------------------------

/**
 * Adapter interface for the external credit-event feed.
 *
 * The feed surfaces rating-agency downgrades (Moody's / S&P / Fitch),
 * SARB risk-notification events, or internal counterparty-watchlist
 * threshold crossings that constitute a "material" credit event per
 * LRM Policy v1 §5.2 (Tier 2 trigger: `ExternalCreditEventDetected`).
 *
 * Build-phase: `StubExternalCreditFeedAdapter.fetchCreditEvent` returns null.
 * Licence-day: replace with a live-feed implementation via constructor
 * injection or the `CREDIT_FEED_ADAPTER` environment variable.
 */
export interface ExternalCreditFeedAdapter {
  /**
   * Fetch the most recent external credit event for `entityId` as of `asOf`.
   *
   * Returns null when no material event is present (build-phase default;
   * also the correct return when no event has occurred on the query date).
   *
   * @param entityId - Legal-entity short-id (e.g. `LE-ZA-HOZ-BANK` or a
   *   counterparty LEI / internal party reference).
   * @param asOf     - ISO 8601 date string — the business date of the EWI
   *   evaluation pass.
   */
  fetchCreditEvent(
    entityId: string,
    asOf: string,
  ): Promise<{
    /** BCBS / LRM severity qualifier: "material" trips the Tier 2 trigger. */
    severity: string;
    /** Agency or channel that surfaced the event (e.g. "moodys", "sarb-notification"). */
    sourceAgency: string;
    /** Human-readable description for the trigger event's `description` field. */
    note: string;
  } | null>;
}

// ---------------------------------------------------------------------------
// RecoveryPlanFeedAdapter
// ---------------------------------------------------------------------------

/**
 * Adapter interface for the Recovery Plan early-warning-indicator feed.
 *
 * Surfaces recovery-framework indicator trips (ICAAP §3.3.5 / LRM Policy
 * v1 §5.2 Tier 3 trigger: `RecoveryEarlyWarningTriggered`). Once Helena
 * (Chief Risk Officer, governance) lands the recovery-plan indicator
 * substrate, this adapter wraps that substrate.
 *
 * Build-phase: `StubRecoveryPlanFeedAdapter.fetchRecoveryWarning` returns null.
 * Licence-day: replace with Helena's recovery-plan indicator substrate binding
 * via constructor injection or the `RECOVERY_FEED_ADAPTER` environment variable.
 */
export interface RecoveryPlanFeedAdapter {
  /**
   * Fetch the most recent recovery-plan EWI trip for `entityId` as of `asOf`.
   *
   * Returns null when no indicator has crossed its threshold (build-phase
   * default; also correct when no trip has occurred on the query date).
   *
   * @param entityId - Legal-entity short-id.
   * @param asOf     - ISO 8601 date string — the business date of the EWI
   *   evaluation pass.
   */
  fetchRecoveryWarning(
    entityId: string,
    asOf: string,
  ): Promise<{
    /** Indicator identifier from the Recovery Plan indicator register. */
    triggerType: string;
    /** Human-readable description for the trigger event's `description` field. */
    note: string;
  } | null>;
}

// ---------------------------------------------------------------------------
// Build-phase stub implementations
// ---------------------------------------------------------------------------

/**
 * Build-phase stub for `ExternalCreditFeedAdapter`.
 *
 * Always returns null — no external credit feed is wired in the build phase.
 * Replace this class at licence-day with a live-feed implementation that
 * connects to the Moody's / S&P / Fitch webhook, the SARB risk-notification
 * channel, or an internal counterparty-watchlist subscription.
 *
 * Injection point: `loadCfpEwiInputs` in `platform/alm/cfp-ewi.ts`.
 * Replace via constructor injection or the `CREDIT_FEED_ADAPTER` env var.
 */
export class StubExternalCreditFeedAdapter implements ExternalCreditFeedAdapter {
  // build-phase stub — no external feed wired; returns null unconditionally
  async fetchCreditEvent(
    _entityId: string,
    _asOf: string,
  ): Promise<{ severity: string; sourceAgency: string; note: string } | null> {
    return null;
  }
}

/**
 * Build-phase stub for `RecoveryPlanFeedAdapter`.
 *
 * Always returns null — Helena's (Chief Risk Officer, governance) recovery-plan
 * indicator substrate has not yet landed. Replace at licence-day when the
 * substrate is available.
 *
 * Injection point: `loadCfpEwiInputs` in `platform/alm/cfp-ewi.ts`.
 * Replace via constructor injection or the `RECOVERY_FEED_ADAPTER` env var.
 */
export class StubRecoveryPlanFeedAdapter implements RecoveryPlanFeedAdapter {
  // build-phase stub — recovery-plan indicator substrate pending; returns null unconditionally
  async fetchRecoveryWarning(
    _entityId: string,
    _asOf: string,
  ): Promise<{ triggerType: string; note: string } | null> {
    return null;
  }
}
