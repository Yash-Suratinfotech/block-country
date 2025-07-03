import express from "express";
import db from "../db.js";
import { getClientIp, normalizeIp } from "../utils/ipUtils.js";

const router = express.Router();

// Public endpoint for storefront script - Check country
router.get("/check_country", async (req, res) => {
  const { shop, country } = req.query;

  if (!shop || !country) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const rows = await db.query(
      "SELECT 1 FROM blocked_countries WHERE shop_domain=? AND country_code=?",
      [shop, country]
    );
    res.status(200).json({ blocked: rows.length > 0 });
  } catch (error) {
    console.error("Error checking country:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Public endpoint for storefront script - Check IP
router.get("/check_ip", async (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  // Get the client's real IP address from the request
  const rawIp = getClientIp(req);
  const clientIp = normalizeIp(rawIp);

  if (!clientIp) {
    return res.status(400).json({ error: "Could not determine IP address" });
  }

  try {
    const rows = await db.query(
      "SELECT note FROM blocked_ips WHERE shop_domain=? AND ip_address=? LIMIT 1",
      [shop, clientIp]
    );
    res.status(200).json({
      blocked: rows.length > 0,
      ip: clientIp,
      reason: rows.length > 0 ? rows[0].note : null,
    });
  } catch (error) {
    console.error("Error checking IP:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Combined check endpoint - Check both country and IP
router.get("/check_access", async (req, res) => {
  const { shop, country } = req.query;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  // Get the client's real IP address
  const rawIp = getClientIp(req);
  const clientIp = normalizeIp(rawIp);

  try {
    // Check country if provided
    let countryBlocked = false;
    if (country) {
      const countryResult = await db.query(
        "SELECT 1 FROM blocked_countries WHERE shop_domain=? AND country_code=?",
        [shop, country]
      );
      countryBlocked = countryResult.length > 0;
    }

    // Check IP
    let ipBlocked = false;
    let ipBlockReason = null;
    if (clientIp) {
      const ipResult = await db.query(
        "SELECT note FROM blocked_ips WHERE shop_domain=? AND ip_address=? LIMIT 1",
        [shop, clientIp]
      );
      ipBlocked = ipResult.length > 0;
      ipBlockReason = ipBlocked ? ipResult[0].note : null;
    }

    res.status(200).json({
      blocked: countryBlocked || ipBlocked,
      countryBlocked,
      ipBlocked,
      ip: clientIp,
      country: country || null,
      reason: ipBlockReason,
    });
  } catch (error) {
    console.error("Error checking access:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
