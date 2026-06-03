// seeds.js — Seeds page (Trusted-Figures Program, objective 1).
//
// Fetches /api/seeds and renders, per foundational build-phase seed: its title,
// kind, source form (boot-ingester / idempotent-script), source file, how it
// runs, the data fixture it consumes, the event types + market-data tick types
// it produces with live counts, and descope status. Cards are grouped by source
// form. All current entries are visibility-only (descopable:false), so the
// descope/replace controls stay hidden.
//
// Author: Atlas (substrate)

(() => {
  const esc = (s) => SC.esc(String(s ?? ""));

  const KIND_COLOURS = {
    identity: "var(--color-accent, #1668dc)",
    instruments: "var(--color-accent, #1668dc)",
    capital: "var(--color-success, #389e0d)",
    policy: "var(--color-warning, #d48806)",
    "risk-limits": "var(--color-warning, #d48806)",
  };

  function kindColour(seedKind) {
    return KIND_COLOURS[seedKind] ?? "var(--color-text-secondary)";
  }

  function sourceBadge(source) {
    const isBoot = source === "boot-ingester";
    const label = isBoot ? "boot ingester" : "standing script";
    const colour = isBoot ? "var(--color-accent, #1668dc)" : "var(--color-success, #389e0d)";
    return `<span style="display:inline-block;padding:2px 8px;border:1px solid ${colour};color:${colour};border-radius:10px;font:var(--text-caption);font-weight:600">${esc(label)}</span>`;
  }

  async function descope(seedId, title) {
    const reason = window.prompt(
      `Descope "${title}"?\n\nGive a reason (the seed is skipped at next boot):`,
    );
    if (reason === null) return;
    if (!reason.trim()) {
      window.alert("A reason is required to descope a seed.");
      return;
    }
    const res = await fetch("/api/seeds/descope", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seedId, reason: reason.trim() }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      window.alert(`Descope failed: ${data?.error ?? res.statusText}`);
      return;
    }
    window.alert(data?.effect ?? "Seed descoped at next boot.");
    load();
  }

  function countTable(title, counts) {
    const entries = Object.entries(counts || {});
    if (entries.length === 0) return "";
    const rows = entries
      .map(
        ([t, n]) =>
          `<tr style="border-top:1px solid var(--color-border)">
            <td style="padding:4px 8px"><code>${esc(t)}</code></td>
            <td style="padding:4px 8px;text-align:right;color:${n > 0 ? "var(--color-success)" : "var(--color-text-secondary)"}">${n}</td>
          </tr>`,
      )
      .join("");
    return `<div style="margin-top:var(--space-3)">
      <div style="font-weight:600;margin-bottom:var(--space-2);font:var(--text-caption)">${esc(title)}</div>
      <table style="width:60%;min-width:320px;border-collapse:collapse;font:var(--text-caption)">
        <thead><tr style="text-align:left;color:var(--color-text-secondary)">
          <th style="padding:4px 8px">Type</th><th style="padding:4px 8px;text-align:right">Count</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function renderCard(s) {
    const card = document.createElement("div");
    card.style.cssText =
      "border:1px solid var(--color-border);border-radius:8px;padding:var(--space-5);margin-bottom:var(--space-5);background:var(--color-surface)";

    const present = (s.totalEvents || 0) + (s.totalTicks || 0) > 0;
    const statusBadge = s.descoped
      ? `<span style="color:var(--color-danger);font-weight:600">● Descoped — skipped at next boot</span>`
      : present
        ? `<span style="color:var(--color-success);font-weight:600">● Seeded (present in store)</span>`
        : `<span style="color:var(--color-text-secondary);font-weight:600">● Registered — not yet seeded</span>`;

    const descopeNote = s.descope
      ? `<div style="margin-top:var(--space-2);color:var(--color-danger);font:var(--text-caption)">
          Descoped ${esc(s.descope.asOf)} by ${esc(s.descope.actor)}: ${esc(s.descope.reason)}
        </div>`
      : "";

    const promoteNote = s.promotion
      ? `<div style="margin-top:var(--space-2);color:var(--color-text-secondary);font:var(--text-caption)">
          Replaced with ${s.promotion.replacementEventIds.length} simulated event(s) ${esc(s.promotion.asOf)}${s.promotion.note ? ` — ${esc(s.promotion.note)}` : ""}
        </div>`
      : "";

    const dataFileLine = s.dataFile
      ? `<div style="margin-top:var(--space-1);font:var(--text-caption);color:var(--color-text-secondary)">Data: <code>${esc(s.dataFile)}</code></div>`
      : "";

    const controls =
      s.descopable && !s.descoped
        ? `<div style="margin-top:var(--space-4);display:flex;gap:var(--space-3);flex-wrap:wrap">
            <button data-descope="${esc(s.seedId)}" data-title="${esc(s.title)}"
              style="padding:6px 14px;border:1px solid var(--color-danger);color:var(--color-danger);background:transparent;border-radius:6px;cursor:pointer;font:var(--text-caption)">
              Descope
            </button>
            ${
              s.replaceWith
                ? `<a href="${esc(s.replaceWith.href)}"
                    style="padding:6px 14px;border:1px solid var(--color-border);color:var(--color-text);background:transparent;border-radius:6px;text-decoration:none;font:var(--text-caption)">
                    ${esc(s.replaceWith.label)} →
                  </a>`
                : ""
            }
          </div>`
        : "";

    const eventsTable = countTable("Emitted events", s.eventCounts);
    const ticksTable = countTable("Market-data ticks", s.marketDataCounts);
    const noOutputs =
      !eventsTable && !ticksTable
        ? `<div style="margin-top:var(--space-3);font:var(--text-caption);color:var(--color-text-secondary)">No declared outputs.</div>`
        : "";

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-2)">
        <div>
          <div style="display:flex;align-items:center;gap:var(--space-2)">
            <span style="font:var(--text-heading-3);font-weight:600">${esc(s.title)}</span>
            ${sourceBadge(s.source)}
          </div>
          <div style="font:var(--text-caption);color:${kindColour(s.kind)}">
            ${esc(s.kind)} · <code>${esc(s.seedId)}</code>
          </div>
          <div style="margin-top:var(--space-1);font:var(--text-caption);color:var(--color-text-secondary)">
            Source: <code>${esc(s.sourcePath)}</code>
          </div>
          <div style="margin-top:var(--space-1);font:var(--text-caption);color:var(--color-text-secondary)">
            Runs: <code>${esc(s.invocation)}</code>
          </div>
          ${dataFileLine}
        </div>
        <div style="text-align:right;font:var(--text-caption)">${statusBadge}</div>
      </div>
      <div style="margin-top:var(--space-3);font:var(--text-body);color:var(--color-text-secondary)">${esc(s.description)}</div>
      ${descopeNote}
      ${promoteNote}
      ${eventsTable}
      ${ticksTable}
      ${noOutputs}
      ${controls}
      <div style="margin-top:var(--space-3);font:var(--text-caption);color:var(--color-text-secondary)">
        Citations: ${s.citations.map((c) => `<code>${esc(c)}</code>`).join(" ")}
      </div>`;

    const btn = card.querySelector("[data-descope]");
    if (btn) {
      btn.addEventListener("click", () => descope(btn.dataset.descope, btn.dataset.title));
    }
    return card;
  }

  function sectionHeading(text) {
    const h = document.createElement("h2");
    h.textContent = text;
    h.style.cssText =
      "font:var(--text-heading-2);font-weight:600;margin:var(--space-6) 0 var(--space-4)";
    return h;
  }

  async function load() {
    const data = await fetch("/api/seeds").then((r) => (r.ok ? r.json() : null));
    const tilesEl = document.getElementById("seed-tiles");
    const cardsEl = document.getElementById("seed-cards");
    if (!data) {
      if (cardsEl) cardsEl.textContent = "Failed to load /api/seeds.";
      return;
    }

    const seeds = data.seeds || [];
    const bootSeeds = seeds.filter((s) => s.source === "boot-ingester");
    const scriptSeeds = seeds.filter((s) => s.source === "idempotent-script");
    const seededCount = seeds.filter((s) => (s.totalEvents || 0) + (s.totalTicks || 0) > 0).length;

    if (tilesEl) {
      tilesEl.innerHTML = "";
      tilesEl.append(
        SC.renderTile({ label: "Foundational seeds", value: seeds.length, status: "info" }),
        SC.renderTile({ label: "Boot ingesters", value: bootSeeds.length, status: "info" }),
        SC.renderTile({ label: "Standing scripts", value: scriptSeeds.length, status: "info" }),
        SC.renderTile({
          label: "Seeded (present)",
          value: seededCount,
          status: seededCount === seeds.length ? "ok" : "warning",
        }),
      );
    }

    if (cardsEl) {
      cardsEl.innerHTML = "";
      if (bootSeeds.length > 0) {
        cardsEl.append(sectionHeading("Boot ingesters — market-data fixtures (loaded every boot)"));
        for (const s of bootSeeds) cardsEl.append(renderCard(s));
      }
      if (scriptSeeds.length > 0) {
        cardsEl.append(sectionHeading("Standing scripts — foundational event seeds"));
        for (const s of scriptSeeds) cardsEl.append(renderCard(s));
      }
    }
  }

  load();
})();
