// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import PrivacyWebhookHandlers from "./privacy.js";

import blockedCountriesRouter from "./routes/blockedCountries.js";
import blockedIpsRouter from "./routes/blockedIps.js";
import storeRouter from "./routes/store.js";
import publicCheckRouter from "./routes/publicCheck.js";

import { ipBlockingMiddleware } from "./middleware/ipBlockingMiddleware.js";
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

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  async (req, res, next) => {
    // You can access the session like this:
    const session = res.locals.shopify?.session;
    if (session) {
      // For debugging/logging
      console.log("✅ OAuth Callback - Shop authenticated:", session.shop);
      // Save to your DB if needed, or do post-auth actions
      // e.g. await db.query(...);
    } else {
      console.log("⚠️ No session found in OAuth callback!");
    }
    // Then redirect as usual:
    return shopify.redirectToShopifyOrAppRoot()(req, res, next);
  }
);

app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js

const authenticateUser = async (req, res, next) => {
  let shop = req.query.shop;
  let shopStore = await shopify.config.sessionStorage.findSessionsByShop(shop);
  if (shop === shopStore[0].shop) {
    next();
  } else {
    res.send("User not authenticated");
  }
};

app.use("/api/*", shopify.validateAuthenticatedSession());
app.use("/data/*", authenticateUser);

app.use(express.json());

// 👇 mount /apis routes
app.use("/api", blockedCountriesRouter);
app.use("/api", blockedIpsRouter);
app.use("/api/store", storeRouter);
app.use("/data/info", publicCheckRouter);

// Protected routes - apply IP blocking middleware
app.get("/shop/*", ipBlockingMiddleware, (req, res) => {
  // Your shop routes here
});

// Webhook for uninstall cleanup (SQLite version)
app.post("/api/webhooks/app-uninstalled", async (req, res) => {
  const shop = req.headers["x-shopify-shop-domain"];
  if (shop) {
    await db.query("DELETE FROM blocked_countries WHERE shop_domain = ?", [shop]);
    await db.query("DELETE FROM shopify_sessions WHERE shop = ?", [shop]);
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

app.listen(PORT);
