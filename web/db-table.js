import dotenv from "dotenv";
dotenv.config();

import { Client } from "pg";
const DATABASE_URL = process.env.DATABASE_URL;

const client = new Client({
  connectionString: DATABASE_URL,
});

await client.connect();

// Drop foreign key if it exists
await client.query(`
  ALTER TABLE blocked_countries
  DROP CONSTRAINT IF EXISTS blocked_countries_shop_domain_fkey;
`);

// Recreate table if needed (does nothing if already exists with right structure)
await client.query(`
  CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    shop_domain TEXT UNIQUE,
    access_token TEXT,
    installed_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS blocked_countries (
    id SERIAL PRIMARY KEY,
    shop_domain TEXT,
    country_code VARCHAR(2),
    CONSTRAINT shop_country_unique UNIQUE(shop_domain, country_code)
  );
`);

await client.end();
console.log("✅ Tables initialized (shops and blocked_countries, no relation).");
