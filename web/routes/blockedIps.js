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

  try {
    const rows = await db.query(
      `SELECT ip_address, note, created_at 
       FROM blocked_ips 
       WHERE shop_domain = ? 
       ORDER BY created_at DESC`,
      [shop]
    );
    res.json({ ips: rows || [] });
  } catch (error) {
    console.error("Error fetching blocked IPs:", error);
    res.status(500).json({ error: "Failed to fetch blocked IPs" });
  }
});

// Add IP address
router.post("/blocked-ips", async (req, res) => {
  const shop = getShop(req);
  const { ip_address, note } = req.body;

  if (!ip_address || !isValidIp(ip_address)) {
    return res.status(400).json({ error: "Invalid IP address" });
  }

  const normalizedIp = normalizeIp(ip_address);

  try {
    // Check if already exists
    const existing = await db.query(
      `SELECT 1 FROM blocked_ips WHERE shop_domain = ? AND ip_address = ?`,
      [shop, normalizedIp]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "IP address already blocked" });
    }

    await db.query(
      `INSERT INTO blocked_ips (shop_domain, ip_address, note) VALUES (?, ?, ?)`,
      [shop, normalizedIp, note || null]
    );
    res.status(201).json({ message: "IP address blocked successfully", ip: { shop_domain: shop, ip_address: normalizedIp, note } });
  } catch (error) {
    console.error("Error adding blocked IP:", error);
    res.status(500).json({ error: "Failed to block IP address" });
  }
});

// Remove IP address
router.delete("/blocked-ips/:ip", async (req, res) => {
  const shop = getShop(req);
  const ipAddress = req.params.ip;

  if (!ipAddress || !isValidIp(ipAddress)) {
    return res.status(400).json({ error: "Invalid IP address" });
  }

  const normalizedIp = normalizeIp(ipAddress);

  try {
    const result = await db.query(
      "DELETE FROM blocked_ips WHERE shop_domain = ? AND ip_address = ?",
      [shop, normalizedIp]
    );
    // result.changes is the number of rows deleted
    if (result.changes === 0) {
      res.status(404).json({ error: "IP address not found" });
    } else {
      res.status(200).json({ message: "IP address unblocked successfully" });
    }
  } catch (error) {
    console.error("Error removing blocked IP:", error);
    res.status(500).json({ error: "Failed to unblock IP address" });
  }
});

// Check if IP is blocked
router.get("/blocked-ips/check/:ip", async (req, res) => {
  const shop = getShop(req);
  const ipAddress = req.params.ip;

  if (!ipAddress || !isValidIp(ipAddress)) {
    return res.status(400).json({ error: "Invalid IP address" });
  }

  const normalizedIp = normalizeIp(ipAddress);

  try {
    const rows = await db.query(
      "SELECT 1 FROM blocked_ips WHERE shop_domain = ? AND ip_address = ? LIMIT 1",
      [shop, normalizedIp]
    );
    res.json({ blocked: rows.length > 0 });
  } catch (error) {
    console.error("Error checking blocked IP:", error);
    res.status(500).json({ error: "Failed to check IP status" });
  }
});

export default router;