import express from "express";
import db from "../db.js";

const router = express.Router();

// Public endpoint for storefront script
router.get("/check_country", async (req, res) => {
  const { shop, country } = req.query;
  // if (key !== process.env.COUNTRY_CHECK_KEY)
  //   return res.status(401).send("Unauthorized");
  const client = await db.getClient();

  await client.query("BEGIN");
  const { rowCount } = await db.query(
    "SELECT 1 FROM blocked_countries WHERE shop_domain=$1 AND country_code=$2",
    [shop, country]
  );
  await client.query("COMMIT");
  client.release();
  // await client.query("ROLLBACK");
  res.status(200).json({ blocked: rowCount > 0 });
});

export default router;
