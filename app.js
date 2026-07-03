const state = {
  data: null,
  rows: [],
  metric: "netSales",
  compareMode: "previousPeriod",
  dateRange: {
    start: "",
    end: "",
    min: "",
    max: "",
  },
  comparisonRange: {
    start: "",
    end: "",
  },
  trendPoints: [],
  fourWeekHover: {
    weeks: [],
    series: [],
    points: [],
    plot: null,
  },
  fourWeekDimension: "vendor",
  productSort: {
    key: "netSales",
    direction: "desc",
  },
  visiblePanels: {
    status: true,
    vendors: true,
    departments: true,
    regions: true,
    productType: true,
    class: true,
    subClass: true,
    size: true,
    season: false,
  },
  filters: {
    week: "All",
    status: "All",
    release: "All",
    season: "All",
    size: "All",
    department: "All",
    productType: "All",
    className: "All",
    vendor: "All",
    search: "",
  },
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const oneDecimal = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const lineColors = ["#ff5a00", "#111111", "#f6a623", "#a36a3d", "#6f6a63", "#b00020"];

const elements = {
  sourceLabel: document.querySelector("#sourceLabel"),
  weekFilter: document.querySelector("#weekFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  releaseFilter: document.querySelector("#releaseFilter"),
  seasonFilter: document.querySelector("#seasonFilter"),
  sizeFilter: document.querySelector("#sizeFilter"),
  departmentFilter: document.querySelector("#departmentFilter"),
  productTypeFilter: document.querySelector("#productTypeFilter"),
  classFilter: document.querySelector("#classFilter"),
  vendorFilter: document.querySelector("#vendorFilter"),
  searchInput: document.querySelector("#searchInput"),
  resetButton: document.querySelector("#resetButton"),
  dateStart: document.querySelector("#dateStart"),
  dateEnd: document.querySelector("#dateEnd"),
  compareMode: document.querySelector("#compareMode"),
  compareStart: document.querySelector("#compareStart"),
  compareEnd: document.querySelector("#compareEnd"),
  resetDateButton: document.querySelector("#resetDateButton"),
  kpiSales: document.querySelector("#kpiSales"),
  kpiUnits: document.querySelector("#kpiUnits"),
  kpiAov: document.querySelector("#kpiAov"),
  kpiProducts: document.querySelector("#kpiProducts"),
  salesDelta: document.querySelector("#salesDelta"),
  unitsDelta: document.querySelector("#unitsDelta"),
  trendChart: document.querySelector("#trendChart"),
  trendTooltip: document.querySelector("#trendTooltip"),
  fourWeekChart: document.querySelector("#fourWeekChart"),
  fourWeekDimension: document.querySelector("#fourWeekDimension"),
  fourWeekLegend: document.querySelector("#fourWeekLegend"),
  fourWeekTooltip: document.querySelector("#fourWeekTooltip"),
  statusBars: document.querySelector("#statusBars"),
  vendorBars: document.querySelector("#vendorBars"),
  departmentBars: document.querySelector("#departmentBars"),
  productTypeBars: document.querySelector("#productTypeBars"),
  classBars: document.querySelector("#classBars"),
  subClassBars: document.querySelector("#subClassBars"),
  provinceBars: document.querySelector("#provinceBars"),
  seasonMix: document.querySelector("#seasonMix"),
  sizeBars: document.querySelector("#sizeBars"),
  productTable: document.querySelector("#productTable"),
  tableCount: document.querySelector("#tableCount"),
  metricButtons: document.querySelectorAll("[data-metric]"),
  sortButtons: document.querySelectorAll("[data-sort]"),
  panelToggles: document.querySelectorAll("[data-panel-toggle]"),
  panels: document.querySelectorAll("[data-panel]"),
  panelRows: document.querySelectorAll("[data-panel-row]"),
};

fetch("data/dashboard-data.json")
  .then((response) => response.json())
  .then((data) => {
    state.data = data;
    state.rows = data.rows.map(normalizeRow);
    setupFilters(data);
    bindEvents();
    render();
  })
  .catch((error) => {
    document.body.innerHTML = `<main class="empty">Could not load data/dashboard-data.json. ${error.message}</main>`;
  });

function normalizeRow(row) {
  return {
    ...row,
    date: row.date || "",
    status: row.status || "(blank)",
    release: row.release || "(blank)",
    season: row.season || "(blank)",
    size: row.size || "(blank)",
    department: row.department || "(blank)",
    productType: row.productType || "(blank)",
    class: row.class || "(blank)",
    subClass: row.subClass || "(blank)",
    vendor: row.vendor || "(blank)",
    netSales: Number(row.netSales) || 0,
    units: Number(row.units) || 0,
    inventory: Number(row.inventory) || 0,
  };
}

function setupFilters(data) {
  const source = data.sourceFiles.map((item) => `${item.week} (${item.rowCount} rows)`).join(", ");
  const dates = [...new Set(state.rows.map((row) => row.date).filter(Boolean))].sort();
  elements.sourceLabel.textContent = source;
  fillSelect(elements.weekFilter, ["All", ...sortWeeks(data.filters.weeks)]);
  elements.weekFilter.value = "All";
  fillSelect(elements.statusFilter, ["All", ...data.filters.statuses]);
  fillSelect(elements.releaseFilter, ["All", ...(data.filters.releases || [])]);
  fillSelect(elements.seasonFilter, ["All", ...(data.filters.seasons || [])]);
  fillSelect(elements.sizeFilter, ["All", ...(data.filters.sizes || [])]);
  fillSelect(elements.departmentFilter, ["All", ...data.filters.departments]);
  fillSelect(elements.productTypeFilter, ["All", ...(data.filters.productTypes || [])]);
  fillSelect(elements.classFilter, ["All", ...data.filters.classes]);
  fillSelect(elements.vendorFilter, ["All", ...data.filters.vendors]);

  state.dateRange.min = dates[0] || "";
  state.dateRange.max = dates[dates.length - 1] || "";
  state.dateRange.start = state.dateRange.min;
  state.dateRange.end = state.dateRange.max;
  for (const input of [elements.dateStart, elements.dateEnd]) {
    input.min = state.dateRange.min;
    input.max = state.dateRange.max;
  }
  for (const input of [elements.compareStart, elements.compareEnd]) {
    input.min = state.dateRange.min;
    input.max = state.dateRange.max;
  }
  elements.dateStart.value = state.dateRange.start;
  elements.dateEnd.value = state.dateRange.end;
  syncComparisonInputs();
}

function fillSelect(select, values, labeler = (value) => value) {
  select.innerHTML = values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labeler(value))}</option>`)
    .join("");
}

function bindEvents() {
  elements.weekFilter.addEventListener("change", (event) => {
    state.filters.week = event.target.value;
    render();
  });
  elements.dateStart.addEventListener("change", (event) => {
    state.dateRange.start = event.target.value;
    state.filters.week = "All";
    elements.weekFilter.value = "All";
    if (state.dateRange.end && state.dateRange.start > state.dateRange.end) {
      state.dateRange.end = state.dateRange.start;
      elements.dateEnd.value = state.dateRange.end;
    }
    if (state.compareMode !== "customRange") syncComparisonInputs();
    render();
  });
  elements.dateEnd.addEventListener("change", (event) => {
    state.dateRange.end = event.target.value;
    state.filters.week = "All";
    elements.weekFilter.value = "All";
    if (state.dateRange.start && state.dateRange.end < state.dateRange.start) {
      state.dateRange.start = state.dateRange.end;
      elements.dateStart.value = state.dateRange.start;
    }
    if (state.compareMode !== "customRange") syncComparisonInputs();
    render();
  });
  elements.resetDateButton.addEventListener("click", () => {
    state.dateRange.start = state.dateRange.min;
    state.dateRange.end = state.dateRange.max;
    state.filters.week = "All";
    elements.dateStart.value = state.dateRange.start;
    elements.dateEnd.value = state.dateRange.end;
    elements.weekFilter.value = "All";
    if (state.compareMode !== "customRange") syncComparisonInputs();
    render();
  });
  elements.compareMode.addEventListener("change", (event) => {
    state.compareMode = event.target.value;
    if (state.compareMode !== "customRange") syncComparisonInputs();
    updateComparisonInputState();
    render();
  });
  elements.compareStart.addEventListener("change", (event) => {
    state.compareMode = "customRange";
    elements.compareMode.value = "customRange";
    state.comparisonRange.start = event.target.value;
    if (state.comparisonRange.end && state.comparisonRange.start > state.comparisonRange.end) {
      state.comparisonRange.end = state.comparisonRange.start;
      elements.compareEnd.value = state.comparisonRange.end;
    }
    updateComparisonInputState();
    render();
  });
  elements.compareEnd.addEventListener("change", (event) => {
    state.compareMode = "customRange";
    elements.compareMode.value = "customRange";
    state.comparisonRange.end = event.target.value;
    if (state.comparisonRange.start && state.comparisonRange.end < state.comparisonRange.start) {
      state.comparisonRange.start = state.comparisonRange.end;
      elements.compareStart.value = state.comparisonRange.start;
    }
    updateComparisonInputState();
    render();
  });
  elements.statusFilter.addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    render();
  });
  elements.releaseFilter.addEventListener("change", (event) => {
    state.filters.release = event.target.value;
    render();
  });
  elements.seasonFilter.addEventListener("change", (event) => {
    state.filters.season = event.target.value;
    render();
  });
  elements.sizeFilter.addEventListener("change", (event) => {
    state.filters.size = event.target.value;
    render();
  });
  elements.departmentFilter.addEventListener("change", (event) => {
    state.filters.department = event.target.value;
    render();
  });
  elements.productTypeFilter.addEventListener("change", (event) => {
    state.filters.productType = event.target.value;
    render();
  });
  elements.classFilter.addEventListener("change", (event) => {
    state.filters.className = event.target.value;
    render();
  });
  elements.vendorFilter.addEventListener("change", (event) => {
    state.filters.vendor = event.target.value;
    render();
  });
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    render();
  });
  elements.resetButton.addEventListener("click", () => {
    state.filters = {
      week: "All",
      status: "All",
      release: "All",
      season: "All",
      size: "All",
      department: "All",
      productType: "All",
      className: "All",
      vendor: "All",
      search: "",
    };
    elements.weekFilter.value = "All";
    elements.statusFilter.value = "All";
    elements.releaseFilter.value = "All";
    elements.seasonFilter.value = "All";
    elements.sizeFilter.value = "All";
    elements.departmentFilter.value = "All";
    elements.productTypeFilter.value = "All";
    elements.classFilter.value = "All";
    elements.vendorFilter.value = "All";
    elements.searchInput.value = "";
    render();
  });
  elements.metricButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.metric = button.dataset.metric;
      elements.metricButtons.forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });
  elements.fourWeekDimension.addEventListener("change", (event) => {
    state.fourWeekDimension = event.target.value;
    renderFourWeekTrend(filteredRows());
  });
  elements.sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.sort;
      if (state.productSort.key === key) {
        state.productSort.direction = state.productSort.direction === "desc" ? "asc" : "desc";
      } else {
        state.productSort.key = key;
        state.productSort.direction = defaultSortDirection(key);
      }
      render();
    });
  });
  elements.panelToggles.forEach((toggle) => {
    const panel = toggle.dataset.panelToggle;
    toggle.checked = Boolean(state.visiblePanels[panel]);
    toggle.addEventListener("change", () => {
      state.visiblePanels[panel] = toggle.checked;
      renderPanelVisibility();
    });
  });
  elements.trendChart.addEventListener("mousemove", showTrendTooltip);
  elements.trendChart.addEventListener("mouseleave", hideTrendTooltip);
  elements.fourWeekChart.addEventListener("mousemove", showFourWeekTooltip);
  elements.fourWeekChart.addEventListener("mouseleave", hideFourWeekTooltip);
  window.addEventListener("resize", () => {
    const rows = filteredRows();
    renderTrend(rows);
    renderFourWeekTrend(rows);
  });
}

function filteredRows() {
  return state.rows.filter((row) => {
    return matchesFilters(row) && isInDateRange(row, state.dateRange.start, state.dateRange.end);
  });
}

function comparisonRows() {
  const previous = comparisonDateRange();
  if (!previous) return [];
  return state.rows.filter((row) => matchesFilters(row) && isInDateRange(row, previous.start, previous.end));
}

function matchesFilters(row) {
  const query = state.filters.search;
  if (state.filters.week !== "All" && row.week !== state.filters.week) return false;
  if (state.filters.status !== "All" && row.status !== state.filters.status) return false;
  if (state.filters.release !== "All" && row.release !== state.filters.release) return false;
  if (state.filters.season !== "All" && row.season !== state.filters.season) return false;
  if (state.filters.size !== "All" && row.size !== state.filters.size) return false;
  if (state.filters.department !== "All" && row.department !== state.filters.department) return false;
  if (state.filters.productType !== "All" && row.productType !== state.filters.productType) return false;
  if (state.filters.className !== "All" && row.class !== state.filters.className) return false;
  if (state.filters.vendor !== "All" && row.vendor !== state.filters.vendor) return false;
  if (!query) return true;
  return `${row.sku} ${row.title} ${row.vendor} ${row.productType} ${row.class} ${row.subClass} ${row.department} ${row.release} ${row.season} ${row.size}`
    .toLowerCase()
    .includes(query);
}

function isInDateRange(row, start, end) {
  if (start && row.date && row.date < start) return false;
  if (end && row.date && row.date > end) return false;
  return true;
}

function render() {
  const rows = filteredRows();
  const previousRows = comparisonRows();
  const totals = rollupTotals(rows);
  const previousTotals = rollupTotals(previousRows);
  const dates = [...new Set(rows.map((row) => row.date).filter(Boolean))].sort();

  elements.kpiSales.textContent = money.format(totals.netSales);
  elements.kpiUnits.textContent = oneDecimal.format(totals.units);
  elements.kpiAov.textContent = money.format(totals.units ? totals.netSales / totals.units : 0);
  elements.kpiProducts.textContent = oneDecimal.format(totals.products);

  const salesDelta = pctChange(totals.netSales, previousTotals.netSales);
  const unitsDelta = pctChange(totals.units, previousTotals.units);
  const comparison = comparisonDateRange();
  const comparisonLabel = comparison ? `${formatDate(comparison.start)} to ${formatDate(comparison.end)}` : "";
  elements.salesDelta.textContent = previousRows.length
    ? `${formatSignedMoney(totals.netSales - previousTotals.netSales)} (${formatPct(salesDelta)}) vs ${comparisonLabel}`
    : "No comparison";
  elements.salesDelta.className = previousRows.length && salesDelta < 0 ? "negative" : previousRows.length ? "positive" : "";
  elements.unitsDelta.textContent = previousRows.length
    ? `${formatSignedNumber(totals.units - previousTotals.units)} (${formatPct(unitsDelta)}) vs ${comparisonLabel}`
    : "Net quantity";
  elements.unitsDelta.className = previousRows.length && unitsDelta < 0 ? "negative" : previousRows.length ? "positive" : "";

  renderTrend(rows);
  renderFourWeekTrend(rows);
  renderBars(elements.statusBars, topGroups(rows, "status", 8), topGroups(previousRows, "status", 100), totals.netSales);
  renderBars(elements.vendorBars, topGroups(rows, "vendor", 8), topGroups(previousRows, "vendor", 100), totals.netSales);
  renderBars(elements.departmentBars, topGroups(rows, "department", 8), topGroups(previousRows, "department", 100), totals.netSales);
  renderBars(elements.provinceBars, topGroups(rows, "province", 8), topGroups(previousRows, "province", 100), totals.netSales);
  renderSeasonMix(rows);
  renderBars(elements.productTypeBars, topGroups(rows, "productType", 8), topGroups(previousRows, "productType", 100), totals.netSales);
  renderBars(elements.classBars, topGroups(rows, "class", 8), topGroups(previousRows, "class", 100), totals.netSales);
  renderBars(elements.subClassBars, topGroups(rows, "subClass", 8), topGroups(previousRows, "subClass", 100), totals.netSales);
  renderBars(elements.sizeBars, topGroups(rows, "size", 8), topGroups(previousRows, "size", 100), totals.netSales);
  renderProducts(topProducts(rows, 40, previousRows, totals.netSales), totals.netSales);
  renderPanelVisibility();
}

function rollupTotals(rows) {
  const products = new Set();
  const totals = rows.reduce(
    (acc, row) => {
      acc.netSales += Number(row.netSales) || 0;
      acc.units += Number(row.units) || 0;
      products.add(row.title);
      return acc;
    },
    { netSales: 0, units: 0, products: 0 },
  );
  totals.products = products.size;
  return totals;
}

function weekComparison(rows) {
  const byWeek = groupMetric(rows, "week");
  const weeks = Object.keys(byWeek).sort();
  if (weeks.length < 2) {
    return {
      salesLabel: "Add another week for WoW",
      salesClass: "",
      unitsLabel: "Net quantity",
      unitsClass: "",
    };
  }
  const latest = weeks[weeks.length - 1];
  const previous = weeks[weeks.length - 2];
  const salesDelta = pctChange(byWeek[latest].netSales, byWeek[previous].netSales);
  const unitsDelta = pctChange(byWeek[latest].units, byWeek[previous].units);
  return {
    salesLabel: `${formatPct(salesDelta)} vs ${previous}`,
    salesClass: salesDelta >= 0 ? "positive" : "negative",
    unitsLabel: `${formatPct(unitsDelta)} vs ${previous}`,
    unitsClass: unitsDelta >= 0 ? "positive" : "negative",
  };
}

function groupMetric(rows, key) {
  return rows.reduce((acc, row) => {
    const name = row[key] || "(blank)";
    acc[name] ||= { name, netSales: 0, units: 0 };
    acc[name].netSales += Number(row.netSales) || 0;
    acc[name].units += Number(row.units) || 0;
    return acc;
  }, {});
}

function topGroups(rows, key, limit) {
  return Object.values(groupMetric(rows, key))
    .sort((a, b) => b.netSales - a.netSales)
    .slice(0, limit);
}

function topProducts(rows, limit, previousRows = [], totalSales = 0) {
  const previousByTitle = previousRows.reduce((acc, row) => {
    acc[row.title] ||= { netSales: 0, units: 0 };
    acc[row.title].netSales += Number(row.netSales) || 0;
    acc[row.title].units += Number(row.units) || 0;
    return acc;
  }, {});

  const grouped = rows.reduce((acc, row) => {
    acc[row.title] ||= {
      name: row.title,
      sku: row.sku,
      image: row.image,
      vendor: row.vendor,
      productType: row.productType,
      statuses: new Set(),
      release: row.release,
      season: row.season,
      department: row.department,
      class: row.class,
      subClass: row.subClass,
      netSales: 0,
      units: 0,
      inventory: null,
      inventoryDate: "",
      sizes: new Set(),
      weeks: {},
      previousSales: previousByTitle[row.title]?.netSales || 0,
      previousUnits: previousByTitle[row.title]?.units || 0,
      share: 0,
      salesChange: 0,
      unitsChange: 0,
    };
    acc[row.title].netSales += Number(row.netSales) || 0;
    acc[row.title].units += Number(row.units) || 0;
    acc[row.title].sizes.add(row.size);
    acc[row.title].statuses.add(row.status);
    if (!acc[row.title].inventoryDate || row.date > acc[row.title].inventoryDate) {
      acc[row.title].inventoryDate = row.date;
      acc[row.title].inventory = Number(row.inventory) || 0;
    } else if (row.date === acc[row.title].inventoryDate) {
      acc[row.title].inventory = Math.min(acc[row.title].inventory, Number(row.inventory) || 0);
    }
    acc[row.title].weeks[row.week] ||= 0;
    acc[row.title].weeks[row.week] += Number(row.netSales) || 0;
    return acc;
  }, {});

  return sortProducts(
    Object.values(grouped).map((product) => ({
      ...product,
      share: totalSales ? product.netSales / totalSales : 0,
      salesChange: product.netSales - product.previousSales,
      unitsChange: product.units - product.previousUnits,
    })),
  )
    .slice(0, limit);
}

function renderBars(container, rows, previousRows = [], totalSales = 0) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty">No matching data</div>`;
    return;
  }
  const previousMap = Object.fromEntries(previousRows.map((row) => [row.name, row]));
  const max = Math.max(...rows.map((row) => Math.abs(row.netSales)), 1);
  container.innerHTML = rows
    .map((row) => {
      const width = Math.max((Math.abs(row.netSales) / max) * 100, 2);
      const previous = previousMap[row.name];
      const delta = previous ? pctChange(row.netSales, previous.netSales) : null;
      const deltaClass = delta === null ? "" : delta >= 0 ? "positive" : "negative";
      const deltaLabel = delta === null ? "-" : formatPct(delta);
      const share = totalSales ? row.netSales / totalSales : 0;
      return `
        <div class="bar-row">
          <div class="bar-meta">
            <strong title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</strong>
            <span>${money.format(row.netSales)} <b>${formatPctPlain(share)}</b> <em class="${deltaClass}">${deltaLabel}</em></span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSeasonMix(rows) {
  const groups = topGroups(rows, "season", 100);
  const total = rows.reduce(
    (acc, row) => {
      acc.netSales += row.netSales;
      acc.units += row.units;
      return acc;
    },
    { netSales: 0, units: 0 },
  );

  if (!groups.length) {
    elements.seasonMix.innerHTML = `<div class="empty">No matching seasons</div>`;
    return;
  }

  elements.seasonMix.innerHTML = `
    <table class="mini-table">
      <thead>
        <tr>
          <th>Season</th>
          <th class="num">% Net Sales</th>
          <th class="num">Sum of Net Sales</th>
          <th class="num">Sum of Net Quantity</th>
        </tr>
      </thead>
      <tbody>
        ${groups
          .map((row) => {
            const pct = total.netSales ? row.netSales / total.netSales : 0;
            return `
              <tr>
                <td>${escapeHtml(row.name)}</td>
                <td class="num pct-cell">
                  <span class="pct-bar" style="width:${Math.min(Math.abs(pct) * 100, 100)}%"></span>
                  <span class="${pct < 0 ? "negative" : ""}">${formatPctPlain(pct)}</span>
                </td>
                <td class="num ${row.netSales < 0 ? "negative" : ""}">${money.format(row.netSales)}</td>
                <td class="num ${row.units < 0 ? "negative" : ""}">${oneDecimal.format(row.units)}</td>
              </tr>
            `;
          })
          .join("")}
        <tr class="total-row">
          <td>Grand Total</td>
          <td class="num">100.0%</td>
          <td class="num">${money.format(total.netSales)}</td>
          <td class="num">${oneDecimal.format(total.units)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderProducts(products, totalSales = 0) {
  updateSortButtons();
  elements.tableCount.textContent = `${products.length} products`;
  if (!products.length) {
    elements.productTable.innerHTML = `<tr><td class="empty" colspan="12">No matching products</td></tr>`;
    return;
  }
  elements.productTable.innerHTML = products
    .map((product) => {
      const share = totalSales ? product.netSales / totalSales : 0;
      const salesDelta = pctChange(product.netSales, product.previousSales);
      const unitsDelta = pctChange(product.units, product.previousUnits);
      const salesDeltaClass = product.previousSales ? (salesDelta >= 0 ? "positive" : "negative") : "";
      const unitsDeltaClass = product.previousUnits ? (unitsDelta >= 0 ? "positive" : "negative") : "";
      return `
        <tr>
          <td>
            <div class="product-cell">
              <img class="thumb" src="${escapeAttr(product.image)}" alt="" loading="lazy" />
              <div>
                <div class="product-title" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</div>
                <div class="sku-line">${escapeHtml(product.sku || "")}</div>
              </div>
            </div>
          </td>
          <td>${escapeHtml(product.vendor)}</td>
          <td>${escapeHtml(statusLabel(product.statuses))}</td>
          <td>${escapeHtml(product.release || "")}</td>
          <td>${escapeHtml(product.season || "")}</td>
          <td>${escapeHtml(sizeLabel(product.sizes))}</td>
          <td class="num">${money.format(product.netSales)}</td>
          <td class="num">${oneDecimal.format(product.units)}</td>
          <td class="num">${formatPctPlain(share)}</td>
          <td class="num">${oneDecimal.format(product.inventory)}</td>
          <td class="num ${salesDeltaClass}">${product.previousSales ? `${formatSignedMoney(product.salesChange)} (${formatPct(salesDelta)})` : "-"}</td>
          <td class="num ${unitsDeltaClass}">${product.previousUnits ? `${formatSignedNumber(product.unitsChange)} (${formatPct(unitsDelta)})` : "-"}</td>
        </tr>
      `;
    })
    .join("");
}

function sortProducts(products) {
  const { key, direction } = state.productSort;
  const multiplier = direction === "asc" ? 1 : -1;
  return products.sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    if (typeof left === "number" && typeof right === "number") {
      if (left === right) return b.netSales - a.netSales;
      return (left - right) * multiplier;
    }
    const result = String(left).localeCompare(String(right));
    if (result === 0) return b.netSales - a.netSales;
    return result * multiplier;
  });
}

function sortValue(product, key) {
  if (key === "status") return statusLabel(product.statuses);
  if (key === "vendor") return product.vendor || "";
  if (key === "name") return product.name || "";
  if (key === "share") return product.share;
  if (key === "salesChange") return product.salesChange;
  if (key === "unitsChange") return product.unitsChange;
  return Number(product[key]) || 0;
}

function defaultSortDirection(key) {
  return ["name", "vendor", "status"].includes(key) ? "asc" : "desc";
}

function updateSortButtons() {
  elements.sortButtons.forEach((button) => {
    const active = button.dataset.sort === state.productSort.key;
    button.classList.toggle("active", active);
    button.classList.toggle("asc", active && state.productSort.direction === "asc");
    button.classList.toggle("desc", active && state.productSort.direction === "desc");
  });
}

function renderPanelVisibility() {
  elements.panels.forEach((panel) => {
    panel.hidden = !state.visiblePanels[panel.dataset.panel];
  });
  elements.panelRows.forEach((row) => {
    const panels = [...row.querySelectorAll("[data-panel]")];
    row.hidden = panels.length > 0 && panels.every((panel) => panel.hidden);
  });
}

function renderTrend(rows) {
  const canvas = elements.trendChart;
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(rect.width * ratio, 320);
  canvas.height = 260 * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const grouped = Object.values(groupMetric(rows, "date")).sort((a, b) => a.name.localeCompare(b.name));
  context.clearRect(0, 0, rect.width, 260);
  state.trendPoints = drawChart(context, rect.width, 260, grouped, state.metric);
}

function renderFourWeekTrend(rows) {
  const canvas = elements.fourWeekChart;
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const height = 260;
  canvas.width = Math.max(rect.width * ratio, 320);
  canvas.height = height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, rect.width, height);

  const weeks = [...new Set(rows.map((row) => row.week).filter(Boolean))]
    .sort((a, b) => weekNumber(a) - weekNumber(b))
    .slice(-4);

  if (!weeks.length) {
    drawEmptyChart(context, rect.width, height, "No matching weekly data");
    elements.fourWeekLegend.innerHTML = "";
    state.fourWeekHover = { weeks: [], series: [], points: [], plot: null };
    return;
  }

  const weekSet = new Set(weeks);
  const dimension = state.fourWeekDimension;
  const grouped = rows
    .filter((row) => weekSet.has(row.week))
    .reduce((acc, row) => {
      const name = row[dimension] || "(blank)";
      acc[name] ||= {
        name,
        total: 0,
        values: Object.fromEntries(weeks.map((week) => [week, 0])),
        sales: Object.fromEntries(weeks.map((week) => [week, 0])),
        units: Object.fromEntries(weeks.map((week) => [week, 0])),
      };
      const value = Number(row[state.metric]) || 0;
      acc[name].values[row.week] += value;
      acc[name].sales[row.week] += Number(row.netSales) || 0;
      acc[name].units[row.week] += Number(row.units) || 0;
      acc[name].total += value;
      return acc;
    }, {});

  const series = Object.values(grouped)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  if (!series.length) {
    drawEmptyChart(context, rect.width, height, "No matching weekly data");
    elements.fourWeekLegend.innerHTML = "";
    state.fourWeekHover = { weeks: [], series: [], points: [], plot: null };
    return;
  }

  state.fourWeekHover = drawMultiLineChart(context, rect.width, height, weeks, series, state.metric);
  elements.fourWeekLegend.innerHTML = series
    .map((item, index) => {
      const color = lineColors[index % lineColors.length];
      return `<span><i style="background:${color}"></i>${escapeHtml(item.name)}</span>`;
    })
    .join("");
}

function drawChart(context, width, height, points, metric) {
  const pad = { top: 18, right: 20, bottom: 40, left: 58 };
  const chartWidth = Math.max(width - pad.left - pad.right, 1);
  const chartHeight = height - pad.top - pad.bottom;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#dbe3e1";
  context.lineWidth = 1;
  context.font = "12px system-ui, sans-serif";
  context.fillStyle = "#66726f";

  if (!points.length) {
    context.fillText("No matching data", pad.left, height / 2);
    return [];
  }

  const values = points.map((point) => Number(point[metric]) || 0);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (chartHeight / 4) * i;
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
    const value = max - (span / 4) * i;
    context.fillText(metric === "netSales" ? money.format(value) : oneDecimal.format(value), 8, y + 4);
  }

  const step = chartWidth / Math.max(points.length - 1, 1);
  const coords = points.map((point, index) => {
    const x = pad.left + step * index;
    const y = pad.top + chartHeight - ((point[metric] - min) / span) * chartHeight;
    return { x, y, point };
  });

  context.strokeStyle = "#ff5a00";
  context.lineWidth = 3;
  context.beginPath();
  drawSmoothPath(context, coords);
  context.stroke();

  coords.forEach((coord, index) => {
    if (index === 0 || index === coords.length - 1 || points.length <= 9) {
      context.save();
      context.translate(coord.x, height - 16);
      context.rotate(points.length > 7 ? -0.55 : 0);
      context.fillStyle = "#66726f";
      context.textAlign = points.length > 7 ? "right" : "center";
      context.fillText(shortLabel(coord.point.name), 0, 0);
      context.restore();
    }
  });
  return coords;
}

function drawMultiLineChart(context, width, height, weeks, series, metric) {
  const pad = { top: 18, right: 20, bottom: 38, left: 62 };
  const chartWidth = Math.max(width - pad.left - pad.right, 1);
  const chartHeight = height - pad.top - pad.bottom;
  const values = series.flatMap((item) => weeks.map((week) => item.values[week] || 0));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#dbe3e1";
  context.lineWidth = 1;
  context.font = "12px system-ui, sans-serif";
  context.fillStyle = "#66726f";

  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (chartHeight / 4) * i;
    const value = max - (span / 4) * i;
    context.beginPath();
    context.moveTo(pad.left, y);
    context.lineTo(width - pad.right, y);
    context.stroke();
    context.fillText(metric === "netSales" ? money.format(value) : oneDecimal.format(value), 8, y + 4);
  }

  const step = chartWidth / Math.max(weeks.length - 1, 1);
  const pointGrid = [];
  series.forEach((item, index) => {
    const color = lineColors[index % lineColors.length];
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    const coords = weeks.map((week, weekIndex) => {
      const x = pad.left + step * weekIndex;
      const value = item.values[week] || 0;
      const y = pad.top + chartHeight - ((value - min) / span) * chartHeight;
      return { x, y, week, value, name: item.name, color };
    });
    pointGrid[index] = coords;
    drawSmoothPath(context, coords);
    context.stroke();
  });

  weeks.forEach((week, index) => {
    const x = pad.left + step * index;
    context.fillStyle = "#66726f";
    context.textAlign = "center";
    context.fillText(week, x, height - 14);
  });
  context.textAlign = "left";
  return {
    weeks,
    series,
    points: pointGrid,
    plot: {
      left: pad.left,
      right: width - pad.right,
      top: pad.top,
      bottom: pad.top + chartHeight,
      step,
    },
  };
}

function drawSmoothPath(context, coords) {
  if (!coords.length) return;
  if (coords.length < 3) {
    coords.forEach((coord, index) => {
      if (index === 0) context.moveTo(coord.x, coord.y);
      else context.lineTo(coord.x, coord.y);
    });
    return;
  }

  context.moveTo(coords[0].x, coords[0].y);
  for (let i = 0; i < coords.length - 1; i += 1) {
    const current = coords[i];
    const next = coords[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    context.quadraticCurveTo(current.x, current.y, midX, midY);
  }
  const last = coords[coords.length - 1];
  context.lineTo(last.x, last.y);
}

function drawEmptyChart(context, width, height, label) {
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#66726f";
  context.font = "12px system-ui, sans-serif";
  context.fillText(label, 58, height / 2);
}

function pctChange(current, previous) {
  if (!previous) return current ? 1 : 0;
  return (current - previous) / Math.abs(previous);
}

function comparisonDateRange() {
  if (state.compareMode === "none") return null;
  if (state.compareMode === "customRange") {
    if (!state.comparisonRange.start || !state.comparisonRange.end) return null;
    return {
      start: state.comparisonRange.start,
      end: state.comparisonRange.end,
    };
  }
  if (!state.dateRange.start || !state.dateRange.end) return null;
  const start = parseDate(state.dateRange.start);
  const end = parseDate(state.dateRange.end);
  const days = Math.max(Math.round((end - start) / 86400000) + 1, 1);
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - (state.compareMode === "previousWeek" ? 7 : 1));
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days + 1);
  return {
    start: toIsoDate(previousStart),
    end: toIsoDate(previousEnd),
  };
}

function syncComparisonInputs() {
  const comparison = comparisonDateRange();
  if (comparison) {
    state.comparisonRange.start = comparison.start;
    state.comparisonRange.end = comparison.end;
  } else if (!state.comparisonRange.start || !state.comparisonRange.end) {
    state.comparisonRange.start = state.dateRange.min;
    state.comparisonRange.end = state.dateRange.min;
  }
  elements.compareStart.value = state.comparisonRange.start;
  elements.compareEnd.value = state.comparisonRange.end;
  updateComparisonInputState();
}

function updateComparisonInputState() {
  const disabled = state.compareMode === "none";
  elements.compareStart.disabled = disabled;
  elements.compareEnd.disabled = disabled;
  elements.compareStart.closest("label").classList.toggle("muted-control", disabled);
  elements.compareEnd.closest("label").classList.toggle("muted-control", disabled);
}

function showTrendTooltip(event) {
  if (!state.trendPoints.length) return;
  const rect = elements.trendChart.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const nearest = state.trendPoints.reduce((best, point) => {
    return Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best;
  }, state.trendPoints[0]);
  if (Math.abs(nearest.x - x) > 34) {
    hideTrendTooltip();
    return;
  }
  renderTrend(filteredRows());
  const context = elements.trendChart.getContext("2d");
  drawHoverGuide(context, nearest.x, nearest.y, 18, 220, "#111111");
  elements.trendTooltip.hidden = false;
  elements.trendTooltip.innerHTML = `
    <strong>${escapeHtml(formatDate(nearest.point.name))}</strong>
    <span>Sales ${escapeHtml(money.format(nearest.point.netSales))}</span>
    <span>Units ${escapeHtml(oneDecimal.format(nearest.point.units))}</span>
  `;
  const left = Math.min(Math.max(nearest.x + 10, 8), rect.width - 150);
  const top = Math.max(nearest.y - 66, 8);
  elements.trendTooltip.style.left = `${left}px`;
  elements.trendTooltip.style.top = `${top}px`;
}

function hideTrendTooltip() {
  elements.trendTooltip.hidden = true;
  renderTrend(filteredRows());
}

function showFourWeekTooltip(event) {
  const hover = state.fourWeekHover;
  if (!hover.weeks.length || !hover.plot) return;
  const rect = elements.fourWeekChart.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const nearestIndex = hover.weeks.reduce((bestIndex, week, index) => {
    const pointX = hover.plot.left + hover.plot.step * index;
    const bestX = hover.plot.left + hover.plot.step * bestIndex;
    return Math.abs(pointX - x) < Math.abs(bestX - x) ? index : bestIndex;
  }, 0);
  const guideX = hover.plot.left + hover.plot.step * nearestIndex;
  if (Math.abs(guideX - x) > Math.max(42, hover.plot.step / 2)) {
    hideFourWeekTooltip();
    return;
  }

  renderFourWeekTrend(filteredRows());
  const context = elements.fourWeekChart.getContext("2d");
  drawHoverGuide(context, guideX, null, hover.plot.top, hover.plot.bottom, "#111111");
  const week = hover.weeks[nearestIndex];
  const lines = hover.series
    .map((item, index) => {
      const color = lineColors[index % lineColors.length];
      return `
        <span>
          <i style="background:${color}"></i>
          <em>${escapeHtml(item.name)}</em>
          <b>${escapeHtml(money.format(item.sales[week] || 0))}</b>
          <small>${escapeHtml(oneDecimal.format(item.units[week] || 0))} units</small>
        </span>
      `;
    })
    .join("");
  const totalSales = hover.series.reduce((sum, item) => sum + (item.sales[week] || 0), 0);
  const totalUnits = hover.series.reduce((sum, item) => sum + (item.units[week] || 0), 0);
  elements.fourWeekTooltip.hidden = false;
  elements.fourWeekTooltip.innerHTML = `
    <strong>${escapeHtml(week)}</strong>
    <span>Total sales ${escapeHtml(money.format(totalSales))}</span>
    <span>Total units ${escapeHtml(oneDecimal.format(totalUnits))}</span>
    <div class="tooltip-lines">${lines}</div>
  `;
  const left = Math.min(Math.max(guideX + 12, 8), rect.width - 230);
  elements.fourWeekTooltip.style.left = `${left}px`;
  elements.fourWeekTooltip.style.top = `${Math.max(hover.plot.top + 8, 8)}px`;
}

function hideFourWeekTooltip() {
  elements.fourWeekTooltip.hidden = true;
  renderFourWeekTrend(filteredRows());
}

function drawHoverGuide(context, x, y, top, bottom, color) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.setLineDash([4, 4]);
  context.beginPath();
  context.moveTo(x, top);
  context.lineTo(x, bottom);
  context.stroke();
  context.setLineDash([]);
  if (typeof y === "number") {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, 4.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(x, y, 2, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function formatPct(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function formatPctPlain(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSignedMoney(value) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${money.format(value)}`;
}

function formatSignedNumber(value) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${oneDecimal.format(value)}`;
}

function sortWeeks(weeks) {
  return [...weeks].sort((a, b) => weekNumber(b) - weekNumber(a));
}

function weekNumber(value) {
  const match = String(value || "").match(/WK\s*(\d+)/i);
  return match ? Number(match[1]) : -1;
}

function seasonSort(a, b) {
  const parsedA = parseSeason(a);
  const parsedB = parseSeason(b);
  if (parsedA.year !== parsedB.year) return parsedB.year - parsedA.year;
  if (parsedA.rank !== parsedB.rank) return parsedA.rank - parsedB.rank;
  return a.localeCompare(b);
}

function parseSeason(value) {
  const match = String(value || "").match(/^([A-Z])\s*(\d{2})$/i);
  const ranks = { U: 1, P: 2, F: 3, H: 4 };
  if (!match) return { year: -1, rank: 99 };
  return { year: Number(match[2]), rank: ranks[match[1].toUpperCase()] || 50 };
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function toIsoDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function sizeLabel(sizes) {
  const values = [...sizes].filter((value) => value && value !== "(blank)").sort();
  if (!values.length) return "";
  if (values.length <= 4) return values.join(", ");
  return `${values.slice(0, 4).join(", ")} +${values.length - 4}`;
}

function statusLabel(statuses) {
  const values = [...statuses].filter((value) => value && value !== "(blank)");
  const hasMarkdown = values.some((value) => /markdown/i.test(value));
  const hasFullPrice = values.some((value) => /full\s*price/i.test(value));
  if (hasMarkdown && hasFullPrice) return "Markdown + Full Price";
  return values.sort().join(" + ") || "";
}

function shortLabel(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  return value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value || "");
}
