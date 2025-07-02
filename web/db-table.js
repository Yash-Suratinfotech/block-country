import dotenv from "dotenv";
dotenv.config();

import { Client } from "pg";
const DATABASE_URL = process.env.DATABASE_URL;

const client = new Client({
  connectionString: DATABASE_URL,
});

await client.connect();

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

  CREATE TABLE IF NOT EXISTS blocked_ips (
    id SERIAL PRIMARY KEY,
    shop_domain TEXT,
    ip_address VARCHAR(45) NOT NULL, -- Supports both IPv4 and IPv6
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT shop_ip_unique UNIQUE(shop_domain, ip_address)
  );

  CREATE INDEX idx_blocked_ips_shop_domain ON blocked_ips(shop_domain);
  CREATE INDEX idx_blocked_ips_ip_address ON blocked_ips(ip_address);
`);

await client.end();
console.log(
  "✅ Tables initialized (shops and blocked_countries, no relation)."
);
