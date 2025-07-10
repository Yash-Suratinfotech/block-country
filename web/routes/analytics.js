// web/routes/analytics.js
import express from "express";
import db from "../db.js";

const router = express.Router();

function getShop(req) {
  return req.query.shop || req.body.shop;
}

// Get analytics dashboard data
router.get("/analytics/dashboard", async (req, res) => {
  const shop = getShop(req);
  const { days = 7 } = req.query;
  const client = await db.getClient();

  try {
    // Overview stats
    const overviewStats = await client.query(
      `
      SELECT 
        COUNT(*) as total_visits,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(DISTINCT ip_address) as unique_visitors,
        AVG(visit_duration) as avg_duration,
        SUM(page_views) as total_page_views,
        COUNT(CASE WHEN is_bot = true THEN 1 END) as bot_visits,
        COUNT(CASE WHEN blocked_reason IS NOT NULL THEN 1 END) as blocked_visits
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
    `,
      [shop]
    );

    // Daily visits trend
    const dailyTrend = await client.query(
      `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as visits,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(CASE WHEN is_bot = true THEN 1 END) as bot_visits,
        COUNT(CASE WHEN blocked_reason IS NOT NULL THEN 1 END) as blocked_visits
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
      [shop]
    );

    // Top countries
    const topCountries = await client.query(
      `
      SELECT 
        country_code,
        COUNT(*) as visits,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(CASE WHEN blocked_reason IS NOT NULL THEN 1 END) as blocked_visits
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND country_code IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY country_code
      ORDER BY visits DESC
      LIMIT 10
    `,
      [shop]
    );

    // Device breakdown
    const deviceStats = await client.query(
      `
      SELECT 
        device_type,
        COUNT(*) as visits,
        COUNT(DISTINCT session_id) as unique_sessions,
        AVG(visit_duration) as avg_duration
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY device_type
      ORDER BY visits DESC
    `,
      [shop]
    );

    // Browser breakdown
    const browserStats = await client.query(
      `
      SELECT 
        browser_name,
        COUNT(*) as visits,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND browser_name IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY browser_name
      ORDER BY visits DESC
      LIMIT 10
    `,
      [shop]
    );

    // Top pages
    const topPages = await client.query(
      `
      SELECT 
        page_url,
        COUNT(*) as visits,
        COUNT(DISTINCT session_id) as unique_sessions,
        AVG(visit_duration) as avg_duration
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND page_url IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY page_url
      ORDER BY visits DESC
      LIMIT 10
    `,
      [shop]
    );

    res.json({
      overview: overviewStats.rows[0] || {},
      dailyTrend: dailyTrend.rows,
      topCountries: topCountries.rows,
      deviceStats: deviceStats.rows,
      browserStats: browserStats.rows,
      topPages: topPages.rows,
    });
  } catch (error) {
    console.error("Error fetching analytics dashboard:", error);
    res.status(500).json({ error: "Failed to fetch analytics data" });
  } finally {
    client.release();
  }
});

// Get detailed visitor analytics
router.get("/analytics/visitors", async (req, res) => {
  const shop = getShop(req);
  const {
    days = 7,
    page = 1,
    limit = 50,
    filter_bots = false,
    filter_blocked = false,
  } = req.query;
  const client = await db.getClient();

  try {
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereConditions = [
      `shop_domain = $1`,
      `created_at >= NOW() - INTERVAL '${parseInt(days)} days'`,
    ];
    let paramCount = 1;
    const params = [shop];

    if (filter_bots === "true") {
      whereConditions.push(`is_bot = false`);
    }

    if (filter_blocked === "true") {
      whereConditions.push(`blocked_reason IS NULL`);
    }

    // Get visitors with pagination
    const visitors = await client.query(
      `
      SELECT 
        ip_address,
        country_code,
        user_agent,
        device_type,
        browser_name,
        browser_version,
        page_url,
        referrer,
        visit_duration,
        page_views,
        is_bot,
        bot_name,
        blocked_reason,
        created_at
      FROM user_analytics 
      WHERE ${whereConditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `,
      [...params, parseInt(limit), offset]
    );

    // Get total count
    const totalCount = await client.query(
      `
      SELECT COUNT(*) as total
      FROM user_analytics 
      WHERE ${whereConditions.join(" AND ")}
    `,
      params
    );

    res.json({
      visitors: visitors.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalCount.rows[0].total),
        totalPages: Math.ceil(
          parseInt(totalCount.rows[0].total) / parseInt(limit)
        ),
      },
    });
  } catch (error) {
    console.error("Error fetching visitor analytics:", error);
    res.status(500).json({ error: "Failed to fetch visitor data" });
  } finally {
    client.release();
  }
});

// Get blocking analytics
router.get("/analytics/blocking", async (req, res) => {
  const shop = getShop(req);
  const { days = 7 } = req.query;
  const client = await db.getClient();

  try {
    // Blocking reasons breakdown
    const blockingReasons = await client.query(
      `
      SELECT 
        CASE 
          WHEN blocked_reason LIKE '%Country%' THEN 'Country Blocked'
          WHEN blocked_reason LIKE '%IP%' THEN 'IP Blocked'
          WHEN blocked_reason LIKE '%Bot%' THEN 'Bot Blocked'
          ELSE 'Other'
        END as reason_category,
        COUNT(*) as count
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND blocked_reason IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY reason_category
      ORDER BY count DESC
    `,
      [shop]
    );

    // Blocked countries
    const blockedCountries = await client.query(
      `
      SELECT 
        country_code,
        COUNT(*) as blocked_attempts
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND blocked_reason IS NOT NULL
        AND blocked_reason LIKE '%Country%'
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY country_code
      ORDER BY blocked_attempts DESC
      LIMIT 10
    `,
      [shop]
    );

    // Blocked IPs
    const blockedIPs = await client.query(
      `
      SELECT 
        ip_address,
        COUNT(*) as blocked_attempts,
        MAX(created_at) as last_attempt
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND blocked_reason IS NOT NULL
        AND blocked_reason LIKE '%IP%'
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY ip_address
      ORDER BY blocked_attempts DESC
      LIMIT 10
    `,
      [shop]
    );

    // Blocked bots
    const blockedBots = await client.query(
      `
      SELECT 
        bot_name,
        COUNT(*) as blocked_attempts
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND blocked_reason IS NOT NULL
        AND is_bot = true
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY bot_name
      ORDER BY blocked_attempts DESC
      LIMIT 10
    `,
      [shop]
    );

    // Daily blocking trend
    const dailyBlocking = await client.query(
      `
      SELECT 
        DATE(created_at) as date,
        COUNT(CASE WHEN blocked_reason LIKE '%Country%' THEN 1 END) as country_blocks,
        COUNT(CASE WHEN blocked_reason LIKE '%IP%' THEN 1 END) as ip_blocks,
        COUNT(CASE WHEN blocked_reason LIKE '%Bot%' THEN 1 END) as bot_blocks
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND blocked_reason IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
      [shop]
    );

    res.json({
      blockingReasons: blockingReasons.rows,
      blockedCountries: blockedCountries.rows,
      blockedIPs: blockedIPs.rows,
      blockedBots: blockedBots.rows,
      dailyBlocking: dailyBlocking.rows,
    });
  } catch (error) {
    console.error("Error fetching blocking analytics:", error);
    res.status(500).json({ error: "Failed to fetch blocking analytics" });
  } finally {
    client.release();
  }
});

// Export analytics data
router.get("/analytics/export", async (req, res) => {
  const shop = getShop(req);
  const { days = 30, format = "csv" } = req.query;
  const client = await db.getClient();

  try {
    const analyticsData = await client.query(
      `
      SELECT 
        created_at,
        ip_address,
        country_code,
        device_type,
        browser_name,
        browser_version,
        page_url,
        referrer,
        visit_duration,
        page_views,
        is_bot,
        bot_name,
        blocked_reason
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      ORDER BY created_at DESC
    `,
      [shop]
    );

    if (format === "csv") {
      const csvHeader =
        "Date,IP Address,Country,Device,Browser,Browser Version,Page URL,Referrer,Duration (s),Page Views,Is Bot,Bot Name,Blocked Reason\n";
      const csvData = analyticsData.rows
        .map(
          (row) =>
            `"${row.created_at}","${row.ip_address}","${
              row.country_code || ""
            }","${row.device_type}","${row.browser_name}","${
              row.browser_version
            }","${row.page_url}","${row.referrer || ""}","${
              row.visit_duration
            }","${row.page_views}","${row.is_bot}","${row.bot_name || ""}","${
              row.blocked_reason || ""
            }"`
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="analytics-${shop}-${days}days.csv"`
      );
      res.send(csvHeader + csvData);
    } else {
      res.json(analyticsData.rows);
    }
  } catch (error) {
    console.error("Error exporting analytics:", error);
    res.status(500).json({ error: "Failed to export analytics data" });
  } finally {
    client.release();
  }
});

// Real-time analytics (for live dashboard)
router.get("/analytics/realtime", async (req, res) => {
  const shop = getShop(req);
  const client = await db.getClient();

  try {
    // Last 30 minutes activity
    const realtimeStats = await client.query(
      `
      SELECT 
        COUNT(*) as current_visitors,
        COUNT(DISTINCT ip_address) as unique_visitors,
        COUNT(CASE WHEN is_bot = true THEN 1 END) as bot_visits,
        COUNT(CASE WHEN blocked_reason IS NOT NULL THEN 1 END) as blocked_visits
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND created_at >= NOW() - INTERVAL '30 minutes'
    `,
      [shop]
    );

    // Recent visitors (last 10)
    const recentVisitors = await client.query(
      `
      SELECT 
        ip_address,
        country_code,
        device_type,
        browser_name,
        page_url,
        is_bot,
        blocked_reason,
        created_at
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND created_at >= NOW() - INTERVAL '30 minutes'
      ORDER BY created_at DESC
      LIMIT 10
    `,
      [shop]
    );

    // Live page views (last hour by 5-minute intervals)
    const livePageViews = await client.query(
      `
      SELECT 
        DATE_TRUNC('minute', created_at) as time_bucket,
        COUNT(*) as page_views
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND created_at >= NOW() - INTERVAL '1 hour'
      GROUP BY DATE_TRUNC('minute', created_at)
      ORDER BY time_bucket ASC
    `,
      [shop]
    );

    res.json({
      stats: realtimeStats.rows[0] || {},
      recentVisitors: recentVisitors.rows,
      livePageViews: livePageViews.rows,
    });
  } catch (error) {
    console.error("Error fetching realtime analytics:", error);
    res.status(500).json({ error: "Failed to fetch realtime analytics" });
  } finally {
    client.release();
  }
});

// Analytics summary for homepage
router.get("/analytics/summary", async (req, res) => {
  const shop = getShop(req);
  const client = await db.getClient();

  try {
    // Today vs yesterday comparison
    const todayStats = await client.query(
      `
      SELECT 
        COUNT(*) as visits,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(CASE WHEN blocked_reason IS NOT NULL THEN 1 END) as blocked_visits
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND DATE(created_at) = CURRENT_DATE
    `,
      [shop]
    );

    const yesterdayStats = await client.query(
      `
      SELECT 
        COUNT(*) as visits,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(CASE WHEN blocked_reason IS NOT NULL THEN 1 END) as blocked_visits
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
    `,
      [shop]
    );

    // Last 7 days totals
    const weekStats = await client.query(
      `
      SELECT 
        COUNT(*) as total_visits,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(DISTINCT ip_address) as unique_visitors,
        COUNT(DISTINCT country_code) as countries_visited,
        COUNT(CASE WHEN is_bot = true THEN 1 END) as bot_visits,
        COUNT(CASE WHEN blocked_reason IS NOT NULL THEN 1 END) as blocked_visits
      FROM user_analytics 
      WHERE shop_domain = $1 
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    `,
      [shop]
    );

    const today = todayStats.rows[0] || {
      visits: 0,
      unique_sessions: 0,
      blocked_visits: 0,
    };
    const yesterday = yesterdayStats.rows[0] || {
      visits: 0,
      unique_sessions: 0,
      blocked_visits: 0,
    };
    const week = weekStats.rows[0] || {};

    // Calculate percentage changes
    const visitChange =
      yesterday.visits > 0
        ? (
            ((today.visits - yesterday.visits) / yesterday.visits) *
            100
          ).toFixed(1)
        : today.visits > 0
        ? 100
        : 0;

    const sessionChange =
      yesterday.unique_sessions > 0
        ? (
            ((today.unique_sessions - yesterday.unique_sessions) /
              yesterday.unique_sessions) *
            100
          ).toFixed(1)
        : today.unique_sessions > 0
        ? 100
        : 0;

    res.json({
      today: {
        ...today,
        visitChange: parseFloat(visitChange),
        sessionChange: parseFloat(sessionChange),
      },
      yesterday,
      week,
    });
  } catch (error) {
    console.error("Error fetching analytics summary:", error);
    res.status(500).json({ error: "Failed to fetch analytics summary" });
  } finally {
    client.release();
  }
});

export default router;
