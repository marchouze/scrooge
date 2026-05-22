# Non-Trade Trigger Event Pattern

## Purpose

Accounting entries are consequences of trigger events from any domain — not
only trade events. This document specifies the pattern for introducing a
non-trade trigger event so the accounting domain can subscribe to it and emit
`SubLedgerPostingEmitted` in response.

## When to use this pattern

Use this pattern when an accounting entry arises from a domain event that is
**not** part of a trade lifecycle. Examples:

- **Risk domain:** `ProvisionCalculated` → ECL provision posting
- **Product-control domain:** `BookPnlAttributed` → book-level P&L posting
- **Period-close domain:** `AccountingPeriodOpened` → reversal of prior-period accruals

## Steps to add a new non-trade trigger

### 1. Define the event type in its domain module

```ts
// platform/event-store/event-types/<domain>.ts
export const myEventPayloadSchema = z.object({ ... });
export type MyEventPayload = z.infer<typeof myEventPayloadSchema>;
export function makeMyEvent(args: { ... }): Event { ... }
```

Register the event type in the domain's `*_EVENT_TYPES` array.

### 2. Register in the posting-rule registry

```ts
// platform/accounting/posting-rule-registry.ts — add to POSTING_RULE_REGISTRY:
{
  triggerEventType: "MyEvent",
  triggerDomain: "risk",          // or "product-control", "period-close"
  lifecycleId: "n/a",            // non-lifecycle events use "n/a"
  lifecycleStage: "in-flight",
  postingRuleId: "PR-MY-001",
  postingType: "my-posting-type", // must also be added to SubLedgerPostingEmitted postingType enum
  condition: "always",            // or "non-zero-delta" / "non-zero-pnl"
  conditionDetail: "IFRS citation or plain reason",
}
```

Update the stub entry (if one exists) to remove `condition: "intentional-no-impact"`.

### 3. Add the `postingType` to the SubLedgerPostingEmitted schema

```ts
// platform/event-store/event-types/fx-accounting.ts — subLedgerPostingEmittedPayloadSchema:
postingType: z.enum([
  ...,
  "my-posting-type",   // ← add here
]),
```

### 4. Write the pure posting-rule function

```ts
// platform/accounting/posting-rules/<domain>.ts
export function myEventJournals(event: MyEventPayload): SubLedgerLeg[] {
  // return balanced debit/credit legs
}
```

### 5. Wire into the GL posting engine

```ts
// platform/accounting/gl-posting-engine.ts — NON_TRADE_HANDLERS:
const NON_TRADE_HANDLERS: Partial<Record<string, NonTradeHandler>> = {
  "MyEvent": (event) => myEventJournals(event.payload as MyEventPayload),
};
```

Also add `"MyEvent"` to `HANDLED_EVENT_TYPES`.

### 6. Emit the trigger event from the owning domain agent

The domain agent (e.g. the risk model, the product-control engine) is
responsible for emitting the trigger event. The **accounting agent** (Bea)
subscribes — it never emits the trigger.

## Invariants

- The accounting agent is the **only** agent that emits `SubLedgerPostingEmitted`.
- Every `SubLedgerPostingEmitted` must carry a `sourceEventId` pointing to the
  trigger event that caused it.
- Every trigger event must be registered in `POSTING_RULE_REGISTRY` before it
  is wired into the engine.
- The `recon:gl-ledger-coverage` pipeline asserts coverage against the registry.
