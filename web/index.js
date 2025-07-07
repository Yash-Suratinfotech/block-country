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
import botManagementRouter from "./routes/botManagement.js";
import contentProtectionRouter from "./routes/contentProtection.js";
import analyticsRouter from "./routes/analytics.js";
import webhooksRouter from "./routes/webhooks.js";

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

// Public routes for storefront (with enhanced blocking) and enhanced blocking middleware to protected routes
app.use("/data/info", publicCheckRouter);
app.use("/shop/*", enhancedBlockingMiddleware);
app.use("/api/webhooks", webhooksRouter);

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
