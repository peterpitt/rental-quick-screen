// 租屋快篩 — 應用程式進入點
// Feature 1：以卡片呈現物件。
// Feature 2：依核心條件（最高租金 / 最少房數 / 行政區）即時篩選。
// Feature 3：必備條件淘汰（缺一即出局），與軟性評分分開處理。
(function () {
  "use strict";

  const state = {
    all: [],
    filters: {
      maxRent: Infinity,
      minRooms: 0,
      district: "",
      // 必備條件：true 代表「一定要有」，缺少即淘汰。
      mustHave: { pets: false, elevator: false, nearMRT: false },
    },
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

  // 數值 / 類別條件（Feature 2）。
  function passesConstraints(l, f) {
    if (l.rent > f.maxRent) return false;
    if (l.rooms < f.minRooms) return false;
    if (f.district && l.district !== f.district) return false;
    return true;
  }

  // 必備條件（Feature 3）：勾選的項目，物件缺一即淘汰。
  function passesMustHaves(l, f) {
    const m = f.mustHave;
    if (m.pets && !l.petsAllowed) return false;
    if (m.elevator && !l.elevator) return false;
    if (m.nearMRT && !l.nearMRT) return false;
    return true;
  }

  // 完整篩選 = 數值條件 + 必備條件。
  function applyFilters(listings, f) {
    return listings.filter((l) => passesConstraints(l, f) && passesMustHaves(l, f));
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

  function renderEmptyState(message) {
    state.dom.results.innerHTML =
      '<p class="empty-state">' + escapeHtml(message) + "</p>";
  }

  function rerender() {
    const f = state.filters;
    // 先套數值條件，再套必備條件，才能分開算出「被必備條件淘汰」的數量。
    const afterConstraints = state.all.filter((l) => passesConstraints(l, f));
    const shown = afterConstraints.filter((l) => passesMustHaves(l, f));
    const knockedOut = afterConstraints.length - shown.length;

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
    const petsEl = document.getElementById("m-pets");
    const elevatorEl = document.getElementById("m-elevator");
    const mrtEl = document.getElementById("m-mrt");

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
    resetEl.addEventListener("click", function () {
      rentEl.value = RENT_MAX;
      roomsEl.value = "0";
      districtEl.value = "";
      petsEl.checked = false;
      elevatorEl.checked = false;
      mrtEl.checked = false;
      state.filters = {
        maxRent: Infinity,
        minRooms: 0,
        district: "",
        mustHave: { pets: false, elevator: false, nearMRT: false },
      };
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

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      applyFilters,
      passesConstraints,
      passesMustHaves,
      attributeChips,
      formatRent,
    };
  }
})();
