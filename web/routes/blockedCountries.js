// web/routes/blockedCountries.js
import express from "express";
import db from "../db.js";

const router = express.Router();

// Helper: extract shop from session
function getShop(req) {
  return req.query.shop || req.body.shop;
}

// Get blocked countries with enhanced filtering
router.get("/blocked-countries", async (req, res) => {
  const shop = getShop(req);
  const { list_type } = req.query; // Optional filter by list_type
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    let query = `
      SELECT country_code, list_type, redirect_url, created_at, updated_at 
      FROM blocked_countries 
      WHERE shop_domain = $1
    `;
    let params = [shop];

    if (list_type && ['whitelist', 'blacklist'].includes(list_type)) {
      query += ` AND list_type = $2`;
      params.push(list_type);
    }

    query += ` ORDER BY list_type DESC, created_at DESC`;

    const { rows } = await db.query(query, params);

    await client.query("COMMIT");
    res.json({ 
      countries: rows || [],
      stats: {
        total: rows.length,
        whitelist: rows.filter(c => c.list_type === 'whitelist').length,
        blacklist: rows.filter(c => c.list_type === 'blacklist').length
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error fetching countries:", error);
    res.status(500).json({ error: "Failed to fetch countries" });
  } finally {
    client.release();
  }
});

// Add country with enhanced options
router.post("/blocked-countries", async (req, res) => {
  const shop = getShop(req);
  const { country, list_type = 'blacklist', redirect_url } = req.body;
  const client = await db.getClient();

  if (!country) {
    return res.status(400).json({ error: "Country code is required" });
  }

  if (!['whitelist', 'blacklist'].includes(list_type)) {
    return res.status(400).json({ error: "Invalid list_type. Must be 'whitelist' or 'blacklist'" });
  }

  try {
    await client.query("BEGIN");

    // Check if country already exists
    const existingCountry = await db.query(
      "SELECT country_code, list_type FROM blocked_countries WHERE shop_domain = $1 AND country_code = $2",
      [shop, country]
    );

    if (existingCountry.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ 
        error: "Country already exists in rules",
        existing: existingCountry.rows[0]
      });
    }

    // Insert new country rule
    const { rows } = await db.query(`
      INSERT INTO blocked_countries (shop_domain, country_code, list_type, redirect_url) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `, [shop, country, list_type, redirect_url || null]);

    await client.query("COMMIT");
    res.status(201).json({ 
      message: "Country rule created", 
      country: rows[0] 
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error adding country:", error);
    res.status(500).json({ error: "Failed to add country" });
  } finally {
    client.release();
  }
});

// Update country rule
router.put("/blocked-countries/:code", async (req, res) => {
  const shop = getShop(req);
  const country = req.params.code;
  const { list_type, redirect_url } = req.body;
  const client = await db.getClient();

  if (!['whitelist', 'blacklist'].includes(list_type)) {
    return res.status(400).json({ error: "Invalid list_type. Must be 'whitelist' or 'blacklist'" });
  }

  try {
    await client.query("BEGIN");

    const { rows, rowCount } = await db.query(`
      UPDATE blocked_countries 
      SET list_type = $1, redirect_url = $2, updated_at = CURRENT_TIMESTAMP
      WHERE shop_domain = $3 AND country_code = $4
      RETURNING *
    `, [list_type, redirect_url || null, shop, country]);

    await client.query("COMMIT");

    if (rowCount === 0) {
      res.status(404).json({ error: "Country rule not found" });
    } else {
      res.json({ 
        message: "Country rule updated", 
        country: rows[0] 
      });
    }

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating country:", error);
    res.status(500).json({ error: "Failed to update country" });
  } finally {
    client.release();
  }
});

// Remove country
router.delete("/blocked-countries/:code", async (req, res) => {
  const shop = getShop(req);
  const country = req.params.code;
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const { rowCount } = await db.query(
      "DELETE FROM blocked_countries WHERE shop_domain = $1 AND country_code = $2",
      [shop, country]
    );

    await client.query("COMMIT");

    if (rowCount === 0) {
      res.status(404).json({ error: "Country rule not found" });
    } else {
      res.json({ message: "Country rule removed" });
    }

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error removing country:", error);
    res.status(500).json({ error: "Failed to remove country" });
  } finally {
    client.release();
  }
});

// Export countries to CSV
router.get("/blocked-countries/export", async (req, res) => {
  const shop = getShop(req);
  const client = await db.getClient();

  try {
    const { rows } = await db.query(`
      SELECT country_code, list_type, redirect_url, created_at 
      FROM blocked_countries 
      WHERE shop_domain = $1 
      ORDER BY list_type DESC, country_code ASC
    `, [shop]);

    // Generate CSV
    const csvHeader = 'Country Code,Rule Type,Redirect URL,Created At\n';
    const csvData = rows.map(row => 
      `"${row.country_code}","${row.list_type}","${row.redirect_url || ''}","${row.created_at}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="country-rules-${shop}.csv"`);
    res.send(csvHeader + csvData);

  } catch (error) {
    console.error("Error exporting countries:", error);
    res.status(500).json({ error: "Failed to export countries" });
  } finally {
    client.release();
  }
});

// Get country settings
router.get("/country-settings", async (req, res) => {
  const shop = getShop(req);
  const client = await db.getClient();

  try {
    const { rows } = await db.query(`
      SELECT * FROM country_settings 
      WHERE shop_domain = $1
    `, [shop]);

    const defaultSettings = {
      shop_domain: shop,
      default_list_type: 'blacklist',
      redirect_url: '',
      custom_message: 'Sorry, this store is not available in your country.',
      enable_country_detection: true
    };

    res.json({ 
      settings: rows.length > 0 ? rows[0] : defaultSettings 
    });

  } catch (error) {
    console.error("Error fetching country settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  } finally {
    client.release();
  }
});

// Update country settings
router.post("/country-settings", async (req, res) => {
  const shop = getShop(req);
  const {
    default_list_type = 'blacklist',
    redirect_url = '',
    custom_message = 'Sorry, this store is not available in your country.',
    enable_country_detection = true
  } = req.body;
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const { rows } = await db.query(`
      INSERT INTO country_settings (
        shop_domain, default_list_type, redirect_url, custom_message, enable_country_detection
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (shop_domain) 
      DO UPDATE SET 
        default_list_type = EXCLUDED.default_list_type,
        redirect_url = EXCLUDED.redirect_url,
        custom_message = EXCLUDED.custom_message,
        enable_country_detection = EXCLUDED.enable_country_detection,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [shop, default_list_type, redirect_url, custom_message, enable_country_detection]);

    await client.query("COMMIT");
    res.json({ 
      message: "Country settings updated", 
      settings: rows[0] 
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating country settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  } finally {
    client.release();
  }
});

// Bulk import countries
router.post("/blocked-countries/bulk-import", async (req, res) => {
  const shop = getShop(req);
  const { countries, list_type = 'blacklist', redirect_url } = req.body;
  const client = await db.getClient();

  if (!Array.isArray(countries) || countries.length === 0) {
    return res.status(400).json({ error: "Countries array is required" });
  }

  if (!['whitelist', 'blacklist'].includes(list_type)) {
    return res.status(400).json({ error: "Invalid list_type" });
  }

  try {
    await client.query("BEGIN");

    const results = {
      added: [],
      skipped: [],
      errors: []
    };

    for (const country of countries) {
      try {
        // Check if country already exists
        const existing = await db.query(
          "SELECT country_code FROM blocked_countries WHERE shop_domain = $1 AND country_code = $2",
          [shop, country]
        );

        if (existing.rows.length > 0) {
          results.skipped.push(country);
          continue;
        }

        // Insert country
        await db.query(`
          INSERT INTO blocked_countries (shop_domain, country_code, list_type, redirect_url) 
          VALUES ($1, $2, $3, $4)
        `, [shop, country, list_type, redirect_url || null]);

        results.added.push(country);

      } catch (error) {
        console.error(`Error adding country ${country}:`, error);
        results.errors.push({ country, error: error.message });
      }
    }

    await client.query("COMMIT");
    res.json({
      message: "Bulk import completed",
      results
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in bulk import:", error);
    res.status(500).json({ error: "Failed to import countries" });
  } finally {
    client.release();
  }
});

export default router;