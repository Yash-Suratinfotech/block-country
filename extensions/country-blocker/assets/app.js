// extensions/country-blocker/assets/app.js
// Combined file - all modules in one

(function() {
  'use strict';

  // ============================================================================
  // CONSTANTS AND CONFIGURATION
  // ============================================================================

  const SESSION_KEY = "bc_session";
  const SESSION_START_KEY = "bc_session_start";
  const PAGE_VIEWS_KEY = "bc_page_views";
  const LAST_ACTIVITY_KEY = "bc_last_activity";

  // Timezone to Country mapping
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

  // Bot patterns
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
    "lighthouse",
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

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  function getClientIP() {
    return new Promise(async (resolve) => {
      let detectedIP = null;
      
      // Method 1: Try external IP service (most reliable)
      try {
        const response = await fetch('https://api.ipify.org?format=json', {
          method: 'GET',
          timeout: 3000
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.ip && isValidIP(data.ip)) {
            detectedIP = data.ip;
            console.log("✌️Detected IP via ipify:", detectedIP);
            resolve(detectedIP);
            return;
          }
        }
      } catch (error) {
        console.log("✌️IP detection via ipify failed:", error.message);
      }

      // Method 2: Try alternative IP service
      try {
        const response = await fetch('https://api64.ipify.org?format=json', {
          method: 'GET',
          timeout: 3000
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.ip && isValidIP(data.ip)) {
            detectedIP = data.ip;
            console.log("✌️Detected IP via ipify64:", detectedIP);
            resolve(detectedIP);
            return;
          }
        }
      } catch (error) {
        console.log("✌️IP detection via ipify64 failed:", error.message);
      }

      // Method 3: WebRTC (fallback, can be blocked)
      try {
        const rtc = new RTCPeerConnection({ 
          iceServers: [],
          iceCandidatePoolSize: 0
        });
        
        let timeout;
        
        const cleanup = () => {
          if (timeout) clearTimeout(timeout);
          try {
            rtc.close();
          } catch (e) {}
        };

        rtc.createDataChannel("");
        
        const offer = await rtc.createOffer();
        await rtc.setLocalDescription(offer);

        rtc.onicecandidate = function (ice) {
          if (!ice || !ice.candidate || !ice.candidate.candidate) return;

          const candidate = ice.candidate.candidate;
          const ipMatch = candidate.match(
            /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/
          );

          if (ipMatch && !detectedIP) {
            const ip = ipMatch[1];
            if (isValidIP(ip) && !isPrivateIP(ip)) {
              detectedIP = ip;
              console.log("✌️Detected IP via WebRTC:", detectedIP);
              cleanup();
              resolve(detectedIP);
            }
          }
        };

        // Timeout after 3 seconds
        timeout = setTimeout(() => {
          if (!detectedIP) {
            console.log("✌️WebRTC IP detection failed");
            cleanup();
            resolve(null);
          }
        }, 3000);
        
      } catch (error) {
        console.log("✌️WebRTC IP detection error:", error.message);
        resolve(null);
      }
    });
  }

  // Helper functions for IP validation (similar to backend ipUtils.js)
  function isValidIP(ip) {
    if (!ip || typeof ip !== "string") return false;
    return isValidIPv4(ip) || isValidIPv6(ip);
  }

  function isValidIPv4(ip) {
    if (!ip || typeof ip !== "string") return false;

    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipv4Regex);

    if (!match) return false;

    // Check each octet is in valid range (0-255)
    for (let i = 1; i <= 4; i++) {
      const octet = parseInt(match[i], 10);
      if (octet < 0 || octet > 255) return false;
      // Check for leading zeros (except for "0")
      if (match[i].length > 1 && match[i][0] === "0") return false;
    }

    return true;
  }

  function isValidIPv6(ip) {
    if (!ip || typeof ip !== "string") return false;

    // Basic IPv6 patterns
    const ipv6Patterns = [
      // Full IPv6 (8 groups of 4 hex digits)
      /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i,
      // IPv6 with :: compression
      /^(([0-9a-f]{1,4}:)*)?::([0-9a-f]{1,4}:)*[0-9a-f]{1,4}$/i,
      // IPv6 loopback
      /^::1$/i,
      // IPv6 zero address
      /^::$/i,
    ];

    return ipv6Patterns.some((pattern) => pattern.test(ip));
  }

  function isPrivateIP(ip) {
    if (!ip) return false;

    const privateRanges = [
      // IPv4 Private ranges
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16

      // IPv4 Special ranges
      /^127\./, // 127.0.0.0/8 (loopback)
      /^169\.254\./, // 169.254.0.0/16 (link-local)
      /^224\./, // 224.0.0.0/4 (multicast)
      /^240\./, // 240.0.0.0/4 (reserved)

      // IPv6 Private/Special ranges
      /^::1$/, // IPv6 loopback
      /^fe80::/i, // IPv6 link-local
      /^fc00::/i, // IPv6 unique local
      /^fd00::/i, // IPv6 unique local
      /^ff00::/i, // IPv6 multicast
      /^::/, // IPv6 zero/unspecified
    ];

    return privateRanges.some((range) => range.test(ip));
  }

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

  function getDeviceInfo() {
    try {
      const userAgent = navigator.userAgent;
      const screenWidth = window.screen.width;

      // Combine user agent and screen size for better detection
      if (
        /tablet|ipad|playbook|silk/i.test(userAgent) ||
        (screenWidth >= 768 && screenWidth <= 1024)
      ) {
        return { type: "tablet" };
      }

      if (
        /mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(
          userAgent
        ) ||
        screenWidth < 768
      ) {
        return { type: "mobile" };
      }

      return { type: "desktop" };
    } catch (error) {
      console.log("✌️Error detecting device:", error.message);
      return { type: "unknown" };
    }
  }

  function getBrowserInfo() {
    try {
      const userAgent = navigator.userAgent;
      let name = "Unknown";
      let version = "Unknown";

      if (userAgent.includes("Edg/")) {
        name = "Edge";
        const match = userAgent.match(/Edg\/([0-9.]+)/);
        version = match ? match[1] : "Unknown";
      } else if (userAgent.includes("Chrome/")) {
        name = "Chrome";
        const match = userAgent.match(/Chrome\/([0-9.]+)/);
        version = match ? match[1] : "Unknown";
      } else if (userAgent.includes("Firefox/")) {
        name = "Firefox";
        const match = userAgent.match(/Firefox\/([0-9.]+)/);
        version = match ? match[1] : "Unknown";
      } else if (
        userAgent.includes("Safari/") &&
        !userAgent.includes("Chrome/")
      ) {
        name = "Safari";
        const match = userAgent.match(/Version\/([0-9.]+)/);
        version = match ? match[1] : "Unknown";
      } else if (userAgent.includes("Opera/") || userAgent.includes("OPR/")) {
        name = "Opera";
        const match = userAgent.match(/(?:Opera|OPR)\/([0-9.]+)/);
        version = match ? match[1] : "Unknown";
      }

      return { name, version };
    } catch (error) {
      console.log("✌️Error detecting browser:", error.message);
      return { name: "Unknown", version: "Unknown" };
    }
  }

  function detectBot() {
    try {
      const userAgent = navigator.userAgent.toLowerCase();

      // Check against bot patterns
      const isBot = botPatterns.some((pattern) => userAgent.includes(pattern));

      if (isBot) {
        // Try to identify specific bot
        let botName = "Unknown Bot";

        if (userAgent.includes("googlebot")) botName = "Googlebot";
        else if (userAgent.includes("bingbot")) botName = "Bingbot";
        else if (userAgent.includes("facebookexternalhit"))
          botName = "Facebook Bot";
        else if (userAgent.includes("twitterbot")) botName = "Twitter Bot";
        else if (userAgent.includes("linkedinbot")) botName = "LinkedIn Bot";
        else if (userAgent.includes("ahrefsbot")) botName = "Ahrefs Bot";
        else if (userAgent.includes("semrushbot")) botName = "SEMrush Bot";
        else if (userAgent.includes("lighthouse")) botName = "Lighthouse";

        console.log("✌️Bot detected:", botName);
        return { isBot: true, name: botName };
      }

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

      if (isSuspicious) {
        console.log("✌️Suspicious bot activity detected");
        return { isBot: true, name: "Suspicious Bot" };
      }

      return { isBot: false, name: null };
    } catch (error) {
      console.log("✌️Error in bot detection:", error.message);
      return { isBot: false, name: null };
    }
  }

  // ============================================================================
  // SESSION TRACKER CLASS
  // ============================================================================

  class SessionTracker {
    constructor() {
      this.sessionId = null;
      this.startTime = null;
      this.pageViews = 0;
      this.lastActivity = Date.now();
      this.activityListeners = [];
      this.initSession();
      this.setupActivityTracking();
    }

    initSession() {
      try {
        // Get or create session ID
        this.sessionId = sessionStorage.getItem(SESSION_KEY);

        if (!this.sessionId) {
          this.sessionId = this.generateSessionId();
          sessionStorage.setItem(SESSION_KEY, this.sessionId);
          sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());
          sessionStorage.setItem(PAGE_VIEWS_KEY, "1");
          this.startTime = Date.now();
          this.pageViews = 1;
          console.log("✌️Created new session:", this.sessionId);
        } else {
          // Restore session data
          this.startTime = parseInt(
            sessionStorage.getItem(SESSION_START_KEY) || Date.now()
          );
          this.pageViews = parseInt(
            sessionStorage.getItem(PAGE_VIEWS_KEY) || "1"
          );
          this.lastActivity = parseInt(
            sessionStorage.getItem(LAST_ACTIVITY_KEY) || Date.now()
          );

          // Increment page views
          this.pageViews++;
          sessionStorage.setItem(PAGE_VIEWS_KEY, this.pageViews.toString());
          console.log(
            "✌️Restored session:",
            this.sessionId,
            "Page views:",
            this.pageViews
          );
        }
      } catch (error) {
        console.log("✌️SessionStorage error, using fallback");
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.pageViews = 1;
      }
    }

    generateSessionId() {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const userAgent = navigator.userAgent
        .substr(0, 20)
        .replace(/[^a-zA-Z0-9]/g, "");
      return `session_${random}_${timestamp}_${userAgent}`;
    }

    setupActivityTracking() {
      // Track user activity
      const activityEvents = [
        "click",
        "scroll",
        "mousemove",
        "keypress",
        "touchstart",
      ];

      const updateActivity = () => {
        this.lastActivity = Date.now();
        try {
          sessionStorage.setItem(LAST_ACTIVITY_KEY, this.lastActivity.toString());
        } catch (e) {}
      };

      // Throttle activity updates
      let activityTimeout;
      const throttledUpdate = () => {
        if (activityTimeout) return;
        activityTimeout = setTimeout(() => {
          updateActivity();
          activityTimeout = null;
        }, 1000);
      };

      activityEvents.forEach((event) => {
        document.addEventListener(event, throttledUpdate, { passive: true });
        this.activityListeners.push({ event, handler: throttledUpdate });
      });

      // Page visibility tracking
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          this.sendBeacon();
        } else {
          updateActivity();
        }
      });

      // Unload tracking
      window.addEventListener("beforeunload", () => {
        this.sendBeacon();
      });
    }

    getSessionDuration() {
      return Math.round((Date.now() - this.startTime) / 1000); // Duration in seconds
    }

    getTimeSinceLastActivity() {
      return Math.round((Date.now() - this.lastActivity) / 1000);
    }

    isActive() {
      // Consider session active if activity within last 30 seconds
      return this.getTimeSinceLastActivity() < 30;
    }

    getSessionData() {
      return {
        sessionId: this.sessionId,
        startTime: this.startTime,
        duration: this.getSessionDuration(),
        pageViews: this.pageViews,
        isActive: this.isActive(),
        lastActivity: this.lastActivity,
      };
    }

    sendBeacon() {
      const shop = window.Shopify?.shop || window.location.hostname;
      if (!shop) return;

      const data = {
        shop: shop,
        session_id: this.sessionId,
        action: "page_exit",
        duration: this.getSessionDuration(),
        page_views: this.pageViews,
      };

      // Use fetch instead of sendBeacon
      fetch("/apps/proxy-1/track_exit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(data),
        keepalive: true, // Important for page unload
      }).then(() => {
        // Optionally log or handle response
      }).catch((err) => {
        // Optionally handle error
      });
    }

    destroy() {
      // Clean up event listeners
      this.activityListeners.forEach(({ event, handler }) => {
        document.removeEventListener(event, handler);
      });
    }
  }

  // ============================================================================
  // ACCESS CHECKER CLASS
  // ============================================================================

  class AccessChecker {
    constructor(sessionTracker) {
      this.sessionTracker = sessionTracker;
      this.shop = this.getShopDomain();
      this.checkResults = null;
    }

    getShopDomain() {
      if (typeof Shopify !== "undefined" && Shopify.shop) {
        return Shopify.shop;
      }

      const hostname = window.location.hostname;
      if (hostname.includes(".myshopify.com")) {
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
            return match[1];
          }
        }
      }

      return null;
    }

    async performAccessCheck() {
      if (!this.shop) {
        console.log("✌️No shop domain found, skipping check");
        return null;
      }

      console.log("✌️Starting enhanced access check for shop:", this.shop);

      try {
        // Collect all data in parallel
        const [clientIP, countryCode] = await Promise.all([
          getClientIP(),
          Promise.resolve(getCountryCode()),
        ]);

        const deviceInfo = getDeviceInfo();
        const browserInfo = getBrowserInfo();
        const botInfo = detectBot();
        const sessionData = this.sessionTracker.getSessionData();

        const checkData = {
          shop: this.shop,
          session_id: sessionData.sessionId,
          country: countryCode,
          client_ip: clientIP,
          device_type: deviceInfo.type,
          browser: browserInfo.name,
          is_bot: botInfo.isBot.toString(),
          bot_name: botInfo.name,
          page_url: window.location.href,
          referrer: document.referrer || "",
          user_agent: navigator.userAgent,
        };

        console.log("✌️Access check data:", checkData);

        // Make API call
        const apiUrl = new URL(
          "/apps/proxy-1/check_access_enhanced",
          window.location.origin
        );
        Object.entries(checkData).forEach(([key, value]) => {
          if (value) apiUrl.searchParams.set(key, value);
        });

        const response = await fetch(apiUrl.toString(), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log("✌️Access check result:", result);

        this.checkResults = result;
        return result;
      } catch (error) {
        console.error("✌️Access check failed:", error);
        // Fail open - don't block on error
        return null;
      }
    }

    handleBlockedAccess(result) {
      console.log("✌️Handling blocked access:", result);

      if (result?.redirect_info?.redirect_url) {
        this.showRedirectMessage(result.redirect_info);
      } else {
        this.showBlockMessage(result);
      }
    }

    showBlockMessage(result) {
      const message =
        result?.redirect_info?.custom_message ||
        this.getDefaultBlockMessage(result?.reason);

      document.body.innerHTML = `
        <div style="text-align:center;margin-top:20%;font-family:Arial,sans-serif;padding:40px;">
          <h1 style="color:#d32f2f;margin-bottom:20px;">Access Restricted</h1>
          <p style="font-size:18px;margin-bottom:20px;">${message}</p>
          <p style="color:#666;font-size:14px;margin-top:30px;">
            If you believe this is an error, please contact support.
          </p>
        </div>
      `;
    }

    showRedirectMessage(redirectInfo) {
      const message =
        redirectInfo.custom_message ||
        "Redirecting you to an appropriate page...";

      document.body.innerHTML = `
        <div style="text-align:center;margin-top:20%;font-family:Arial,sans-serif;padding:40px;">
          <h1 style="color:#d32f2f;margin-bottom:20px;">Access Restricted</h1>
          <p style="font-size:18px;margin-bottom:30px;">${message}</p>
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

      setTimeout(() => {
        window.location.href = redirectInfo.redirect_url;
      }, 3000);
    }

    getDefaultBlockMessage(reason) {
      if (!reason) return "Access to this store has been restricted.";

      if (reason.includes("Country")) {
        return "Sorry, this store is not available in your country.";
      } else if (reason.includes("IP")) {
        return "Your access has been restricted.";
      } else if (reason.includes("Bot")) {
        return "Automated access is not allowed.";
      }

      return "Access to this store has been restricted.";
    }
  }

  // ============================================================================
  // ANALYTICS TRACKER CLASS
  // ============================================================================

  class AnalyticsTracker {
    constructor(sessionTracker, shop) {
      this.sessionTracker = sessionTracker;
      this.shop = shop;
      this.trackingInterval = null;
      this.lastTracked = 0;
    }

    async trackPageView(additionalData = {}) {
      const now = Date.now();

      // Throttle tracking to once every 5 seconds
      if (now - this.lastTracked < 5000) {
        return;
      }

      this.lastTracked = now;
      const sessionData = this.sessionTracker.getSessionData();

      const trackingData = {
        shop: this.shop,
        session_id: sessionData.sessionId,
        duration: sessionData.duration,
        page_views: sessionData.pageViews,
        page_url: window.location.href,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        ...additionalData,
      };

      // Add performance metrics if available
      if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        if (timing.loadEventEnd > 0) {
          trackingData.performance = {
            loadTime: timing.loadEventEnd - timing.navigationStart,
            domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
            firstPaint: timing.responseEnd - timing.navigationStart,
          };
        }
      }

      try {
        const response = await fetch("/apps/proxy-1/track_analytics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify(trackingData),
        });

        if (response.ok) {
          console.log("✌️Analytics tracked successfully");
        } else {
          console.log("✌️Analytics tracking failed:", response.status);
        }
      } catch (error) {
        console.log("✌️Analytics error:", error.message);
      }
    }

    startPeriodicTracking() {
      // Track every 30 seconds if user is active
      this.trackingInterval = setInterval(() => {
        if (this.sessionTracker.isActive()) {
          this.trackPageView({ action: "heartbeat" });
        }
      }, 30000);
    }

    stopPeriodicTracking() {
      if (this.trackingInterval) {
        clearInterval(this.trackingInterval);
        this.trackingInterval = null;
      }
    }

    async trackError(error) {
      try {
        await fetch("/apps/proxy-1/track_error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop: this.shop,
            session_id: this.sessionTracker.getSessionData().sessionId,
            error_message: error.message,
            error_stack: error.stack,
            page_url: window.location.href,
            user_agent: navigator.userAgent,
          }),
        });
      } catch (e) {
        // Fail silently
      }
    }
  }

  // ============================================================================
  // MAIN APPLICATION LOGIC
  // ============================================================================

  let sessionTracker;
  let accessChecker;
  let analyticsTracker;

  async function initialize() {
    console.log('✌️Initializing Block Country app...');

    try {
      // Initialize session tracking
      sessionTracker = new SessionTracker();
      
      // Initialize access checker
      accessChecker = new AccessChecker(sessionTracker);
      
      // Get shop domain
      const shop = accessChecker.shop;
      if (!shop) {
        console.log('✌️No shop domain found, app disabled');
        return;
      }

      // Initialize analytics
      analyticsTracker = new AnalyticsTracker(sessionTracker, shop);

      // Perform access check
      const result = await accessChecker.performAccessCheck();
      
      if (result?.blocked) {
        console.log('✌️Access blocked:', result.reason);
        accessChecker.handleBlockedAccess(result);
        return;
      }

      console.log('✌️Access allowed');

      // Load content protection if enabled
      if (result?.contentProtection?.enabled) {
        await loadContentProtection(shop, result.contentProtection.settings);
      }

      // Start tracking
      await analyticsTracker.trackPageView({
        country_code: result?.debug?.country,
        device_type: result?.debug?.deviceType,
        browser: result?.debug?.browser,
        is_bot: result?.debug?.isBot,
        client_ip: result?.debug?.clientIp
      });

      // Start periodic tracking
      analyticsTracker.startPeriodicTracking();

      console.log('✌️Block Country app initialized successfully');

    } catch (error) {
      console.error('✌️Initialization error:', error);
      if (analyticsTracker) {
        analyticsTracker.trackError(error);
      }
    }
  }

  async function loadContentProtection(shop, settings) {
    try {
      console.log('✌️Loading content protection module via fetch');
      const response = await fetch(`/apps/proxy-1/content_protection_script?shop=${shop}`);
      if (!response.ok) {
        throw new Error('Failed to fetch content protection script');
      }
      const scriptText = await response.text();
      const script = document.createElement('script');
      script.textContent = scriptText;
      document.head.appendChild(script);
      console.log('✌️Content protection loaded via fetch');
    } catch (error) {
      console.error('✌️Error loading content protection:', error);
    }
  }

  // ============================================================================
  // EVENT HANDLERS AND CLEANUP
  // ============================================================================

  // Global error handler
  window.addEventListener('error', (event) => {
    console.error('✌️Global error:', event.message);
    if (analyticsTracker) {
      analyticsTracker.trackError({
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno
      });
    }
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (sessionTracker) {
      sessionTracker.destroy();
    }
    if (analyticsTracker) {
      analyticsTracker.stopPeriodicTracking();
    }
  });

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();