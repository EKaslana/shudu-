(function () {
  const tabs = Array.from(document.querySelectorAll(".version-tab"));
  const statusEl = document.getElementById("statsStatus");
  const totalUvEl = document.getElementById("statsTotalUv");
  const todayUvEl = document.getElementById("statsTodayUv");
  const totalPvEl = document.getElementById("statsTotalPv");
  const trendEl = document.getElementById("statsTrend");
  const sourcesEl = document.getElementById("statsSources");

  let activeVersion = "9x9";

  function setStatus(text, tone) {
    statusEl.textContent = text;
    statusEl.classList.toggle("is-error", tone === "error");
  }

  function formatNumber(value) {
    return Number.isFinite(value) ? new Intl.NumberFormat("zh-CN").format(value) : "--";
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function renderTrend(items) {
    if (!items.length) {
      trendEl.innerHTML = '<div class="empty-state">暂无最近 7 日趋势数据</div>';
      return;
    }

    const max = Math.max.apply(null, items.map(function (item) {
      return Number(item.pv || item.uv || 0);
    })) || 1;

    trendEl.innerHTML = items.map(function (item) {
      const value = Number(item.pv || item.uv || 0);
      const width = Math.max(8, Math.round(value / max * 100));
      return (
        '<div class="trend-row">' +
          '<span class="trend-label">' + escapeHtml(item.date || item.day || "") + "</span>" +
          '<div class="trend-bar" aria-hidden="true">' +
            '<div class="trend-fill" style="width:' + width + '%"></div>' +
          "</div>" +
          '<span class="trend-value">' + escapeHtml(formatNumber(value)) + "</span>" +
        "</div>"
      );
    }).join("");
  }

  function renderSources(items) {
    if (!items.length) {
      sourcesEl.innerHTML = '<div class="empty-state">暂无来源渠道数据</div>';
      return;
    }

    sourcesEl.innerHTML = items.map(function (item) {
      return (
        '<div class="source-row">' +
          '<span class="source-label">' + escapeHtml(item.channel || "direct") + "</span>" +
          '<span class="source-value">' + escapeHtml(formatNumber(Number(item.visits || 0))) + "</span>" +
        "</div>"
      );
    }).join("");
  }

  function renderStats(payload) {
    totalUvEl.textContent = formatNumber(Number(payload.uv));
    todayUvEl.textContent = formatNumber(Number(payload.today_uv));
    totalPvEl.textContent = formatNumber(Number(payload.total_pv));
    renderTrend(Array.isArray(payload.trend) ? payload.trend : []);
    renderSources(Array.isArray(payload.sources) ? payload.sources : []);
  }

  async function loadStats(version) {
    setStatus("正在加载 " + version + " 统计...");
    try {
      const response = await fetch("/api/stats?version=" + encodeURIComponent(version), {
        headers: {
          Accept: "application/json"
        }
      });
      if (!response.ok) {
        throw new Error("stats request failed with status " + response.status);
      }
      const payload = await response.json();
      renderStats(payload);
      setStatus(version + " 统计已更新");
    } catch (error) {
      console.warn("[stats-dashboard] stats failed:", error);
      setStatus("统计暂时不可用，请稍后刷新", "error");
    }
  }

  function activateVersion(version) {
    activeVersion = version;
    tabs.forEach(function (tab) {
      const selected = tab.dataset.version === version;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    loadStats(activeVersion);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      activateVersion(tab.dataset.version || "9x9");
    });
  });

  activateVersion(activeVersion);
})();
