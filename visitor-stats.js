(function () {
  const visitorIdStorageKey = "sudoku-visitor-id";
  const statusEl = document.getElementById("visitorStatsStatus");
  const totalUvEl = document.getElementById("statsTotalUv");
  const todayUvEl = document.getElementById("statsTodayUv");
  const totalPvEl = document.getElementById("statsTotalPv");
  const trendEl = document.getElementById("statsTrend");
  const sourcesEl = document.getElementById("statsSources");

  if (!statusEl || !totalUvEl || !todayUvEl || !totalPvEl || !trendEl || !sourcesEl) {
    return;
  }

  function setStatus(text, tone) {
    statusEl.textContent = text;
    statusEl.classList.remove("is-error", "is-muted");
    if (tone === "error") {
      statusEl.classList.add("is-error");
      return;
    }
    if (tone === "muted") {
      statusEl.classList.add("is-muted");
    }
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

  function pickFirstNumber(source, keys) {
    for (const key of keys) {
      const value = source && source[key];
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return numeric;
    }
    return null;
  }

  function pickFirstArray(source, keys) {
    for (const key of keys) {
      if (Array.isArray(source && source[key])) return source[key];
    }
    return [];
  }

  function pickFirstString(source, keys) {
    for (const key of keys) {
      const value = source && source[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  }

  function generateVisitorId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    }
    return "visitor-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function getOrCreateVisitorId() {
    let visitorId = "";
    try {
      visitorId = localStorage.getItem(visitorIdStorageKey) || "";
      if (!visitorId) {
        visitorId = generateVisitorId();
        localStorage.setItem(visitorIdStorageKey, visitorId);
      }
    } catch (error) {
      visitorId = generateVisitorId();
    }
    return visitorId;
  }

  function normalizeChannelName(channel) {
    return channel || "direct";
  }

  function getSourceContext() {
    const pageUrl = new URL(window.location.href);
    const utmSource = (pageUrl.searchParams.get("utm_source") || "").trim();
    const utmMedium = (pageUrl.searchParams.get("utm_medium") || "").trim();
    const utmCampaign = (pageUrl.searchParams.get("utm_campaign") || "").trim();
    const referrer = document.referrer || "";
    let channel = "";

    if (utmSource) {
      channel = utmMedium ? utmSource + " / " + utmMedium : utmSource;
    } else if (referrer) {
      try {
        const referrerUrl = new URL(referrer);
        channel = referrerUrl.hostname.replace(/^www\./, "") || "referral";
      } catch (error) {
        channel = "referral";
      }
    }

    return {
      referrer: referrer,
      channel: normalizeChannelName(channel),
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign
    };
  }

  async function postTrack(payload) {
    const response = await fetch("/api/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      keepalive: true
    });

    if (!response.ok) {
      throw new Error("track request failed with status " + response.status);
    }
  }

  async function fetchStats() {
    const response = await fetch("/api/stats", {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("stats request failed with status " + response.status);
    }

    return response.json();
  }

  function normalizeTrendItem(item, index) {
    if (item == null) {
      return null;
    }
    if (typeof item === "number" || typeof item === "string") {
      const numeric = Number(item);
      if (!Number.isFinite(numeric)) return null;
      return {
        label: "第 " + (index + 1) + " 天",
        value: numeric
      };
    }

    const label = pickFirstString(item, ["date", "day", "label", "name"]) || "第 " + (index + 1) + " 天";
    const value = pickFirstNumber(item, ["value", "uv", "pv", "count", "visits", "total"]);
    if (!Number.isFinite(value)) {
      return null;
    }

    return { label: label, value: value };
  }

  function normalizeSourceItem(item, index) {
    if (item == null) {
      return null;
    }
    if (typeof item === "string") {
      return { label: item, value: 0 };
    }

    const label = pickFirstString(item, ["channel", "source", "label", "name"]) || "渠道 " + (index + 1);
    const value = pickFirstNumber(item, ["count", "pv", "uv", "value", "visits", "total"]);
    return {
      label: label,
      value: Number.isFinite(value) ? value : 0
    };
  }

  function unwrapPayload(payload) {
    if (payload && typeof payload === "object") {
      if (payload.data && typeof payload.data === "object") return payload.data;
      if (payload.stats && typeof payload.stats === "object") return payload.stats;
    }
    return payload || {};
  }

  function normalizeStats(payload) {
    const source = unwrapPayload(payload);
    return {
      totalUv: pickFirstNumber(source, ["total_uv", "uv", "totalVisitors", "total_visitors", "unique_visitors"]),
      todayUv: pickFirstNumber(source, ["today_uv", "today", "todayVisitors", "today_visitors", "daily_uv"]),
      totalPv: pickFirstNumber(source, ["total_pv", "pv", "totalPageViews", "page_views", "total_views"]),
      trend: pickFirstArray(source, ["recent_7d", "recent7d", "last_7_days", "trend", "daily_trend"])
        .map(normalizeTrendItem)
        .filter(Boolean)
        .slice(0, 7),
      sources: pickFirstArray(source, ["sources", "channels", "source_channels", "traffic_sources"])
        .map(normalizeSourceItem)
        .filter(Boolean)
    };
  }

  function renderTrend(items) {
    if (!items.length) {
      trendEl.innerHTML = '<div class="visitor-empty">暂无最近 7 日趋势数据</div>';
      return;
    }

    const max = Math.max.apply(null, items.map(function (item) {
      return item.value;
    })) || 1;

    trendEl.innerHTML = items.map(function (item) {
      const width = Math.max(8, Math.round(item.value / max * 100));
      return (
        '<div class="visitor-trend-row">' +
          '<span class="visitor-trend-label">' + escapeHtml(item.label) + "</span>" +
          '<div class="visitor-trend-bar" aria-hidden="true">' +
            '<div class="visitor-trend-fill" style="width:' + width + '%"></div>' +
          "</div>" +
          '<span class="visitor-trend-value">' + escapeHtml(formatNumber(item.value)) + "</span>" +
        "</div>"
      );
    }).join("");
  }

  function renderSources(items) {
    if (!items.length) {
      sourcesEl.innerHTML = '<div class="visitor-empty">暂无来源渠道数据</div>';
      return;
    }

    sourcesEl.innerHTML = items.map(function (item) {
      return (
        '<div class="visitor-source-row">' +
          '<span class="visitor-source-label">' + escapeHtml(item.label) + "</span>" +
          '<span class="visitor-source-value">' + escapeHtml(formatNumber(item.value)) + "</span>" +
        "</div>"
      );
    }).join("");
  }

  function renderStats(stats) {
    totalUvEl.textContent = formatNumber(stats.totalUv);
    todayUvEl.textContent = formatNumber(stats.todayUv);
    totalPvEl.textContent = formatNumber(stats.totalPv);
    renderTrend(stats.trend);
    renderSources(stats.sources);
  }

  async function initVisitorStats() {
    const visitorId = getOrCreateVisitorId();
    const sourceContext = getSourceContext();
    const payload = {
      visitor_id: visitorId,
      path: window.location.pathname,
      title: document.title,
      channel: sourceContext.channel,
      referrer: sourceContext.referrer,
      utm_source: sourceContext.utm_source,
      utm_medium: sourceContext.utm_medium,
      utm_campaign: sourceContext.utm_campaign,
      user_agent: navigator.userAgent,
      occurred_at: new Date().toISOString()
    };

    let trackError = null;
    setStatus("正在登记访问...", "muted");

    try {
      await postTrack(payload);
    } catch (error) {
      trackError = error;
      console.warn("[visitor-stats] track failed:", error);
    }

    try {
      const rawStats = await fetchStats();
      renderStats(normalizeStats(rawStats));
      setStatus(trackError ? "访问登记失败，当前先展示可用统计" : "统计已更新", trackError ? "muted" : "");
    } catch (error) {
      console.warn("[visitor-stats] stats failed:", error);
      setStatus("统计暂时不可用，请稍后刷新", "error");
      if (trackError) {
        console.warn("[visitor-stats] track also failed:", trackError);
      }
    }
  }

  initVisitorStats();
})();
