import { BillingInterval, LATEST_API_VERSION } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { SQLiteSessionStorage } from "@shopify/shopify-app-session-storage-sqlite";
import { restResources } from "@shopify/shopify-api/rest/admin/2025-01";

// Use different paths for dev vs production
const DATABASE_URL =
  process.env.NODE_ENV === "production"
    ? "/opt/render/project/src/sessions.sqlite" // Render's persistent directory
    : "./database.sqlite";

const billingConfig = {
  "My Shopify One-Time Charge": {
    // This is an example configuration that would do a one-time charge for $2 (only USD is currently supported)
    amount: 2.0,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
  },
};

const shopify = shopifyApp({
  api: {
    apiVersion: LATEST_API_VERSION,
    restResources,
    future: {
      customerAddressDefaultFix: true,
      lineItemBilling: true,
      unstable_managedPricingSupport: true,
    },
    billing: undefined,
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  // Use HOST from environment
  host: process.env.HOST || process.env.SHOPIFY_APP_URL,
  // Session storage with correct path
  sessionStorage: new SQLiteSessionStorage(DATABASE_URL),
});

export default shopify;
