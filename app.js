// 租屋快篩 — 應用程式進入點
// Feature 1：載入物件資料並以卡片呈現。後續功能會在此基礎上擴充。
(function () {
  "use strict";

  const resultsEl = document.getElementById("results");
  const summaryEl = document.getElementById("summary");

  // --- 格式化工具 ---
  function formatRent(rent) {
    return "NT$ " + rent.toLocaleString("zh-Hant-TW");
  }

  // 一張卡片要顯示的屬性標籤（依物件有無動態產生）。
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

  // --- 文字處理：避免把資料直接塞進 innerHTML 造成 XSS ---
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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
    resultsEl.innerHTML = '<p class="empty-state">' + escapeHtml(message) + "</p>";
  }

  function render(listings) {
    if (!listings || listings.length === 0) {
      summaryEl.textContent = "";
      renderEmptyState("尚無物件資料。");
      return;
    }
    summaryEl.textContent = "共 " + listings.length + " 筆物件";
    resultsEl.innerHTML = listings.map(cardHtml).join("");
  }

  function init() {
    const listings = Array.isArray(window.LISTINGS) ? window.LISTINGS : [];
    render(listings);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
