/**
 * Enhanced utility functions for IP address handling
 * Supports multiple detection methods, better validation, and enhanced security
 */

/**
 * Extract the real client IP address from the request using multiple methods
 * Enhanced version with priority order and validation
 */
export function getClientIp(req) {
  // Priority order of IP detection methods
  const ipSources = [
    // Cloudflare (highest priority for CF-hosted sites)
    () => req.headers["cf-connecting-ip"],

    // Real IP header (nginx, other proxies)
    () => req.headers["x-real-ip"],

    // X-Forwarded-For (most common proxy header)
    () => {
      const xForwardedFor = req.headers["x-forwarded-for"];
      if (xForwardedFor) {
        // Take the first IP in the chain (original client)
        const ips = xForwardedFor.split(",").map((ip) => ip.trim());
        // Return first non-private IP, or first IP if all are private
        return ips.find((ip) => !isPrivateIp(ip)) || ips[0];
      }
      return null;
    },

    // Other proxy headers
    () => req.headers["x-forwarded"],
    () => req.headers["x-cluster-client-ip"],
    () => req.headers["forwarded-for"],
    () => req.headers["forwarded"],

    // Client IP from query (for frontend-detected IPs)
    () => req.query?.client_ip,
    () => req.body?.client_ip,

    // Express framework IP (with trust proxy)
    () => req.ip,

    // Raw connection IPs (fallback)
    () => req.connection?.remoteAddress,
    () => req.socket?.remoteAddress,
    () => req.connection?.socket?.remoteAddress,
    () => req.info?.remoteAddress, // For some server configurations
  ];

  // Try each method in priority order
  for (const getIP of ipSources) {
    try {
      const ip = getIP();
      if (ip && isValidIp(ip) && ip !== "undefined" && ip !== "null") {
        const normalizedIP = normalizeIp(ip);
        if (normalizedIP && !isLoopbackIp(normalizedIP)) {
          return normalizedIP;
        }
      }
    } catch (error) {
      // Continue to next method if this one fails
      continue;
    }
  }

  // Return null if no valid IP found
  return null;
}

/**
 * Enhanced IP address normalization
 * Handles IPv6, IPv4-mapped IPv6, and various edge cases
 */
export function normalizeIp(ip) {
  if (!ip || typeof ip !== "string") return null;

  // Trim whitespace and convert to lowercase
  ip = ip.trim().toLowerCase();

  // Handle IPv6-mapped IPv4 addresses
  if (ip.startsWith("::ffff:")) {
    const ipv4 = ip.substring(7);
    if (isValidIpv4(ipv4)) {
      return ipv4;
    }
  }

  // Handle IPv6 in brackets (common in some headers)
  if (ip.startsWith("[") && ip.endsWith("]")) {
    ip = ip.slice(1, -1);
  }

  // Remove port number if present
  const portIndex = ip.lastIndexOf(":");
  if (portIndex > 0 && ip.indexOf(":") !== portIndex) {
    // This is IPv6, don't remove the last colon
  } else if (portIndex > 0 && !ip.includes("::")) {
    // This might be IPv4:port or IPv6 with port
    const beforeColon = ip.substring(0, portIndex);
    if (isValidIpv4(beforeColon)) {
      ip = beforeColon;
    }
  }

  return ip;
}

/**
 * Enhanced validation for both IPv4 and IPv6
 */
export function isValidIp(ip) {
  if (!ip || typeof ip !== "string") return false;
  return isValidIpv4(ip) || isValidIpv6(ip);
}

/**
 * Validate IPv4 address with proper range checking
 */
export function isValidIpv4(ip) {
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

/**
 * Enhanced IPv6 validation
 */
export function isValidIpv6(ip) {
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

/**
 * Enhanced private IP detection including more ranges
 */
export function isPrivateIp(ip) {
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

/**
 * Check if IP is loopback (localhost)
 */
export function isLoopbackIp(ip) {
  if (!ip) return false;

  const loopbackPatterns = [
    /^127\./, // IPv4 loopback
    /^::1$/, // IPv6 loopback
    /^localhost$/i,
  ];

  return loopbackPatterns.some((pattern) => pattern.test(ip));
}

/**
 * Detect if IP might be from a VPN or proxy service
 * Basic detection - not 100% accurate but helps identify obvious cases
 */
export function isPotentialProxy(ip) {
  if (!ip || !isValidIp(ip)) return false;

  // Known VPN/Proxy IP ranges (basic detection)
  const proxyPatterns = [
    // Common VPN provider ranges (examples - would need comprehensive list)
    /^185\.159\./, // Some VPN providers
    /^185\.233\./, // Some VPN providers
    /^91\.247\./, // Some VPN providers

    // Add more patterns as needed based on your threat intelligence
  ];

  return proxyPatterns.some((pattern) => pattern.test(ip));
}

/**
 * Get IP type classification
 */
export function getIpType(ip) {
  if (!ip || !isValidIp(ip)) return "invalid";

  if (isLoopbackIp(ip)) return "loopback";
  if (isPrivateIp(ip)) return "private";
  if (isPotentialProxy(ip)) return "proxy";
  if (isValidIpv6(ip)) return "public_ipv6";
  if (isValidIpv4(ip)) return "public_ipv4";

  return "unknown";
}

/**
 * Enhanced IP geolocation (using free service with fallbacks)
 * Note: For production, consider using paid services for better accuracy
 */
export async function getIpInfo(ip, options = {}) {
  if (!ip || !isValidIp(ip) || isPrivateIp(ip)) {
    return null;
  }

  const { timeout = 5000, retries = 2 } = options;

  // List of free IP geolocation services (as fallbacks)
  const services = [
    {
      name: "ip-api",
      url: `http://ip-api.com/json/${ip}`,
      parser: (data) =>
        data.status === "success"
          ? {
              country: data.country,
              countryCode: data.countryCode,
              region: data.regionName,
              city: data.city,
              isp: data.isp,
              org: data.org,
              as: data.as,
              proxy: data.proxy,
              hosting: data.hosting,
            }
          : null,
    },
    {
      name: "ipapi",
      url: `https://ipapi.co/${ip}/json/`,
      parser: (data) =>
        data.error
          ? null
          : {
              country: data.country_name,
              countryCode: data.country_code,
              region: data.region,
              city: data.city,
              isp: data.org,
              timezone: data.timezone,
            },
    },
  ];

  for (const service of services) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(service.url, {
          signal: controller.signal,
          headers: { "User-Agent": "ShopifyBlockCountryApp/1.0" },
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const parsed = service.parser(data);
          if (parsed) {
            return { ...parsed, source: service.name };
          }
        }
      } catch (error) {
        console.error(
          `IP info service ${service.name} failed (attempt ${attempt + 1}):`,
          error.message
        );
        if (attempt === retries - 1) {
          // Last attempt for this service failed, try next service
          break;
        }
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  return null;
}

/**
 * Rate limiting helper for IP-based limiting
 */
export function getIpHash(ip) {
  if (!ip) return null;

  // Simple hash for rate limiting (not cryptographically secure)
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if IP is in a CIDR range
 * Useful for bulk IP range blocking
 */
export function isIpInCidr(ip, cidr) {
  if (!ip || !cidr || !isValidIpv4(ip)) return false;

  const [range, bits] = cidr.split("/");
  if (!range || !bits || !isValidIpv4(range)) return false;

  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range);

  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * Convert IPv4 to integer for CIDR calculations
 */
function ipToInt(ip) {
  return (
    ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0
  );
}

/**
 * Bulk validate multiple IPs
 */
export function validateIpList(ips) {
  if (!Array.isArray(ips)) return [];

  return ips
    .map((ip) => ({
      ip: ip,
      valid: isValidIp(ip),
      type: getIpType(ip),
      normalized: normalizeIp(ip),
    }))
    .filter((result) => result.valid);
}

/**
 * Advanced IP detection for debugging
 * Returns all possible IP addresses found in request
 */
export function debugIpDetection(req) {
  const sources = {
    "cf-connecting-ip": req.headers["cf-connecting-ip"],
    "x-real-ip": req.headers["x-real-ip"],
    "x-forwarded-for": req.headers["x-forwarded-for"],
    "x-forwarded": req.headers["x-forwarded"],
    "x-cluster-client-ip": req.headers["x-cluster-client-ip"],
    "forwarded-for": req.headers["forwarded-for"],
    forwarded: req.headers["forwarded"],
    "client-ip-query": req.query?.client_ip,
    "client-ip-body": req.body?.client_ip,
    "req.ip": req.ip,
    remoteAddress: req.connection?.remoteAddress,
    socket: req.socket?.remoteAddress,
    "connection-socket": req.connection?.socket?.remoteAddress,
  };

  const results = {};
  for (const [source, ip] of Object.entries(sources)) {
    if (ip) {
      results[source] = {
        raw: ip,
        normalized: normalizeIp(ip),
        valid: isValidIp(ip),
        type: getIpType(normalizeIp(ip)),
      };
    }
  }

  return {
    sources: results,
    recommended: getClientIp(req),
    timestamp: new Date().toISOString(),
  };
}
