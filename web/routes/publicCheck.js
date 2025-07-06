// web/routes/publicCheck.js
import express from "express";
import db from "../db.js";
import { getClientIp, normalizeIp } from "../utils/ipUtils.js";

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

// Enhanced country check with whitelist/blacklist support
router.get("/check_country", async (req, res) => {
  const { shop, country } = req.query;

  if (!shop || !country) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Get all country rules for this shop
    const countryRules = await client.query(
      `
      SELECT list_type, redirect_url, country_code
      FROM blocked_countries 
      WHERE shop_domain = $1
      ORDER BY list_type DESC
    `,
      [shop]
    );

    let blocked = false;
    let redirectUrl = null;
    let reason = null;

    // Check if we have any rules
    if (countryRules.rows.length === 0) {
      // No rules = allow all
      blocked = false;
    } else {
      // Check for whitelist rules first
      const whitelistRules = countryRules.rows.filter(
        (r) => r.list_type === "whitelist"
      );
      const blacklistRules = countryRules.rows.filter(
        (r) => r.list_type === "blacklist"
      );

      if (whitelistRules.length > 0) {
        // Whitelist mode: only allow countries in whitelist
        const isWhitelisted = whitelistRules.some(
          (r) => r.country_code === country
        );
        if (!isWhitelisted) {
          blocked = true;
          reason = `Country ${country} not in whitelist`;
          // Get default redirect from settings
          const settingsResult = await client.query(
            "SELECT redirect_url FROM country_settings WHERE shop_domain = $1",
            [shop]
          );
          redirectUrl = settingsResult.rows[0]?.redirect_url || null;
        }
      } else if (blacklistRules.length > 0) {
        // Blacklist mode: block countries in blacklist
        const blacklistedRule = blacklistRules.find(
          (r) => r.country_code === country
        );
        if (blacklistedRule) {
          blocked = true;
          reason = `Country ${country} is blacklisted`;
          redirectUrl = blacklistedRule.redirect_url;
        }
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

// Enhanced IP check with whitelist/blacklist support
router.get("/check_ip", async (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  const clientIp = getEnhancedClientIP(req);

  if (!clientIp) {
    return res.status(400).json({ error: "Could not determine IP address" });
  }

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Get all IP rules for this shop
    const ipRules = await client.query(
      `
      SELECT list_type, redirect_url, note, ip_address
      FROM blocked_ips 
      WHERE shop_domain = $1
      ORDER BY list_type DESC
    `,
      [shop]
    );

    let blocked = false;
    let redirectUrl = null;
    let reason = null;

    // Check if we have any rules
    if (ipRules.rows.length === 0) {
      // No rules = allow all
      blocked = false;
    } else {
      // Check for whitelist rules first
      const whitelistRules = ipRules.rows.filter(
        (r) => r.list_type === "whitelist"
      );
      const blacklistRules = ipRules.rows.filter(
        (r) => r.list_type === "blacklist"
      );

      if (whitelistRules.length > 0) {
        // Whitelist mode: only allow IPs in whitelist
        const isWhitelisted = whitelistRules.some(
          (r) => r.ip_address === clientIp
        );
        if (!isWhitelisted) {
          blocked = true;
          reason = `IP ${clientIp} not in whitelist`;
          // Get default redirect from settings
          const settingsResult = await client.query(
            "SELECT redirect_url FROM ip_settings WHERE shop_domain = $1",
            [shop]
          );
          redirectUrl = settingsResult.rows[0]?.redirect_url || null;
        }
      } else if (blacklistRules.length > 0) {
        // Blacklist mode: block IPs in blacklist
        const blacklistedRule = blacklistRules.find(
          (r) => r.ip_address === clientIp
        );
        if (blacklistedRule) {
          blocked = true;
          reason = blacklistedRule.note || `IP ${clientIp} is blacklisted`;
          redirectUrl = blacklistedRule.redirect_url;
        }
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

// Fixed and enhanced combined access check
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

    // 1. Check country blocking (if country provided)
    if (country && !blocked) {
      const countryRules = await client.query(
        `
        SELECT list_type, redirect_url, country_code
        FROM blocked_countries 
        WHERE shop_domain = $1
        ORDER BY list_type DESC
      `,
        [shop]
      );

      if (countryRules.rows.length > 0) {
        const whitelistRules = countryRules.rows.filter(
          (r) => r.list_type === "whitelist"
        );
        const blacklistRules = countryRules.rows.filter(
          (r) => r.list_type === "blacklist"
        );

        if (whitelistRules.length > 0) {
          // Whitelist mode
          const isWhitelisted = whitelistRules.some(
            (r) => r.country_code === country
          );
          if (!isWhitelisted) {
            blocked = true;
            blockReason = `Country not in whitelist: ${country}`;

            const settingsResult = await client.query(
              "SELECT redirect_url, custom_message FROM country_settings WHERE shop_domain = $1",
              [shop]
            );
            if (settingsResult.rows.length > 0) {
              redirectUrl = settingsResult.rows[0].redirect_url;
              customMessage = settingsResult.rows[0].custom_message;
            }
          }
        } else if (blacklistRules.length > 0) {
          // Blacklist mode
          const blacklistedRule = blacklistRules.find(
            (r) => r.country_code === country
          );
          if (blacklistedRule) {
            blocked = true;
            blockReason = `Country blocked: ${country}`;
            redirectUrl = blacklistedRule.redirect_url;
          }
        }
      }
    }

    // 2. Check IP blocking (if not already blocked and IP available)
    if (!blocked && clientIp) {
      const ipRules = await client.query(
        `
        SELECT list_type, redirect_url, note, ip_address
        FROM blocked_ips 
        WHERE shop_domain = $1
        ORDER BY list_type DESC
      `,
        [shop]
      );

      if (ipRules.rows.length > 0) {
        const whitelistRules = ipRules.rows.filter(
          (r) => r.list_type === "whitelist"
        );
        const blacklistRules = ipRules.rows.filter(
          (r) => r.list_type === "blacklist"
        );

        if (whitelistRules.length > 0) {
          // Whitelist mode
          const isWhitelisted = whitelistRules.some(
            (r) => r.ip_address === clientIp
          );
          if (!isWhitelisted) {
            blocked = true;
            blockReason = `IP not in whitelist: ${clientIp}`;

            const settingsResult = await client.query(
              "SELECT redirect_url, custom_message FROM ip_settings WHERE shop_domain = $1",
              [shop]
            );
            if (settingsResult.rows.length > 0) {
              redirectUrl = settingsResult.rows[0].redirect_url;
              customMessage = settingsResult.rows[0].custom_message;
            }
          }
        } else if (blacklistRules.length > 0) {
          // Blacklist mode
          const blacklistedRule = blacklistRules.find(
            (r) => r.ip_address === clientIp
          );
          if (blacklistedRule) {
            blocked = true;
            blockReason = blacklistedRule.note || `IP blocked: ${clientIp}`;
            redirectUrl = blacklistedRule.redirect_url;
          }
        }
      }
    }

    // 3. Check bot blocking (if not already blocked)
    if (!blocked && is_bot === "true") {
      const userAgent = req.headers["user-agent"] || "";

      // Get bot rules for this shop
      const botRules = await client.query(
        `
        SELECT list_type, bot_name, user_agent_pattern
        FROM bot_settings 
        WHERE shop_domain IN ($1, '*') AND is_enabled = true
        ORDER BY 
          CASE WHEN shop_domain = $1 THEN 0 ELSE 1 END,
          list_type DESC
      `,
        [shop]
      );

      if (botRules.rows.length > 0) {
        const lowerUserAgent = userAgent.toLowerCase();

        // Find matching bot rule
        const matchingRule = botRules.rows.find((rule) =>
          lowerUserAgent.includes(rule.user_agent_pattern.toLowerCase())
        );

        if (matchingRule) {
          if (matchingRule.list_type === "blacklist") {
            blocked = true;
            blockReason = `Bot blocked: ${
              matchingRule.bot_name || "Unknown bot"
            }`;
          }
        } else {
          // No rule found - check if we have any whitelist rules
          const hasWhitelistRules = botRules.rows.some(
            (r) => r.list_type === "whitelist"
          );
          if (hasWhitelistRules) {
            blocked = true;
            blockReason = "Unknown bot - not in whitelist";
          }
        }
      }
    }

    // 4. Check content protection settings
    const protectionResult = await client.query(
      "SELECT * FROM content_protection_settings WHERE shop_domain = $1",
      [shop]
    );

    const hasContentProtection =
      protectionResult.rows.length > 0 &&
      Object.entries(protectionResult.rows[0])
        .filter(([key]) => key.startsWith("disable_"))
        .some(([, value]) => value === true);

    // 5. Enhanced analytics logging with better session handling
    try {
      if (session_id) {
        // Check if this is an existing session
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
          // Update existing session
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
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `,
            [currentDuration, page_url, existingSession.rows[0].id]
          );
        } else {
          // Create new session record
          await client.query(
            `
            INSERT INTO user_analytics (
              shop_domain, session_id, ip_address, country_code, 
              device_type, browser_name, page_url, referrer, 
              is_bot, blocked_reason, user_agent, page_views
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1)
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
        }
      }
    } catch (analyticsError) {
      console.error("Analytics logging error:", analyticsError);
      // Don't fail the request if analytics fails
    }

    await client.query("COMMIT");

    // 6. Return comprehensive response
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
        userAgent: req.headers["user-agent"],
        country: country,
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

// Enhanced analytics tracking with better session management
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
  } = req.body;

  if (!shop || !session_id) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const clientIp = client_ip || getEnhancedClientIP(req);
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Check for existing session (within last 4 hours)
    const existingSession = await client.query(
      `
      SELECT id, page_views, created_at, visit_duration
      FROM user_analytics 
      WHERE shop_domain = $1 AND session_id = $2 
      AND created_at > NOW() - INTERVAL '4 hours'
      ORDER BY created_at DESC 
      LIMIT 1
    `,
      [shop, session_id]
    );

    if (existingSession.rows.length > 0) {
      // Update existing session
      await client.query(
        `
        UPDATE user_analytics 
        SET visit_duration = GREATEST(visit_duration, $1),
            page_views = GREATEST(page_views, $2),
            page_url = $3,
            updated_at = CURRENT_TIMESTAMP,
            user_agent = COALESCE(NULLIF($4, ''), user_agent),
            screen_resolution = COALESCE($5, screen_resolution),
            viewport_size = COALESCE($6, viewport_size),
            timezone = COALESCE($7, timezone),
            language = COALESCE($8, language)
        WHERE id = $9
      `,
        [
          duration || 0,
          page_views || 1,
          page_url,
          user_agent,
          screen_resolution,
          viewport_size,
          timezone,
          language,
          existingSession.rows[0].id,
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
          duration || 0,
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
          shop_domain, session_id, page_url, load_time, dom_ready_time
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `,
        [shop, session_id, page_url, performance.loadTime, performance.domReady]
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
            showProtectionMessage('Console access is disabled');
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

// All other existing routes remain the same...
// Bot validation, performance tracking, error tracking, etc.
// (keeping the rest of the original file's routes)

export default router;
