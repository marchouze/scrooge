# Principle 1 — Events are the only source of truth

The event log is the single durable artefact of the bank. Nothing else is authoritative.

- Balances, positions, exposures, P&L, capital, liquidity ratios, regulatory-return cells, accounting trial balances — all are **queries** over the event log, computed at a point in time. None is stored as authoritative state.
- Stored projections exist only as caches. They must be reproducible from the event log at any moment, and the events outrank them in every reconciliation.
- "As-of" replay is a first-class capability. Any quantity must be reproducible at any past point in time.
- Off-the-shelf systems that maintain authoritative aggregate state (typical core-banking products that own balance tables) are incompatible with this architecture and may not be adopted as the system of record.
- "Real-time" is the default. Periodic batch is a presentation choice, not a processing model.
