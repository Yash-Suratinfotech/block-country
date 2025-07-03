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
  const rows = await db.query(
    "SELECT country_code, created_at FROM blocked_countries WHERE shop_domain=? ORDER BY created_at DESC",
    [shop]
  );
  res.json({ countries: rows || [] });
});

// Add country
router.post("/blocked-countries", async (req, res) => {
  const shop = getShop(req);
  const { country } = req.body;
  await db.query(
    "INSERT OR IGNORE INTO blocked_countries (shop_domain, country_code) VALUES (?, ?)",
    [shop, country]
  );
  res.status(200).send("Added");
});

// Remove country
router.delete("/blocked-countries/:code", async (req, res) => {
  const shop = getShop(req);
  const country = req.params.code;
  await db.query(
    "DELETE FROM blocked_countries WHERE shop_domain=? AND country_code=?",
    [shop, country]
  );
  res.status(200).send("Removed");
});

export default router;
