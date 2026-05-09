# Principle 3 — Cloud-native; nothing manual or physical except where essential

The bank operates in the cloud and conducts every process digitally. Manual or physical steps are exceptions that must be justified.

- **Infrastructure** is cloud-native and code-defined. Servers, networks, databases, key stores, observability — all provisioned, configured, and changed via IaC. No hand-managed boxes. No persistent operator credentials.
- **Workflows** are coded. Approvals, escalations, exception handling, and case management run as event-driven processes with full audit trails. A human in a workflow is a typed actor, not a step that happens "outside the system".
- **Customer interaction** is digital by default — onboarding, contracting, signing, statements, support. Physical channels exist only where law or counterparty contract requires.
- **Documents** are structured data first; PDFs are renderings, not records. Wet signatures are reserved for the narrow set of cases excluded by ECTA Schedule 1 (wills, alienation of land, certain bills of exchange, long-term leases where statute requires writing) and for counterparties who legitimately cannot transact electronically.
- **Cash, physical securities, and physical correspondence** are out of scope for the bank's default operating model. Where a regulator, counterparty, or product genuinely requires them, they enter the system as digitised events at the earliest possible point and are flagged as exceptions.
- **Cryptographic key material** lives in managed cloud HSMs that meet FIPS 140-2/3 Level 3. Private keys never leave the HSM.
- **Data residency and offshoring** are designed in line with SARB Prudential Authority Directive 3 of 2018 on cloud computing and offshoring of data, and with POPIA cross-border transfer requirements.
- "Where essential" is a judgment that costs something. Each exception is registered, justified by citation under Principle 2, and reviewed periodically.

## Implementation sequence: full local build first, then migrate to cloud as a single coherent phase

- The bank's *target state* is cloud-native (Azure). The *implementation sequence* is to build the complete bank capability locally end-to-end first, then migrate to Azure as a single coherent phase — not split capability development across local and cloud halves.
- "Local" here is not a demo or skeleton: every system capability the procedures reference, every report the reporting-capability spec lists, every regulator-submission generator, every reconciliation harness must run end-to-end locally before migration. Local is substantively production-grade in its logic.
- Substrate-replacement seams (event store, identity, HSM, observability, dashboard distribution) are designed in from day one behind clean TypeScript interfaces; the cloud lift swaps the substrates without rewriting capability.
- Rationale: reduces cloud spend during foundational work, prevents premature commitment to Azure-substrate primitives we don't yet know we need, keeps the build close to the team during architectural iteration.
