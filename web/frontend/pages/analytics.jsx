// web/frontend/pages/analytics.jsx 
import React, { useEffect, useState, useCallback } from "react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Layout,
  InlineGrid,
  DataTable,
  Select,
  Tabs,
  Box,
  Badge,
  InlineStack,
  EmptyState,
  Spinner,
  Banner,
  Button,
  Tooltip,
} from "@shopify/polaris";
import { ExportIcon, RefreshIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function Analytics() {
  const shopify = useAppBridge();
  const shop = shopify.config.shop;

  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);
  const [timeRange, setTimeRange] = useState("7");
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Analytics data
  const [dashboardData, setDashboardData] = useState(null);
  const [visitorsData, setVisitorsData] = useState(null);
  const [blockingData, setBlockingData] = useState(null);
  const [realtimeData, setRealtimeData] = useState(null);
  const [loadingStates, setLoadingStates] = useState({
    dashboard: false,
    visitors: false,
    blocking: false,
    realtime: false,
  });

  const tabs = [
    {
      id: "overview",
      content: "Overview",
      accessibilityLabel: "Overview Analytics",
    },
    {
      id: "visitors",
      content: "Visitors",
      accessibilityLabel: "Visitor Analytics",
    },
    {
      id: "blocking",
      content: "Blocking",
      accessibilityLabel: "Blocking Analytics",
    },
    {
      id: "realtime",
      content: "Real-time",
      accessibilityLabel: "Real-time Analytics",
    },
  ];

  const timeRangeOptions = [
    { label: "Last 24 hours", value: "1" },
    { label: "Last 7 days", value: "7" },
    { label: "Last 30 days", value: "30" },
    { label: "Last 90 days", value: "90" },
  ];

  useEffect(() => {
    loadAnalyticsData();
  }, [shop, timeRange]);

  useEffect(() => {
    // Set up real-time data refresh
    if (selectedTab === 3 || autoRefresh) {
      const interval = setInterval(() => {
        if (selectedTab === 3) {
          loadRealtimeData();
        } else if (autoRefresh) {
          loadAnalyticsData();
        }
      }, 30000); // Every 30 seconds

      if (selectedTab === 3) {
        loadRealtimeData();
      }

      return () => clearInterval(interval);
    }
  }, [selectedTab, shop, autoRefresh]);

  const loadAnalyticsData = async () => {
    if (selectedTab !== 3) {
      setLoading(true);
    }

    try {
      const promises = [
        loadDashboardData(),
        loadVisitorsData(),
        loadBlockingData(),
      ];

      await Promise.all(promises);
    } catch (error) {
      console.error("Error loading analytics data:", error);
      shopify.toast.show("Error loading analytics data", { isError: true });
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    setLoadingStates((prev) => ({ ...prev, dashboard: true }));
    try {
      const response = await fetch(
        `/api/analytics/dashboard?shop=${shop}&days=${timeRange}`
      );
      if (response.ok) {
        const data = await response.json();

        // Fix duration calculations
        if (data.overview) {
          data.overview.avg_duration = Math.round(
            data.overview.avg_duration || 0
          );
        }

        // Fix page data duration calculations
        if (data.topPages) {
          data.topPages = data.topPages.map((page) => ({
            ...page,
            avg_duration: Math.round(page.avg_duration || 0),
          }));
        }

        setDashboardData(data);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, dashboard: false }));
    }
  };

  const loadVisitorsData = async () => {
    setLoadingStates((prev) => ({ ...prev, visitors: true }));
    try {
      const response = await fetch(
        `/api/analytics/visitors?shop=${shop}&days=${timeRange}&limit=100`
      );
      if (response.ok) {
        const data = await response.json();

        // Fix visitor duration data
        if (data.visitors) {
          data.visitors = data.visitors.map((visitor) => ({
            ...visitor,
            visit_duration: Math.round(visitor.visit_duration || 0),
          }));
        }

        setVisitorsData(data);
      }
    } catch (error) {
      console.error("Error loading visitors data:", error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, visitors: false }));
    }
  };

  const loadBlockingData = async () => {
    setLoadingStates((prev) => ({ ...prev, blocking: true }));
    try {
      const response = await fetch(
        `/api/analytics/blocking?shop=${shop}&days=${timeRange}`
      );
      if (response.ok) {
        const data = await response.json();
        setBlockingData(data);
      }
    } catch (error) {
      console.error("Error loading blocking data:", error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, blocking: false }));
    }
  };

  const loadRealtimeData = async () => {
    setLoadingStates((prev) => ({ ...prev, realtime: true }));
    try {
      const response = await fetch(`/api/analytics/realtime?shop=${shop}`);
      if (response.ok) {
        const data = await response.json();
        setRealtimeData(data);
      }
    } catch (error) {
      console.error("Error loading real-time data:", error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, realtime: false }));
    }
  };

  const handleTabChange = useCallback((selectedTabIndex) => {
    setSelectedTab(selectedTabIndex);
  }, []);

  const handleTimeRangeChange = useCallback((value) => {
    setTimeRange(value);
  }, []);

  const handleRefresh = useCallback(() => {
    if (selectedTab === 3) {
      loadRealtimeData();
    } else {
      loadAnalyticsData();
    }
  }, [selectedTab]);

  const exportData = async (format = "csv") => {
    try {
      const response = await fetch(
        `/api/analytics/export?shop=${shop}&days=${timeRange}&format=${format}`
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `analytics-${shop}-${timeRange}days.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        shopify.toast.show("Analytics data exported successfully");
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      shopify.toast.show("Error exporting data", { isError: true });
    }
  };

  const formatNumber = (num) => {
    if (typeof num !== "number" || isNaN(num)) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatPercentage = (value, total) => {
    if (!total || total === 0) return "0%";
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  const renderOverview = () => {
    if (loadingStates.dashboard || !dashboardData) {
      return (
        <div style={{ padding: "40px", textAlign: "center" }}>
          <Spinner size="large" />
        </div>
      );
    }

    const { overview } = dashboardData;

    return (
      <Layout>
        <Layout.Section>
          <InlineGrid columns="4" gap="400">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" tone="subdued">
                  Total Visits
                </Text>
                <Text variant="displayLarge">
                  {formatNumber(overview.total_visits || 0)}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {formatNumber(overview.unique_sessions || 0)} unique sessions
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" tone="subdued">
                  Unique Visitors
                </Text>
                <Text variant="displayLarge">
                  {formatNumber(overview.unique_visitors || 0)}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Avg. duration: {formatDuration(overview.avg_duration)}
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" tone="subdued">
                  Bot Visits
                </Text>
                <Text variant="displayLarge" tone="warning">
                  {formatNumber(overview.bot_visits || 0)}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {formatPercentage(overview.bot_visits, overview.total_visits)}{" "}
                  of total
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" tone="subdued">
                  Blocked Visits
                </Text>
                <Text variant="displayLarge" tone="critical">
                  {formatNumber(overview.blocked_visits || 0)}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {formatPercentage(
                    overview.blocked_visits,
                    overview.total_visits
                  )}{" "}
                  of total
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns="2" gap="400">
            {/* Top Countries */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Top Countries
                </Text>
                {!dashboardData.topCountries ||
                dashboardData.topCountries.length === 0 ? (
                  <EmptyState
                    heading="No country data"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>No country information available for this period.</p>
                  </EmptyState>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "numeric", "numeric"]}
                    headings={["Country", "Visits", "Blocked"]}
                    rows={dashboardData.topCountries.map((country) => [
                      country.country_code || "Unknown",
                      formatNumber(country.visits || 0),
                      <Text
                        tone={
                          (country.blocked_visits || 0) > 0
                            ? "critical"
                            : "subdued"
                        }
                      >
                        {formatNumber(country.blocked_visits || 0)}
                      </Text>,
                    ])}
                  />
                )}
              </BlockStack>
            </Card>

            {/* Device Breakdown */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Device Types
                </Text>
                {!dashboardData.deviceStats ||
                dashboardData.deviceStats.length === 0 ? (
                  <EmptyState
                    heading="No device data"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>No device information available for this period.</p>
                  </EmptyState>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "numeric", "text"]}
                    headings={["Device", "Visits", "Avg. Duration"]}
                    rows={dashboardData.deviceStats.map((device) => [
                      <InlineStack gap="200">
                        <Badge
                          tone={
                            device.device_type === "mobile"
                              ? "info"
                              : device.device_type === "tablet"
                              ? "warning"
                              : "success"
                          }
                        >
                          {device.device_type || "unknown"}
                        </Badge>
                      </InlineStack>,
                      formatNumber(device.visits || 0),
                      formatDuration(device.avg_duration),
                    ])}
                  />
                )}
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Top Pages - Fixed duration calculation */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Popular Pages
              </Text>
              {!dashboardData.topPages ||
              dashboardData.topPages.length === 0 ? (
                <EmptyState
                  heading="No page data"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>No page visit data available for this period.</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={["text", "numeric", "text"]}
                  headings={["Page URL", "Visits", "Avg. Duration"]}
                  rows={dashboardData.topPages.map((page) => [
                    <Tooltip content={page.page_url || ""}>
                      <Text variant="bodyMd" as="span" breakWord>
                        {(page.page_url || "").length > 60
                          ? (page.page_url || "").substring(0, 60) + "..."
                          : page.page_url || "Unknown"}
                      </Text>
                    </Tooltip>,
                    formatNumber(page.visits || 0),
                    formatDuration(page.avg_duration),
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    );
  };

  const renderVisitors = () => {
    if (loadingStates.visitors || !visitorsData) {
      return (
        <div style={{ padding: "40px", textAlign: "center" }}>
          <Spinner size="large" />
        </div>
      );
    }

    return (
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  Recent Visitors
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Showing {visitorsData.visitors?.length || 0} of{" "}
                  {visitorsData.pagination?.total || 0} visitors
                </Text>
              </InlineStack>

              {!visitorsData.visitors || visitorsData.visitors.length === 0 ? (
                <EmptyState
                  heading="No visitor data"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>No visitor data available for this period.</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={[
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                  ]}
                  headings={[
                    "IP Address",
                    "Country",
                    "Device",
                    "Browser",
                    "Duration",
                    "Status",
                  ]}
                  rows={visitorsData.visitors.map((visitor) => [
                    visitor.ip_address || "Unknown",
                    visitor.country_code || "-",
                    <Badge
                      tone={
                        visitor.device_type === "mobile"
                          ? "info"
                          : visitor.device_type === "tablet"
                          ? "warning"
                          : "success"
                      }
                    >
                      {visitor.device_type || "unknown"}
                    </Badge>,
                    visitor.browser_name || "Unknown",
                    formatDuration(visitor.visit_duration),
                    visitor.blocked_reason ? (
                      <Badge tone="critical">Blocked</Badge>
                    ) : visitor.is_bot ? (
                      <Badge tone="warning">Bot</Badge>
                    ) : (
                      <Badge tone="success">Allowed</Badge>
                    ),
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    );
  };

  const renderBlocking = () => {
    if (loadingStates.blocking || !blockingData) {
      return (
        <div style={{ padding: "40px", textAlign: "center" }}>
          <Spinner size="large" />
        </div>
      );
    }

    return (
      <Layout>
        <Layout.Section>
          <InlineGrid columns="4" gap="400">
            {(blockingData.blockingReasons || []).map((reason) => (
              <Card key={reason.reason_category}>
                <BlockStack gap="200">
                  <Text variant="headingMd" tone="subdued">
                    {reason.reason_category}
                  </Text>
                  <Text variant="displayMedium" tone="critical">
                    {formatNumber(reason.count || 0)}
                  </Text>
                </BlockStack>
              </Card>
            ))}
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns="2" gap="400">
            {/* Blocked Countries */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Most Blocked Countries
                </Text>
                {!blockingData.blockedCountries ||
                blockingData.blockedCountries.length === 0 ? (
                  <EmptyState
                    heading="No blocked countries"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>No countries have been blocked in this period.</p>
                  </EmptyState>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "numeric"]}
                    headings={["Country", "Blocked Attempts"]}
                    rows={blockingData.blockedCountries.map((country) => [
                      country.country_code || "Unknown",
                      formatNumber(country.blocked_attempts || 0),
                    ])}
                  />
                )}
              </BlockStack>
            </Card>

            {/* Blocked IPs */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Most Blocked IPs
                </Text>
                {!blockingData.blockedIPs ||
                blockingData.blockedIPs.length === 0 ? (
                  <EmptyState
                    heading="No blocked IPs"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>No IP addresses have been blocked in this period.</p>
                  </EmptyState>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "numeric"]}
                    headings={["IP Address", "Blocked Attempts"]}
                    rows={blockingData.blockedIPs.map((ip) => [
                      ip.ip_address || "Unknown",
                      formatNumber(ip.blocked_attempts || 0),
                    ])}
                  />
                )}
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Blocked Bots */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Blocked Bots
              </Text>
              {!blockingData.blockedBots ||
              blockingData.blockedBots.length === 0 ? (
                <EmptyState
                  heading="No blocked bots"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>No bots have been blocked in this period.</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={["text", "numeric"]}
                  headings={["Bot Name", "Blocked Attempts"]}
                  rows={blockingData.blockedBots.map((bot) => [
                    bot.bot_name || "Unknown Bot",
                    formatNumber(bot.blocked_attempts || 0),
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    );
  };

  const renderRealtime = () => {
    return (
      <Layout>
        <Layout.Section>
          <Banner title="Live Analytics" tone="info">
            <p>
              Data refreshes automatically every 30 seconds. Showing activity
              from the last 30 minutes.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          {loadingStates.realtime ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <Spinner size="large" />
              <Text>Loading real-time data...</Text>
            </div>
          ) : (
            <InlineGrid columns="4" gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" tone="subdued">
                    Current Visitors
                  </Text>
                  <Text variant="displayLarge" tone="success">
                    {formatNumber(realtimeData?.stats?.current_visitors || 0)}
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Last 30 minutes
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" tone="subdued">
                    Unique Visitors
                  </Text>
                  <Text variant="displayLarge">
                    {formatNumber(realtimeData?.stats?.unique_visitors || 0)}
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Last 30 minutes
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" tone="subdued">
                    Bot Visits
                  </Text>
                  <Text variant="displayLarge" tone="warning">
                    {formatNumber(realtimeData?.stats?.bot_visits || 0)}
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Last 30 minutes
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" tone="subdued">
                    Blocked Visits
                  </Text>
                  <Text variant="displayLarge" tone="critical">
                    {formatNumber(realtimeData?.stats?.blocked_visits || 0)}
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    Last 30 minutes
                  </Text>
                </BlockStack>
              </Card>
            </InlineGrid>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Recent Activity
              </Text>
              {!realtimeData?.recentVisitors ||
              realtimeData.recentVisitors.length === 0 ? (
                <EmptyState
                  heading="No recent activity"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>No visitor activity in the last 30 minutes.</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={[
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                    "text",
                  ]}
                  headings={[
                    "Time",
                    "IP Address",
                    "Country",
                    "Device",
                    "Page",
                    "Status",
                  ]}
                  rows={realtimeData.recentVisitors.map((visitor) => [
                    new Date(visitor.created_at).toLocaleTimeString(),
                    visitor.ip_address || "Unknown",
                    visitor.country_code || "-",
                    <Badge
                      tone={
                        visitor.device_type === "mobile"
                          ? "info"
                          : visitor.device_type === "tablet"
                          ? "warning"
                          : "success"
                      }
                    >
                      {visitor.device_type || "unknown"}
                    </Badge>,
                    <Tooltip content={visitor.page_url || ""}>
                      <Text variant="bodyMd" as="span" breakWord>
                        {(visitor.page_url || "").split("/").pop() || "/"}
                      </Text>
                    </Tooltip>,
                    visitor.blocked_reason ? (
                      <Badge tone="critical">Blocked</Badge>
                    ) : visitor.is_bot ? (
                      <Badge tone="warning">Bot</Badge>
                    ) : (
                      <Badge tone="success">Active</Badge>
                    ),
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    );
  };

  if (loading && selectedTab !== 3) {
    return (
      <Page title="Analytics & Insights">
        <Card>
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Spinner size="large" />
            <Text>Loading analytics data...</Text>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Analytics & Insights"
      subtitle="Monitor visitor behavior and blocking effectiveness"
      primaryAction={{
        content: "Export Data",
        onAction: () => exportData("csv"),
        icon: ExportIcon,
      }}
      secondaryActions={[
        {
          content: "Refresh",
          onAction: handleRefresh,
          icon: RefreshIcon,
        },
        {
          content: "Export JSON",
          onAction: () => exportData("json"),
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <InlineStack align="space-between" blockAlign="center">
            <Tabs
              tabs={tabs}
              selected={selectedTab}
              onSelect={handleTabChange}
            />
            <InlineStack gap="200">
              {selectedTab !== 3 && (
                <Select
                  label="Time Range"
                  labelHidden
                  options={timeRangeOptions}
                  value={timeRange}
                  onChange={handleTimeRangeChange}
                />
              )}
              {selectedTab !== 3 && (
                <Button
                  variant="tertiary"
                  tone={autoRefresh ? "success" : "base"}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
                </Button>
              )}
            </InlineStack>
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          <Box paddingBlockStart="400">
            {selectedTab === 0 && renderOverview()}
            {selectedTab === 1 && renderVisitors()}
            {selectedTab === 2 && renderBlocking()}
            {selectedTab === 3 && renderRealtime()}
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
