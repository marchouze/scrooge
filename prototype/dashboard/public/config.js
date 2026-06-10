// dashboard/public/config.js
//
// Platform configuration page — fetches /api/config, renders a table of all
// paths and server settings with source annotations (env/file/default), and
// supports inline editing for file- and default-sourced values.
//
// Authority: D-BANK-CONFIG-STORE (centralized config, 2026-05-25)
// Author: Atlas (Core banking platform architect, engineering)

(() => {
  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────

  async function fetchConfig() {
    const r = await fetch("/api/config");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }

  async function patchConfig(patch) {
    const r = await fetch("/api/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      throw new Error(err.error ?? `HTTP ${r.status}`);
    }
    return await r.json();
  }

  // ── Source badge ───────────────────────────────────────────────────────────

  function sourceBadge(source) {
    const cls =
      source === "env" ? "source-env" : source === "file" ? "source-file" : "source-default";
    return `<span class="source-badge ${cls}">${esc(source)}</span>`;
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  let _configData = null;

  function renderSection(title, entries, sectionKey) {
    const rows = entries
      .map(([key, { value, source }]) => {
        const valueStr = String(value);
        const editable = source !== "env";
        const editCell = editable
          ? `<button class="edit-btn" data-section="${esc(sectionKey)}" data-key="${esc(key)}" data-value="${esc(valueStr)}">Edit</button>`
          : `<span class="env-note">Set by env var — edit the env to change</span>`;
        return `<tr>
          <td><span class="config-key">${esc(key)}</span></td>
          <td id="val-${esc(sectionKey)}-${esc(key)}"><span class="config-value">${esc(valueStr)}</span></td>
          <td>${sourceBadge(source)}</td>
          <td>${editCell}</td>
        </tr>`;
      })
      .join("");

    return `
      <div class="config-section">
        <h2>${esc(title)}</h2>
        <table class="config-table">
          <thead><tr>
            <th>Key</th><th>Value</th><th>Source</th><th>Action</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderConfig(data) {
    _configData = data;

    const pathEntries = Object.entries(data.paths);
    const serverEntries = Object.entries(data.server);

    const filePath = data.configFilePath ?? "~/.config/bank/platform.json";
    const fileExists = data.configFileExists;

    const subtitle = document.getElementById("configSubtitle");
    if (subtitle) {
      subtitle.innerHTML = `Single source of truth for all process paths and server settings.
        Stored at <code>${esc(filePath)}</code>
        ${fileExists ? '<span class="source-badge source-file">file exists</span>' : '<span class="source-badge source-default">auto-created on first access</span>'}.
        Env vars override per key.`;
    }

    const html =
      renderSection("Paths", pathEntries, "paths") +
      renderSection("Server", serverEntries, "server") +
      renderDisplaySection(data.display);

    const container = document.getElementById("configContent");
    container.innerHTML = html;

    // Wire edit buttons
    for (const btn of container.querySelectorAll(".edit-btn")) {
      btn.addEventListener("click", () => startEdit(btn));
    }

    // Wire display-preferences form
    wireDisplayForm(container);

    // If navigated with #display, scroll the section into view.
    if (window.location.hash === "#display") {
      document.getElementById("display")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // ── Display preferences ──────────────────────────────────────────────────────
  // Platform-wide number/currency house style, applied by SC.fmtMoney on every
  // page. Distinct from per-viewer sidebar prefs (those live in localStorage).

  function unwrapDisplay(display) {
    const out = {};
    for (const [k, v] of Object.entries(display ?? {})) out[k] = v?.value;
    return out;
  }

  function displaySources(display) {
    // Collapse the six per-key sources to a single badge: "file" if any key is
    // file-sourced, else "default".
    const sources = Object.values(display ?? {}).map((v) => v?.source);
    return sources.includes("file") ? "file" : "default";
  }

  function renderDisplaySection(display) {
    const d = unwrapDisplay(display);
    const sel = (cond) => (cond ? "checked" : "");
    return `
      <div class="config-section" id="display">
        <h2>Display preferences</h2>
        <p class="env-note">
          Platform-wide number &amp; currency house style — applied on every page.
          ${sourceBadge(displaySources(display))}
        </p>
        <div class="display-form">
          <label class="field-label" for="disp-decimals">Decimal places</label>
          <div class="field-control">
            <input type="number" id="disp-decimals" min="0" max="8" step="1" value="${esc(d.decimals)}">
          </div>

          <span class="field-label">Thousands separator</span>
          <div class="field-control">
            <label><input type="checkbox" id="disp-thousands" ${sel(d.thousandsSeparator)}> Group digits (1,234,567)</label>
          </div>

          <span class="field-label">Negative numbers</span>
          <div class="field-control">
            <label><input type="radio" name="disp-negative" value="minus" ${sel(d.negativeStyle === "minus")}> −1,234</label>
            <label><input type="radio" name="disp-negative" value="parens" ${sel(d.negativeStyle === "parens")}> (1,234)</label>
            <label><input type="radio" name="disp-negative" value="minus-red" ${sel(d.negativeStyle === "minus-red")}> red −1,234</label>
          </div>

          <span class="field-label">Numeric alignment</span>
          <div class="field-control">
            <label><input type="checkbox" id="disp-rightalign" ${sel(d.rightAlignNumbers)}> Right-align number columns</label>
          </div>

          <span class="field-label">Currency position</span>
          <div class="field-control">
            <label><input type="radio" name="disp-ccypos" value="prefix" ${sel(d.currencyPosition === "prefix")}> ZAR 1,234.56</label>
            <label><input type="radio" name="disp-ccypos" value="suffix" ${sel(d.currencyPosition === "suffix")}> 1,234.56 ZAR</label>
          </div>

          <label class="field-label" for="disp-locale">Locale</label>
          <div class="field-control">
            <input type="text" id="disp-locale" value="${esc(d.locale)}" placeholder="en-ZA">
          </div>
        </div>

        <div class="display-preview">
          <div class="preview-label">Live preview</div>
          <div class="preview-row" id="disp-preview-pos">—</div>
          <div class="preview-row" id="disp-preview-neg">—</div>
        </div>

        <button class="save-btn" id="display-save">Save display preferences</button>
        <span id="display-status"></span>
      </div>`;
  }

  // Read the pending (unsaved) display settings from the form inputs.
  function readDisplayForm() {
    const neg = document.querySelector('input[name="disp-negative"]:checked')?.value || "minus";
    const ccy = document.querySelector('input[name="disp-ccypos"]:checked')?.value || "prefix";
    const decimalsRaw = Number(document.getElementById("disp-decimals")?.value);
    return {
      decimals: Number.isInteger(decimalsRaw) ? decimalsRaw : 2,
      thousandsSeparator: !!document.getElementById("disp-thousands")?.checked,
      negativeStyle: neg,
      rightAlignNumbers: !!document.getElementById("disp-rightalign")?.checked,
      currencyPosition: ccy,
      locale: (document.getElementById("disp-locale")?.value || "en-ZA").trim() || "en-ZA",
    };
  }

  // Render the two sample figures using the pending settings, without committing
  // them globally: temporarily swap window.BANK_DISPLAY around the format calls.
  function updateDisplayPreview() {
    const posEl = document.getElementById("disp-preview-pos");
    const negEl = document.getElementById("disp-preview-neg");
    if (!posEl || !negEl || !window.SC || typeof window.SC.fmtMoney !== "function") return;
    const pending = readDisplayForm();
    const prev = window.BANK_DISPLAY;
    window.BANK_DISPLAY = pending;
    try {
      posEl.innerHTML = window.SC.fmtMoney(1234567, "ZAR"); // 12,345.67
      negEl.innerHTML = window.SC.fmtMoney(-9876543, "ZAR"); // 98,765.43 negative
    } finally {
      window.BANK_DISPLAY = prev;
    }
  }

  function wireDisplayForm(container) {
    const inputs = container.querySelectorAll(
      "#disp-decimals, #disp-thousands, #disp-rightalign, #disp-locale, " +
        'input[name="disp-negative"], input[name="disp-ccypos"]',
    );
    for (const el of inputs) {
      el.addEventListener("input", updateDisplayPreview);
      el.addEventListener("change", updateDisplayPreview);
    }
    container.querySelector("#display-save")?.addEventListener("click", saveDisplay);
    // Defer first preview until the formatter script has loaded.
    if (window.SC && typeof window.SC.fmtMoney === "function") updateDisplayPreview();
    else document.addEventListener("bank-display-ready", updateDisplayPreview, { once: true });
  }

  async function saveDisplay() {
    const pending = readDisplayForm();
    const status = document.getElementById("display-status");
    try {
      const result = await patchConfig({ display: pending });
      // Apply live so this page (and the shared formatter) reflect immediately.
      window.BANK_DISPLAY = pending;
      document.dispatchEvent(new CustomEvent("bank-display-ready", { detail: pending }));
      if (status) {
        status.textContent = "Saved ✓";
        status.style.color = "var(--color-success)";
      }
      renderConfig(result.config);
    } catch (err) {
      if (status) {
        status.textContent = `Save failed: ${err.message}`;
        status.style.color = "var(--color-danger)";
      } else {
        alert(`Save failed: ${err.message}`);
      }
    }
  }

  // ── Inline edit ────────────────────────────────────────────────────────────

  function startEdit(btn) {
    const sectionKey = btn.dataset.section;
    const key = btn.dataset.key;
    const currentValue = btn.dataset.value;

    const cell = btn.parentElement;
    const valCell = document.getElementById(`val-${sectionKey}-${key}`);

    // Swap value cell to an input
    valCell.innerHTML = `
      <div class="edit-row">
        <input class="edit-input" id="input-${sectionKey}-${key}" type="text" value="${esc(currentValue)}">
      </div>`;

    // Swap action cell to save/cancel
    cell.innerHTML = `
      <button class="save-btn" id="save-${sectionKey}-${key}">Save</button>
      <button class="cancel-btn" id="cancel-${sectionKey}-${key}">Cancel</button>`;

    document
      .getElementById(`save-${sectionKey}-${key}`)
      .addEventListener("click", () => saveEdit(sectionKey, key));
    document.getElementById(`cancel-${sectionKey}-${key}`).addEventListener("click", () => load());

    document.getElementById(`input-${sectionKey}-${key}`)?.focus();
  }

  async function saveEdit(sectionKey, key) {
    const input = document.getElementById(`input-${sectionKey}-${key}`);
    if (!input) return;
    const newValue = input.value.trim();
    if (!newValue) return;

    // For server keys, coerce to number
    const patch = {};
    if (sectionKey === "server") {
      const n = Number(newValue);
      if (Number.isNaN(n)) {
        alert(`"${newValue}" is not a valid number for server.${key}`);
        return;
      }
      patch.server = { [key]: n };
    } else {
      patch.paths = { [key]: newValue };
    }

    try {
      const result = await patchConfig(patch);
      renderConfig(result.config);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
      load(); // Re-render from server state
    }
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  async function load() {
    try {
      const data = await fetchConfig();
      renderConfig(data);
    } catch (err) {
      const container = document.getElementById("configContent");
      container.innerHTML = `<p style="color:var(--danger,#c33);">Failed to load config: ${esc(String(err))}</p>`;
    }
  }

  function init() {
    load();
    // Refresh every 30s to pick up external changes
    setInterval(load, 30_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
