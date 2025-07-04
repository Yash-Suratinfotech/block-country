// web/utils/userAgentUtils.js

/**
 * Bot detection patterns and names
 */
const BOT_PATTERNS = [
  // Search Engine Bots
  { pattern: /googlebot/i, name: "Googlebot" },
  { pattern: /bingbot/i, name: "BingBot" },
  { pattern: /slurp/i, name: "Yahoo Slurp" },
  { pattern: /duckduckbot/i, name: "DuckDuckBot" },
  { pattern: /baiduspider/i, name: "Baidu Spider" },
  { pattern: /yandexbot/i, name: "YandexBot" },

  // Social Media Bots
  { pattern: /facebookexternalhit/i, name: "Facebook External Hit" },
  { pattern: /twitterbot/i, name: "TwitterBot" },
  { pattern: /linkedinbot/i, name: "LinkedIn Bot" },
  { pattern: /pinterest/i, name: "Pinterest" },
  { pattern: /whatsapp/i, name: "WhatsApp" },
  { pattern: /telegrambot/i, name: "Telegram Bot" },

  // SEO & Analytics Bots
  { pattern: /ahrefsbot/i, name: "aHrefs Bot" },
  { pattern: /semrushbot/i, name: "Semrush Bot" },
  { pattern: /mj12bot/i, name: "Majestic Bot" },
  { pattern: /dotbot/i, name: "DotBot" },
  { pattern: /sistrix/i, name: "SISTRIX Crawler" },
  { pattern: /screaming frog/i, name: "Screaming Frog" },

  // Development & Testing Bots
  { pattern: /lighthouse/i, name: "Lighthouse" },
  { pattern: /pagespeed/i, name: "PageSpeed Insights" },
  { pattern: /gtmetrix/i, name: "GTmetrix" },
  { pattern: /pingdom/i, name: "Pingdom" },
  { pattern: /uptimerobot/i, name: "UptimeRobot" },

  // E-commerce Specific
  { pattern: /applebot/i, name: "Applebot" },
  { pattern: /shopify/i, name: "Shopify Bot" },

  // Generic Bot Patterns
  { pattern: /bot/i, name: "Generic Bot" },
  { pattern: /crawler/i, name: "Generic Crawler" },
  { pattern: /spider/i, name: "Generic Spider" },
  { pattern: /scraper/i, name: "Generic Scraper" },
  { pattern: /curl/i, name: "cURL" },
  { pattern: /wget/i, name: "Wget" },
  { pattern: /python-requests/i, name: "Python Requests" },
  { pattern: /node-fetch/i, name: "Node Fetch" },
  { pattern: /axios/i, name: "Axios" },
];

/**
 * Device type detection patterns
 */
const DEVICE_PATTERNS = {
  mobile: [
    /mobile/i,
    /android/i,
    /iphone/i,
    /ipod/i,
    /blackberry/i,
    /windows phone/i,
    /opera mini/i,
    /palm/i,
    /webos/i,
  ],
  tablet: [
    /ipad/i,
    /android(?!.*mobile)/i,
    /tablet/i,
    /kindle/i,
    /silk/i,
    /playbook/i,
  ],
  desktop: [], // Default fallback
};

/**
 * Browser detection patterns
 */
const BROWSER_PATTERNS = [
  { pattern: /edg/i, name: "Edge" },
  { pattern: /chrome/i, name: "Chrome" },
  { pattern: /firefox/i, name: "Firefox" },
  { pattern: /safari/i, name: "Safari" },
  { pattern: /opera/i, name: "Opera" },
  { pattern: /ie|trident/i, name: "Internet Explorer" },
  { pattern: /samsung/i, name: "Samsung Browser" },
];

/**
 * Detect if user agent belongs to a bot
 */
export function detectBot(userAgent) {
  if (!userAgent) {
    return { isBot: false, name: null };
  }

  for (const { pattern, name } of BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { isBot: true, name };
    }
  }

  // Additional heuristics for bot detection
  const suspiciousPatterns = [
    /^$/, // Empty user agent
    /^[a-zA-Z0-9\-\.]+\/[0-9\.]+$/, // Simple version pattern
    /headless/i,
    /phantom/i,
    /automation/i,
    /test/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(userAgent)) {
      return { isBot: true, name: "Suspicious Bot" };
    }
  }

  return { isBot: false, name: null };
}

/**
 * Detect device type from user agent
 */
export function detectDevice(userAgent) {
  if (!userAgent) {
    return { type: "unknown" };
  }

  // Check mobile first (most specific)
  for (const pattern of DEVICE_PATTERNS.mobile) {
    if (pattern.test(userAgent)) {
      return { type: "mobile" };
    }
  }

  // Check tablet
  for (const pattern of DEVICE_PATTERNS.tablet) {
    if (pattern.test(userAgent)) {
      return { type: "tablet" };
    }
  }

  // Default to desktop
  return { type: "desktop" };
}

/**
 * Parse browser information from user agent
 */
export function parseUserAgent(userAgent) {
  if (!userAgent) {
    return { name: "Unknown", version: "Unknown" };
  }

  // Detect browser
  let browserName = "Unknown";
  for (const { pattern, name } of BROWSER_PATTERNS) {
    if (pattern.test(userAgent)) {
      browserName = name;
      break;
    }
  }

  // Extract version (simplified)
  let version = "Unknown";
  try {
    if (browserName === "Chrome") {
      const match = userAgent.match(/chrome\/([0-9.]+)/i);
      version = match ? match[1] : "Unknown";
    } else if (browserName === "Firefox") {
      const match = userAgent.match(/firefox\/([0-9.]+)/i);
      version = match ? match[1] : "Unknown";
    } else if (browserName === "Safari") {
      const match = userAgent.match(/version\/([0-9.]+).*safari/i);
      version = match ? match[1] : "Unknown";
    } else if (browserName === "Edge") {
      const match = userAgent.match(/edg\/([0-9.]+)/i);
      version = match ? match[1] : "Unknown";
    }
  } catch (error) {
    console.error("Error parsing browser version:", error);
  }

  return { name: browserName, version };
}

/**
 * Check if user agent is a legitimate search engine bot
 */
export function isLegitimateSearchBot(userAgent) {
  const legitimateBots = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i, // Yahoo
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
  ];

  return legitimateBots.some((pattern) => pattern.test(userAgent));
}

/**
 * Check if user agent is a social media crawler
 */
export function isSocialMediaBot(userAgent) {
  const socialBots = [
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /pinterest/i,
    /whatsapp/i,
  ];

  return socialBots.some((pattern) => pattern.test(userAgent));
}

/**
 * Check if user agent is a SEO/analytics bot
 */
export function isSEOBot(userAgent) {
  const seoBots = [
    /ahrefsbot/i,
    /semrushbot/i,
    /mj12bot/i,
    /dotbot/i,
    /sistrix/i,
  ];

  return seoBots.some((pattern) => pattern.test(userAgent));
}

/**
 * Get detailed user agent analysis
 */
export function analyzeUserAgent(userAgent) {
  const bot = detectBot(userAgent);
  const device = detectDevice(userAgent);
  const browser = parseUserAgent(userAgent);

  return {
    userAgent,
    isBot: bot.isBot,
    botName: bot.name,
    deviceType: device.type,
    browserName: browser.name,
    browserVersion: browser.version,
    isLegitimateSearchBot: isLegitimateSearchBot(userAgent),
    isSocialMediaBot: isSocialMediaBot(userAgent),
    isSEOBot: isSEOBot(userAgent),
    timestamp: new Date().toISOString(),
  };
}
