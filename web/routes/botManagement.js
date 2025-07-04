// web/routes/botManagement.js
import express from "express";
import db from "../db.js";

const router = express.Router();

function getShop(req) {
  return req.query.shop || req.body.shop;
}

// Get bot settings
router.get("/bot-settings", async (req, res) => {
  const shop = getShop(req);
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Get shop-specific settings
    const shopSettings = await client.query(
      `
      SELECT id, user_agent_pattern, bot_name, bot_url, list_type, is_enabled, created_at
      FROM bot_settings 
      WHERE shop_domain = $1 
      ORDER BY bot_name, list_type DESC
    `,
      [shop]
    );

    // Get global settings for reference
    const globalSettings = await client.query(`
      SELECT user_agent_pattern, bot_name, bot_url, list_type, is_enabled
      FROM bot_settings 
      WHERE shop_domain = '*' 
      ORDER BY bot_name, list_type DESC
    `);

    await client.query("COMMIT");

    res.json({
      shopSettings: shopSettings.rows || [],
      globalSettings: globalSettings.rows || [],
      stats: {
        whitelistedBots: shopSettings.rows.filter(
          (s) => s.list_type === "whitelist" && s.is_enabled
        ).length,
        blacklistedBots: shopSettings.rows.filter(
          (s) => s.list_type === "blacklist" && s.is_enabled
        ).length,
        totalBots: shopSettings.rows.length,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error fetching bot settings:", error);
    res.status(500).json({ error: "Failed to fetch bot settings" });
  } finally {
    client.release();
  }
});

// Add/update bot setting
router.post("/bot-settings", async (req, res) => {
  const shop = getShop(req);
  const { user_agent_pattern, bot_name, bot_url, list_type } = req.body;
  const client = await db.getClient();

  if (!user_agent_pattern || !list_type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
      INSERT INTO bot_settings (shop_domain, user_agent_pattern, bot_name, bot_url, list_type) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (shop_domain, user_agent_pattern) 
      DO UPDATE SET 
        bot_name = EXCLUDED.bot_name,
        bot_url = EXCLUDED.bot_url,
        list_type = EXCLUDED.list_type,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
      [shop, user_agent_pattern, bot_name || null, bot_url || null, list_type]
    );

    await client.query("COMMIT");
    res.status(201).json({ message: "Bot setting saved", setting: rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error saving bot setting:", error);
    res.status(500).json({ error: "Failed to save bot setting" });
  } finally {
    client.release();
  }
});

// Update bot setting status
router.patch("/bot-settings/:id", async (req, res) => {
  const shop = getShop(req);
  const { id } = req.params;
  const { is_enabled, list_type } = req.body;
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (typeof is_enabled === "boolean") {
      updates.push(`is_enabled = ${paramCount++}`);
      values.push(is_enabled);
    }

    if (list_type) {
      updates.push(`list_type = ${paramCount++}`);
      values.push(list_type);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(shop, id);

    const { rowCount } = await client.query(
      `
      UPDATE bot_settings 
      SET ${updates.join(", ")}
      WHERE shop_domain = ${paramCount++} AND id = ${paramCount++}
    `,
      values
    );

    await client.query("COMMIT");

    if (rowCount === 0) {
      res.status(404).json({ error: "Bot setting not found" });
    } else {
      res.json({ message: "Bot setting updated" });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating bot setting:", error);
    res.status(500).json({ error: "Failed to update bot setting" });
  } finally {
    client.release();
  }
});

// Delete bot setting
router.delete("/bot-settings/:id", async (req, res) => {
  const shop = getShop(req);
  const { id } = req.params;
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const { rowCount } = await client.query(
      "DELETE FROM bot_settings WHERE shop_domain = $1 AND id = $2",
      [shop, id]
    );

    await client.query("COMMIT");

    if (rowCount === 0) {
      res.status(404).json({ error: "Bot setting not found" });
    } else {
      res.json({ message: "Bot setting deleted" });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting bot setting:", error);
    res.status(500).json({ error: "Failed to delete bot setting" });
  } finally {
    client.release();
  }
});

// Get bot analytics
router.get("/bot-analytics", async (req, res) => {
  const shop = getShop(req);
  const { days = 7 } = req.query;
  const client = await db.getClient();

  try {
    // Bot visits over time
    const botVisits = await client.query(
      `
      SELECT 
        DATE(created_at) as date,
        bot_name,
        COUNT(*) as visits,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND is_bot = true 
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(created_at), bot_name
      ORDER BY date DESC, visits DESC
    `,
      [shop]
    );

    // Top bots
    const topBots = await client.query(
      `
      SELECT 
        bot_name,
        COUNT(*) as total_visits,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(CASE WHEN blocked_reason IS NOT NULL THEN 1 END) as blocked_visits
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND is_bot = true 
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY bot_name
      ORDER BY total_visits DESC
      LIMIT 10
    `,
      [shop]
    );

    // Bot blocking stats
    const blockingStats = await client.query(
      `
      SELECT 
        COUNT(*) as total_bot_visits,
        COUNT(CASE WHEN blocked_reason IS NOT NULL THEN 1 END) as blocked_visits,
        COUNT(CASE WHEN blocked_reason IS NULL THEN 1 END) as allowed_visits
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND is_bot = true 
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
    `,
      [shop]
    );

    res.json({
      botVisits: botVisits.rows,
      topBots: topBots.rows,
      stats: blockingStats.rows[0] || {
        total_bot_visits: 0,
        blocked_visits: 0,
        allowed_visits: 0,
      },
    });
  } catch (error) {
    console.error("Error fetching bot analytics:", error);
    res.status(500).json({ error: "Failed to fetch bot analytics" });
  } finally {
    client.release();
  }
});

export default router;
