// web/routes/blockedIps.js
import express from "express";
import db from "../db.js";
import { isValidIp, normalizeIp } from "../utils/ipUtils.js";

const router = express.Router();

// Helper: extract shop from session
function getShop(req) {
  return req.query.shop || req.body.shop;
}

// Get blocked IPs with enhanced filtering
router.get("/blocked-ips", async (req, res) => {
  const shop = getShop(req);
  const { list_type } = req.query; // Optional filter by list_type
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    let query = `
      SELECT ip_address, note, list_type, redirect_url, created_at, updated_at 
      FROM blocked_ips 
      WHERE shop_domain = $1
    `;
    let params = [shop];

    if (list_type && ["whitelist", "blacklist"].includes(list_type)) {
      query += ` AND list_type = $2`;
      params.push(list_type);
    }

    query += ` ORDER BY list_type DESC, created_at DESC`;

    const { rows } = await db.query(query, params);

    await client.query("COMMIT");
    res.json({
      ips: rows || [],
      stats: {
        total: rows.length,
        whitelist: rows.filter((ip) => ip.list_type === "whitelist").length,
        blacklist: rows.filter((ip) => ip.list_type === "blacklist").length,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error fetching blocked IPs:", error);
    res.status(500).json({ error: "Failed to fetch blocked IPs" });
  } finally {
    client.release();
  }
});

// Add IP address with enhanced options
router.post("/blocked-ips", async (req, res) => {
  const shop = getShop(req);
  const { ip_address, note, list_type = "blacklist", redirect_url } = req.body;
  const client = await db.getClient();

  // Validate IP address
  if (!ip_address || !isValidIp(ip_address)) {
    return res.status(400).json({ error: "Valid IP address is required" });
  }

  if (!["whitelist", "blacklist"].includes(list_type)) {
    return res
      .status(400)
      .json({ error: "Invalid list_type. Must be 'whitelist' or 'blacklist'" });
  }

  // Normalize the IP address
  const normalizedIp = normalizeIp(ip_address);

  try {
    await client.query("BEGIN");

    // Check if IP already exists
    const existingIP = await db.query(
      "SELECT ip_address, list_type FROM blocked_ips WHERE shop_domain = $1 AND ip_address = $2",
      [shop, normalizedIp]
    );

    if (existingIP.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "IP address already exists in rules",
        existing: existingIP.rows[0],
      });
    }

    // Insert new IP rule
    const { rows } = await db.query(
      `
      INSERT INTO blocked_ips (shop_domain, ip_address, note, list_type, redirect_url) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *
    `,
      [shop, normalizedIp, note || null, list_type, redirect_url || null]
    );

    await client.query("COMMIT");
    res.status(201).json({
      message: "IP rule created successfully",
      ip: rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error adding blocked IP:", error);
    res.status(500).json({ error: "Failed to add IP address" });
  } finally {
    client.release();
  }
});

// Update IP rule
router.put("/blocked-ips/:ip", async (req, res) => {
  const shop = getShop(req);
  const ipAddress = req.params.ip;
  const { note, list_type, redirect_url } = req.body;
  const client = await db.getClient();

  if (!isValidIp(ipAddress)) {
    return res.status(400).json({ error: "Invalid IP address" });
  }

  if (!["whitelist", "blacklist"].includes(list_type)) {
    return res
      .status(400)
      .json({ error: "Invalid list_type. Must be 'whitelist' or 'blacklist'" });
  }

  // Normalize the IP address
  const normalizedIp = normalizeIp(ipAddress);

  try {
    await client.query("BEGIN");

    const { rows, rowCount } = await db.query(
      `
      UPDATE blocked_ips 
      SET note = $1, list_type = $2, redirect_url = $3, updated_at = CURRENT_TIMESTAMP
      WHERE shop_domain = $4 AND ip_address = $5
      RETURNING *
    `,
      [note || null, list_type, redirect_url || null, shop, normalizedIp]
    );

    await client.query("COMMIT");

    if (rowCount === 0) {
      res.status(404).json({ error: "IP address rule not found" });
    } else {
      res.json({
        message: "IP rule updated successfully",
        ip: rows[0],
      });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating blocked IP:", error);
    res.status(500).json({ error: "Failed to update IP address" });
  } finally {
    client.release();
  }
});

// Remove IP address
router.delete("/blocked-ips/:ip", async (req, res) => {
  const shop = getShop(req);
  const ipAddress = req.params.ip;
  const client = await db.getClient();

  if (!ipAddress || !isValidIp(ipAddress)) {
    return res.status(400).json({ error: "Invalid IP address" });
  }

  // Normalize the IP address
  const normalizedIp = normalizeIp(ipAddress);

  try {
    await client.query("BEGIN");

    const { rowCount } = await db.query(
      "DELETE FROM blocked_ips WHERE shop_domain = $1 AND ip_address = $2",
      [shop, normalizedIp]
    );

    await client.query("COMMIT");

    if (rowCount === 0) {
      res.status(404).json({ error: "IP address rule not found" });
    } else {
      res.json({ message: "IP rule removed successfully" });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error removing blocked IP:", error);
    res.status(500).json({ error: "Failed to remove IP address" });
  } finally {
    client.release();
  }
});

// Check if IP is blocked (useful for middleware)
router.get("/blocked-ips/check/:ip", async (req, res) => {
  const shop = getShop(req);
  const ipAddress = req.params.ip;
  const client = await db.getClient();

  if (!ipAddress || !isValidIp(ipAddress)) {
    return res.status(400).json({ error: "Invalid IP address" });
  }

  // Normalize the IP address
  const normalizedIp = normalizeIp(ipAddress);

  try {
    const { rows } = await db.query(
      `
      SELECT list_type, note, redirect_url 
      FROM blocked_ips 
      WHERE shop_domain = $1 AND ip_address = $2 
      LIMIT 1
    `,
      [shop, normalizedIp]
    );

    if (rows.length === 0) {
      // Check if whitelist mode is active
      const whitelistCount = await db.query(
        "SELECT COUNT(*) FROM blocked_ips WHERE shop_domain = $1 AND list_type = 'whitelist'",
        [shop]
      );

      const isWhitelistMode = parseInt(whitelistCount.rows[0].count) > 0;

      res.json({
        blocked: isWhitelistMode, // Block if whitelist mode and IP not in whitelist
        reason: isWhitelistMode ? "IP not in whitelist" : null,
        list_type: null,
        redirect_url: null,
      });
    } else {
      const rule = rows[0];
      const isBlocked = rule.list_type === "blacklist";

      res.json({
        blocked: isBlocked,
        reason: isBlocked ? rule.note || "IP address blocked" : null,
        list_type: rule.list_type,
        redirect_url: rule.redirect_url,
      });
    }
  } catch (error) {
    console.error("Error checking blocked IP:", error);
    res.status(500).json({ error: "Failed to check IP status" });
  } finally {
    client.release();
  }
});

// Export IPs to CSV
router.get("/blocked-ips/export", async (req, res) => {
  const shop = getShop(req);
  const client = await db.getClient();

  try {
    const { rows } = await db.query(
      `
      SELECT ip_address, note, list_type, redirect_url, created_at 
      FROM blocked_ips 
      WHERE shop_domain = $1 
      ORDER BY list_type DESC, ip_address ASC
    `,
      [shop]
    );

    // Generate CSV
    const csvHeader = "IP Address,Note,Rule Type,Redirect URL,Created At\n";
    const csvData = rows
      .map(
        (row) =>
          `"${row.ip_address}","${row.note || ""}","${row.list_type}","${
            row.redirect_url || ""
          }","${row.created_at}"`
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ip-rules-${shop}.csv"`
    );
    res.send(csvHeader + csvData);
  } catch (error) {
    console.error("Error exporting IPs:", error);
    res.status(500).json({ error: "Failed to export IP addresses" });
  } finally {
    client.release();
  }
});

// Get IP settings
router.get("/ip-settings", async (req, res) => {
  const shop = getShop(req);
  const client = await db.getClient();

  try {
    const { rows } = await db.query(
      `
      SELECT * FROM ip_settings 
      WHERE shop_domain = $1
    `,
      [shop]
    );

    const defaultSettings = {
      shop_domain: shop,
      default_list_type: "blacklist",
      redirect_url: "",
      custom_message:
        "Your IP address has been blocked from accessing this store.",
      auto_block_repeated_attempts: false,
      max_attempts_threshold: 5,
      enable_ip_detection: true,
    };

    res.json({
      settings: rows.length > 0 ? rows[0] : defaultSettings,
    });
  } catch (error) {
    console.error("Error fetching IP settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  } finally {
    client.release();
  }
});

// Update IP settings
router.post("/ip-settings", async (req, res) => {
  const shop = getShop(req);
  const {
    default_list_type = "blacklist",
    redirect_url = "",
    custom_message = "Your IP address has been blocked from accessing this store.",
    auto_block_repeated_attempts = false,
    max_attempts_threshold = 5,
    enable_ip_detection = true,
  } = req.body;
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const { rows } = await db.query(
      `
      INSERT INTO ip_settings (
        shop_domain, default_list_type, redirect_url, custom_message, 
        auto_block_repeated_attempts, max_attempts_threshold, enable_ip_detection
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (shop_domain) 
      DO UPDATE SET 
        default_list_type = EXCLUDED.default_list_type,
        redirect_url = EXCLUDED.redirect_url,
        custom_message = EXCLUDED.custom_message,
        auto_block_repeated_attempts = EXCLUDED.auto_block_repeated_attempts,
        max_attempts_threshold = EXCLUDED.max_attempts_threshold,
        enable_ip_detection = EXCLUDED.enable_ip_detection,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
      [
        shop,
        default_list_type,
        redirect_url,
        custom_message,
        auto_block_repeated_attempts,
        max_attempts_threshold,
        enable_ip_detection,
      ]
    );

    await client.query("COMMIT");
    res.json({
      message: "IP settings updated",
      settings: rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating IP settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  } finally {
    client.release();
  }
});

// Bulk import IPs
router.post("/blocked-ips/bulk-import", async (req, res) => {
  const shop = getShop(req);
  const { ips, list_type = "blacklist", note, redirect_url } = req.body;
  const client = await db.getClient();

  if (!Array.isArray(ips) || ips.length === 0) {
    return res.status(400).json({ error: "IPs array is required" });
  }

  if (!["whitelist", "blacklist"].includes(list_type)) {
    return res.status(400).json({ error: "Invalid list_type" });
  }

  try {
    await client.query("BEGIN");

    const results = {
      added: [],
      skipped: [],
      errors: [],
    };

    for (const ip of ips) {
      try {
        // Validate IP
        if (!isValidIp(ip)) {
          results.errors.push({ ip, error: "Invalid IP address format" });
          continue;
        }

        const normalizedIp = normalizeIp(ip);

        // Check if IP already exists
        const existing = await db.query(
          "SELECT ip_address FROM blocked_ips WHERE shop_domain = $1 AND ip_address = $2",
          [shop, normalizedIp]
        );

        if (existing.rows.length > 0) {
          results.skipped.push(ip);
          continue;
        }

        // Insert IP
        await db.query(
          `
          INSERT INTO blocked_ips (shop_domain, ip_address, note, list_type, redirect_url) 
          VALUES ($1, $2, $3, $4, $5)
        `,
          [shop, normalizedIp, note || null, list_type, redirect_url || null]
        );

        results.added.push(ip);
      } catch (error) {
        console.error(`Error adding IP ${ip}:`, error);
        results.errors.push({ ip, error: error.message });
      }
    }

    await client.query("COMMIT");
    res.json({
      message: "Bulk import completed",
      results,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in bulk import:", error);
    res.status(500).json({ error: "Failed to import IP addresses" });
  } finally {
    client.release();
  }
});

// Get IP analytics
router.get("/blocked-ips/analytics", async (req, res) => {
  const shop = getShop(req);
  const { days = 7 } = req.query;
  const client = await db.getClient();

  try {
    // Most blocked IPs
    const topBlockedIPs = await db.query(
      `
      SELECT 
        ip_address,
        COUNT(*) as blocked_attempts,
        MAX(created_at) as last_attempt
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND blocked_reason LIKE '%IP%'
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY ip_address
      ORDER BY blocked_attempts DESC
      LIMIT 10
    `,
      [shop]
    );

    // IP blocking stats
    const blockingStats = await db.query(
      `
      SELECT 
        DATE(created_at) as date,
        COUNT(CASE WHEN blocked_reason LIKE '%IP%' THEN 1 END) as ip_blocks,
        COUNT(DISTINCT ip_address) as unique_blocked_ips
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
      [shop]
    );

    res.json({
      topBlockedIPs: topBlockedIPs.rows,
      blockingStats: blockingStats.rows,
    });
  } catch (error) {
    console.error("Error fetching IP analytics:", error);
    res.status(500).json({ error: "Failed to fetch IP analytics" });
  } finally {
    client.release();
  }
});

export default router;
