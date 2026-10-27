// 租屋快篩 — 應用程式進入點
// Feature 1：以卡片呈現物件。
// Feature 2：依核心條件（最高租金 / 最少房數 / 行政區）即時篩選。
(function () {
  "use strict";

  // 全部物件（來源資料）、目前篩選條件、以及 DOM 參照分開存放：
  // 來源不變，篩選只是對它做一次純函式運算，方便後續功能疊加。
  const state = {
    all: [],
    filters: { maxRent: Infinity, minRooms: 0, district: "" },
    dom: {},
  };

  const RENT_MAX = 60000; // 與 index.html 的 slider 上限一致

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

  // 篩選：純函式，輸入全部物件 + 條件，輸出符合的物件。
  function applyFilters(listings, filters) {
    return listings.filter(function (l) {
      if (l.rent > filters.maxRent) return false;
      if (l.rooms < filters.minRooms) return false;
      if (filters.district && l.district !== filters.district) return false;
      return true;
    });
  }

  function cardHtml(listing) {
    const chips = attributeChips(listing)
      .map((c) => '<li class="chip">' + escapeHtml(c) + "</li>")
      .join("");
    return (
      '<article class="card">' +
      '<div class="card-head">' +
      '<span class="card-district">' + escapeHtml(listing.district) + "</span>" +
      '<span class="card-rent">' + formatRent(listing.rent) + "<small>/月</small></span>" +
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

  // --- 以下為瀏覽器端（需要 DOM） ---
  function renderEmptyState(message) {
    state.dom.results.innerHTML =
      '<p class="empty-state">' + escapeHtml(message) + "</p>";
  }

  function rerender() {
    const shown = applyFilters(state.all, state.filters);
    if (state.all.length === 0) {
      state.dom.summary.textContent = "";
      renderEmptyState("尚無物件資料。");
      return;
    }
    if (shown.length === 0) {
      state.dom.summary.textContent = "共 0 筆（總物件 " + state.all.length + " 筆）";
      renderEmptyState("沒有符合條件的物件，試著放寬快篩條件。");
      return;
    }
    state.dom.summary.textContent =
      "共 " + shown.length + " 筆（總物件 " + state.all.length + " 筆）";
    state.dom.results.innerHTML = shown.map(cardHtml).join("");
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

    populateDistricts(districtEl, state.all);

    function syncRentLabel(value) {
      const v = Number(value);
      // 滑到最大值視為「不限」，避免排除掉最貴的物件。
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
    resetEl.addEventListener("click", function () {
      rentEl.value = RENT_MAX;
      roomsEl.value = "0";
      districtEl.value = "";
      state.filters = { maxRent: Infinity, minRooms: 0, district: "" };
      syncRentLabel(RENT_MAX);
      rerender();
    });

    syncRentLabel(rentEl.value);
  }

  function init() {
    state.dom.results = document.getElementById("results");
    state.dom.summary = document.getElementById("summary");
    state.all = Array.isArray(window.LISTINGS) ? window.LISTINGS : [];
    wireFilters();
    rerender();
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", init);
  }

  // 匯出純函式，供 Node 煙霧測試使用（瀏覽器端不受影響）。
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { applyFilters, attributeChips, formatRent };
  }
})();
