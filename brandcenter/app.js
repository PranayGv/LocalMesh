const $ = (id) => document.getElementById(id);

const repairListEl = $("repair-list");
const repairEmptyEl = $("repair-empty");
const stockListEl = $("stock-list");
const stockEmptyEl = $("stock-empty");
const detailPlaceholder = $("detail-placeholder");
const detailContent = $("detail-content");

let repairs = [];
let stocks = [];
let viewMode = "repair"; // "repair" | "stock"
let selectedKind = null; // "repair" | "stock"
let selectedId = null;
let lastRepairFingerprint = "";
let lastStockFingerprint = "";

const ICONS = {
  classify: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
  wrench: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 10-5.4 5.4L2 19v3h3l7.3-7.3a4 4 0 005.4-5.4z"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v8a2 2 0 01-1 1.73l-7 4a2 2 0 01-2 0l-7-4A2 2 0 013 16V8"/><path d="M3.3 7L12 12l8.7-5"/><path d="M12 22V12"/></svg>`,
  warehouse: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/></svg>`,
  hub: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>`,
};

/* ---------------------------------------------------------------------- */
/* Queue polling                                                          */
/* ---------------------------------------------------------------------- */

async function fetchRepairs() {
  try {
    const res = await fetch("/api/service/repairs");
    if (!res.ok) return;
    repairs = await res.json();
    const fp = JSON.stringify(repairs.map((r) => r.id));
    if (fp !== lastRepairFingerprint) {
      lastRepairFingerprint = fp;
      renderRepairList();
    }
    renderStats();
  } catch (err) {
    /* backend not reachable yet — keep showing what we have */
  }
}

async function fetchStocks() {
  try {
    const res = await fetch("/api/service/stock-checks");
    if (!res.ok) return;
    stocks = await res.json();
    const fp = JSON.stringify(stocks.map((s) => s.id));
    if (fp !== lastStockFingerprint) {
      lastStockFingerprint = fp;
      renderStockList();
    }
    renderStats();
  } catch (err) {
    /* backend not reachable yet — keep showing what we have */
  }
}

function renderStats() {
  $("stat-repairs").textContent = repairs.length;
  $("stat-repair-local").textContent = repairs.filter((r) => r.route === "local_warehouse").length;
  $("stat-repair-hub").textContent = repairs.filter((r) => r.route === "central_hub").length;
  $("stat-stock").textContent = stocks.length;
  $("stat-stock-flag").textContent = stocks.filter((s) => s.route === "flag_storefront").length;
}

function formatTimestamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ---------------------------------------------------------------------- */
/* Queue lists                                                            */
/* ---------------------------------------------------------------------- */

function repairMeta(r) {
  return r.route === "local_warehouse"
    ? { dot: "dot-local", label: "LOCAL WH" }
    : { dot: "dot-hub", label: "CENTRAL HUB" };
}

function stockMeta(s) {
  return s.route === "dispatch"
    ? { dot: "dot-local", label: "DISPATCHED" }
    : { dot: "dot-defect", label: "UNAVAILABLE" };
}

function renderRepairList() {
  const has = repairs.length > 0;
  repairEmptyEl.hidden = has;
  repairListEl.hidden = !has;
  if (!has) return;

  repairListEl.innerHTML = repairs
    .map((r) => {
      const meta = repairMeta(r);
      const active = selectedKind === "repair" && r.id === selectedId ? "active" : "";
      return `
        <button class="queue-row ${active}" data-kind="repair" data-id="${r.id}">
          <span class="qr-dot ${meta.dot}"></span>
          <span class="qr-main">
            <span class="qr-product">${r.product}</span>
            <span class="qr-meta">${r.area_name} &middot; ${formatTimestamp(r.submitted_at)}</span>
          </span>
          <span class="qr-status ${meta.dot}">${meta.label}</span>
        </button>
      `;
    })
    .join("");

  repairListEl.querySelectorAll(".queue-row").forEach((row) => {
    row.addEventListener("click", () => selectNotification("repair", row.dataset.id));
  });
}

function renderStockList() {
  const has = stocks.length > 0;
  stockEmptyEl.hidden = has;
  stockListEl.hidden = !has;
  if (!has) return;

  stockListEl.innerHTML = stocks
    .map((s) => {
      const meta = stockMeta(s);
      const active = selectedKind === "stock" && s.id === selectedId ? "active" : "";
      return `
        <button class="queue-row ${active}" data-kind="stock" data-id="${s.id}">
          <span class="qr-dot ${meta.dot}"></span>
          <span class="qr-main">
            <span class="qr-product">${s.product}</span>
            <span class="qr-meta">${s.area_name} &middot; ${formatTimestamp(s.submitted_at)}</span>
          </span>
          <span class="qr-status ${meta.dot}">${meta.label}</span>
        </button>
      `;
    })
    .join("");

  stockListEl.querySelectorAll(".queue-row").forEach((row) => {
    row.addEventListener("click", () => selectNotification("stock", row.dataset.id));
  });
}

/* ---------------------------------------------------------------------- */
/* Detail panel                                                           */
/* ---------------------------------------------------------------------- */

function selectNotification(kind, id) {
  selectedKind = kind;
  selectedId = id;
  renderRepairList();
  renderStockList();
  detailPlaceholder.hidden = true;
  detailContent.hidden = false;

  if (kind === "repair") {
    const r = repairs.find((x) => x.id === id);
    if (r) renderRepairDetail(r);
  } else {
    const s = stocks.find((x) => x.id === id);
    if (s) renderStockDetail(s);
  }
}

function statTile(label, value) {
  return `
    <div class="stat-tile">
      <p class="stat-tile-label">${label}</p>
      <p class="stat-tile-value">${value}</p>
    </div>
  `;
}

function gateRow(icon, title, passed, reason) {
  return `
    <div class="gate-row ${passed ? "gate-pass" : "gate-fail"}">
      <span class="gate-icon">${passed ? "✓" : "✕"}</span>
      <div class="gate-body">
        <p class="gate-title">${title}</p>
        <p class="gate-reason">${reason}</p>
      </div>
    </div>
  `;
}

function skipRow(title, reason) {
  return `
    <div class="gate-row gate-skip">
      <span class="gate-icon">–</span>
      <div class="gate-body">
        <p class="gate-title">${title}</p>
        <p class="gate-reason">${reason}</p>
      </div>
    </div>
  `;
}

function renderRepairDetail(r) {
  const isLocal = r.route === "local_warehouse";
  const icon = isLocal ? ICONS.warehouse : ICONS.hub;
  const routeLabel = isLocal ? "Local Warehouse" : "Central Hub";
  const bannerClass = isLocal ? "local-warehouse" : "central-hub";

  let stepsHtml = gateRow(
    ICONS.classify,
    "Certified Technician Check",
    r.technician_check.available,
    r.technician_check.reason
  );

  if (!r.repair_attempt.attempted) {
    stepsHtml += skipRow("Attempt Repair", "Skipped — " + r.repair_attempt.reason);
    stepsHtml += skipRow("Industry Standard Check", "Skipped — no repair was attempted.");
  } else {
    stepsHtml += gateRow(ICONS.wrench, "Attempt Repair", true, r.repair_attempt.reason);
    stepsHtml += gateRow(
      ICONS.classify,
      "Industry Standard Check",
      r.repair_attempt.passed,
      r.repair_attempt.reason
    );
  }

  let dissatisfactionHtml = "";
  if (r.dissatisfaction_check) {
    const { demand, climate } = r.dissatisfaction_check;
    const tiles = [
      statTile("Recent Demand", `${demand.recent_avg}/mo`),
      statTile("Demand Threshold", `${demand.threshold}/mo`),
      statTile("Climate Zone", climate.area_climate_zone),
      statTile("Climate Fit", climate.is_climate_fit ? "Yes" : "No"),
    ].join("");
    dissatisfactionHtml = `
      <div class="section-block">
        <p class="panel-title">Personal-Dissatisfaction Criterion
          <span class="status-pill ${demand.has_demand ? "yes" : "no"}">Demand: ${demand.has_demand ? "Yes" : "No"}</span>
        </p>
        <p class="reason-text">Repair passed inspection, so the refurbished unit is routed the same way a dissatisfaction return would be — by current local demand, then climate fit.</p>
        <div class="stat-grid">${tiles}</div>
        <p class="reason-text">${demand.reason}</p>
        <p class="reason-text">${climate.reason}</p>
      </div>
    `;
  }

  const html = `
    <div class="detail-header">
      <div>
        <p class="detail-eyebrow">REPAIR NOTIFICATION</p>
        <h2>${r.product}</h2>
        <p class="detail-sub">${r.area_name}${r.return_id ? ` &middot; linked return <code>${r.return_id}</code>` : ""} &middot; received ${formatTimestamp(r.submitted_at)}</p>
      </div>
      <span class="status-badge ${isLocal ? "dot-local" : "dot-hub"}">${routeLabel.toUpperCase()}</span>
    </div>
    <section class="panel">
      <p class="panel-title">${ICONS.wrench} Service Centre Intake — Repair Notification</p>
      ${stepsHtml}
      <div class="decision-banner ${bannerClass}">
        <p class="decision-head">${icon}<span class="route-label">Decision: ${routeLabel}</span></p>
        <p class="reason-text">${r.route_reason}</p>
      </div>
    </section>
    ${dissatisfactionHtml ? `<section class="panel">${dissatisfactionHtml}</section>` : ""}
  `;
  detailContent.innerHTML = html;
}

function renderStockDetail(s) {
  const isDispatch = s.route === "dispatch";
  const icon = isDispatch ? ICONS.box : ICONS.hub;
  const routeLabel = isDispatch ? "Dispatch Unit" : "Flag Storefront";
  const bannerClass = isDispatch ? "local-warehouse" : "central-hub";

  const tiles = [
    statTile("Local Qty (this centre)", s.local_qty),
    statTile("Partner Shops With Stock", s.partner_matches.length),
  ].join("");

  const matches = s.partner_matches.length
    ? `<div class="city-chip-grid">${s.partner_matches
        .map(
          (m) =>
            `<span class="city-chip yes">${m.area_name} <small>${m.qty} units${s.found_at && s.found_at.area_code === m.area_code ? " — dispatched from here" : ""}</small></span>`
        )
        .join("")}</div>`
    : `<p class="reason-text">No partner shop reported stock for this product.</p>`;

  const html = `
    <div class="detail-header">
      <div>
        <p class="detail-eyebrow">OUT OF STOCK NOTIFICATION</p>
        <h2>${s.product}</h2>
        <p class="detail-sub">${s.area_name} &middot; received ${formatTimestamp(s.submitted_at)}</p>
      </div>
      <span class="status-badge ${isDispatch ? "dot-local" : "dot-defect"}">${isDispatch ? "DISPATCHED" : "UNAVAILABLE"}</span>
    </div>
    <section class="panel">
      <p class="panel-title">${ICONS.box} Local Brand Stock Lookup
        <span class="status-pill ${s.in_stock ? "yes" : "no"}">In stock: ${s.in_stock ? "Yes" : "No"}</span>
      </p>
      <p class="reason-text">Checked this service centre's own local warehouse, then every partner shop (every other local warehouse) for the same product.</p>
      <div class="stat-grid">${tiles}</div>
      ${matches}
      <div class="decision-banner ${bannerClass}">
        <p class="decision-head">${icon}<span class="route-label">Decision: ${routeLabel}</span></p>
        <p class="reason-text">${s.route_reason}</p>
      </div>
    </section>
  `;
  detailContent.innerHTML = html;
}

/* ---------------------------------------------------------------------- */
/* Tabs + init                                                            */
/* ---------------------------------------------------------------------- */

function initViewTabs() {
  const tabs = $("view-tabs");
  if (!tabs) return;
  tabs.querySelectorAll(".vt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.view === viewMode) return;
      viewMode = btn.dataset.view;
      tabs.querySelectorAll(".vt-btn").forEach((b) => b.classList.toggle("on", b === btn));
      $("repair-view").hidden = viewMode !== "repair";
      $("stock-view").hidden = viewMode !== "stock";
      detailContent.hidden = true;
      detailContent.innerHTML = "";
      detailPlaceholder.hidden = false;
      detailPlaceholder.querySelector("p").textContent =
        viewMode === "repair"
          ? "Select a repair notification from the queue to view its service centre intake flow."
          : "Select a stock notification from the queue to view its lookup result.";
    });
  });
}

const clearBtn = $("clear-queue");
if (clearBtn) {
  clearBtn.addEventListener("click", async () => {
    if (!repairs.length && !stocks.length) return;
    if (!confirm("Clear all service centre notifications? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/service/notifications", { method: "DELETE" });
      if (res.ok) {
        repairs = [];
        stocks = [];
        selectedKind = null;
        selectedId = null;
        lastRepairFingerprint = "";
        lastStockFingerprint = "";
        renderRepairList();
        renderStockList();
        renderStats();
        detailContent.hidden = true;
        detailPlaceholder.hidden = false;
      }
    } catch (err) {
      console.error("Failed to clear service notifications", err);
    }
  });
}

initViewTabs();
fetchRepairs();
fetchStocks();
setInterval(() => {
  fetchRepairs();
  fetchStocks();
}, 4000);
