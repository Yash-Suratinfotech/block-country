// web/db-table.js - Enhanced version with analytics improvements
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { Client } from "pg";
const DATABASE_URL = process.env.DATABASE_URL;
console.log("🔗 DATABASE_URL:", DATABASE_URL ? "Connected" : "Not found");

const client = new Client({
  connectionString: DATABASE_URL,
});

await client.connect();

try {
  // Create table
  await client.query(`
    -- DROP TABLES FIRST IF NEEDED (optional, for reset)
    -- DROP TABLE IF EXISTS blocked_countries CASCADE;
    -- DROP TABLE IF EXISTS blocked_ips CASCADE;
    -- DROP TABLE IF EXISTS bot_settings CASCADE;
    -- DROP TABLE IF EXISTS content_protection_settings CASCADE;
    -- DROP TABLE IF EXISTS user_analytics CASCADE;
    -- DROP TABLE IF EXISTS performance_analytics CASCADE;
    -- DROP TABLE IF EXISTS country_settings CASCADE;
    -- DROP TABLE IF EXISTS ip_settings CASCADE;
    -- DROP TABLE IF EXISTS shops CASCADE;

    -- 1. shops table
    CREATE TABLE IF NOT EXISTS shops (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT UNIQUE NOT NULL,
      access_token TEXT,
      installed_at TIMESTAMP DEFAULT NOW()
    );

    -- 2. blocked_countries table
    CREATE TABLE IF NOT EXISTS blocked_countries (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT NOT NULL,
      country_code VARCHAR(2) NOT NULL,
      list_type VARCHAR(10) DEFAULT 'blacklist' CHECK (list_type IN ('whitelist', 'blacklist')),
      redirect_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(shop_domain, country_code)
    );

    -- 3. blocked_ips table
    CREATE TABLE IF NOT EXISTS blocked_ips (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT NOT NULL,
      ip_address VARCHAR(45) NOT NULL,
      note TEXT,
      list_type VARCHAR(10) DEFAULT 'blacklist' CHECK (list_type IN ('whitelist', 'blacklist')),
      redirect_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(shop_domain, ip_address)
    );

    -- 4. bot_settings table
    CREATE TABLE IF NOT EXISTS bot_settings (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT NOT NULL,
      user_agent_pattern TEXT NOT NULL,
      bot_name VARCHAR(100),
      bot_url TEXT,
      list_type VARCHAR(10) DEFAULT 'whitelist' CHECK (list_type IN ('whitelist', 'blacklist')),
      is_enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(shop_domain, user_agent_pattern)
    );

    -- 5. content_protection_settings table
    CREATE TABLE IF NOT EXISTS content_protection_settings (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT UNIQUE NOT NULL,
      disable_right_click BOOLEAN DEFAULT false,
      disable_text_selection BOOLEAN DEFAULT false,
      disable_image_drag BOOLEAN DEFAULT false,
      disable_copy_paste BOOLEAN DEFAULT false,
      disable_dev_tools BOOLEAN DEFAULT false,
      custom_protection_message TEXT DEFAULT 'Content is protected',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. user_analytics table
    CREATE TABLE IF NOT EXISTS user_analytics (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT NOT NULL,
      session_id VARCHAR(100) NOT NULL,
      ip_address VARCHAR(45),
      country_code VARCHAR(2),
      user_agent TEXT,
      device_type VARCHAR(20),
      browser_name VARCHAR(50),
      browser_version VARCHAR(20),
      page_url TEXT,
      referrer TEXT,
      visit_duration INTEGER DEFAULT 0,
      page_views INTEGER DEFAULT 1,
      is_bot BOOLEAN DEFAULT false,
      bot_name VARCHAR(100),
      blocked_reason TEXT,
      screen_resolution VARCHAR(20),
      viewport_size VARCHAR(20),
      timezone VARCHAR(50),
      language VARCHAR(10),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(shop_domain, session_id)
    );

    -- 7. performance_analytics table
    CREATE TABLE IF NOT EXISTS performance_analytics (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT NOT NULL,
      session_id VARCHAR(100),
      page_url TEXT,
      load_time INTEGER,
      dom_ready_time INTEGER,
      first_paint_time INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 8. country_settings table
    CREATE TABLE IF NOT EXISTS country_settings (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT UNIQUE NOT NULL,
      default_list_type VARCHAR(10) DEFAULT 'blacklist' CHECK (default_list_type IN ('whitelist', 'blacklist')),
      redirect_url TEXT,
      custom_message TEXT DEFAULT 'Sorry, this store is not available in your country.',
      enable_country_detection BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 9. ip_settings table
    CREATE TABLE IF NOT EXISTS ip_settings (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT UNIQUE NOT NULL,
      default_list_type VARCHAR(10) DEFAULT 'blacklist' CHECK (default_list_type IN ('whitelist', 'blacklist')),
      redirect_url TEXT,
      custom_message TEXT DEFAULT 'Your IP address has been blocked from accessing this store.',
      auto_block_repeated_attempts BOOLEAN DEFAULT false,
      max_attempts_threshold INTEGER DEFAULT 5,
      enable_ip_detection BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("✅ All tables created successfully");
} catch (error) {
  console.error("❌ Error setting up enhanced database:", error);
  throw error;
} finally {
  await client.end();
}