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

  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    const { rowCount } = await db.query(
      "SELECT 1 FROM blocked_countries WHERE shop_domain=$1 AND country_code=$2",
      [shop, country]
    );
    await client.query("COMMIT");
    res.status(200).json({ blocked: rowCount > 0 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error checking country:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
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

  const client = await db.getClient();

  try {
    await client.query("BEGIN");
    const { rows } = await db.query(
      "SELECT note FROM blocked_ips WHERE shop_domain=$1 AND ip_address=$2 LIMIT 1",
      [shop, clientIp]
    );
    await client.query("COMMIT");

    res.status(200).json({
      blocked: rows.length > 0,
      ip: clientIp, // Return the IP for debugging (optional)
      reason: rows.length > 0 ? rows[0].note : null,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error checking IP:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
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

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Check country if provided
    let countryBlocked = false;
    if (country) {
      const countryResult = await db.query(
        "SELECT 1 FROM blocked_countries WHERE shop_domain=$1 AND country_code=$2",
        [shop, country]
      );
      countryBlocked = countryResult.rowCount > 0;
    }

    // Check IP
    let ipBlocked = false;
    let ipBlockReason = null;
    if (clientIp) {
      const ipResult = await db.query(
        "SELECT note FROM blocked_ips WHERE shop_domain=$1 AND ip_address=$2 LIMIT 1",
        [shop, clientIp]
      );
      ipBlocked = ipResult.rows.length > 0;
      ipBlockReason = ipBlocked ? ipResult.rows[0].note : null;
    }

    await client.query("COMMIT");

    res.status(200).json({
      blocked: countryBlocked || ipBlocked,
      countryBlocked,
      ipBlocked,
      ip: clientIp,
      country: country || null,
      reason: ipBlockReason,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error checking access:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

export default router;
