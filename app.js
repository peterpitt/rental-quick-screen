// 租屋快篩 — 應用程式進入點
// 目前只負責開機並顯示空狀態；後續功能會逐步加上。
(function () {
  "use strict";

  const resultsEl = document.getElementById("results");

  function renderEmptyState(message) {
    resultsEl.innerHTML = '<p class="empty-state">' + message + "</p>";
  }

  function init() {
    const listings = Array.isArray(window.LISTINGS) ? window.LISTINGS : [];
    if (listings.length === 0) {
      renderEmptyState("尚無物件資料。");
      return;
    }
    renderEmptyState("已載入 " + listings.length + " 筆物件（顯示功能開發中）。");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
