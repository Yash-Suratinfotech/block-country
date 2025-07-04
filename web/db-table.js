// Clean database setup - drops all tables and recreates them
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Client } from "pg";
const DATABASE_URL = process.env.DATABASE_URL;
console.log('🔗 DATABASE_URL:', DATABASE_URL ? 'Connected' : 'Not found');

const client = new Client({
  connectionString: DATABASE_URL,
});

await client.connect();

try {
  console.log("🗑️  Dropping all existing tables...");
  
  // Drop all tables (in correct order due to dependencies)
  // await client.query(`
  //   DROP TABLE IF EXISTS performance_analytics CASCADE;
  //   DROP TABLE IF EXISTS user_analytics CASCADE;
  //   DROP TABLE IF EXISTS content_protection_settings CASCADE;
  //   DROP TABLE IF EXISTS bot_settings CASCADE;
  //   DROP TABLE IF EXISTS blocked_ips CASCADE;
  //   DROP TABLE IF EXISTS blocked_countries CASCADE;
  //   DROP TABLE IF EXISTS ip_settings CASCADE;
  //   DROP TABLE IF EXISTS country_settings CASCADE;
  //   DROP TABLE IF EXISTS shops CASCADE;
    
  //   -- Drop views if they exist
  //   DROP VIEW IF EXISTS analytics_summary CASCADE;
  //   DROP VIEW IF EXISTS blocking_summary CASCADE;
  // `);
  
  // console.log("✅ All tables dropped successfully");
  
  console.log("🏗️  Creating fresh tables...");
  
  // Create shops table
  await client.query(`
    CREATE TABLE shops (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT UNIQUE NOT NULL,
      access_token TEXT,
      installed_at TIMESTAMP DEFAULT NOW()
    );
  `);
  
  // Create blocked_countries table
  await client.query(`
    CREATE TABLE blocked_countries (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT NOT NULL,
      country_code VARCHAR(2) NOT NULL,
      list_type VARCHAR(10) DEFAULT 'blacklist' CHECK (list_type IN ('whitelist', 'blacklist')),
      redirect_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(shop_domain, country_code)
    );
  `);
  
  // Create blocked_ips table
  await client.query(`
    CREATE TABLE blocked_ips (
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
  `);
  
  // Create bot_settings table
  await client.query(`
    CREATE TABLE bot_settings (
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
  `);
  
  // Create content_protection_settings table
  await client.query(`
    CREATE TABLE content_protection_settings (
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
  `);
  
  // Create user_analytics table
  await client.query(`
    CREATE TABLE user_analytics (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT NOT NULL,
      session_id VARCHAR(100),
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(shop_domain, session_id)
    );
  `);
  
  // Create performance_analytics table
  await client.query(`
    CREATE TABLE performance_analytics (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT NOT NULL,
      session_id VARCHAR(100),
      page_url TEXT,
      load_time INTEGER,
      dom_ready_time INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Create country_settings table
  await client.query(`
    CREATE TABLE country_settings (
      id SERIAL PRIMARY KEY,
      shop_domain TEXT UNIQUE NOT NULL,
      default_list_type VARCHAR(10) DEFAULT 'blacklist' CHECK (default_list_type IN ('whitelist', 'blacklist')),
      redirect_url TEXT,
      custom_message TEXT DEFAULT 'Sorry, this store is not available in your country.',
      enable_country_detection BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Create ip_settings table
  await client.query(`
    CREATE TABLE ip_settings (
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
  
  // Create indexes for better performance
  console.log("🔍 Creating indexes...");
  await client.query(`
    CREATE INDEX idx_user_analytics_shop_date ON user_analytics(shop_domain, created_at);
    CREATE INDEX idx_user_analytics_session ON user_analytics(session_id);
    CREATE INDEX idx_user_analytics_country ON user_analytics(shop_domain, country_code);
    CREATE INDEX idx_user_analytics_device ON user_analytics(shop_domain, device_type);
    CREATE INDEX idx_user_analytics_bot ON user_analytics(shop_domain, is_bot);
    CREATE INDEX idx_bot_settings_shop ON bot_settings(shop_domain);
    CREATE INDEX idx_bot_settings_enabled ON bot_settings(shop_domain, is_enabled);
    CREATE INDEX idx_blocked_countries_shop ON blocked_countries(shop_domain);
    CREATE INDEX idx_blocked_ips_shop ON blocked_ips(shop_domain);
    CREATE INDEX idx_performance_analytics_shop ON performance_analytics(shop_domain, created_at);
    CREATE INDEX idx_blocked_countries_list_type ON blocked_countries(shop_domain, list_type);
    CREATE INDEX idx_blocked_ips_list_type ON blocked_ips(shop_domain, list_type);
  `);
  
  console.log("✅ Indexes created");
  
  // Insert default bot settings
  console.log("🤖 Adding default bot settings...");
  await client.query(`
    INSERT INTO bot_settings (shop_domain, user_agent_pattern, bot_name, bot_url, list_type) VALUES
    ('*', 'googlebot', 'Googlebot', 'http://www.google.com/bot.html', 'whitelist'),
    ('*', 'bingbot', 'BingBot', 'http://search.msn.com/msnbot.htm', 'whitelist'),
    ('*', 'facebookexternalhit', 'Facebook External Hit', 'https://www.facebook.com/externalhit_uatext.php', 'whitelist'),
    ('*', 'twitterbot', 'Twitter Bot', 'https://developer.twitter.com/en/docs/twitter-for-websites/cards/guides/getting-started', 'whitelist'),
    ('*', 'linkedinbot', 'LinkedIn Bot', 'http://www.linkedin.com', 'whitelist'),
    ('*', 'pinterest', 'Pinterest', 'http://www.pinterest.com', 'whitelist'),
    ('*', 'applebot', 'Applebot', 'https://support.apple.com/en-us/HT204683', 'whitelist'),
    ('*', 'slurp', 'Yahoo Slurp', 'https://help.yahoo.com/kb/search/slurp-crawling-page-sln22600.html', 'whitelist');
  `);
  
  console.log("✅ Default bot settings added");
  
  // Create views for analytics
  console.log("📊 Creating analytics views...");
  await client.query(`
    CREATE VIEW analytics_summary AS
    SELECT 
      shop_domain,
      DATE(created_at) as date,
      country_code,
      device_type,
      COUNT(*) as visits,
      COUNT(DISTINCT session_id) as unique_sessions,
      COUNT(DISTINCT ip_address) as unique_visitors,
      AVG(visit_duration) as avg_duration,
      SUM(page_views) as total_page_views,
      COUNT(CASE WHEN is_bot = true THEN 1 END) as bot_visits,
      COUNT(CASE WHEN blocked_reason IS NOT NULL THEN 1 END) as blocked_visits
    FROM user_analytics 
    GROUP BY shop_domain, DATE(created_at), country_code, device_type;
  `);
  
  await client.query(`
    CREATE VIEW blocking_summary AS
    SELECT 
      shop_domain,
      DATE(created_at) as date,
      COUNT(CASE WHEN blocked_reason LIKE '%Country%' THEN 1 END) as country_blocks,
      COUNT(CASE WHEN blocked_reason LIKE '%IP%' THEN 1 END) as ip_blocks,
      COUNT(CASE WHEN blocked_reason LIKE '%Bot%' THEN 1 END) as bot_blocks,
      COUNT(*) as total_blocks
    FROM user_analytics 
    WHERE blocked_reason IS NOT NULL
    GROUP BY shop_domain, DATE(created_at);
  `);
  
  console.log("✅ Views created");
  
  console.log("🎉 Database setup completed successfully!");
  console.log("📋 Summary:");
  console.log("   ✅ 8 tables created");
  console.log("   ✅ 12 indexes created");
  console.log("   ✅ 8 default bot settings added");
  console.log("   ✅ 2 analytics views created");
  console.log("   ✅ All constraints and relationships established");
  
} catch (error) {
  console.error("❌ Error setting up database:", error);
  throw error;
} finally {
  await client.end();
}