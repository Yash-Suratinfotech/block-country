// extensions/country-blocker/assets/helper.js

// Static Timezone to Country mapping
export const timezoneMap = {
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
export const botPatterns = [
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
export function getSessionId() {
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
    return "temp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
  }
}

//  IP detection - try multiple methods
export function getClientIP() {
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
export function getShopDomain() {
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
