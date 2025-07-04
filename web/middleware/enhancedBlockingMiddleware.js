// web/middleware/enhancedBlockingMiddleware.js
import db from "../db.js";
import { getClientIp, normalizeIp, isPrivateIp } from "../utils/ipUtils.js";
import {
  detectBot,
  detectDevice,
  parseUserAgent,
} from "../utils/userAgentUtils.js";
import { generateSessionId } from "../utils/sessionUtils.js";

/**
 * Enhanced middleware that handles all blocking logic:
 * - Country whitelist/blacklist
 * - IP whitelist/blacklist
 * - Bot detection and blocking
 * - User analytics tracking
 */
export const enhancedBlockingMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  const rawIp = getClientIp(req);
  const clientIp = normalizeIp(rawIp);
  const userAgent = req.headers["user-agent"] || "";
  const shop = req.query.shop || req.body.shop || req.session?.shop;

  // Skip if no shop or IP (but log it)
  if (!shop || !clientIp) {
    return next();
  }

  // Skip blocking for private IPs in development
  if (process.env.NODE_ENV === "development" && isPrivateIp(clientIp)) {
    return next();
  }

  const client = await db.getClient();
  let isBlocked = false;
  let blockReason = null;
  let sessionId = generateSessionId(clientIp, userAgent);

  try {
    await client.query("BEGIN");

    // 1. Detect bot
    const botInfo = detectBot(userAgent);
    const deviceInfo = detectDevice(userAgent);
    const browserInfo = parseUserAgent(userAgent);

    // 2. Check bot whitelist/blacklist
    if (botInfo.isBot) {
      const botCheck = await checkBotAccess(
        client,
        shop,
        userAgent,
        botInfo.name
      );
      if (botCheck.blocked) {
        isBlocked = true;
        blockReason = `Bot blocked: ${botInfo.name || "Unknown bot"}`;
      }
    }

    // 3. Check IP whitelist/blacklist (only if not already blocked)
    if (!isBlocked) {
      const ipCheck = await checkIpAccess(client, shop, clientIp);
      if (ipCheck.blocked) {
        isBlocked = true;
        blockReason = ipCheck.reason || "IP address blocked";
      }
    }

    // 4. Check country whitelist/blacklist (only if not already blocked)
    let countryCode = null;
    if (!isBlocked) {
      // Try to get country from various sources
      countryCode =
        req.query.country ||
        req.headers["cf-ipcountry"] ||
        (await guessCountryFromTimezone(req));

      if (countryCode) {
        const countryCheck = await checkCountryAccess(
          client,
          shop,
          countryCode
        );
        if (countryCheck.blocked) {
          isBlocked = true;
          blockReason = `Country blocked: ${countryCode}`;
        }
      }
    }

    // 5. Log analytics (regardless of blocking)
    await logUserAnalytics(client, {
      shop_domain: shop,
      session_id: sessionId,
      ip_address: clientIp,
      country_code: countryCode,
      user_agent: userAgent,
      device_type: deviceInfo.type,
      browser_name: browserInfo.name,
      browser_version: browserInfo.version,
      page_url: req.originalUrl,
      referrer: req.headers.referer || null,
      visit_duration: Math.round((Date.now() - startTime) / 1000),
      is_bot: botInfo.isBot,
      bot_name: botInfo.name,
      blocked_reason: isBlocked ? blockReason : null,
    });

    await client.query("COMMIT");

    // 6. Block if necessary
    if (isBlocked) {
      console.log(
        `Blocked access: ${blockReason} - IP: ${clientIp}, Shop: ${shop}`
      );

      return res.status(403).json({
        error: "Access denied",
        message: getBlockMessage(blockReason),
        code: "ACCESS_BLOCKED",
        reason: blockReason,
      });
    }

    // Add info to request for logging
    req.clientInfo = {
      ip: clientIp,
      bot: botInfo,
      device: deviceInfo,
      browser: browserInfo,
      country: countryCode,
      sessionId,
    };

    next();
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in enhanced blocking middleware:", error);
    // Fail open - allow access if check fails
    next();
  } finally {
    client.release();
  }
};

/**
 * Check if bot is allowed based on whitelist/blacklist
 */
async function checkBotAccess(client, shop, userAgent, botName) {
  const lowerUserAgent = userAgent.toLowerCase();

  // Check shop-specific bot settings first
  let { rows } = await client.query(
    `
    SELECT list_type, bot_name 
    FROM bot_settings 
    WHERE shop_domain = $1 AND is_enabled = true 
    AND (LOWER($2) LIKE '%' || LOWER(user_agent_pattern) || '%')
    ORDER BY list_type DESC
  `,
    [shop, lowerUserAgent]
  );

  // Fallback to global settings (shop_domain = '*')
  if (rows.length === 0) {
    const globalResult = await client.query(
      `
      SELECT list_type, bot_name 
      FROM bot_settings 
      WHERE shop_domain = '*' AND is_enabled = true 
      AND (LOWER($1) LIKE '%' || LOWER(user_agent_pattern) || '%')
      ORDER BY list_type DESC
    `,
      [lowerUserAgent]
    );
    rows = globalResult.rows;
  }

  if (rows.length === 0) {
    // No specific rule found - default behavior for unknown bots
    return { blocked: true, reason: "Unknown bot - not in whitelist" };
  }

  const setting = rows[0];
  const isWhitelisted = setting.list_type === "whitelist";

  return {
    blocked: !isWhitelisted,
    reason: isWhitelisted
      ? null
      : `Bot blocked: ${setting.bot_name || botName}`,
  };
}

/**
 * Check IP whitelist/blacklist
 */
async function checkIpAccess(client, shop, ip) {
  const { rows } = await client.query(
    `
    SELECT list_type, note 
    FROM blocked_ips 
    WHERE shop_domain = $1 AND ip_address = $2 
    ORDER BY list_type DESC 
    LIMIT 1
  `,
    [shop, ip]
  );

  if (rows.length === 0) {
    // No rule found - check if whitelist mode is enabled
    const whitelistCount = await client.query(
      "SELECT COUNT(*) FROM blocked_ips WHERE shop_domain = $1 AND list_type = 'whitelist'",
      [shop]
    );

    if (parseInt(whitelistCount.rows[0].count) > 0) {
      // Whitelist mode is active, block IPs not in whitelist
      return { blocked: true, reason: "IP not in whitelist" };
    }

    // No whitelist mode, allow access
    return { blocked: false };
  }

  const setting = rows[0];
  const isWhitelisted = setting.list_type === "whitelist";

  return {
    blocked: !isWhitelisted,
    reason: isWhitelisted ? null : setting.note || "IP address blocked",
  };
}

/**
 * Check country whitelist/blacklist
 */
async function checkCountryAccess(client, shop, countryCode) {
  const { rows } = await client.query(
    `
    SELECT list_type 
    FROM blocked_countries 
    WHERE shop_domain = $1 AND country_code = $2 
    ORDER BY list_type DESC 
    LIMIT 1
  `,
    [shop, countryCode]
  );

  if (rows.length === 0) {
    // No rule found - check if whitelist mode is enabled
    const whitelistCount = await client.query(
      "SELECT COUNT(*) FROM blocked_countries WHERE shop_domain = $1 AND list_type = 'whitelist'",
      [shop]
    );

    if (parseInt(whitelistCount.rows[0].count) > 0) {
      // Whitelist mode is active, block countries not in whitelist
      return { blocked: true };
    }

    // No whitelist mode, allow access
    return { blocked: false };
  }

  const setting = rows[0];
  const isWhitelisted = setting.list_type === "whitelist";

  return { blocked: !isWhitelisted };
}

/**
 * Log user analytics
 */
async function logUserAnalytics(client, data) {
  try {
    // Check if session already exists
    const existingSession = await client.query(
      `
      SELECT id, page_views, visit_duration 
      FROM user_analytics 
      WHERE shop_domain = $1 AND session_id = $2 
      AND created_at > NOW() - INTERVAL '30 minutes'
      ORDER BY created_at DESC 
      LIMIT 1
    `,
      [data.shop_domain, data.session_id]
    );

    if (existingSession.rows.length > 0) {
      // Update existing session
      await client.query(
        `
        UPDATE user_analytics 
        SET page_views = page_views + 1,
            visit_duration = $1,
            page_url = $2,
            updated_at = NOW()
        WHERE id = $3
      `,
        [data.visit_duration, data.page_url, existingSession.rows[0].id]
      );
    } else {
      // Create new session record
      await client.query(
        `
        INSERT INTO user_analytics (
          shop_domain, session_id, ip_address, country_code, user_agent,
          device_type, browser_name, browser_version, page_url, referrer,
          visit_duration, is_bot, bot_name, blocked_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `,
        [
          data.shop_domain,
          data.session_id,
          data.ip_address,
          data.country_code,
          data.user_agent,
          data.device_type,
          data.browser_name,
          data.browser_version,
          data.page_url,
          data.referrer,
          data.visit_duration,
          data.is_bot,
          data.bot_name,
          data.blocked_reason,
        ]
      );
    }
  } catch (error) {
    console.error("Error logging analytics:", error);
    // Don't throw - analytics shouldn't break the request
  }
}

/**
 * Get user-friendly block message
 */
function getBlockMessage(reason) {
  if (reason.includes("Bot blocked")) {
    return "This bot is not allowed to access this store.";
  }
  if (reason.includes("IP")) {
    return "Your IP address has been blocked from accessing this store.";
  }
  if (reason.includes("Country")) {
    return "This store is not available in your country.";
  }
  return "Access to this store has been restricted.";
}

/**
 * Try to guess country from browser timezone (fallback)
 */
async function guessCountryFromTimezone(req) {
  // This would need to be implemented on the frontend and passed as a header
  // For now, return null
  return null;
}
