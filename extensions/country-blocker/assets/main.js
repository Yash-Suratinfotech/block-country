// extensions/country-blocker/assets/enhanced-main.js
(async () => {
  try {
    // Enhanced blocking and analytics script with redirect support

    // Utility functions
    function generateSessionId() {
      return (
        "session_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now()
      );
    }

    function guessCountryCode() {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const timezoneToCountry = {
        "America/New_York": "US",
        "America/Chicago": "US",
        "America/Los_Angeles": "US",
        "America/Denver": "US",
        "America/Phoenix": "US",
        "America/Anchorage": "US",
        "America/Toronto": "CA",
        "America/Vancouver": "CA",
        "America/Mexico_City": "MX",
        "America/Sao_Paulo": "BR",
        "America/Buenos_Aires": "AR",
        "Europe/London": "GB",
        "Europe/Paris": "FR",
        "Europe/Berlin": "DE",
        "Europe/Rome": "IT",
        "Europe/Madrid": "ES",
        "Europe/Amsterdam": "NL",
        "Europe/Brussels": "BE",
        "Europe/Zurich": "CH",
        "Europe/Vienna": "AT",
        "Europe/Warsaw": "PL",
        "Europe/Prague": "CZ",
        "Europe/Budapest": "HU",
        "Europe/Athens": "GR",
        "Europe/Stockholm": "SE",
        "Europe/Oslo": "NO",
        "Europe/Copenhagen": "DK",
        "Europe/Helsinki": "FI",
        "Europe/Moscow": "RU",
        "Europe/Istanbul": "TR",
        "Africa/Cairo": "EG",
        "Africa/Johannesburg": "ZA",
        "Africa/Lagos": "NG",
        "Africa/Nairobi": "KE",
        "Asia/Dubai": "AE",
        "Asia/Jerusalem": "IL",
        "Asia/Riyadh": "SA",
        "Asia/Tehran": "IR",
        "Asia/Karachi": "PK",
        "Asia/Kolkata": "IN",
        "Asia/Calcutta": "IN",
        "Asia/Dhaka": "BD",
        "Asia/Bangkok": "TH",
        "Asia/Jakarta": "ID",
        "Asia/Singapore": "SG",
        "Asia/Kuala_Lumpur": "MY",
        "Asia/Manila": "PH",
        "Asia/Hong_Kong": "HK",
        "Asia/Shanghai": "CN",
        "Asia/Beijing": "CN",
        "Asia/Tokyo": "JP",
        "Asia/Seoul": "KR",
        "Australia/Sydney": "AU",
        "Australia/Melbourne": "AU",
        "Australia/Brisbane": "AU",
        "Australia/Perth": "AU",
        "Pacific/Auckland": "NZ",
        "Pacific/Honolulu": "US",
      };
      return timezoneToCountry[timezone] || null;
    }

    function detectDeviceType() {
      const userAgent = navigator.userAgent;
      if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
        return "tablet";
      }
      if (
        /mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(
          userAgent
        )
      ) {
        return "mobile";
      }
      return "desktop";
    }

    function detectBrowser() {
      const userAgent = navigator.userAgent;
      if (userAgent.includes("Chrome")) return "Chrome";
      if (userAgent.includes("Firefox")) return "Firefox";
      if (userAgent.includes("Safari")) return "Safari";
      if (userAgent.includes("Edge")) return "Edge";
      if (userAgent.includes("Opera")) return "Opera";
      return "Unknown";
    }

    function isBot() {
      const userAgent = navigator.userAgent.toLowerCase();
      const botPatterns = [
        "googlebot",
        "bingbot",
        "slurp",
        "duckduckbot",
        "baiduspider",
        "yandexbot",
        "facebookexternalhit",
        "twitterbot",
        "linkedinbot",
        "pinterest",
        "whatsapp",
        "ahrefsbot",
        "semrushbot",
        "mj12bot",
        "dotbot",
        "bot",
        "crawler",
        "spider",
      ];
      return botPatterns.some((pattern) => userAgent.includes(pattern));
    }

    function showBlockMessage(message, customStyle = {}) {
      const defaultStyle = {
        textAlign: "center",
        marginTop: "20%",
        fontFamily: "Arial, sans-serif",
        padding: "40px",
        color: "#333",
      };

      const style = { ...defaultStyle, ...customStyle };
      const styleString = Object.entries(style)
        .map(
          ([key, value]) =>
            `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}:${value}`
        )
        .join(";");

      document.body.innerHTML = `<div style="${styleString}">${message}</div>`;
    }

    function handleRedirect(redirectUrl, delay = 0) {
      if (delay > 0) {
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, delay);
      } else {
        window.location.href = redirectUrl;
      }
    }

    // Get session info
    const sessionId =
      sessionStorage.getItem("blockapp_session") || generateSessionId();
    sessionStorage.setItem("blockapp_session", sessionId);

    const countryCode = guessCountryCode();
    const deviceType = detectDeviceType();
    const browser = detectBrowser();
    const isUserBot = isBot();
    const startTime = Date.now();

    console.log("Enhanced Block Country - Session Info:", {
      sessionId,
      country: countryCode,
      device: deviceType,
      browser: browser,
      isBot: isUserBot,
    });

    // Check access permissions with enhanced endpoint
    const checkUrl = new URL(
      `/apps/proxy-1/check_access_enhanced`,
      window.location.origin
    );
    checkUrl.searchParams.set("shop", Shopify.shop);
    checkUrl.searchParams.set("session_id", sessionId);
    checkUrl.searchParams.set("device_type", deviceType);
    checkUrl.searchParams.set("browser", browser);
    checkUrl.searchParams.set("is_bot", isUserBot);
    checkUrl.searchParams.set("page_url", window.location.href);
    checkUrl.searchParams.set("referrer", document.referrer || "");

    if (countryCode) {
      checkUrl.searchParams.set("country", countryCode);
    }

    const response = await fetch(checkUrl.toString());
    const result = await response.json();

    console.log("Enhanced access check result:", result);

    // Handle blocking with redirect support
    if (result.blocked) {
      console.log("Access blocked:", result.reason);

      // Check if there's a specific redirect URL for this block
      let redirectUrl = null;
      let customMessage = null;

      if (result.redirect_info) {
        redirectUrl = result.redirect_info.redirect_url;
        customMessage = result.redirect_info.custom_message;
      }

      // Handle redirection
      if (redirectUrl) {
        console.log("Redirecting to:", redirectUrl);

        // Show a brief message before redirecting
        showBlockMessage(`
          <h1 style="color:#d32f2f;">Access Restricted</h1>
          <p>Redirecting you to an appropriate page...</p>
          <div style="margin-top:20px;">
            <div style="display:inline-block;width:20px;height:20px;border:2px solid #d32f2f;border-top:2px solid transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
          </div>
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        `);

        // Redirect after 2 seconds
        handleRedirect(redirectUrl, 2000);
        return;
      }

      // Show block message (no redirect)
      let message =
        '<div style="text-align:center;margin-top:20%;font-family:Arial,sans-serif;">';
      message += '<h1 style="color:#d32f2f;">Access Restricted</h1>';

      if (customMessage) {
        message += `<p>${customMessage}</p>`;
      } else if (result.reason) {
        if (result.reason.includes("Country")) {
          message +=
            "<p>Sorry, this store is not available in your country.</p>";
        } else if (result.reason.includes("IP")) {
          message += "<p>Your access has been restricted.</p>";
        } else if (result.reason.includes("Bot")) {
          message += "<p>Automated access is not allowed.</p>";
        } else {
          message += "<p>Access to this store has been restricted.</p>";
        }
      } else {
        message += "<p>Access to this store has been restricted.</p>";
      }

      message +=
        '<p style="color:#666;font-size:14px;margin-top:20px;">If you believe this is an error, please contact support.</p>';
      message += "</div>";

      showBlockMessage(message);
      return;
    }

    // Load content protection if enabled
    if (result.contentProtection && result.contentProtection.enabled) {
      const protectionScript = document.createElement("script");
      protectionScript.src = `/apps/proxy-1/content_protection_script?shop=${Shopify.shop}`;
      protectionScript.onerror = () => {
        console.log("Content protection script failed to load");
      };
      document.head.appendChild(protectionScript);
    }

    // Analytics tracking with enhanced data
    let pageViews = 1;
    let lastActivityTime = Date.now();
    let interactionCount = 0;

    // Track page view duration and interactions
    function trackPageView() {
      const duration = Math.round((Date.now() - startTime) / 1000);

      fetch(`/apps/proxy-1/track_analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: Shopify.shop,
          session_id: sessionId,
          country_code: countryCode,
          device_type: deviceType,
          browser: browser,
          is_bot: isUserBot,
          page_url: window.location.href,
          referrer: document.referrer || null,
          duration: duration,
          page_views: pageViews,
          interaction_count: interactionCount,
          user_agent: navigator.userAgent,
        }),
      }).catch((err) => console.log("Analytics tracking error:", err));
    }

    // Track user activity and interactions
    function trackActivity(eventType) {
      lastActivityTime = Date.now();
      interactionCount++;

      // Track specific interaction types
      if (eventType === "page_change") {
        pageViews++;
      }
    }

    // Enhanced event listeners for activity tracking
    const trackingEvents = [
      { event: "click", type: "click" },
      { event: "scroll", type: "scroll" },
      { event: "keypress", type: "keypress" },
      { event: "mousemove", type: "mousemove" },
    ];

    trackingEvents.forEach(({ event, type }) => {
      document.addEventListener(event, () => trackActivity(type), {
        passive: true,
      });
    });

    // Track page visibility changes
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        trackActivity("page_visible");
      } else {
        trackPageView(); // Track when page becomes hidden
      }
    });

    // Track page changes for SPAs
    let currentUrl = window.location.href;
    const checkForUrlChange = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        trackActivity("page_change");
      }
    };

    // Check for URL changes every 500ms (for SPAs)
    setInterval(checkForUrlChange, 500);

    // Track page view on load
    window.addEventListener("load", trackPageView);

    // Track page view before unload
    window.addEventListener("beforeunload", trackPageView);

    // Periodic tracking (every 30 seconds if active)
    setInterval(() => {
      if (Date.now() - lastActivityTime < 30000) {
        // Active in last 30 seconds
        trackPageView();
      }
    }, 30000);

    // Enhanced bot detection and validation
    if (isUserBot) {
      console.log("Bot detected - Enhanced monitoring active");

      // Additional bot validation
      const botCheckUrl = new URL(
        `/apps/proxy-1/validate_bot`,
        window.location.origin
      );
      botCheckUrl.searchParams.set("shop", Shopify.shop);
      botCheckUrl.searchParams.set("user_agent", navigator.userAgent);

      fetch(botCheckUrl.toString())
        .then((res) => res.json())
        .then((botResult) => {
          if (botResult.blocked) {
            if (botResult.redirect_url) {
              handleRedirect(botResult.redirect_url);
            } else {
              showBlockMessage(
                '<h1 style="text-align:center;margin-top:20%;">Bot access not permitted</h1>'
              );
            }
          }
        })
        .catch((err) => console.log("Bot validation error:", err));
    }

    // Performance monitoring with error tracking
    if (window.performance && window.performance.timing) {
      const perfData = window.performance.timing;
      const loadTime = perfData.loadEventEnd - perfData.navigationStart;

      // Track performance metrics
      setTimeout(() => {
        fetch(`/apps/proxy-1/track_performance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop: Shopify.shop,
            session_id: sessionId,
            load_time: loadTime,
            dom_ready:
              perfData.domContentLoadedEventEnd - perfData.navigationStart,
            page_url: window.location.href,
            connection_type: navigator.connection
              ? navigator.connection.effectiveType
              : "unknown",
            memory_info: navigator.deviceMemory || null,
          }),
        }).catch((err) => console.log("Performance tracking error:", err));
      }, 1000);
    }

    // Error tracking
    window.addEventListener("error", (event) => {
      fetch(`/apps/proxy-1/track_error`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: Shopify.shop,
          session_id: sessionId,
          error_message: event.message,
          error_source: event.filename,
          error_line: event.lineno,
          page_url: window.location.href,
          user_agent: navigator.userAgent,
        }),
      }).catch((err) => console.log("Error tracking failed:", err));
    });

    console.log("Enhanced Block Country script loaded successfully");
  } catch (error) {
    console.error("Enhanced Block Country script error:", error);

    // Track script errors
    try {
      fetch(`/apps/proxy-1/track_script_error`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: Shopify.shop,
          error_message: error.message,
          error_stack: error.stack,
          page_url: window.location.href,
          user_agent: navigator.userAgent,
        }),
      }).catch(() => {}); // Fail silently
    } catch (trackingError) {
      // Fail silently - don't break the store if tracking fails
    }
  }
})();
