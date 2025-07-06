// extensions/country-blocker/assets/app.js
// import {
//   timezoneMap,
//   botPatterns,
//   getSessionId,
//   getClientIP,
//   getShopDomain,
// } from "./helper.js";

(function () {
  "use strict";

  // Static Timezone to Country mapping
  const timezoneMap = {
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

  // Static bot detection patterns
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
    "scraper",
    "curl",
    "wget",
    "python-requests",
    "axios",
    "node-fetch",
  ];

  //  session ID generator with better uniqueness
  function getSessionId() {
    try {
      let sessionId = sessionStorage.getItem("bc_session");
      if (!sessionId) {
        // Create more unique session ID
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        const userAgent = navigator.userAgent
          .substr(0, 20)
          .replace(/[^a-zA-Z0-9]/g, "");
        sessionId = `session_${random}_${timestamp}_${userAgent}`;
        sessionStorage.setItem("bc_session", sessionId);
        console.log("✌️Created new session:", sessionId);
      } else {
        console.log("✌️Using existing session:", sessionId);
      }
      return sessionId;
    } catch (error) {
      console.log("✌️SessionStorage error, using temp session");
      return (
        "temp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5)
      );
    }
  }

  //  IP detection - try multiple methods
  function getClientIP() {
    return new Promise((resolve) => {
      // Method 1: Try WebRTC (most accurate for real IP)
      const rtc = new RTCPeerConnection({
        iceServers: [],
      });

      let ip = null;

      rtc.createDataChannel("");
      rtc.createOffer().then((offer) => rtc.setLocalDescription(offer));

      rtc.onicecandidate = function (ice) {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;

        const candidate = ice.candidate.candidate;
        const ipMatch = candidate.match(
          /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/
        );

        if (ipMatch && !ip) {
          ip = ipMatch[1];
          console.log("✌️Detected IP via WebRTC:", ip);
          resolve(ip);
          rtc.close();
        }
      };

      // Fallback after 2 seconds
      setTimeout(() => {
        if (!ip) {
          console.log("✌️WebRTC IP detection failed, using fallback");
          resolve(null);
        }
      }, 2000);
    });
  }

  // Get shop domain directly
  function getShopDomain() {
    // Try multiple ways to get shop domain
    if (typeof Shopify !== "undefined" && Shopify.shop) {
      console.log("✌️Got shop from Shopify object:", Shopify.shop);
      return Shopify.shop;
    }

    // Try to extract from current URL
    const hostname = window.location.hostname;
    if (hostname.includes(".myshopify.com")) {
      console.log("✌️Got shop from URL:", hostname);
      return hostname;
    }

    // Try to find in page content
    const scripts = document.querySelectorAll("script");
    for (let script of scripts) {
      if (script.textContent && script.textContent.includes(".myshopify.com")) {
        const match = script.textContent.match(
          /([a-zA-Z0-9\-]+\.myshopify\.com)/
        );
        if (match) {
          console.log("✌️Got shop from script content:", match[1]);
          return match[1];
        }
      }
    }

    console.log("✌️Could not determine shop domain");
    return null;
  }

  // Enhanced country detection
  function getCountryCode() {
    try {
      // Method 1: Try to get from timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log("✌️Detected timezone:", timezone);

      let country = timezoneMap[timezone];

      // Method 2: Try to get from locale
      if (!country) {
        const locale = navigator.language || navigator.languages[0];
        if (locale) {
          const localeCountry = locale.split("-")[1];
          if (localeCountry && localeCountry.length === 2) {
            country = localeCountry.toUpperCase();
            console.log("✌️Detected country from locale:", country);
          }
        }
      }

      console.log("✌️Final detected country:", country);
      return country;
    } catch (error) {
      console.log("✌️Error detecting country:", error.message);
      return null;
    }
  }

  // Enhanced device detection
  function getDeviceType() {
    try {
      const userAgent = navigator.userAgent;
      const screenWidth = window.screen.width;

      // Combine user agent and screen size for better detection
      if (
        /tablet|ipad|playbook|silk/i.test(userAgent) ||
        (screenWidth >= 768 && screenWidth <= 1024)
      ) {
        return "tablet";
      }
      if (
        /mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(
          userAgent
        ) ||
        screenWidth < 768
      ) {
        return "mobile";
      }
      return "desktop";
    } catch (error) {
      console.log("✌️Error detecting device:", error.message);
      return "unknown";
    }
  }

  // Enhanced browser detection
  function getBrowser() {
    try {
      const userAgent = navigator.userAgent;
      if (userAgent.includes("Edg/")) return "Edge";
      if (userAgent.includes("Chrome/")) return "Chrome";
      if (userAgent.includes("Firefox/")) return "Firefox";
      if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/"))
        return "Safari";
      if (userAgent.includes("Opera/") || userAgent.includes("OPR/"))
        return "Opera";
      return "Unknown";
    } catch (error) {
      console.log("✌️Error detecting browser:", error.message);
      return "Unknown";
    }
  }

  // Enhanced bot detection
  function isBot() {
    try {
      const userAgent = navigator.userAgent.toLowerCase();

      const detected = botPatterns.some((pattern) =>
        userAgent.includes(pattern)
      );

      // Additional heuristics
      const suspiciousPatterns = [
        () => userAgent === "", // Empty user agent
        () => !/mozilla/i.test(userAgent) && !/gecko/i.test(userAgent), // Missing common browser identifiers
        () => !navigator.languages || navigator.languages.length === 0, // No language preferences
        () => navigator.webdriver === true, // Automated browser
        () => window.phantom !== undefined, // PhantomJS
        () => window.callPhantom !== undefined, // PhantomJS
      ];

      const isSuspicious = suspiciousPatterns.some((check) => check());

      console.log("✌️Bot detection result:", detected || isSuspicious);
      return detected || isSuspicious;
    } catch (error) {
      console.log("✌️Error in bot detection:", error.message);
      return false;
    }
  }

  // Show blocking message
  function showBlockMessage(result) {
    console.log("✌️Showing block message:", result);

    let message =
      '<div style="text-align:center;margin-top:20%;font-family:Arial,sans-serif;padding:40px;">';
    message +=
      '<h1 style="color:#d32f2f;margin-bottom:20px;">Access Restricted</h1>';

    if (result?.redirect_info && result?.redirect_info.custom_message) {
      message +=
        '<p style="font-size:18px;margin-bottom:20px;">' +
        result?.redirect_info.custom_message +
        "</p>";
    } else if (result?.reason) {
      if (result?.reason.includes("Country")) {
        message +=
          '<p style="font-size:18px;margin-bottom:20px;">Sorry, this store is not available in your country.</p>';
      } else if (result?.reason.includes("IP")) {
        message +=
          '<p style="font-size:18px;margin-bottom:20px;">Your access has been restricted.</p>';
      } else if (result?.reason.includes("Bot")) {
        message +=
          '<p style="font-size:18px;margin-bottom:20px;">Automated access is not allowed.</p>';
      } else {
        message +=
          '<p style="font-size:18px;margin-bottom:20px;">Access to this store has been restricted.</p>';
      }
    } else {
      message +=
        '<p style="font-size:18px;margin-bottom:20px;">Access to this store has been restricted.</p>';
    }

    message +=
      '<p style="color:#666;font-size:14px;margin-top:30px;">If you believe this is an error, please contact support.</p>';
    message += "</div>";

    document.body.innerHTML = message;
  }

  // Handle redirect with better UX
  function handleRedirect(redirectInfo) {
    console.log("✌️Redirecting to:", redirectInfo.redirect_url);

    const loadingMessage = `
      <div style="text-align:center;margin-top:20%;font-family:Arial,sans-serif;padding:40px;">
        <h1 style="color:#d32f2f;margin-bottom:20px;">Access Restricted</h1>
        <p style="font-size:18px;margin-bottom:30px;">${
          redirectInfo.custom_message ||
          "Redirecting you to an appropriate page..."
        }</p>
        <div style="margin:30px 0;">
          <div style="display:inline-block;width:20px;height:20px;border:2px solid #d32f2f;border-top:2px solid transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
        </div>
        <p style="color:#666;font-size:14px;">You will be redirected in 3 seconds...</p>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </div>
    `;

    document.body.innerHTML = loadingMessage;

    setTimeout(function () {
      window.location.href = redirectInfo.redirect_url;
    }, 3000); // Increased to 3 seconds for better UX
  }

  // Track analytics with better session management
  function trackAnalytics(shop, sessionData) {
    try {
      console.log("✌️Tracking analytics with enhanced data");

      // Get page performance data if available
      let performanceData = {};
      if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        performanceData = {
          loadTime: timing.loadEventEnd - timing.navigationStart,
          domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
          firstPaint: timing.responseEnd - timing.navigationStart,
        };
      }

      const data = {
        shop: shop,
        session_id: sessionData.sessionId,
        country_code: sessionData.country,
        device_type: sessionData.device,
        browser: sessionData.browser,
        is_bot: sessionData.isBot,
        page_url: window.location.href,
        referrer: document.referrer || null,
        duration: Math.round((Date.now() - sessionData.startTime) / 1000),
        page_views: sessionData.pageViews || 1,
        user_agent: navigator.userAgent,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        performance: performanceData,
        client_ip: sessionData.clientIP || null,
      };

      fetch("/apps/proxy-1/track_analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(data),
      })
        .then(function (response) {
          if (response?.ok) {
            console.log("✌️Analytics tracked successfully");
            // Update page view count
            sessionData.pageViews = (sessionData.pageViews || 1) + 1;
            sessionStorage.setItem(
              "bc_page_views",
              sessionData.pageViews.toString()
            );
          } else {
            console.log("✌️Analytics tracking failed:", response?.status);
          }
        })
        .catch(function (error) {
          console.log("✌️Analytics error:", error.message);
        });
    } catch (error) {
      console.log("✌️Analytics tracking error:", error.message);
    }
  }

  // Main access check function with enhanced IP detection
  async function checkAccess() {
    console.log("✌️Starting enhanced access check");

    // Get shop domain
    const shop = getShopDomain();
    if (!shop) {
      console.log("✌️No shop domain found, skipping check");
      return;
    }

    // Try to get client IP
    const clientIP = await getClientIP();

    // Collect enhanced session data
    const sessionData = {
      sessionId: getSessionId(),
      country: getCountryCode(),
      device: getDeviceType(),
      browser: getBrowser(),
      isBot: isBot(),
      startTime: Date.now(),
      clientIP: clientIP,
      pageViews: parseInt(sessionStorage.getItem("bc_page_views") || "1"),
    };

    console.log("✌️Enhanced session data:", sessionData);

    // Build API URL with all data
    const apiUrl = new URL(
      "/apps/proxy-1/check_access_enhanced",
      window.location.origin
    );
    apiUrl.searchParams.set("shop", shop);
    apiUrl.searchParams.set("session_id", sessionData.sessionId);
    apiUrl.searchParams.set("device_type", sessionData.device);
    apiUrl.searchParams.set("browser", sessionData.browser);
    apiUrl.searchParams.set("is_bot", sessionData.isBot);
    apiUrl.searchParams.set("page_url", window.location.href);
    apiUrl.searchParams.set("referrer", document.referrer || "");

    if (sessionData.country) {
      apiUrl.searchParams.set("country", sessionData.country);
    }

    if (clientIP) {
      apiUrl.searchParams.set("client_ip", clientIP);
    }

    console.log("✌️Enhanced API URL:", apiUrl.toString());

    // Make API call with better error handling
    try {
      const response = await fetch(apiUrl.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response?.ok) {
        throw new Error(`HTTP ${response?.status}: ${response?.statusText}`);
      }

      const result = await response.json();
      console.log("✌️Enhanced access check result:", result);

      if (result?.blocked) {
        console.log("✌️Access is blocked:", result?.reason);

        // Handle redirect with enhanced info
        if (result?.redirect_info && result?.redirect_info.redirect_url) {
          handleRedirect(result?.redirect_info);
        } else {
          showBlockMessage(result);
        }
        return;
      }

      console.log("✌️Access allowed");

      // Load content protection if enabled
      if (result?.contentProtection && result?.contentProtection.enabled) {
        loadContentProtection(shop, result.contentProtection.settings);
      }

      // Track analytics with enhanced data
      trackAnalytics(shop, sessionData);
    } catch (error) {
      console.log("✌️Access check failed:", error.message);

      // Fail open - don't block if API call fails
      console.log("✌️Failing open due to error");

      // Still try to track analytics
      trackAnalytics(shop, sessionData);
    }
  }

  // Enhanced content protection loading
  function loadContentProtection(shop, settings) {
    try {
      console.log("✌️Loading enhanced content protection");

      // Load the content protection script with settings
      const script = document.createElement("script");
      script.src = `/apps/proxy-1/content_protection_script?shop=${shop}`;
      script.onload = function () {
        console.log("✌️Content protection loaded successfully");
      };
      script.onerror = function () {
        console.log("✌️Content protection failed to load");
      };
      document.head.appendChild(script);
    } catch (error) {
      console.log("✌️Error loading content protection:", error.message);
    }
  }

  // Initialize when ready
  function init() {
    console.log("✌️Initializing enhanced Block Country script...");

    // Run immediately
    checkAccess();

    // Set up periodic analytics tracking (every 30 seconds for active sessions)
    let lastActivity = Date.now();

    // Track user activity
    const activityEvents = ["click", "scroll", "mousemove", "keypress"];
    activityEvents.forEach((event) => {
      document.addEventListener(
        event,
        () => {
          lastActivity = Date.now();
        },
        { passive: true }
      );
    });

    // Periodic tracking for active users
    setInterval(function () {
      if (Date.now() - lastActivity < 60000) {
        // Active in last minute
        const shop = getShopDomain();
        if (shop) {
          trackAnalytics(shop, {
            sessionId: getSessionId(),
            country: getCountryCode(),
            device: getDeviceType(),
            browser: getBrowser(),
            isBot: isBot(),
            startTime: Date.now(),
            pageViews: parseInt(sessionStorage.getItem("bc_page_views") || "1"),
          });
        }
      }
    }, 30000);

    // Track page visibility changes
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        // User left the page, do final analytics update
        const shop = getShopDomain();
        if (shop) {
          navigator.sendBeacon(
            "/apps/proxy-1/track_analytics",
            JSON.stringify({
              shop: shop,
              session_id: getSessionId(),
              action: "page_exit",
              duration: Math.round(
                (Date.now() -
                  parseInt(
                    sessionStorage.getItem("bc_start_time") || Date.now()
                  )) /
                  1000
              ),
            })
          );
        }
      }
    });

    console.log("✌️Enhanced initialization complete");
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Enhanced global error handler
  window.addEventListener("error", function (event) {
    console.log(
      "✌️Global error captured:",
      event.message,
      event.filename,
      event.lineno
    );

    // Track errors for debugging
    const shop = getShopDomain();
    if (shop) {
      fetch("/apps/proxy-1/track_error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shop,
          session_id: getSessionId(),
          error_message: event.message,
          error_source: event.filename,
          error_line: event.lineno,
          page_url: window.location.href,
          user_agent: navigator.userAgent,
        }),
      }).catch(() => {}); // Fail silently
    }
  });
})();
