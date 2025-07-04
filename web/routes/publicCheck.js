// web/routes/publicCheck.js
import express from "express";
import db from "../db.js";
import { getClientIp, normalizeIp } from "../utils/ipUtils.js";

const router = express.Router();

// Enhanced country check with redirect support
router.get("/check_country", async (req, res) => {
  const { shop, country } = req.query;

  if (!shop || !country) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Check country rules
    const countryResult = await db.query(
      `
      SELECT list_type, redirect_url 
      FROM blocked_countries 
      WHERE shop_domain = $1 AND country_code = $2
    `,
      [shop, country]
    );

    let blocked = false;
    let redirectUrl = null;
    let reason = null;

    if (countryResult.rows.length > 0) {
      const rule = countryResult.rows[0];
      blocked = rule.list_type === "blacklist";
      redirectUrl = rule.redirect_url;
      reason = blocked ? `Country ${country} is blacklisted` : null;
    } else {
      // Check if whitelist mode is active
      const whitelistCount = await db.query(
        "SELECT COUNT(*) FROM blocked_countries WHERE shop_domain = $1 AND list_type = 'whitelist'",
        [shop]
      );

      if (parseInt(whitelistCount.rows[0].count) > 0) {
        blocked = true;
        reason = `Country ${country} not in whitelist`;

        // Get default redirect from settings
        const settingsResult = await db.query(
          "SELECT redirect_url FROM country_settings WHERE shop_domain = $1",
          [shop]
        );
        redirectUrl = settingsResult.rows[0]?.redirect_url || null;
      }
    }

    await client.query("COMMIT");
    res.status(200).json({
      blocked,
      reason,
      redirect_url: redirectUrl,
      country_code: country,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error checking country:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Enhanced IP check with redirect support
router.get("/check_ip", async (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  const rawIp = getClientIp(req);
  const clientIp = normalizeIp(rawIp);

  if (!clientIp) {
    return res.status(400).json({ error: "Could not determine IP address" });
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Check IP rules
    const ipResult = await db.query(
      `
      SELECT list_type, redirect_url, note 
      FROM blocked_ips 
      WHERE shop_domain = $1 AND ip_address = $2
    `,
      [shop, clientIp]
    );

    let blocked = false;
    let redirectUrl = null;
    let reason = null;

    if (ipResult.rows.length > 0) {
      const rule = ipResult.rows[0];
      blocked = rule.list_type === "blacklist";
      redirectUrl = rule.redirect_url;
      reason = blocked ? rule.note || `IP ${clientIp} is blacklisted` : null;
    } else {
      // Check if whitelist mode is active
      const whitelistCount = await db.query(
        "SELECT COUNT(*) FROM blocked_ips WHERE shop_domain = $1 AND list_type = 'whitelist'",
        [shop]
      );

      if (parseInt(whitelistCount.rows[0].count) > 0) {
        blocked = true;
        reason = `IP ${clientIp} not in whitelist`;

        // Get default redirect from settings
        const settingsResult = await db.query(
          "SELECT redirect_url FROM ip_settings WHERE shop_domain = $1",
          [shop]
        );
        redirectUrl = settingsResult.rows[0]?.redirect_url || null;
      }
    }

    await client.query("COMMIT");
    res.status(200).json({
      blocked,
      reason,
      redirect_url: redirectUrl,
      ip: clientIp,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error checking IP:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Enhanced combined access check with redirect support
router.get("/check_access_enhanced", async (req, res) => {
  const {
    shop,
    country,
    session_id,
    device_type,
    browser,
    is_bot,
    page_url,
    referrer,
  } = req.query;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  const rawIp = getClientIp(req);
  const clientIp = normalizeIp(rawIp);
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    let blocked = false;
    let blockReason = null;
    let redirectUrl = null;
    let customMessage = null;

    // 1. Check country blocking (if country provided)
    if (country && !blocked) {
      const countryResult = await db.query(
        `
        SELECT list_type, redirect_url 
        FROM blocked_countries 
        WHERE shop_domain = $1 AND country_code = $2
      `,
        [shop, country]
      );

      if (countryResult.rows.length > 0) {
        const rule = countryResult.rows[0];
        if (rule.list_type === "blacklist") {
          blocked = true;
          blockReason = `Country blocked: ${country}`;
          redirectUrl = rule.redirect_url;
        }
      } else {
        // Check if whitelist mode is active for countries
        const whitelistCount = await db.query(
          "SELECT COUNT(*) FROM blocked_countries WHERE shop_domain = $1 AND list_type = 'whitelist'",
          [shop]
        );

        if (parseInt(whitelistCount.rows[0].count) > 0) {
          blocked = true;
          blockReason = `Country not in whitelist: ${country}`;

          // Get default redirect from country settings
          const settingsResult = await db.query(
            "SELECT redirect_url, custom_message FROM country_settings WHERE shop_domain = $1",
            [shop]
          );
          if (settingsResult.rows.length > 0) {
            redirectUrl = settingsResult.rows[0].redirect_url;
            customMessage = settingsResult.rows[0].custom_message;
          }
        }
      }
    }

    // 2. Check IP blocking (if not already blocked and IP available)
    if (!blocked && clientIp) {
      const ipResult = await db.query(
        `
        SELECT list_type, redirect_url, note 
        FROM blocked_ips 
        WHERE shop_domain = $1 AND ip_address = $2
      `,
        [shop, clientIp]
      );

      if (ipResult.rows.length > 0) {
        const rule = ipResult.rows[0];
        if (rule.list_type === "blacklist") {
          blocked = true;
          blockReason = rule.note || `IP blocked: ${clientIp}`;
          redirectUrl = rule.redirect_url;
        }
      } else {
        // Check if whitelist mode is active for IPs
        const whitelistCount = await db.query(
          "SELECT COUNT(*) FROM blocked_ips WHERE shop_domain = $1 AND list_type = 'whitelist'",
          [shop]
        );

        if (parseInt(whitelistCount.rows[0].count) > 0) {
          blocked = true;
          blockReason = `IP not in whitelist: ${clientIp}`;

          // Get default redirect from IP settings
          const settingsResult = await db.query(
            "SELECT redirect_url, custom_message FROM ip_settings WHERE shop_domain = $1",
            [shop]
          );
          if (settingsResult.rows.length > 0) {
            redirectUrl = settingsResult.rows[0].redirect_url;
            customMessage = settingsResult.rows[0].custom_message;
          }
        }
      }
    }

    // 3. Check content protection settings
    const protectionResult = await db.query(
      "SELECT * FROM content_protection_settings WHERE shop_domain = $1",
      [shop]
    );

    const hasContentProtection =
      protectionResult.rows.length > 0 &&
      Object.values(protectionResult.rows[0]).some((val) => val === true);

    // 4. Log analytics (enhanced with more data)
    try {
      await db.query(
        `
        INSERT INTO user_analytics (
          shop_domain, session_id, ip_address, country_code, 
          device_type, browser_name, page_url, referrer, 
          is_bot, blocked_reason, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT DO NOTHING
      `,
        [
          shop,
          session_id,
          clientIp,
          country,
          device_type,
          browser,
          page_url,
          referrer,
          is_bot === "true",
          blocked ? blockReason : null,
          req.headers["user-agent"] || "",
        ]
      );
    } catch (analyticsError) {
      console.error("Analytics logging error:", analyticsError);
      // Don't fail the request if analytics fails
    }

    await client.query("COMMIT");

    // 5. Return comprehensive response
    const response = {
      blocked,
      reason: blockReason,
      contentProtection: {
        enabled: hasContentProtection,
        settings: protectionResult.rows[0] || null,
      },
    };

    // Add redirect information if blocked
    if (blocked) {
      response.redirect_info = {
        redirect_url: redirectUrl,
        custom_message: customMessage,
        has_redirect: !!redirectUrl,
      };
    }

    res.json(response);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in enhanced access check:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Bot validation endpoint with redirect support
router.get("/validate_bot", async (req, res) => {
  const { shop, user_agent } = req.query;

  if (!shop || !user_agent) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const client = await db.getClient();

  try {
    const lowerUserAgent = user_agent.toLowerCase();

    // Check shop-specific bot settings first
    let { rows } = await client.query(
      `
      SELECT list_type, bot_name, redirect_url 
      FROM bot_settings 
      WHERE shop_domain = $1 AND is_enabled = true 
      AND (LOWER($2) LIKE '%' || LOWER(user_agent_pattern) || '%')
      ORDER BY list_type DESC
    `,
      [shop, lowerUserAgent]
    );

    // Fallback to global settings
    if (rows.length === 0) {
      const globalResult = await client.query(
        `
        SELECT list_type, bot_name, redirect_url 
        FROM bot_settings 
        WHERE shop_domain = '*' AND is_enabled = true 
        AND (LOWER($1) LIKE '%' || LOWER(user_agent_pattern) || '%')
        ORDER BY list_type DESC
      `,
        [lowerUserAgent]
      );
      rows = globalResult.rows;
    }

    let blocked = false;
    let redirectUrl = null;
    let reason = null;

    if (rows.length === 0) {
      // No specific rule found - default behavior for unknown bots
      blocked = true;
      reason = "Unknown bot - not in whitelist";
    } else {
      const setting = rows[0];
      blocked = setting.list_type !== "whitelist";
      redirectUrl = setting.redirect_url;
      reason = blocked ? `Bot blocked: ${setting.bot_name}` : null;
    }

    res.json({
      blocked,
      reason,
      redirect_url: redirectUrl,
    });
  } catch (error) {
    console.error("Error validating bot:", error);
    res.status(500).json({ error: "Bot validation failed" });
  } finally {
    client.release();
  }
});

// Analytics tracking endpoint (enhanced)
// Use this version if you want analytics to never fail
router.post("/track_analytics", async (req, res) => {
  const {
    shop,
    session_id,
    country_code,
    device_type,
    browser,
    is_bot,
    page_url,
    referrer,
    duration,
    page_views,
    user_agent,
  } = req.body;

  if (!shop || !session_id) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const client = await db.getClient();

  try {
    const clientIp = getClientIp(req);

    // Make session_id unique by adding timestamp
    const uniqueSessionId = session_id + "_" + Date.now();

    await client.query(
      `
      INSERT INTO user_analytics (
        shop_domain, session_id, ip_address, country_code, user_agent,
        device_type, browser_name, page_url, referrer, visit_duration,
        page_views, is_bot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `,
      [
        shop,
        uniqueSessionId,
        clientIp,
        country_code,
        user_agent,
        device_type,
        browser,
        page_url,
        referrer,
        duration,
        page_views,
        is_bot,
      ]
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error tracking analytics:", error);
    res.status(500).json({ error: "Failed to track analytics" }); 
  } finally {
    client.release();
  }
});

// Performance tracking endpoint
router.post("/track_performance", async (req, res) => {
  const {
    shop,
    session_id,
    load_time,
    dom_ready,
    page_url,
    connection_type,
    memory_info,
  } = req.body;

  if (!shop || !session_id) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const client = await db.getClient();

  try {
    await client.query(
      `
      INSERT INTO performance_analytics (
        shop_domain, session_id, page_url, load_time, dom_ready_time
      ) VALUES ($1, $2, $3, $4, $5)
    `,
      [shop, session_id, page_url, load_time, dom_ready]
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error tracking performance:", error);
    res.status(500).json({ error: "Failed to track performance" });
  } finally {
    client.release();
  }
});

// Error tracking endpoint
router.post("/track_error", async (req, res) => {
  const {
    shop,
    session_id,
    error_message,
    error_source,
    error_line,
    page_url,
    user_agent,
  } = req.body;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  // Log error to console (could also store in database)
  console.error(`Store Error [${shop}]:`, {
    message: error_message,
    source: error_source,
    line: error_line,
    page: page_url,
    session: session_id,
    userAgent: user_agent,
  });

  res.status(200).json({ success: true });
});

// Script error tracking endpoint
router.post("/track_script_error", async (req, res) => {
  const { shop, error_message, error_stack, page_url, user_agent } = req.body;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  // Log script error to console
  console.error(`Script Error [${shop}]:`, {
    message: error_message,
    stack: error_stack,
    page: page_url,
    userAgent: user_agent,
  });

  res.status(200).json({ success: true });
});

// Get blocking rules summary for a shop
router.get("/blocking_rules_summary", async (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  const client = await db.getClient();

  try {
    const summary = await db.query(
      `
      SELECT * FROM blocking_rules_summary WHERE shop_domain = $1
    `,
      [shop]
    );

    res.json({ summary: summary.rows });
  } catch (error) {
    console.error("Error fetching blocking rules summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  } finally {
    client.release();
  }
});

export default router;
