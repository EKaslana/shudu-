(function () {
  const visitorIdStorageKey = "sudoku-visitor-id";
  const currentScript = document.currentScript;
  const gameVersion = currentScript?.dataset.gameVersion || inferGameVersion();

  function inferGameVersion() {
    return window.location.pathname.startsWith("/shudu4") ? "4x4" : "9x9";
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

  async function initVisitorTracking() {
    const sourceContext = getSourceContext();
    const payload = {
      visitor_id: getOrCreateVisitorId(),
      game_version: gameVersion,
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

    try {
      await postTrack(payload);
    } catch (error) {
      console.warn("[visitor-stats] track failed:", error);
    }
  }

  initVisitorTracking();
})();
