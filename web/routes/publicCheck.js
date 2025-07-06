// web/routes/publicCheck.js
import express from "express";
import db from "../db.js";
import { normalizeIp } from "../utils/ipUtils.js";

const router = express.Router();

// Enhanced IP extraction function
function getEnhancedClientIP(req) {
  // Try multiple methods to get the real client IP
  const methods = [
    () => req.query.client_ip, // From frontend detection
    () => req.headers["cf-connecting-ip"], // Cloudflare
    () => req.headers["x-forwarded-for"]?.split(",")[0]?.trim(), // Proxy
    () => req.headers["x-real-ip"], // Direct
    () => req.ip, // Express
    () => req.connection.remoteAddress, // Raw connection
    () => req.socket.remoteAddress, // Socket
  ];

  for (const method of methods) {
    try {
      const ip = method();
      if (ip && ip !== "undefined" && ip !== "::1" && ip !== "127.0.0.1") {
        return normalizeIp(ip);
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

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
    client_ip,
    bot_name,
    user_agent,
  } = req.query;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  // Get client IP from multiple sources
  const detectedIp = client_ip || getEnhancedClientIP(req);
  const clientIp = normalizeIp(detectedIp);

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    let blocked = false;
    let blockReason = null;
    let redirectUrl = null;
    let customMessage = null;

    // 1. Check if IP is whitelisted (takes precedence)
    let ipWhitelisted = false;
    if (clientIp) {
      const ipWhitelistResult = await client.query(
        `
        SELECT 1 FROM blocked_ips 
        WHERE shop_domain = $1 AND ip_address = $2 AND list_type = 'whitelist'
        LIMIT 1
        `,
        [shop, clientIp]
      );
      ipWhitelisted = ipWhitelistResult.rows.length > 0;
    }

    if (ipWhitelisted) {
      blocked = false;
      blockReason = null;
      // Optionally, you can set a reason like "IP whitelisted"
    } else {
      // 2. Check country blocking (if country provided)
      if (country && !blocked) {
        const countryResult = await client.query(
          `
          SELECT list_type, redirect_url
          FROM blocked_countries 
          WHERE shop_domain = $1 AND country_code = $2
          LIMIT 1
        `,
          [shop, country]
        );

        // Check if whitelist mode is active
        const whitelistCount = await client.query(
          `
          SELECT COUNT(*) as count, 
                 (SELECT redirect_url FROM country_settings WHERE shop_domain = $1) as redirect_url,
                 (SELECT custom_message FROM country_settings WHERE shop_domain = $1) as custom_message
          FROM blocked_countries 
          WHERE shop_domain = $1 AND list_type = 'whitelist'
        `,
          [shop]
        );

        const hasWhitelistMode = parseInt(whitelistCount.rows[0].count) > 0;

        if (countryResult.rows.length > 0) {
          const rule = countryResult.rows[0];
          if (rule.list_type === "blacklist") {
            blocked = true;
            blockReason = `Country blocked: ${country}`;
            redirectUrl =
              rule.redirect_url || whitelistCount.rows[0]?.redirect_url;
            customMessage = whitelistCount.rows[0]?.custom_message;
          }
        } else if (hasWhitelistMode) {
          // Country not in whitelist
          blocked = true;
          blockReason = `Country not in whitelist: ${country}`;
          redirectUrl = whitelistCount.rows[0]?.redirect_url;
          customMessage = whitelistCount.rows[0]?.custom_message;
        }
      }

      // 3. Check IP blacklist (if not already blocked and IP available)
      if (!blocked && clientIp) {
        const ipResult = await client.query(
          `
          SELECT list_type, redirect_url, note
          FROM blocked_ips 
          WHERE shop_domain = $1 AND ip_address = $2
          LIMIT 1
        `,
          [shop, clientIp]
        );

        // Check if whitelist mode is active
        const ipWhitelistCount = await client.query(
          `
          SELECT COUNT(*) as count,
                 (SELECT redirect_url FROM ip_settings WHERE shop_domain = $1) as redirect_url,
                 (SELECT custom_message FROM ip_settings WHERE shop_domain = $1) as custom_message
          FROM blocked_ips 
          WHERE shop_domain = $1 AND list_type = 'whitelist'
        `,
          [shop]
        );

        const hasIpWhitelistMode = parseInt(ipWhitelistCount.rows[0].count) > 0;

        if (ipResult.rows.length > 0) {
          const rule = ipResult.rows[0];
          if (rule.list_type === "blacklist") {
            blocked = true;
            blockReason = rule.note || `IP blocked: ${clientIp}`;
            redirectUrl =
              rule.redirect_url || ipWhitelistCount.rows[0]?.redirect_url;
            customMessage = ipWhitelistCount.rows[0]?.custom_message;
          }
        } else if (hasIpWhitelistMode) {
          // IP not in whitelist
          blocked = true;
          blockReason = `IP not in whitelist: ${clientIp}`;
          redirectUrl = ipWhitelistCount.rows[0]?.redirect_url;
          customMessage = ipWhitelistCount.rows[0]?.custom_message;
        }
      }
    }

    // 4. Check bot blocking (if not already blocked)
    if (!blocked && is_bot === "true") {
      const userAgentToCheck = user_agent || req.headers["user-agent"] || "";
      const botNameToCheck = bot_name || "Unknown Bot";

      // Get bot rules
      const botRules = await client.query(
        `
        SELECT list_type, bot_name, user_agent_pattern
        FROM bot_settings 
        WHERE (shop_domain = $1 OR shop_domain = '*') 
          AND is_enabled = true
        ORDER BY 
          CASE WHEN shop_domain = $1 THEN 0 ELSE 1 END,
          list_type DESC
      `,
        [shop]
      );

      if (botRules.rows.length > 0) {
        const lowerUserAgent = userAgentToCheck.toLowerCase();

        // Separate whitelist and blacklist rules
        const whitelistRules = botRules.rows.filter(
          (r) => r.list_type === "whitelist"
        );
        const blacklistRules = botRules.rows.filter(
          (r) => r.list_type === "blacklist"
        );

        // Find matching rule
        let matchingRule = null;
        for (const rule of botRules.rows) {
          if (lowerUserAgent.includes(rule.user_agent_pattern.toLowerCase())) {
            matchingRule = rule;
            break;
          }
        }

        if (matchingRule) {
          if (matchingRule.list_type === "blacklist") {
            blocked = true;
            blockReason = `Bot blocked: ${
              matchingRule.bot_name || botNameToCheck
            }`;
          }
          // If whitelisted, explicitly allow (don't block)
        } else if (whitelistRules.length > 0) {
          // Has whitelist rules but bot not in whitelist
          blocked = true;
          blockReason = `Bot not in whitelist: ${botNameToCheck}`;
        }
      }
    }

    // 5. Check content protection settings
    const protectionResult = await client.query(
      "SELECT * FROM content_protection_settings WHERE shop_domain = $1",
      [shop]
    );

    const hasContentProtection =
      protectionResult.rows.length > 0 &&
      Object.entries(protectionResult.rows[0])
        .filter(([key]) => key.startsWith("disable_"))
        .some(([, value]) => value === true);

    // 6. Enhanced analytics logging with accurate session tracking
    try {
      if (session_id) {
        // Check for existing session (within 4 hours)
        const existingSession = await client.query(
          `
          SELECT id, page_views, visit_duration, created_at
          FROM user_analytics 
          WHERE shop_domain = $1 AND session_id = $2 
          AND created_at > NOW() - INTERVAL '4 hours'
          ORDER BY created_at DESC 
          LIMIT 1
        `,
          [shop, session_id]
        );

        if (existingSession.rows.length > 0) {
          // Update existing session - calculate accurate duration
          const sessionStart = new Date(existingSession.rows[0].created_at);
          const currentDuration = Math.round(
            (Date.now() - sessionStart.getTime()) / 1000
          );

          await client.query(
            `
            UPDATE user_analytics 
            SET page_views = page_views + 1,
                visit_duration = $1,
                page_url = $2,
                updated_at = CURRENT_TIMESTAMP,
                blocked_reason = COALESCE($3, blocked_reason)
            WHERE id = $4
          `,
            [
              currentDuration,
              page_url,
              blocked ? blockReason : null,
              existingSession.rows[0].id,
            ]
          );
        } else {
          // Create new session record
          await client.query(
            `
            INSERT INTO user_analytics (
              shop_domain, session_id, ip_address, country_code, 
              device_type, browser_name, page_url, referrer, 
              is_bot, bot_name, blocked_reason, user_agent, page_views, visit_duration
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, 0)
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
              bot_name,
              blocked ? blockReason : null,
              user_agent || req.headers["user-agent"] || "",
            ]
          );
        }
      }
    } catch (analyticsError) {
      console.error("Analytics logging error:", analyticsError);
      // Don't fail the request if analytics fails
    }

    await client.query("COMMIT");

    // 7. Return comprehensive response
    const response = {
      blocked,
      reason: blockReason,
      contentProtection: {
        enabled: hasContentProtection,
        settings: protectionResult.rows[0] || null,
      },
      debug: {
        clientIp: clientIp,
        detectedIp: detectedIp,
        userAgent: user_agent || req.headers["user-agent"],
        country: country,
        deviceType: device_type,
        browser: browser,
        isBot: is_bot === "true",
        botName: bot_name,
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
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  } finally {
    client.release();
  }
});

// Enhanced analytics tracking with accurate session time calculation
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
    screen_resolution,
    viewport_size,
    timezone,
    language,
    performance,
    client_ip,
    action,
  } = req.body;

  if (!shop || !session_id) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const clientIp = client_ip || getEnhancedClientIP(req);
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Check for existing session (within 4 hours)
    const existingSession = await client.query(
      `
      SELECT id, page_views, created_at, visit_duration, page_url
      FROM user_analytics 
      WHERE shop_domain = $1 AND session_id = $2 
      AND created_at > NOW() - INTERVAL '4 hours'
      ORDER BY created_at DESC 
      LIMIT 1
    `,
      [shop, session_id]
    );

    if (existingSession.rows.length > 0) {
      const session = existingSession.rows[0];
      const sessionStart = new Date(session.created_at);

      // Calculate accurate duration from session start
      const accurateDuration = Math.round(
        (Date.now() - sessionStart.getTime()) / 1000
      );

      // Update existing session
      await client.query(
        `
        UPDATE user_analytics 
        SET visit_duration = $1,
            page_views = GREATEST(page_views, $2),
            page_url = $3,
            updated_at = CURRENT_TIMESTAMP,
            user_agent = COALESCE(NULLIF($4, ''), user_agent),
            screen_resolution = COALESCE($5, screen_resolution),
            viewport_size = COALESCE($6, viewport_size),
            timezone = COALESCE($7, timezone),
            language = COALESCE($8, language),
            ip_address = COALESCE($9, ip_address)
        WHERE id = $10
      `,
        [
          accurateDuration,
          page_views || session.page_views + 1,
          page_url || session.page_url,
          user_agent,
          screen_resolution,
          viewport_size,
          timezone,
          language,
          clientIp,
          session.id,
        ]
      );
    } else {
      // Create new session
      await client.query(
        `
        INSERT INTO user_analytics (
          shop_domain, session_id, ip_address, country_code, user_agent,
          device_type, browser_name, page_url, referrer, visit_duration,
          page_views, is_bot, screen_resolution, viewport_size, timezone, language
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `,
        [
          shop,
          session_id,
          clientIp,
          country_code,
          user_agent,
          device_type,
          browser,
          page_url,
          referrer,
          0, // Start with 0 duration
          page_views || 1,
          is_bot || false,
          screen_resolution,
          viewport_size,
          timezone,
          language,
        ]
      );
    }

    // Log performance data if provided
    if (performance && performance.loadTime) {
      await client.query(
        `
        INSERT INTO performance_analytics (
          shop_domain, session_id, page_url, load_time, dom_ready_time, first_paint_time
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `,
        [
          shop,
          session_id,
          page_url,
          performance.loadTime,
          performance.domReady,
          performance.firstPaint,
        ]
      );
    }

    await client.query("COMMIT");
    res.status(200).json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error tracking analytics:", error);
    res.status(500).json({ error: "Failed to track analytics" });
  } finally {
    client.release();
  }
});

// Add new endpoint for exit tracking
router.post("/track_exit", async (req, res) => {
  const { shop, session_id, action, duration, page_views } = req.body;

  if (!shop || !session_id) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const client = await db.getClient();

  try {
    // Update final session duration
    await client.query(
      `
      UPDATE user_analytics 
      SET visit_duration = GREATEST(visit_duration, $1),
          page_views = GREATEST(page_views, $2),
          updated_at = CURRENT_TIMESTAMP
      WHERE shop_domain = $3 AND session_id = $4
        AND created_at > NOW() - INTERVAL '4 hours'
    `,
      [duration || 0, page_views || 1, shop, session_id]
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error tracking exit:", error);
    res.status(500).json({ error: "Failed to track exit" });
  } finally {
    client.release();
  }
});

// Enhanced content protection script endpoint
router.get("/content_protection_script", async (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  const client = await db.getClient();

  try {
    const { rows } = await client.query(
      `
      SELECT * FROM content_protection_settings 
      WHERE shop_domain = $1
    `,
      [shop]
    );

    if (rows.length === 0) {
      res.setHeader("Content-Type", "application/javascript");
      res.send("// No content protection enabled");
      return;
    }

    const settings = rows[0];
    const script = generateEnhancedProtectionScript(settings);

    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(script);
  } catch (error) {
    console.error("Error generating content protection script:", error);
    res.setHeader("Content-Type", "application/javascript");
    res.send("// Error loading content protection");
  } finally {
    client.release();
  }
});

// Enhanced content protection script generation
function generateEnhancedProtectionScript(settings) {
  const protections = [];

  if (settings.disable_right_click) {
    protections.push(`
      // Enhanced right-click protection
      document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showProtectionMessage('${settings.custom_protection_message}');
        return false;
      }, true);
      
      // Additional right-click protection for touch devices
      document.addEventListener('touchstart', function(e) {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }, { passive: false });
    `);
  }

  if (settings.disable_text_selection) {
    protections.push(`
      // Enhanced text selection protection
      document.addEventListener('selectstart', function(e) {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          return false;
        }
      }, true);
      
      document.addEventListener('mousedown', function(e) {
        if (e.detail > 1) { // Prevent triple-click selection
          e.preventDefault();
          return false;
        }
      }, true);
      
      // CSS to disable text selection
      const selectionStyle = document.createElement('style');
      selectionStyle.textContent = \`
        * {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          -webkit-touch-callout: none !important;
        }
        input, textarea, [contenteditable="true"] {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
        }
      \`;
      document.head.appendChild(selectionStyle);
    `);
  }

  if (settings.disable_image_drag) {
    protections.push(`
      // Enhanced image drag protection
      document.addEventListener('dragstart', function(e) {
        if (e.target.tagName === 'IMG') {
          e.preventDefault();
          showProtectionMessage('${settings.custom_protection_message}');
          return false;
        }
      }, true);
      
      // Prevent image saving via touch
      document.addEventListener('touchstart', function(e) {
        if (e.target.tagName === 'IMG') {
          e.preventDefault();
        }
      }, { passive: false });
      
      // Make all images non-draggable and add protection
      function protectImages() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
          img.draggable = false;
          img.oncontextmenu = function() { return false; };
          img.ondragstart = function() { return false; };
          img.onselectstart = function() { return false; };
          img.style.pointerEvents = 'none';
          img.style.userSelect = 'none';
        });
      }
      
      // Protect existing and new images
      protectImages();
      const observer = new MutationObserver(protectImages);
      observer.observe(document.body, { childList: true, subtree: true });
    `);
  }

  if (settings.disable_copy_paste) {
    protections.push(`
      // Enhanced copy/paste protection
      const protectedKeys = {
        67: 'copy', // Ctrl+C
        86: 'paste', // Ctrl+V  
        88: 'cut', // Ctrl+X
        65: 'select all', // Ctrl+A
        83: 'save', // Ctrl+S
        80: 'print' // Ctrl+P
      };
      
      document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) { // Include Cmd key for Mac
          if (protectedKeys[e.keyCode]) {
            // Allow in input/textarea fields
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
              e.preventDefault();
              e.stopPropagation();
              showProtectionMessage('${settings.custom_protection_message}');
              return false;
            }
          }
        }
      }, true);
      
      // Prevent clipboard events
      ['copy', 'cut', 'paste'].forEach(event => {
        document.addEventListener(event, function(e) {
          if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            showProtectionMessage('${settings.custom_protection_message}');
          }
        }, true);
      });
    `);
  }

  if (settings.disable_dev_tools) {
    protections.push(`
      // Enhanced developer tools protection
      const devToolsKeys = {
        123: 'F12',
        73: 'Ctrl+Shift+I',
        74: 'Ctrl+Shift+J', 
        67: 'Ctrl+Shift+C',
        85: 'Ctrl+U'
      };
      
      document.addEventListener('keydown', function(e) {
        if (e.keyCode === 123 || // F12
            (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) ||
            (e.ctrlKey && e.keyCode === 85)) { // Ctrl+U
          e.preventDefault();
          e.stopPropagation();
          showProtectionMessage('Developer tools are disabled');
          return false;
        }
      }, true);
      
      // Advanced dev tools detection
      let devtools = {
        open: false,
        orientation: null
      };
      
      const threshold = 160;
      setInterval(() => {
        if (window.outerHeight - window.innerHeight > threshold || 
            window.outerWidth - window.innerWidth > threshold) {
          if (!devtools.open) {
            devtools.open = true;
            document.body.innerHTML = '<div style="text-align:center;margin-top:20%;font-size:24px;font-family:Arial,sans-serif;">Developer tools detected. Please close them to continue.</div>';
          }
        } else {
          devtools.open = false;
        }
      }, 500);
      
      // Console protection
      let devtools_detect = false;
      Object.defineProperty(window, 'console', {
        get: function() {
          if (!devtools_detect) {
            devtools_detect = true;
           // showProtectionMessage('Console access is disabled');
          }
          return {};
        }
      });
    `);
  }

  // Enhanced protection message function
  const messageFunction = `
    function showProtectionMessage(message) {
      // Remove existing message
      const existingMessage = document.getElementById('protection-message');
      if (existingMessage) {
        existingMessage.remove();
      }
      
      // Create and show message with animation
      const messageDiv = document.createElement('div');
      messageDiv.id = 'protection-message';
      messageDiv.style.cssText = \`
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ff4444, #cc0000);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
      \`;
      messageDiv.textContent = message;
      document.body.appendChild(messageDiv);
      
      // Animate in
      setTimeout(() => {
        messageDiv.style.transform = 'translateX(0)';
      }, 10);
      
      // Auto-remove after 4 seconds with animation
      setTimeout(() => {
        messageDiv.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
          }
        }, 300);
      }, 4000);
    }
  `;

  return `
    (function() {
      'use strict';
      
      ${messageFunction}
      
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          ${protections.join("\n")}
        });
      } else {
        ${protections.join("\n")}
      }
      
      console.log('Enhanced content protection active for shop');
    })();
  `;
}

export default router;
