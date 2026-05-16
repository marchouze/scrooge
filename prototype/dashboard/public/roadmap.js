// roadmap.js — Project Plan page.
//
// Pulls /api/state for live counts (decisions, workstreams, procedures,
// obligations, policies). Workstream structure and milestone items are
// hardcoded from the canonical roadmap (Owner Inbox/2026-05-10_scrooge_
// project-status-roadmap.md) — stable architectural content.
//
// Author: Atlas (Core banking platform architect) — roadmap page scaffold.

(() => {
  // ── Workstream catalogue ────────────────────────────────────────────────
  // Each workstream has: id, label, owner, blockers[], done[], inflight[], todo[]
  // Items: { text, ref? }

  const WORKSTREAMS = [
    {
      id: "A",
      anchor: "ws-a",
      label: "Substrate",
      sublabel: "Engineering platform",
      owner: "Atlas (Core banking platform architect) · Devon (COO)",
      blockers: ["S6", "S7", "S8"],
      done: [
        {
          text: "Walking-skeleton platform: event store, projection runtime, identity authenticator, IaC seam, recon harnesses",
          ref: "prototype/platform/recon/*",
        },
        {
          text: "Bank UI v0 + intranet shell + dashboard with obligations page",
          ref: "PRs #52 #48 #81",
        },
        {
          text: "CI gate live: typecheck, lint, tests, citation-gate, nine recon harnesses; branch protection on main",
          ref: "package.json ci",
        },
        {
          text: "Markets schema foundation — FX Spot/Forward/Swap/NDF typed shapes + bookType discriminator",
          ref: "D-MARKETS-SCHEMA-FOUNDATION PR #49",
        },
        {
          text: "Correspondent routing-policy projection + switch-test event family",
          ref: "D-FX-CORRESPONDENT-PAIR-NAMING PR #64",
        },
        { text: "Legal-entity events + IFRS 10 consolidation substrate v0", ref: "PRs #90 #92" },
        {
          text: "RMS Phase 1 — seven typed events + content-addressed doc store + seven projection registers",
          ref: "D-RMS-PHASE-1",
        },
        {
          text: "Provenance substrate Slices 1–3 + intranet scaffold + provenance badges",
          ref: "D-DATA-PROVENANCE-SUBSTRATE",
        },
        {
          text: "Agent-runtime S8 Tier 1 — 27 personas registered, AgentRunner lifecycle wrapper, worker-isolation primitive",
          ref: "PRs #185–#188",
        },
        {
          text: "Party register substrate — unified identity axis (natural-person, legal-entity, counterparty, agent)",
          ref: "D-PARTY-REGISTER PRs 1–3",
        },
        {
          text: "Regulatory knowledge graph — 664 nodes, 373+ edges, GOVERNS fuzzy resolver, JSON Schema ontology",
          ref: "PRs #424–#427",
        },
        {
          text: "Canonical risk taxonomy — 94 codes, typed enum, register, RAS/obligations/policy frontmatter backfilled",
          ref: "PR #256",
        },
        {
          text: "Vera circular-dependency gate — 36 circular deps resolved, madge-circular-deps CI gate live",
          ref: "PR #406",
        },
        { text: "Semantic-layer registry recon gate (M2 Slice 1)", ref: "PR #436" },
        {
          text: "Event-type registry — 143 missing types added, registry warns → 0",
          ref: "PR #434",
        },
        { text: "PermissionPolicies for 41 agent actors (T-01)", ref: "PR #433" },
      ],
      inflight: [
        { text: "RMS Phase 2 — dual-render (registers co-exist with Owner Inbox / Team Inbox)" },
        {
          text: "Product-construction substrate gap closure — six items (pricing-model registration, RWA-delta engine, trade-confirmation generators)",
          ref: "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
        },
        {
          text: "Event-store scaling design build — sequencing pending",
          ref: "D-EVENT-STORE-SCALING",
        },
        {
          text: "Reporting-capability M2–M3 build (Atlas + Anya + Bea)",
          ref: "WS-REPORTING-M2-M3",
        },
        { text: "T-12 sub-agent PermissionPolicy substrate + F-032 Zod schemas" },
      ],
      todo: [
        {
          text: "Approve agent-runtime substrate (S8) → unblocks autonomous personas (Principle 6)",
          ref: "S8",
        },
        { text: "Approve substrate-completeness budget (S7)", ref: "S7 WS-SUBSTRATE-BUDGET" },
        { text: "RMS Phase 3 → Phase 4 (cutover → archive legacy inboxes)" },
        {
          text: "M2 → M8 markers — reporting build, projection runtime hardening, agent-runtime ingest (M8 auto-commit ingest)",
        },
        { text: "Azure migration — single-coherent-phase per Principle 3; seams already in place" },
      ],
    },
    {
      id: "B",
      anchor: "ws-b",
      label: "Governance",
      sublabel: "Seats, hires, frameworks",
      owner: "Owen (Company Secretary) · Devon (COO) · Nolan (Recruiter)",
      blockers: ["D-HIRE-SIX-SEATS-PACK", "S3"],
      done: [
        {
          text: "11 CEO direct reports filled — Scrooge, Helena (CRO), Devon (COO), Camille (CFO), Eitan, Saskia, Owen, Zara (CCO), Iris (IO), Thandiwe (CAE), Rashida (CISO)",
        },
        {
          text: "Compensation framework approved — six-seat thin-human-layer comp envelope",
          ref: "D-COMP-FRAMEWORK-SIX-SEATS PR #134",
        },
        {
          text: "Thin-human-layer composition fixed at six humans",
          ref: "D-THIN-HUMAN-LAYER-MINIMUM PR #47",
        },
        {
          text: "Legal-entity tree v0 — Group + Bank + Securities, shared board across three entities",
          ref: "D-LEGAL-ENTITY-TREE-V0 PRs #82 #93",
        },
        {
          text: "Regulatory perimeter set — Bank to PA, Securities to JSE, Group not separately regulated",
          ref: "D-REGULATORY-PERIMETER PR #85",
        },
        {
          text: "Principles consolidated — six principles, P2 single-graph discipline + P6 autonomous-by-default",
          ref: "D-PRINCIPLES-P2-P6-MERGE",
        },
        {
          text: "27 personas registered as standing autonomous agents; 17-section operating-spec template adopted",
        },
        {
          text: "Six thin-human-layer role briefs drafted by PAX (Independent Chair, NED #2 #3, Human CRO, Compliance Lead, Company Secretary)",
          ref: "D-HIRE-SIX-SEATS-PACK",
        },
        {
          text: "Vera advisory recon pipeline online — mandate coverage, prose duplication, canonical source, policy-obligation trace",
        },
        {
          text: "All 16 STUB procedures → POPULATED; 35 further procedures drafted across Batches G–K",
          ref: "PRs #407–#426",
        },
      ],
      inflight: [
        {
          text: "Persona agent-spec upgrades — sections 6–17 backfill on legacy character-sheet personas",
        },
        { text: "Internal Audit Charter + first audit plan (Thandiwe)", ref: "WS-IA-CHARTER" },
        {
          text: "RAS recalibration for AI-driven bank — substrate / coherence / supply-chain risks (Helena)",
          ref: "WS-RAS-RECALIBRATION",
        },
        { text: "~30 PLANNED procedures still to be drafted across all domains" },
      ],
      todo: [
        {
          text: "CEO decision on D-HIRE-SIX-SEATS-PACK — approve batched six-role hire pack; unblocks 18 months of recruitment lead time",
          ref: "D-HIRE-SIX-SEATS-PACK",
        },
        { text: "Open governance seats — GC then CHRO per hire-order (A2-approved)" },
        {
          text: "Board AC constitution — replaces Interim Audit Forum once independent-NED hires land",
        },
        {
          text: "S3 decision — thin-human-layer composition and timing for licence-day (Owen)",
          ref: "S3",
        },
        {
          text: "Vera Wave-4 #10 — agent-spec-integrity recon pipeline (asserts sections 6–17 on all persona files)",
        },
      ],
    },
    {
      id: "C",
      anchor: "ws-c",
      label: "Regulatory chain",
      sublabel: "Obligations, policies, procedures, instruments",
      owner:
        "Mira (Compliance / RegTech engineer) · Zara (CCO) · Iris (IO) · Imani (Legal-as-code)",
      blockers: ["D-NEW-PRODUCT-APPROVAL-POLICY", "S5"],
      done: [
        {
          text: "Obligations register v1.12 — ~224 obligations across 16 domains, ~68 instruments; entity-scope + applies-at vocabulary",
          ref: "Regulations/_obligations-register.md",
        },
        {
          text: "FAIS Posture A confirmed — bank entity does not need its own FSP licence; securities entity holds FSP path",
          ref: "D-FSP-LICENCE-NECESSITY PRs #66 #68 #70",
        },
        { text: "FIC cycle + FSP path + TCF substrate v0", ref: "PR #44" },
        {
          text: "Naming pre-clearance procedure — TM + Banks Act + CIPC + 11-language; CIPC three-reservation update for all entities",
          ref: "PROC-CORP-NPC-01 PRs #74 #83",
        },
        {
          text: "42+ procedures populated (up from 9 at 2026-05-06 — five-fold increase across Batches A–K)",
        },
        { text: "Records Management Policy + retention citation coverage", ref: "v1.12" },
        { text: "Per-entity POPIA s.55–56 IO designation scoping + procedure", ref: "PR #91" },
        {
          text: "FAIS Act full analysis + GCC analysis; fsca-reg-to-policy recon pipeline live",
          ref: "PRs 2026-05-12",
        },
        {
          text: "Ten governance policies drafted and registered (top-10 Owen priority batch)",
          ref: "PRs #255–#265",
        },
        {
          text: "Bind-status taxonomy — CORPORATE-BIND / LICENCE-BIND / COMMENCEMENT-BIND / CONDITIONAL-BIND vocabulary live",
        },
        {
          text: "DCAM taxonomy complete — EDM Council three-layer architecture, 7 new product codes, party LEI field",
          ref: "PR #432",
        },
      ],
      inflight: [
        { text: "~60 instrument analyses (Mira)", ref: "WS-INSTRUMENT-ANALYSES" },
        {
          text: "~30 procedures still PLANNED → target POPULATED, prioritised by markets-bank profile",
          ref: "WS-PROCEDURES-DRAFTING",
        },
        {
          text: "POPIA IO designation finalisation — Marc interim, real human at licence-day (Iris)",
          ref: "WS-E1-IO-OPTIONS",
        },
      ],
      todo: [
        {
          text: "CEO decide D-NEW-PRODUCT-APPROVAL-POLICY — required gate before products approach commencement-of-trading",
          ref: "D-NEW-PRODUCT-APPROVAL-POLICY",
        },
        {
          text: "Complete instrument analyses — drive ~60 → 0; each unlocks obligations register rows",
        },
        {
          text: "Drive procedures backlog — ~103 populated → ~80 identified total, prioritised by profile",
        },
        {
          text: "Obligation-source tagging — every policy carries Source column (Regulation OR Bank Objective)",
        },
        {
          text: "SARB licence application package — assembled when pre-licence readiness gate lights green; needs S5 external counsel",
          ref: "S5",
        },
      ],
    },
    {
      id: "D",
      anchor: "ws-d",
      label: "Markets franchise",
      sublabel: "Saskia's domain — products, RAS, trading mandate, NPA",
      owner:
        "Saskia (Head of Global Markets) · Helena (CRO) · Kai (technology) · Tomas (settlement) · Eitan (funding)",
      blockers: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
      done: [
        {
          text: "Strategic foundation — institutional global-markets dealer in JSE bonds + JSE equities + OTC IRD; institutional-only; SA single-branch; ~R300m capital target",
          ref: "D-STRATEGIC-FOUNDATION 2026-05-06",
        },
        {
          text: "FX foundation slice — Spot/Forward/Swap/NDF typed shapes + bookType discriminator",
          ref: "D-MARKETS-SCHEMA-FOUNDATION PR #49",
        },
        {
          text: "Named correspondent pair + switch-test cadence + outsourcing procedures",
          ref: "D-M4-FX-SUB-DECISIONS PR #58",
        },
        {
          text: "Correspondent routing-policy projection",
          ref: "D-FX-CORRESPONDENT-PAIR-NAMING PR #64",
        },
        { text: "B-cluster FX-settlement-concentration appetite lines (Helena)", ref: "PR #60" },
        {
          text: "FAIS-KI handover gate-(a) closed + counterparty institutional-eligibility screening v0",
          ref: "PRs #66 #77",
        },
        {
          text: "Product-construction substrate approved",
          ref: "D-PRODUCT-CONSTRUCTION-SUBSTRATE PR #115 series",
        },
        { text: "FinSurv URN cluster wave-1 — current-account + capital-account", ref: "PR #56" },
        {
          text: "Validation methodology — slice A tier definitions locked",
          ref: "D-S7-TARGETED-3-5 PR #50",
        },
        {
          text: "First SARB return (BA-700 capital) — dry-run scenarios A + B + D",
          ref: "S8 Tier 1",
        },
      ],
      inflight: [
        { text: "Markets franchise design proposal (Saskia)", ref: "WS-MARKETS-FRANCHISE" },
        { text: "D-MARKETS-SCHEMA-FOUNDATION ongoing build — handler-callables sync" },
        { text: "Product-construction substrate slices 4+ (Atlas + Kai + Saskia)" },
        { text: "ALM readiness (Ravi, autonomous run)", ref: "2026-05-09" },
        { text: "Daily accounting readiness (Bea) + Liquidity snapshot (Eitan)" },
      ],
      todo: [
        {
          text: "CEO decide NPA Policy v1.0 — gates first product through approval (cross-ref Workstream C)",
          ref: "D-NEW-PRODUCT-APPROVAL-POLICY",
        },
        { text: "NPA gate fires as products approach commencement-of-trading" },
        {
          text: "JSE Listings Requirements scoping (ORG-MK-10) — fires only on first listing event",
        },
        {
          text: "Pre-licence go-live readiness gate — co-owned Saskia + Rashida + Devon; defines build-phase endpoint",
        },
        {
          text: "Licence-day commencement — real capital, real customers, minimum human layer per Banks Act",
        },
      ],
    },
  ];

  // ── Helpers ─────────────────────────────────────────────────────────────

  function setMetric(id, text, tone) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text ?? "–";
    if (tone) el.setAttribute("data-tone", tone);
  }

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function itemsHtml(items, iconClass, iconChar) {
    if (!items.length)
      return `<li class="rm-items" style="padding:6px 0;font-size:12.5px;color:var(--neutral-stone)">None recorded.</li>`;
    return items
      .map(
        (it) =>
          `<li>
            <span class="rm-item-icon ${iconClass}">${iconChar}</span>
            <span class="rm-item-text">${esc(it.text)}</span>
            ${it.ref ? `<span class="rm-item-ref">${esc(it.ref)}</span>` : ""}
          </li>`,
      )
      .join("");
  }

  // ── Render workstreams ───────────────────────────────────────────────────

  function renderWorkstreams(resolvedIds = new Set()) {
    const container = document.getElementById("rm-workstreams");
    if (!container) return;

    container.innerHTML = WORKSTREAMS.map((ws) => {
      const openBlockers = ws.blockers.filter((b) => !resolvedIds.has(b));
      const blockerChips = openBlockers
        .map((b) => `<span class="rm-blocker-chip">${esc(b)}</span>`)
        .join(" ");

      return `
        <div class="rm-workstream" id="${esc(ws.anchor)}">
          <div class="rm-ws-head">
            <span class="rm-ws-id">${esc(ws.id)}</span>
            <div>
              <div class="rm-ws-name">${esc(ws.label)}</div>
              <div style="font-size:11.5px;color:var(--text-secondary);margin-top:2px">${esc(ws.sublabel)}</div>
            </div>
            <div class="rm-ws-owner">${esc(ws.owner)}</div>
          </div>
          <div class="rm-ws-body">
            <details class="rm-panel" open>
              <summary>
                <span class="rm-panel-badge done">✓ Done</span>
                Past milestones
                <span class="rm-panel-count">${ws.done.length} items</span>
              </summary>
              <div class="rm-panel-body">
                <ul class="rm-items">${itemsHtml(ws.done, "icon-done", "✓")}</ul>
              </div>
            </details>
            <details class="rm-panel" open>
              <summary>
                <span class="rm-panel-badge inflight">⟳ In flight</span>
                Active work
                <span class="rm-panel-count">${ws.inflight.length} items</span>
              </summary>
              <div class="rm-panel-body">
                <ul class="rm-items">${itemsHtml(ws.inflight, "icon-inflight", "⟳")}</ul>
              </div>
            </details>
            <details class="rm-panel">
              <summary>
                <span class="rm-panel-badge todo">→ To do</span>
                Forward queue (sequenced)
                <span class="rm-panel-count">${ws.todo.length} items</span>
              </summary>
              <div class="rm-panel-body">
                <ul class="rm-items">${itemsHtml(ws.todo, "icon-todo", "→")}</ul>
              </div>
            </details>
            ${
              openBlockers.length
                ? `<div class="rm-blockers">
                    <span class="rm-blocker-label">Open blockers</span>
                    ${blockerChips}
                  </div>`
                : ""
            }
          </div>
        </div>
      `;
    }).join("");
  }

  // ── Render CEO queue ─────────────────────────────────────────────────────

  function renderCeoQueue(decisionsOpen) {
    const tbody = document.getElementById("rm-queue-body");
    if (!tbody) return;
    const items = Array.isArray(decisionsOpen) ? decisionsOpen : [];
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="rm-empty">No open decisions found.</td></tr>`;
      return;
    }
    tbody.innerHTML = items
      .map(
        (d) => `<tr>
          <td><code>${esc(d.id)}</code></td>
          <td>${esc(d.title)}</td>
          <td>${esc(d.owner ?? "–")}</td>
          <td>${esc(d.category ?? "–")}</td>
        </tr>`,
      )
      .join("");
  }

  // ── Main fetch + render ──────────────────────────────────────────────────

  async function refreshAll() {
    let state = null;
    try {
      const res = await fetch("/api/state");
      if (res.ok) state = await res.json();
    } catch {
      // fall through — render with nulls
    }

    const inFlight = state?.inFlight ?? [];
    const decisionsOpen = state?.decisionsOpen ?? [];
    const decisionsResolved = state?.decisionsResolvedSeed ?? state?.decisionsResolved ?? [];

    // Stat cards
    setMetric(
      "rm-resolved",
      decisionsResolved.length || "–",
      decisionsResolved.length ? "green" : "muted",
    );
    setMetric("rm-open", decisionsOpen.length || "–", decisionsOpen.length > 0 ? "amber" : "muted");
    setMetric("rm-inflight", inFlight.filter((w) => w.active !== false).length || "–", "muted");

    // These come from state fields that may vary; use counts if available
    const procedureCount = state?.procedures?.populated ?? state?.proceduresPopulated ?? null;
    const obligationsCount = state?.obligations?.total ?? state?.obligationsTotal ?? null;
    const policiesCount = state?.policies?.total ?? state?.policiesTotal ?? null;

    setMetric("rm-procedures", procedureCount != null ? String(procedureCount) : "103+", "muted");
    setMetric(
      "rm-obligations",
      obligationsCount != null ? String(obligationsCount) : "224+",
      "muted",
    );
    setMetric("rm-policies", policiesCount != null ? String(policiesCount) : "112+", "muted");

    const resolvedIds = new Set(decisionsResolved.map((r) => r.id ?? r));
    renderWorkstreams(resolvedIds);

    // CEO queue
    renderCeoQueue(decisionsOpen);

    // Update as-of timestamp
    const asOf = document.querySelector("[data-shell-asof]");
    if (asOf) {
      const now = `${new Date().toISOString().slice(0, 16).replace("T", " ")}Z`;
      asOf.textContent = `as of ${now}`;
    }
  }

  // Run on load + wire refresh button
  refreshAll();
  document.addEventListener("shell:refresh", refreshAll);
})();
