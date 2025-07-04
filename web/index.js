// web/index.js
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import PrivacyWebhookHandlers from "./privacy.js";

// Import existing routes
import blockedCountriesRouter from "./routes/blockedCountries.js";
import blockedIpsRouter from "./routes/blockedIps.js";
import storeRouter from "./routes/store.js";
import publicCheckRouter from "./routes/publicCheck.js";

// Import new routes
import botManagementRouter from "./routes/botManagement.js";
import contentProtectionRouter from "./routes/contentProtection.js";
import analyticsRouter from "./routes/analytics.js";

// Import enhanced middleware
import { enhancedBlockingMiddleware } from "./middleware/enhancedBlockingMiddleware.js";
import db from "./db.js";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Trust proxy for accurate IP detection
app.set("trust proxy", true);

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  async (req, res, next) => {
    const session = res.locals.shopify?.session;
    if (session) {
      console.log("✅ OAuth Callback - Shop authenticated:", session.shop);

      // Initialize default settings for new shops
      try {
        const client = await db.getClient();
        await client.query("BEGIN");

        // Check if shop already exists
        const existingShop = await client.query(
          "SELECT id FROM shops WHERE shop_domain = $1",
          [session.shop]
        );

        if (existingShop.rows.length === 0) {
          // Insert new shop
          await client.query(
            "INSERT INTO shops (shop_domain, access_token) VALUES ($1, $2) ON CONFLICT (shop_domain) DO UPDATE SET access_token = EXCLUDED.access_token",
            [session.shop, session.accessToken]
          );

          // Initialize default content protection settings
          await client.query(
            `
            INSERT INTO content_protection_settings (shop_domain) 
            VALUES ($1) 
            ON CONFLICT (shop_domain) DO NOTHING
          `,
            [session.shop]
          );

          console.log(
            "🆕 New shop initialized with default settings:",
            session.shop
          );
        }

        await client.query("COMMIT");
        client.release();
      } catch (error) {
        console.error("Error initializing shop settings:", error);
      }
    } else {
      console.log("⚠️ No session found in OAuth callback!");
    }

    return shopify.redirectToShopifyOrAppRoot()(req, res, next);
  }
);

app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

// Authentication middleware for API routes
const authenticateUser = async (req, res, next) => {
  try {
    const shop = req.query.shop;

    if (!shop) {
      return res.status(400).send("Missing shop parameter");
    }

    const sessions = await shopify.config.sessionStorage.findSessionsByShop(
      shop
    );

    if (sessions && sessions.length > 0) {
      const validSession = sessions.find(
        (session) => session.shop === shop && session.accessToken
      );

      if (validSession) {
        req.shopifySession = validSession;
        return next();
      }
    }

    res.status(401).send("User not authenticated");
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).send("Authentication error");
  }
};

// Apply middleware
app.use("/api/*", shopify.validateAuthenticatedSession());
app.use("/data/*", authenticateUser);
app.use(express.json());

// Mount API routes
app.use("/api", blockedCountriesRouter);
app.use("/api", blockedIpsRouter);
app.use("/api", botManagementRouter);
app.use("/api", contentProtectionRouter);
app.use("/api", analyticsRouter);
app.use("/api/store", storeRouter);

// Public routes for storefront (with enhanced blocking)
app.use("/data/info", publicCheckRouter);

// Enhanced public check endpoints
app.get("/data/info/check_access_enhanced", async (req, res) => {
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

  // Use the enhanced blocking middleware logic
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Get client IP
    const clientIp = req.ip || req.connection.remoteAddress;

    // Check access using enhanced logic (simplified here)
    let blocked = false;
    let blockReason = null;

    // Check country blocking (if country provided)
    if (country) {
      const countryResult = await client.query(
        `
        SELECT list_type FROM blocked_countries 
        WHERE shop_domain = $1 AND country_code = $2
      `,
        [shop, country]
      );

      if (countryResult.rows.length > 0) {
        const isWhitelisted = countryResult.rows[0].list_type === "whitelist";
        if (!isWhitelisted) {
          blocked = true;
          blockReason = `Country blocked: ${country}`;
        }
      } else {
        // Check if whitelist mode is active
        const whitelistCount = await client.query(
          "SELECT COUNT(*) FROM blocked_countries WHERE shop_domain = $1 AND list_type = 'whitelist'",
          [shop]
        );
        if (parseInt(whitelistCount.rows[0].count) > 0) {
          blocked = true;
          blockReason = `Country not in whitelist: ${country}`;
        }
      }
    }

    // Check IP blocking
    if (!blocked && clientIp) {
      const ipResult = await client.query(
        `
        SELECT list_type, note FROM blocked_ips 
        WHERE shop_domain = $1 AND ip_address = $2
      `,
        [shop, clientIp]
      );

      if (ipResult.rows.length > 0) {
        const isWhitelisted = ipResult.rows[0].list_type === "whitelist";
        if (!isWhitelisted) {
          blocked = true;
          blockReason = ipResult.rows[0].note || "IP address blocked";
        }
      }
    }

    // Check content protection settings
    const protectionResult = await client.query(
      "SELECT * FROM content_protection_settings WHERE shop_domain = $1",
      [shop]
    );

    const hasContentProtection =
      protectionResult.rows.length > 0 &&
      Object.values(protectionResult.rows[0]).some((val) => val === true);

    // Log analytics
    await client.query(
      `
      INSERT INTO user_analytics (
        shop_domain, session_id, ip_address, country_code, 
        device_type, browser_name, page_url, referrer, 
        is_bot, blocked_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      ]
    );

    await client.query("COMMIT");

    res.json({
      blocked,
      reason: blockReason,
      contentProtection: {
        enabled: hasContentProtection,
        settings: protectionResult.rows[0] || null,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in enhanced access check:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// Analytics tracking endpoint
app.post("/data/info/track_analytics", async (req, res) => {
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
    const clientIp = req.ip || req.connection.remoteAddress;

    await client.query(
      `
      INSERT INTO user_analytics (
        shop_domain, session_id, ip_address, country_code, user_agent,
        device_type, browser_name, page_url, referrer, visit_duration,
        page_views, is_bot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (shop_domain, session_id) 
      DO UPDATE SET 
        visit_duration = EXCLUDED.visit_duration,
        page_views = EXCLUDED.page_views,
        page_url = EXCLUDED.page_url,
        updated_at = CURRENT_TIMESTAMP
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

// Content protection script endpoint
app.get("/data/info/content_protection_script", async (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  try {
    const response = await fetch(
      `${req.protocol}://${req.get(
        "host"
      )}/api/content-protection/script?shop=${shop}`
    );
    const script = await response.text();

    res.setHeader("Content-Type", "application/javascript");
    res.send(script);
  } catch (error) {
    console.error("Error serving content protection script:", error);
    res.status(500).send("// Error loading content protection");
  }
});

// Apply enhanced blocking middleware to protected routes
app.use("/shop/*", enhancedBlockingMiddleware);

// Webhook for uninstall cleanup
app.post("/api/webhooks/app-uninstalled", async (req, res) => {
  const shop = req.headers["x-shopify-shop-domain"];

  if (shop) {
    const client = await db.getClient();
    try {
      await client.query("BEGIN");

      // Clean up all shop data
      await client.query(
        "DELETE FROM blocked_countries WHERE shop_domain = $1",
        [shop]
      );
      await client.query("DELETE FROM blocked_ips WHERE shop_domain = $1", [
        shop,
      ]);
      await client.query("DELETE FROM bot_settings WHERE shop_domain = $1", [
        shop,
      ]);
      await client.query(
        "DELETE FROM content_protection_settings WHERE shop_domain = $1",
        [shop]
      );
      await client.query("DELETE FROM user_analytics WHERE shop_domain = $1", [
        shop,
      ]);
      await client.query(
        "DELETE FROM performance_analytics WHERE shop_domain = $1",
        [shop]
      );
      await client.query("DELETE FROM shops WHERE shop_domain = $1", [shop]);

      await client.query("COMMIT");
      console.log(`🗑️ Cleaned up data for uninstalled shop: ${shop}`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error during uninstall cleanup:", error);
    } finally {
      client.release();
    }
  }

  res.status(200).send("OK");
});

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(STATIC_PATH, "index.html"))
        .toString()
        .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "")
    );
});

app.listen(PORT, () => {
  console.log(`🚀 Enhanced Block Country app running on port ${PORT}`);
  console.log("📊 Features available:");
  console.log("   - Country whitelist/blacklist blocking");
  console.log("   - IP whitelist/blacklist blocking");
  console.log("   - Bot detection and management");
  console.log("   - Content protection");
  console.log("   - User analytics and insights");
});
