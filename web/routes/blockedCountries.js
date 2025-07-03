import express from "express";
import db from "../db.js";

const router = express.Router();

// Helper: extract shop from session (replace with actual auth middleware)
function getShop(req) {
  return req.query.shop || req.body.shop; // or from session/cookies/App Bridge
}

// Get blocked countries
router.get("/blocked-countries", async (req, res) => {
  const shop = getShop(req);
  const client = await db.getClient();

  await client.query("BEGIN");

  const { rows } = await db.query(
    "SELECT country_code, created_at FROM blocked_countries WHERE shop_domain=$1 ORDER BY created_at DESC",
    [shop]
  );

  await client.query("COMMIT");
  res.json({ countries: rows || [] });
  client.release();
  // await client.query("ROLLBACK");
});

// Add country
router.post("/blocked-countries", async (req, res) => {
  const shop = getShop(req);
  const { country } = req.body;
  const client = await db.getClient();

  await client.query("BEGIN");
  await db.query(
    "INSERT INTO blocked_countries (shop_domain, country_code) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [shop, country]
  );
  await client.query("COMMIT");
  client.release();
  // await client.query("ROLLBACK");
  res.status(200).send("Added");
});

// Remove country
router.delete("/blocked-countries/:code", async (req, res) => {
  const shop = getShop(req);
  const country = req.params.code;
  const client = await db.getClient();

  await client.query("BEGIN");
  await db.query(
    "DELETE FROM blocked_countries WHERE shop_domain=$1 AND country_code=$2",
    [shop, country]
  );
  await client.query("COMMIT");
  client.release();
  // await client.query("ROLLBACK");
  res.status(200).send("Removed");
});

export default router;
