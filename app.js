// 租屋快篩 — 應用程式進入點
// Feature 1：以卡片呈現物件。
// Feature 2：依核心條件（最高租金 / 最少房數 / 行政區）即時篩選。
// Feature 3：必備條件淘汰（缺一即出局），與軟性評分分開處理。
// Feature 4：以加權評分排名剩餘物件，分數透明顯示於卡片上。
// Feature 5：候選名單（星號 + localStorage 保存）與並排比較表。
(function () {
  "use strict";

  const SHORTLIST_KEY = "rqs.shortlist";

  const state = {
    all: [],
    filters: {
      maxRent: Infinity,
      minRooms: 0,
      district: "",
      mustHave: { pets: false, elevator: false, nearMRT: false },
    },
    sort: "score",
    shortlist: new Set(), // 已加入候選的物件 id
    dom: {},
  };

  const RENT_MAX = 60000;
  const WEIGHTS = { rent: 0.4, size: 0.25, commute: 0.25, furnished: 0.1 };

  // --- 純函式工具（可在 Node 測試） ---
  function formatRent(rent) {
    return "NT$ " + rent.toLocaleString("zh-Hant-TW");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function attributeChips(listing) {
    const chips = [];
    if (listing.elevator) chips.push("電梯");
    if (listing.petsAllowed) chips.push("可養寵物");
    if (listing.nearMRT) chips.push("近捷運 " + listing.minutesToMRT + " 分");
    if (listing.furnished) chips.push("附家具");
    if (listing.washerIncluded) chips.push("含洗衣機");
    if (listing.manageFeeIncluded) chips.push("含管理費");
    return chips;
  }

  function passesConstraints(l, f) {
    if (l.rent > f.maxRent) return false;
    if (l.rooms < f.minRooms) return false;
    if (f.district && l.district !== f.district) return false;
    return true;
  }

  function passesMustHaves(l, f) {
    const m = f.mustHave;
    if (m.pets && !l.petsAllowed) return false;
    if (m.elevator && !l.elevator) return false;
    if (m.nearMRT && !l.nearMRT) return false;
    return true;
  }

  function applyFilters(listings, f) {
    return listings.filter((l) => passesConstraints(l, f) && passesMustHaves(l, f));
  }

  function norm(value, min, max, invert) {
    if (max === min) return 0.5;
    const t = (value - min) / (max - min);
    return invert ? 1 - t : t;
  }

  function scoreListings(listings) {
    if (listings.length === 0) return [];
    const rents = listings.map((l) => l.rent);
    const sizes = listings.map((l) => l.size);
    const mins = listings.map((l) => l.minutesToMRT);
    const rMin = Math.min(...rents), rMax = Math.max(...rents);
    const sMin = Math.min(...sizes), sMax = Math.max(...sizes);
    const mMin = Math.min(...mins), mMax = Math.max(...mins);
    return listings.map((l) => {
      const fit =
        WEIGHTS.rent * norm(l.rent, rMin, rMax, true) +
        WEIGHTS.size * norm(l.size, sMin, sMax, false) +
        WEIGHTS.commute * norm(l.minutesToMRT, mMin, mMax, true) +
        WEIGHTS.furnished * (l.furnished ? 1 : 0);
      return { listing: l, score: Math.round(fit * 100) };
    });
  }

  function sortRows(rows, key) {
    const r = rows.slice();
    if (key === "rent") r.sort((a, b) => a.listing.rent - b.listing.rent);
    else if (key === "size") r.sort((a, b) => b.listing.size - a.listing.size);
    else if (key === "commute")
      r.sort((a, b) => a.listing.minutesToMRT - b.listing.minutesToMRT);
    else r.sort((a, b) => b.score - a.score);
    return r;
  }

  // 在一組數值中找出「最佳」的索引集合（可能並列）。lowerIsBetter 時取最小。
  function bestIndices(values, lowerIsBetter) {
    const best = lowerIsBetter ? Math.min(...values) : Math.max(...values);
    const set = new Set();
    values.forEach((v, i) => { if (v === best) set.add(i); });
    return set;
  }

  // --- 以下為瀏覽器端（需要 DOM / localStorage） ---
  function loadShortlist() {
    try {
      const raw = localStorage.getItem(SHORTLIST_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveShortlist(set) {
    try {
      localStorage.setItem(SHORTLIST_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
      /* 無痕模式或儲存被封鎖時，忽略即可，功能在本次瀏覽仍可用 */
    }
  }

  function cardHtml(listing, score) {
    const starred = state.shortlist.has(listing.id);
    const chips = attributeChips(listing)
      .map((c) => '<li class="chip">' + escapeHtml(c) + "</li>")
      .join("");
    return (
      '<article class="card">' +
      '<div class="card-head">' +
      '<span class="head-left">' +
      '<span class="card-district">' + escapeHtml(listing.district) + "</span>" +
      '<span class="score-badge" title="綜合評分">適配 ' + score + "</span>" +
      "</span>" +
      '<span class="head-right">' +
      '<span class="card-rent">' + formatRent(listing.rent) + "<small>/月</small></span>" +
      '<button type="button" class="star" data-star="' + escapeHtml(listing.id) +
      '" aria-pressed="' + (starred ? "true" : "false") +
      '" title="加入/移除候選">' + (starred ? "★" : "☆") + "</button>" +
      "</span>" +
      "</div>" +
      '<h2 class="card-title">' + escapeHtml(listing.title) + "</h2>" +
      '<p class="card-specs">' +
      escapeHtml(listing.layout) + " · " +
      escapeHtml(listing.size) + " 坪 · " +
      escapeHtml(listing.floor) + "/" + escapeHtml(listing.totalFloors) + " 樓" +
      "</p>" +
      '<ul class="chips">' + chips + "</ul>" +
      '<p class="card-foot">可入住：' + escapeHtml(listing.availableFrom) + "</p>" +
      "</article>"
    );
  }

  function renderEmptyState(message) {
    state.dom.results.innerHTML =
      '<p class="empty-state">' + escapeHtml(message) + "</p>";
  }

  // 比較表：以星號候選為欄，關鍵事實為列；數值列標出最佳儲存格。
  function renderCompare() {
    const picked = state.all.filter((l) => state.shortlist.has(l.id));
    const section = state.dom.compare;
    if (picked.length === 0) {
      section.hidden = true;
      section.innerHTML = "";
      return;
    }
    const scored = scoreListings(picked); // 相對於候選群的分數
    const scoreById = {};
    scored.forEach((r) => { scoreById[r.listing.id] = r.score; });

    const bestRent = bestIndices(picked.map((l) => l.rent), true);
    const bestSize = bestIndices(picked.map((l) => l.size), false);
    const bestCommute = bestIndices(picked.map((l) => l.minutesToMRT), true);
    const bestScore = bestIndices(picked.map((l) => scoreById[l.id]), false);

    function row(label, cells, bestSet) {
      const tds = cells
        .map((c, i) => {
          const cls = bestSet && bestSet.has(i) ? ' class="best"' : "";
          return "<td" + cls + ">" + c + "</td>";
        })
        .join("");
      return "<tr><th scope=\"row\">" + label + "</th>" + tds + "</tr>";
    }

    function yn(b) { return b ? "✔" : "—"; }

    const headCells = picked
      .map((l) => "<th scope=\"col\">" + escapeHtml(l.district) + "<br><small>" +
        escapeHtml(l.title) + "</small></th>")
      .join("");

    const html =
      "<h2 class=\"compare-title\">候選比較（" + picked.length + " 筆）</h2>" +
      '<div class="compare-scroll"><table class="compare-table">' +
      "<thead><tr><th scope=\"col\">項目</th>" + headCells + "</tr></thead>" +
      "<tbody>" +
      row("綜合評分", picked.map((l) => scoreById[l.id]), bestScore) +
      row("月租", picked.map((l) => formatRent(l.rent)), bestRent) +
      row("格局", picked.map((l) => escapeHtml(l.layout))) +
      row("坪數", picked.map((l) => l.size + " 坪"), bestSize) +
      row("樓層", picked.map((l) => l.floor + "/" + l.totalFloors)) +
      row("離捷運", picked.map((l) => l.minutesToMRT + " 分"), bestCommute) +
      row("可養寵物", picked.map((l) => yn(l.petsAllowed))) +
      row("電梯", picked.map((l) => yn(l.elevator))) +
      row("附家具", picked.map((l) => yn(l.furnished))) +
      row("押金", picked.map((l) => l.depositMonths + " 個月")) +
      row("可入住", picked.map((l) => escapeHtml(l.availableFrom))) +
      "</tbody></table></div>";

    section.innerHTML = html;
    section.hidden = false;
  }

  function updateShortlistBar() {
    const n = state.shortlist.size;
    state.dom.shortlistCount.textContent = "候選名單：" + n + " 筆";
    state.dom.compareBtn.disabled = n === 0;
    state.dom.clearBtn.disabled = n === 0;
  }

  function rerender() {
    const f = state.filters;
    const afterConstraints = state.all.filter((l) => passesConstraints(l, f));
    const shown = afterConstraints.filter((l) => passesMustHaves(l, f));
    const knockedOut = afterConstraints.length - shown.length;

    updateShortlistBar();

    if (state.all.length === 0) {
      state.dom.summary.textContent = "";
      renderEmptyState("尚無物件資料。");
      return;
    }

    let summary = "共 " + shown.length + " 筆（總物件 " + state.all.length + " 筆）";
    if (knockedOut > 0) summary += "，另有 " + knockedOut + " 筆因必備條件被淘汰";
    state.dom.summary.textContent = summary;

    if (shown.length === 0) {
      renderEmptyState("沒有符合條件的物件，試著放寬快篩或必備條件。");
      return;
    }

    const rows = sortRows(scoreListings(shown), state.sort);
    state.dom.results.innerHTML = rows
      .map((row) => cardHtml(row.listing, row.score))
      .join("");
  }

  function toggleShortlist(id) {
    if (state.shortlist.has(id)) state.shortlist.delete(id);
    else state.shortlist.add(id);
    saveShortlist(state.shortlist);
    rerender();
    // 比較表若正在顯示，同步更新內容。
    if (!state.dom.compare.hidden) renderCompare();
  }

  function populateDistricts(selectEl, listings) {
    const districts = Array.from(new Set(listings.map((l) => l.district))).sort();
    for (const d of districts) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      selectEl.appendChild(opt);
    }
  }

  function wireFilters() {
    const rentEl = document.getElementById("f-rent");
    const rentOut = document.getElementById("rent-output");
    const roomsEl = document.getElementById("f-rooms");
    const districtEl = document.getElementById("f-district");
    const resetEl = document.getElementById("f-reset");
    const petsEl = document.getElementById("m-pets");
    const elevatorEl = document.getElementById("m-elevator");
    const mrtEl = document.getElementById("m-mrt");
    const sortEl = document.getElementById("f-sort");

    populateDistricts(districtEl, state.all);

    function syncRentLabel(value) {
      const v = Number(value);
      rentOut.textContent = v >= RENT_MAX ? "不限" : formatRent(v) + " 以下";
      state.filters.maxRent = v >= RENT_MAX ? Infinity : v;
    }

    rentEl.addEventListener("input", function () {
      syncRentLabel(rentEl.value);
      rerender();
    });
    roomsEl.addEventListener("change", function () {
      state.filters.minRooms = Number(roomsEl.value);
      rerender();
    });
    districtEl.addEventListener("change", function () {
      state.filters.district = districtEl.value;
      rerender();
    });
    petsEl.addEventListener("change", function () {
      state.filters.mustHave.pets = petsEl.checked;
      rerender();
    });
    elevatorEl.addEventListener("change", function () {
      state.filters.mustHave.elevator = elevatorEl.checked;
      rerender();
    });
    mrtEl.addEventListener("change", function () {
      state.filters.mustHave.nearMRT = mrtEl.checked;
      rerender();
    });
    sortEl.addEventListener("change", function () {
      state.sort = sortEl.value;
      rerender();
    });
    resetEl.addEventListener("click", function () {
      rentEl.value = RENT_MAX;
      roomsEl.value = "0";
      districtEl.value = "";
      petsEl.checked = false;
      elevatorEl.checked = false;
      mrtEl.checked = false;
      sortEl.value = "score";
      state.filters = {
        maxRent: Infinity,
        minRooms: 0,
        district: "",
        mustHave: { pets: false, elevator: false, nearMRT: false },
      };
      state.sort = "score";
      syncRentLabel(RENT_MAX);
      rerender();
    });

    syncRentLabel(rentEl.value);
  }

  function wireShortlist() {
    // 卡片以 innerHTML 重繪，因此用事件委派處理星號點擊。
    state.dom.results.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-star]");
      if (!btn) return;
      toggleShortlist(btn.getAttribute("data-star"));
    });
    state.dom.compareBtn.addEventListener("click", function () {
      if (state.dom.compare.hidden) {
        renderCompare();
        state.dom.compareBtn.textContent = "收合比較";
      } else {
        state.dom.compare.hidden = true;
        state.dom.compareBtn.textContent = "比較候選";
      }
    });
    state.dom.clearBtn.addEventListener("click", function () {
      state.shortlist.clear();
      saveShortlist(state.shortlist);
      state.dom.compare.hidden = true;
      state.dom.compareBtn.textContent = "比較候選";
      rerender();
    });
  }

  function init() {
    state.dom.results = document.getElementById("results");
    state.dom.summary = document.getElementById("summary");
    state.dom.compare = document.getElementById("compare");
    state.dom.shortlistCount = document.getElementById("shortlist-count");
    state.dom.compareBtn = document.getElementById("compare-btn");
    state.dom.clearBtn = document.getElementById("clear-shortlist");

    state.all = Array.isArray(window.LISTINGS) ? window.LISTINGS : [];
    state.shortlist = loadShortlist();
    wireFilters();
    wireShortlist();
    rerender();
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", init);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      applyFilters,
      passesConstraints,
      passesMustHaves,
      scoreListings,
      sortRows,
      bestIndices,
      attributeChips,
      formatRent,
    };
  }
})();
