import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const db = await open({
  filename: './database.sqlite',
  driver: sqlite3.Database,
});

// Table creation for SQLite
await db.exec(`
  CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_domain TEXT UNIQUE,
    access_token TEXT,
    installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blocked_countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_domain TEXT,
    country_code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_domain, country_code)
  );

  CREATE TABLE IF NOT EXISTS blocked_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_domain TEXT,
    ip_address TEXT NOT NULL, -- Supports both IPv4 and IPv6
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_domain, ip_address)
  );

  CREATE INDEX IF NOT EXISTS idx_blocked_ips_shop_domain ON blocked_ips(shop_domain);
  CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
`);

await db.close();
console.log(
  "✅ Tables initialized (shops, blocked_countries, blocked_ips)."
);