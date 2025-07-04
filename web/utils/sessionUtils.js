// web/utils/sessionUtils.js
import crypto from "crypto";

/**
 * Generate a unique session ID based on IP and user agent
 */
export function generateSessionId(ip, userAgent) {
  const data = `${ip}:${userAgent}:${Date.now()}`;
  return crypto
    .createHash("sha256")
    .update(data)
    .digest("hex")
    .substring(0, 32);
}

/**
 * Generate a fingerprint for the client (for tracking returning visitors)
 */
export function generateClientFingerprint(ip, userAgent) {
  const data = `${ip}:${userAgent}`;
  return crypto.createHash("md5").update(data).digest("hex");
}

/**
 * Check if session is still valid (within timeout period)
 */
export function isSessionValid(sessionTimestamp, timeoutMinutes = 30) {
  const now = new Date();
  const sessionTime = new Date(sessionTimestamp);
  const diffMinutes = (now - sessionTime) / (1000 * 60);
  return diffMinutes <= timeoutMinutes;
}

/**
 * Extract session info from request headers
 */
export function extractSessionInfo(req) {
  return {
    ip: req.clientInfo?.ip || req.ip,
    userAgent: req.headers["user-agent"] || "",
    referer: req.headers.referer || null,
    acceptLanguage: req.headers["accept-language"] || null,
    timestamp: new Date(),
  };
}
