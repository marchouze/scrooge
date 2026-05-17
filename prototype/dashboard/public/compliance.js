// compliance.js — Obligations & Compliance department view.
//
// Pulls /api/obligations for the full register plus /api/state for
// compliance-indicator fields and the policy count.
// Shows summary metrics, traffic-light indicators for POPIA / FATCA-CRS / FIC,
// top obligations table, and open compliance decisions.
//
// Author: Atlas (Core banking platform architect) — under CEO directive
// 2026-05-12 (intranet scaffold).
// Improved: Noa (Intranet Product Owner & UI Architect) — 2026-05-12.

(() => {
  // Key regulatory frameworks shown as traffic-light indicators.
  const INDICATORS = [
    {
      id: "popia",
      label: "POPIA s.19–22",
      stateKey: "popiaStatus",
      sub: "Information Officer (Iris) — lawful-processing framework",
    },
    {
      id: "fatca",
      label: "FATCA / CRS",
      stateKey: "fatcaStatus",
      sub: "Yael (Tax engineer) — reporting obligations",
    },
    {
      id: "fic",
      label: "FIC Act 38 of 2001",
      stateKey: "ficStatus",
      sub: "Mira + Zara — AML/CFT, STR/CTR cycle",
    },
    {
      id: "sanctions",
      label: "Sanctions / PEP",
      stateKey: "sanctionsStatus",
      sub: "Mira — screening pipeline",
    },
    {
      id: "banks-act",
      label: "Banks Act 94/1990",
      stateKey: "banksActStatus",
      sub: "Helena (CRO) + Owen (CoSec) — licence compliance",
    },
  ];

  function statusTone(s) {
    if (!s) return "muted";
    const v = String(s).toLowerCase();
    if (v === "green" || v === "met" || v === "ok" || v === "compliant") return "green";
    if (v === "amber" || v === "pending" || v === "approaching") return "amber";
    if (v === "red" || v === "flagged" || v === "breach" || v === "overdue") return "red";
    return "muted";
  }

  function setMetric(id, text, tone) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || "–";
    if (tone) el.setAttribute("data-tone", tone);
  }

  function renderIndicators(state) {
    const rows = INDICATORS.map((ind) => {
      const raw = state?.[ind.stateKey] ?? null;
      const tone = statusTone(raw);
      const display = raw ? String(raw).toUpperCase() : "AWAITING DATA";
      return `<div class="tl-row">
  <span class="tl-dot" data-tone="${tone}" title="${tone}"></span>
  <span class="tl-label"><strong>${ind.label}</strong><br><span style="font-size:var(--type-caption);color:var(--neutral-stone)">${ind.sub}</span></span>
  <span class="tl-value">${display}</span>
</div>`;
    }).join("");
    return `<div>${rows}</div>`;
  }

  function renderTopObligations(obligations) {
    if (!obligations) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">awaiting data — <a href="/obligations.html" style="color:var(--accent-ink)">open full register</a></p>`;
    }
    const byId = obligations.byId || {};
    const items = Object.values(byId).slice(0, 15);
    if (!items.length) {
      return `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No obligations found. <a href="/obligations.html" style="color:var(--accent-ink)">Open full register →</a></p>`;
    }

    const rows = items
      .map((o) => {
        const id = o.id || o.obligationId || "–";
        const title = o.title || o.description || "–";
        const bind = o.bind || "–";
        const source = o.source || "–";
        const bindClass = bind === "UNCLASSIFIED-bind" ? "pending" : "met";
        const srcClass = source ? "met" : "pending";
        return `<tr>
  <td><code style="font-size:var(--type-caption)">${id}</code></td>
  <td style="max-width:260px">${title}</td>
  <td><span class="status-badge" data-status="${bindClass}">${bind}</span></td>
  <td><span class="status-badge" data-status="${srcClass}">${source || "empty"}</span></td>
</tr>`;
      })
      .join("");

    return `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Top obligations">
    <thead><tr><th>ID</th><th>Title</th><th>Bind</th><th>Source</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-small)">
  Showing ${items.length} of ${obligations.count || items.length}.
  <a href="/obligations.html" style="color:var(--accent-ink)">Open full register →</a>
</p>`;
  }

  async function load() {
    const [state, obligations] = await Promise.all([
      window.bankShell
        ? window.bankShell.fetch.state()
        : fetch("/api/state", { headers: { Accept: "application/json" } })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
      window.bankShell
        ? window.bankShell.fetch.obligations()
        : fetch("/api/obligations", { headers: { Accept: "application/json" } })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
    ]);

    if (window.bankShell?.render?.asOf && state?.asOf) {
      window.bankShell.render.asOf(state.asOf);
    }

    // --- Summary metrics -------------------------------------------
    const total = obligations?.count ?? 0;
    let emptySource = 0;
    let unclassified = 0;
    const byId = obligations?.byId || {};
    for (const k in byId) {
      if (Object.prototype.hasOwnProperty.call(byId, k)) {
        const o = byId[k];
        if (!o.source) emptySource++;
        if (!o.bind || o.bind === "UNCLASSIFIED-bind") unclassified++;
      }
    }

    // Policy count and open decisions from state
    const policiesCount = state?.bank?.metrics?.policies ?? 0;
    const openDecisionsCount = state?.decisionsOpen?.length ?? 0;

    setMetric("cmp-total", String(total), total > 0 ? "default" : "muted");
    setMetric("cmp-empty-src", String(emptySource), emptySource > 0 ? "warn" : "success");
    setMetric("cmp-unclassified", String(unclassified), unclassified > 0 ? "warn" : "success");
    setMetric("cmp-policies", String(policiesCount), policiesCount > 0 ? "default" : "muted");
    setMetric(
      "cmp-open-decisions",
      String(openDecisionsCount),
      openDecisionsCount > 0 ? "warn" : "success",
    );

    // Framework statuses from state (placeholder until pipeline lands)
    const popia = state?.popiaStatus ?? null;
    const fatca = state?.fatcaStatus ?? null;
    const fic = state?.ficStatus ?? null;

    function indStatus(v) {
      return v ? String(v).toUpperCase() : "–";
    }
    function indTone(v) {
      if (!v) return "muted";
      const s = String(v).toLowerCase();
      if (s === "green" || s === "met" || s === "compliant") return "success";
      if (s === "amber" || s === "pending") return "warn";
      if (s === "red" || s === "flagged") return "error";
      return "muted";
    }

    setMetric("cmp-popia", indStatus(popia), indTone(popia));
    setMetric("cmp-fatca", indStatus(fatca), indTone(fatca));
    setMetric("cmp-fic", indStatus(fic), indTone(fic));

    // --- Compliance indicators ----------------------------------------
    document.getElementById("cmp-indicators-body").innerHTML = renderIndicators(state || {});

    // --- Top obligations table ----------------------------------------
    document.getElementById("cmp-register-body").innerHTML = renderTopObligations(obligations);

    // --- Open compliance decisions ------------------------------------
    const complianceDecisionsEl = document.getElementById("cmp-decisions-body");
    if (complianceDecisionsEl) {
      const complianceDecisions = (state?.decisionsOpen || []).filter((d) => {
        const id = (d.id || "").toUpperCase();
        const title = (d.title || "").toLowerCase();
        return (
          id.includes("POPIA") ||
          id.includes("FIC") ||
          id.includes("FATCA") ||
          id.includes("COMPLIANCE") ||
          id.includes("MIRA") ||
          id.includes("ZARA") ||
          id.includes("IRIS") ||
          title.includes("compliance") ||
          title.includes("popia") ||
          title.includes("fic") ||
          title.includes("fatca") ||
          title.includes("sanctions") ||
          title.includes("aml") ||
          title.includes("information officer") ||
          title.includes("obligations")
        );
      });

      if (!complianceDecisions.length) {
        complianceDecisionsEl.innerHTML = `<p style="color:var(--neutral-stone);font-size:var(--type-small)">No open compliance-tagged decisions. <a href="/decisions.html" style="color:var(--accent-ink)">View all decisions →</a></p>`;
      } else {
        const rows = complianceDecisions
          .map((d) => {
            const id = d.id || "–";
            const title = d.title || "–";
            const category = d.category || "–";
            return `<tr>
  <td><code style="font-size:var(--type-caption)">${id}</code></td>
  <td>${title}</td>
  <td><span class="status-badge" data-status="pending">${category}</span></td>
</tr>`;
          })
          .join("");
        complianceDecisionsEl.innerHTML = `<div class="dept-table-wrap">
  <table class="dept-table" aria-label="Compliance-related open decisions">
    <thead><tr><th>ID</th><th>Title</th><th>Category</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p style="margin-top:var(--space-3);font-size:var(--type-small)">
  <a href="/decisions.html" style="color:var(--accent-ink)">View all open decisions →</a>
</p>`;
      }
    }
  }

  window.bankCompliance = { load };

  if (typeof window.registerPagePoll === "function") {
    window.registerPagePoll(load, 30_000);
  } else {
    setInterval(() => load().catch((e) => console.warn("[compliance] refresh failed", e)), 30_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
