// constants.js — Financial Constants page (Trusted-Figures Program, objective 2).
//
// Fetches /api/constants and renders every owned financial calibration constant,
// grouped by category, with its value (formatted by unit), owning seat and
// regulatory citation. Read-only — regulated constants change via a governed
// Decision, not a dashboard field.
//
// Author: Atlas (Core banking platform architect, engineering)

(() => {
  const esc = (s) => SC.esc(String(s ?? ""));

  const CATEGORY_LABELS = {
    "lcr-runoff": "LCR — run-off rates",
    "lcr-inflow": "LCR — inflow rates",
    "lcr-haircut": "LCR — HQLA haircuts",
    "lcr-cap": "LCR — caps & recognition",
    "lcr-threshold": "LCR — thresholds",
    "nsfr-asf": "NSFR — available stable funding",
    "nsfr-rsf": "NSFR — required stable funding",
    "nsfr-threshold": "NSFR — thresholds",
    "capital-baseline": "Capital — build-phase baselines",
    "capital-threshold": "Capital — appetite thresholds",
    "leverage-threshold": "Leverage — appetite bands",
    "rwa-instrument-weight": "RWA — per-instrument-class weights",
  };

  function formatValue(value, unit) {
    if (unit === "ratio") {
      return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}% <span style="color:var(--color-text-secondary)">(${value})</span>`;
    }
    if (unit === "percentage-points") {
      return `${value} pp`;
    }
    if (unit === "zar-minor") {
      const rand = value / 100;
      return `R${rand.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
    }
    return String(value);
  }

  function renderGroup(group) {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "border:1px solid var(--color-border);border-radius:8px;padding:var(--space-5);margin-bottom:var(--space-5);background:var(--color-surface)";

    const rows = group.constants
      .map(
        (c) => `
        <tr style="border-top:1px solid var(--color-border)">
          <td style="padding:6px 8px"><code>${esc(c.key)}</code></td>
          <td style="padding:6px 8px">${esc(c.label)}</td>
          <td style="padding:6px 8px;text-align:right;font-variant-numeric:tabular-nums">${formatValue(c.value, c.unit)}</td>
          <td style="padding:6px 8px;color:var(--color-text-secondary)">${esc(c.owningRole)}</td>
          <td style="padding:6px 8px"><code>${esc(c.citation)}</code></td>
        </tr>`,
      )
      .join("");

    wrap.innerHTML = `
      <div style="font:var(--text-heading-3);font-weight:600;margin-bottom:var(--space-3)">
        ${esc(CATEGORY_LABELS[group.category] ?? group.category)}
        <span style="font:var(--text-caption);color:var(--color-text-secondary);font-weight:400"> · ${group.constants.length}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font:var(--text-caption)">
        <thead><tr style="text-align:left;color:var(--color-text-secondary)">
          <th style="padding:6px 8px">Key</th>
          <th style="padding:6px 8px">Constant</th>
          <th style="padding:6px 8px;text-align:right">Value</th>
          <th style="padding:6px 8px">Owner</th>
          <th style="padding:6px 8px">Citation</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    return wrap;
  }

  async function load() {
    const data = await fetch("/api/constants").then((r) => (r.ok ? r.json() : null));
    const tilesEl = document.getElementById("const-tiles");
    const groupsEl = document.getElementById("const-groups");
    if (!data) {
      if (groupsEl) groupsEl.textContent = "Failed to load /api/constants.";
      return;
    }

    if (tilesEl) {
      tilesEl.innerHTML = "";
      tilesEl.append(
        SC.renderTile({ label: "Constants", value: data.counts.total, status: "info" }),
        SC.renderTile({ label: "Categories", value: data.counts.categories, status: "info" }),
        SC.renderTile({ label: "Owning seats", value: data.counts.owners, status: "info" }),
      );
    }

    if (groupsEl) {
      groupsEl.innerHTML = "";
      for (const g of data.groups) groupsEl.append(renderGroup(g));
    }
  }

  load();
})();
