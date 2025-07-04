import db from "../db.js";
import { getClientIp, normalizeIp, isPrivateIp } from "../utils/ipUtils.js";

/**
 * Middleware to block requests from blocked IP addresses
 * Use this middleware on routes you want to protect
 */
export const ipBlockingMiddleware = async (req, res, next) => {
  // Get the client's real IP address
  const rawIp = getClientIp(req);
  const clientIp = normalizeIp(rawIp);

  // Extract shop domain from request
  const shop = req.query.shop || req.body.shop || req.session?.shop;

  if (!shop || !clientIp) {
    return next();
  }

  // Optional: Skip blocking for private IPs (for development)
  if (process.env.NODE_ENV === "development" && isPrivateIp(clientIp)) {
    return next();
  }

  try {
    const { rows } = await db.query(
      "SELECT note FROM blocked_ips WHERE shop_domain = $1 AND ip_address = $2 LIMIT 1",
      [shop, clientIp]
    );

    if (rows.length > 0) {
      // IP is blocked
      console.log(
        `Blocked access attempt from IP: ${clientIp} for shop: ${shop}`
      );

      return res.status(403).json({
        error: "Access denied",
        message: "Your IP address has been blocked from accessing this store.",
        code: "IP_BLOCKED",
      });
    }

    // Add the normalized IP to the request for logging
    req.clientIp = clientIp;

    // IP is not blocked, continue
    next();
  } catch (error) {
    console.error("Error checking blocked IP:", error);
    // In case of error, allow the request to continue
    next();
  }
};

/**
 * Express app configuration to trust proxy and get real IP
 * Add this to your main app.js file:
 *
 * app.set('trust proxy', true);
 *
 * This ensures req.ip contains the real client IP when behind a proxy
 *
 * Usage example:
 * app.use('/protected-route', ipBlockingMiddleware, (req, res) => {
 *   // Your protected route logic
 * });
 */