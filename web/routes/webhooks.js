// web/routes/webhooks.js
import express from "express";
import db from "../db.js";

const router = express.Router();

// Webhook for uninstall cleanup
router.post("/app-uninstalled", async (req, res) => {
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
      await client.query(
        "DELETE FROM country_settings WHERE shop_domain = $1",
        [shop]
      );
      await client.query("DELETE FROM ip_settings WHERE shop_domain = $1", [
        shop,
      ]);
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

export default router;