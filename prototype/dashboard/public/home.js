// home.js — bank UI v0 launcher.
//
// Tile data integration: queries existing endpoints (`/api/state`,
// `/api/obligations`, `/api/substrate-gaps`, `/api/fleet`,
// `/api/escalations`) and renders one tile per launcher entry.
//
// No new endpoints. The tile data is a query over canonical sources
// (Principle 1) — counts shown are not stored, they are computed at
// fetch time on the server and rendered here.
//
// Author: Anya (Data / analytics engineer) — under CEO directive
// 2026-05-09.

(() => {
  // ---------------- Tile catalogue ---------------------------
  // Each entry: { id, category, title, blurb, href, count?, tone? }
  // count + tone are filled in dynamically once the relevant fetch
  // resolves. `placeholder: true` flags M-phase / not-yet-wired tiles.

  const CATALOGUE = [
    // -------- Dashboards (live) --------
    {
      id: "obligations",
      category: "dashboards",
      title: "Obligations",
      blurb:
        "Mira's register — every obligation linked to a citation, fulfilment policy, and owner.",
      href: "/policies.html#obligations",
    },
    {
      id: "policies",
      category: "dashboards",
      title: "Policies",
      blurb: "Owen's register — what the bank has committed to, mapped upward to regulation.",
      href: "/policies.html",
    },
    {
      id: "activity",
      category: "dashboards",
      title: "Activity",
      blurb: "Recent events from the log — appended workstreams, decisions, audit findings.",
      href: "/activity.html",
    },
    {
      id: "agents",
      category: "dashboards",
      title: "Agents",
      blurb: "Standing-agent fleet — each persona's last run, next tick, and outputs.",
      href: "/agents.html",
    },
    {
      id: "escalations",
      category: "dashboards",
      title: "Escalations",
      blurb: "Open escalations from agents to the CEO — typed channel, deadline-aware.",
      href: "/escalations",
    },
    {
      id: "fleet",
      category: "dashboards",
      title: "Fleet",
      blurb: "Aggregate agent status across the roster — green / amber / red.",
      href: "/fleet",
    },
    {
      id: "health",
      category: "dashboards",
      title: "Health",
      blurb: "Recon-pipeline conclusions, last derivation tick, build status.",
      href: "/health.html",
    },

    // -------- Reports (as-of-date) --------
    {
      id: "owner-inbox",
      category: "reports",
      title: "Owner Inbox",
      blurb:
        "Every deliverable for the CEO — board-pack drafts, decision briefs, agent run reports.",
      href: "/api/state",
    },
    {
      id: "ba-returns",
      category: "reports",
      title: "BA returns",
      blurb:
        "SARB Prudential Authority returns — generated from the event log on submission cadence.",
      href: "#",
      placeholder: true,
      flag: "v1 substrate",
    },
    {
      id: "board-packs",
      category: "reports",
      title: "Board packs",
      blurb: "Board and committee materials — derive downward from policies and projections.",
      href: "#",
      placeholder: true,
      flag: "Board-portal substrate",
    },
    {
      id: "fin-statements",
      category: "reports",
      title: "Financial statements",
      blurb: "IFRS-aligned statements — Bea's projections over the accounting events.",
      href: "#",
      placeholder: true,
      flag: "Camille / Bea pipeline",
    },
    {
      id: "audit-reports",
      category: "reports",
      title: "Audit reports",
      blurb: "Internal-audit findings register and external-audit deliverables.",
      href: "#",
      placeholder: true,
      flag: "Thandiwe / Vera",
    },

    // -------- Decisions --------
    {
      id: "decisions-ceo",
      category: "decisions",
      title: "CEO decisions",
      blurb: "Open decisions for the CEO. Approve, defer, modify, request revision.",
      href: "/index.html#decisionsOpen",
    },
    {
      id: "decisions-board",
      category: "decisions",
      title: "Board decisions",
      blurb: "Decisions reserved for the Board / Interim Audit Forum (Companies Act 71 of 2008).",
      href: "#",
      placeholder: true,
      flag: "Board-portal substrate",
    },

    // -------- Registers (canonical) --------
    {
      id: "reg-obligations",
      category: "registers",
      title: "Obligations register",
      blurb: "Mira (Compliance / RegTech engineer) — typed citations to regulator instruments.",
      href: "/obligations.html",
    },
    {
      id: "reg-policies",
      category: "registers",
      title: "Policy register",
      blurb: "Owen (Company Secretary, governance) — approved policies + version history.",
      href: "/policies.html",
    },
    {
      id: "reg-procedures",
      category: "registers",
      title: "Procedures index",
      blurb: "Owen + domain leads — every procedure ties to a policy and a system capability.",
      href: "/procedures.html",
    },
    {
      id: "reg-agents",
      category: "registers",
      title: "Agent registry",
      blurb: "Sade (AgentOps) + Scrooge — every standing agent's operating spec.",
      href: "/agents.html",
    },
    {
      id: "reg-regs",
      category: "registers",
      title: "Regulations index",
      blurb: "Inventory of regulator instruments curated by Mira.",
      href: "#",
      placeholder: true,
      flag: "Index UI v1",
    },

    // -------- Substrate ops --------
    {
      id: "sub-arch",
      category: "substrate",
      title: "Architecture",
      blurb: "Atlas (Core banking platform architect) — four-diagram view of the stack.",
      href: "/architecture.html",
    },
    {
      id: "sub-fleet",
      category: "substrate",
      title: "Fleet",
      blurb: "Same view as Dashboards · Fleet — repeated here for ops-pivot convenience.",
      href: "/fleet",
    },
    {
      id: "sub-health",
      category: "substrate",
      title: "Health",
      blurb: "Recon pipelines, derivation tick, build conclusions.",
      href: "/health.html",
    },
    {
      id: "sub-agents",
      category: "substrate",
      title: "Agents",
      blurb: "Standing agents — last run, next tick.",
      href: "/agents.html",
    },
    {
      id: "sub-escalations",
      category: "substrate",
      title: "Escalations",
      blurb: "Open escalations awaiting CEO action.",
      href: "/escalations",
    },
    {
      id: "sub-gaps",
      category: "substrate",
      title: "Substrate gaps",
      blurb: "Atlas's substrate-gap inventory — what the runtime cannot yet do.",
      href: "/health.html#substrate-gaps",
    },

    // -------- Markets (M-phase) --------
    {
      id: "mkts-fx-desk",
      category: "markets",
      title: "FX desk",
      blurb:
        "Sales / trading rehearsal surface — counterparty picker (eligibility-passing only). Slice 1 of D-FX-SALES-TRADING-FRONTEND.",
      href: "/markets/fx/desk.html",
    },
    {
      id: "mkts-desks",
      category: "markets",
      title: "Trading desks (other)",
      blurb: "Equities / bonds / IRS — OMS / EMS surfaces, FIX connectivity, exchange routing.",
      href: "#",
      placeholder: true,
      flag: "M2 — Kai",
    },
    {
      id: "mkts-portfolios",
      category: "markets",
      title: "Portfolios",
      blurb: "Position projections per desk, per book, per legal entity.",
      href: "#",
      placeholder: true,
      flag: "M-phase — Anya / Kai",
    },
    {
      id: "mkts-exposures",
      category: "markets",
      title: "Exposures",
      blurb: "Counterparty, sector, and currency exposures rolled up to risk appetite.",
      href: "#",
      placeholder: true,
      flag: "M-phase — Rohan",
    },
    {
      id: "mkts-risk-pos",
      category: "markets",
      title: "Risk positions",
      blurb: "Market, credit, liquidity risk under Helena's appetite framework.",
      href: "#",
      placeholder: true,
      flag: "M-phase — Rohan / Nadia",
    },

    // -------- Compliance --------
    {
      id: "cmp-fic",
      category: "compliance",
      title: "FIC submissions",
      blurb: "FIC Act 38 of 2001 cycle — STRs, CTRs, regulator portal status.",
      href: "#",
      placeholder: true,
      flag: "Mira / Zara procedure",
    },
    {
      id: "cmp-sanctions",
      category: "compliance",
      title: "Sanctions",
      blurb: "Sanctions / PEP screening pipeline outputs and exceptions.",
      href: "#",
      placeholder: true,
      flag: "Mira procedure",
    },
    {
      id: "cmp-kyc",
      category: "compliance",
      title: "KYC / onboarding",
      blurb: "Customer-onboarding workflow, FAIS-compliant advice records.",
      href: "#",
      placeholder: true,
      flag: "Niko activates at licence-day",
    },
    {
      id: "cmp-conduct",
      category: "compliance",
      title: "Conduct surveillance",
      blurb: "Trading-conduct surveillance feed — Saskia's market-making reviewed by Zara.",
      href: "#",
      placeholder: true,
      flag: "M-phase — Kai / Saskia",
    },
  ];

  // ---------------- Helpers ----------------------------------

  function $(sel) {
    return document.querySelectorAll(sel);
  }

  function renderTiles(catalogue, counts) {
    for (const container of $("[data-shell-tiles]")) {
      const cat = container.getAttribute("data-shell-tiles");
      const items = catalogue.filter(
        (t) => t.category === cat && (window.bankShell ? window.bankShell.canSee(t.id) : true),
      );
      container.innerHTML = items
        .map((tile) => {
          const c = counts[tile.id];
          const placeholderClass = tile.placeholder ? " is-placeholder" : "";
          const tag = tile.placeholder ? "div" : "a";
          const navAttr = tile.placeholder ? "" : ` data-shell-nav="tile:${tile.id}"`;
          const hrefAttr = tile.placeholder ? "" : ` href="${tile.href}"`;
          const roleAttr = tile.placeholder ? ' role="group" tabindex="0"' : "";
          const countBlock = c
            ? `<div class="shell-tile-count" data-tone="${c.tone || "default"}" aria-label="${c.aria || c.text}">${c.text}</div>`
            : "";
          const flagBlock = tile.flag ? `<div class="shell-tile-flag">${tile.flag}</div>` : "";
          const metaBlock = c?.meta?.length
            ? `<div class="shell-tile-meta">${c.meta
                .map(
                  (m) =>
                    `<span class="shell-tile-meta-item"><span class="shell-tile-meta-dot" data-tone="${m.tone || "default"}"></span>${m.label}</span>`,
                )
                .join("")}</div>`
            : "";
          return `<${tag} class="shell-tile${placeholderClass}"${hrefAttr}${navAttr}${roleAttr}><div class="shell-tile-head"><h3 class="shell-tile-title">${tile.title}</h3>${countBlock}</div><p class="shell-tile-blurb">${tile.blurb}</p>${metaBlock}${flagBlock}</${tag}>`;
        })
        .join("");
    }
  }

  function safeNum(n) {
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  }

  function deriveCounts(state, obligations, substrateGaps, fleet, escalations) {
    const counts = {};

    if (state) {
      const decisionsOpen = state.decisionsOpen?.length || 0;
      counts["decisions-ceo"] = {
        text: String(decisionsOpen),
        tone: decisionsOpen > 0 ? "warn" : "muted",
        aria: `${decisionsOpen} open CEO decisions`,
        meta: [
          {
            label: `${state.decisionsResolved ? state.decisionsResolved.length : 0} resolved`,
            tone: "muted",
          },
        ],
      };
      const inboxLen = state.ownerInboxFeed?.length || 0;
      counts["owner-inbox"] = {
        text: String(inboxLen),
        tone: "default",
        aria: `${inboxLen} inbox items`,
      };

      const m = state.bank?.metrics ? state.bank.metrics : null;
      if (m) {
        counts.policies = {
          text: String(safeNum(m.policies)),
          tone: "default",
          aria: `${m.policies} policies in register`,
        };
        counts["reg-policies"] = counts.policies;
        counts["reg-agents"] = {
          text: String(safeNum(m.directReports)),
          tone: "default",
          aria: `${m.directReports} agents reporting`,
        };
        counts.agents = counts["reg-agents"];
        counts["sub-agents"] = counts["reg-agents"];
      }
    }

    if (obligations) {
      const total = safeNum(obligations.count);
      // Curation-gap signal — empty Source / UNCLASSIFIED bind. Pulled
      // from PR #48's surfaced gaps.
      let emptySource = 0;
      let unclassifiedBind = 0;
      const byId = obligations.byId || {};
      for (const k in byId) {
        if (Object.prototype.hasOwnProperty.call(byId, k)) {
          const o = byId[k];
          if (!o.source) emptySource++;
          if (!o.bind || o.bind === "UNCLASSIFIED-bind") unclassifiedBind++;
        }
      }
      const tone = emptySource > 0 || unclassifiedBind > 0 ? "warn" : "success";
      counts.obligations = {
        text: String(total),
        tone: tone,
        aria: `${total} obligations; ${emptySource} empty Source; ${unclassifiedBind} UNCLASSIFIED-bind`,
        meta: [
          { label: `${emptySource} empty Source`, tone: emptySource > 0 ? "warn" : "muted" },
          {
            label: `${unclassifiedBind} UNCLASSIFIED-bind`,
            tone: unclassifiedBind > 0 ? "warn" : "muted",
          },
        ],
      };
      counts["reg-obligations"] = counts.obligations;
    }

    if (substrateGaps) {
      const n = substrateGaps.gaps?.length || 0;
      counts["sub-gaps"] = {
        text: String(n),
        tone: n > 0 ? "warn" : "muted",
        aria: `${n} substrate gaps tracked`,
      };
    }

    if (fleet?.fleet) {
      // fleet shape: { fleet: [{ status, ... }, ...] }
      const list = Array.isArray(fleet.fleet) ? fleet.fleet : [];
      const total = list.length;
      let amber = 0;
      let red = 0;
      for (const a of list) {
        const s = (a.status || "").toLowerCase();
        if (s === "amber" || s === "warn") amber++;
        else if (s === "red" || s === "blocking" || s === "blocked") red++;
      }
      const tone = red > 0 ? "error" : amber > 0 ? "warn" : "success";
      const status = red > 0 ? `${red} red` : amber > 0 ? `${amber} amber` : "all green";
      counts.fleet = {
        text: String(total),
        tone: tone,
        aria: `${total} agents in fleet; ${status}`,
        meta: [{ label: status, tone: red > 0 ? "warn" : amber > 0 ? "warn" : "default" }],
      };
      counts["sub-fleet"] = counts.fleet;
    }

    if (escalations) {
      const list = Array.isArray(escalations.escalations) ? escalations.escalations : [];
      const open = list.length;
      counts.escalations = {
        text: String(open),
        tone: open > 0 ? "warn" : "muted",
        aria: `${open} open escalations`,
      };
      counts["sub-escalations"] = counts.escalations;
    }

    return counts;
  }

  // ---------------- Tile loader (re-runnable) ----------------

  // Extracted so `_refresh-controls.js` can poll it (PR #51) and so a
  // manual refresh from the shell header re-fetches without reloading
  // the page. Returns a Promise so the polling substrate can await it.
  async function loadTiles() {
    if (!window.bankShell) return;

    // Parallel fetch — five endpoints, one round-trip wall-clock.
    const [state, obligations, substrateGaps, fleet, escalations] = await Promise.all([
      window.bankShell.fetch.state(),
      window.bankShell.fetch.obligations(),
      window.bankShell.fetch.substrateGaps(),
      window.bankShell.fetch.fleet(),
      window.bankShell.fetch.escalations(),
    ]);

    if (window.bankShell.render && state && state.asOf) {
      window.bankShell.render.asOf(state.asOf);
    } else if (window.bankShell.render) {
      window.bankShell.render.asOf(null);
    }

    const counts = deriveCounts(state, obligations, substrateGaps, fleet, escalations);
    renderTiles(CATALOGUE, counts);
    if (window.bankShell.audit) {
      window.bankShell.audit.log("home.tiles.rendered", {
        tilesTotal: CATALOGUE.length,
        tilesWithCounts: Object.keys(counts).length,
      });
    }
  }

  // ---------------- Boot -------------------------------------

  async function boot() {
    if (!window.bankShell) {
      console.error("[home] window.bankShell not available — _shell.js failed to load");
      return;
    }

    // Initial render with skeletons (no counts yet) so the page is
    // useful while async fetches resolve.
    renderTiles(CATALOGUE, {});

    await loadTiles();

    // Wire periodic refresh. Prefer Anya's shared substrate
    // (`_refresh-controls.js` from PR #51) when present — it gives the
    // user a Refresh button + last-updated chip + visibility-aware
    // polling. Fall back to a plain setInterval so v0 still meets the
    // dashboards-live bar even when the shared controls aren't
    // loaded yet.
    if (typeof window.registerPagePoll === "function") {
      window.registerPagePoll(loadTiles, 30_000);
    } else {
      setInterval(() => {
        loadTiles().catch((e) => console.warn("[home] tile refresh failed", e));
      }, 30_000);
    }
  }

  // Expose for manual triggering (header refresh button, future tests).
  window.bankHome = { loadTiles };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
