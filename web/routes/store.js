// web/api/store.js
import express from "express";
import shopify from "../shopify.js";
import db from "../db.js";

const router = express.Router();

// GET /api/store/info
router.get("/info", async (req, res) => {
  try {
    const client = new shopify.api.clients.Rest({
      session: res.locals.shopify.session,
    });

    const response = await client.get({ path: "shop" });
    const shop = response?.body?.shop;

    // Return simplified store information
    const simplified = {
      name: shop.name,
      domain: shop.domain,
      email: shop.email,
      plan_display_name: shop.plan_display_name,
      shop_owner: shop.shop_owner,
      country_name: shop.country_name,
      currency: shop.currency,
    };

    res.status(200).json(simplified);
  } catch (error) {
    console.error("Failed to fetch store info:", error);
    res.status(500).json({ error: "Failed to fetch store info" });
  }
});

// GET /api/store/stats
router.get("/stats", async (req, res) => {
  try {
    const shopDomain = res.locals.shopify.session.shop;

    // Get blocked countries count
    const countriesResult = await db.query(
      "SELECT COUNT(DISTINCT country_code) as count FROM blocked_countries WHERE shop_domain = ?",
      [shopDomain]
    );
    const blockedCountriesCount = parseInt(
      countriesResult[0]?.count || 0
    );

    // Get blocked IPs count
    const ipsResult = await db.query(
      "SELECT COUNT(DISTINCT ip_address) as count FROM blocked_ips WHERE shop_domain = ?",
      [shopDomain]
    );
    const blockedIpsCount = parseInt(ipsResult[0]?.count || 0);

    res.status(200).json({
      blockedCountries: blockedCountriesCount,
      blockedIps: blockedIpsCount,
      hasBlockedCountries: blockedCountriesCount > 0,
      hasBlockedIps: blockedIpsCount > 0,
    });
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
