/**
 * Utility functions for IP address handling
 */

/**
 * Extract the real client IP address from the request
 * Handles various proxy configurations
 */
export function getClientIp(req) {
  // Check x-forwarded-for header (most common)
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return xForwardedFor.split(",")[0].trim();
  }

  // Check other common headers
  const xRealIp = req.headers["x-real-ip"];
  if (xRealIp) {
    return xRealIp;
  }

  // Cloudflare
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to req.ip (Express with trust proxy)
  if (req.ip) {
    return req.ip;
  }

  // Last resort - direct connection
  return (
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket?.remoteAddress
  );
}

/**
 * Normalize IP address format
 * Converts IPv6 mapped IPv4 addresses to standard IPv4
 */
export function normalizeIp(ip) {
  if (!ip) return null;

  // Remove IPv6 prefix for IPv4 addresses
  if (ip.substr(0, 7) === "::ffff:") {
    return ip.substr(7);
  }

  return ip;
}

/**
 * Check if an IP address is private/internal
 */
export function isPrivateIp(ip) {
  const privateRanges = [
    /^10\./, // 10.0.0.0 - 10.255.255.255
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0 - 172.31.255.255
    /^192\.168\./, // 192.168.0.0 - 192.168.255.255
    /^127\./, // 127.0.0.0 - 127.255.255.255 (loopback)
    /^::1$/, // IPv6 loopback
    /^fe80::/, // IPv6 link-local
    /^fc00::/, // IPv6 private
  ];

  return privateRanges.some((range) => range.test(ip));
}

/**
 * Validate IP address format
 */
export function isValidIp(ip) {
  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split(".");
    return parts.every((part) => parseInt(part) >= 0 && parseInt(part) <= 255);
  }

  // IPv6 validation (simplified)
  const ipv6Regex = /^([\da-fA-F]{0,4}:){2,7}[\da-fA-F]{0,4}$/;
  return ipv6Regex.test(ip) || ip === "::1";
}

/**
 * Get IP geolocation info (optional - requires external API)
 */
export async function getIpInfo(ip) {
  try {
    // Example using ip-api.com (free tier available)
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await response.json();

    if (data.status === "success") {
      return {
        country: data.country,
        countryCode: data.countryCode,
        region: data.regionName,
        city: data.city,
        isp: data.isp,
      };
    }
  } catch (error) {
    console.error("Error fetching IP info:", error);
  }

  return null;
}
