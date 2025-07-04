import express from "express";
import db from "../db.js";
import { isValidIp, normalizeIp } from "../utils/ipUtils.js";

const router = express.Router();

// Helper: extract shop from session (replace with actual auth middleware)
function getShop(req) {
  return req.query.shop || req.body.shop; // or from session/cookies/App Bridge
}

// Get blocked IPs
router.get("/blocked-ips", async (req, res) => {
  const shop = getShop(req);
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const { rows } = await db.query(
      `SELECT ip_address, note, created_at 
       FROM blocked_ips 
       WHERE shop_domain = $1 
       ORDER BY created_at DESC`,
      [shop]
    );

    await client.query("COMMIT");
    res.json({ ips: rows || [] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error fetching blocked IPs:", error);
    res.status(500).json({ error: "Failed to fetch blocked IPs" });
  } finally {
    client.release();
  }
});

// Add IP address
router.post("/blocked-ips", async (req, res) => {
  const shop = getShop(req);
  const { ip_address, note } = req.body;
  const client = await db.getClient();

  // Validate IP address
  if (!ip_address || !isValidIp(ip_address)) {
    return res.status(400).json({ error: "Invalid IP address" });
  }

  // Normalize the IP address
  const normalizedIp = normalizeIp(ip_address);

  try {
    await client.query("BEGIN");
    
    const { rows } = await db.query(
      `INSERT INTO blocked_ips (shop_domain, ip_address, note) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (shop_domain, ip_address) DO NOTHING
       RETURNING *`,
      [shop, normalizedIp, note || null]
    );
    
    await client.query("COMMIT");
    
    if (rows.length === 0) {
      res.status(409).json({ error: "IP address already blocked" });
    } else {
      res.status(201).json({ message: "IP address blocked successfully", ip: rows[0] });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error adding blocked IP:", error);
    res.status(500).json({ error: "Failed to block IP address" });
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
      res.status(404).json({ error: "IP address not found" });
    } else {
      res.status(200).json({ message: "IP address unblocked successfully" });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error removing blocked IP:", error);
    res.status(500).json({ error: "Failed to unblock IP address" });
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
      "SELECT 1 FROM blocked_ips WHERE shop_domain = $1 AND ip_address = $2 LIMIT 1",
      [shop, normalizedIp]
    );
    
    res.json({ blocked: rows.length > 0 });
  } catch (error) {
    console.error("Error checking blocked IP:", error);
    res.status(500).json({ error: "Failed to check IP status" });
  } finally {
    client.release();
  }
});

export default router;