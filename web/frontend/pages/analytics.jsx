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
} from "@shopify/polaris";
import {
  ExportIcon,
} from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function Analytics() {
  const shopify = useAppBridge();
  const shop = shopify.config.shop;

  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);
  const [timeRange, setTimeRange] = useState("7");

  // Analytics data
  const [dashboardData, setDashboardData] = useState(null);
  const [visitorsData, setVisitorsData] = useState(null);
  const [blockingData, setBlockingData] = useState(null);
  const [realtimeData, setRealtimeData] = useState(null);

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
    { label: "Last 7 days", value: "7" },
    { label: "Last 30 days", value: "30" },
    { label: "Last 90 days", value: "90" },
  ];

  useEffect(() => {
    loadAnalyticsData();
  }, [shop, timeRange]);

  useEffect(() => {
    // Set up real-time data refresh
    if (selectedTab === 3) {
      const interval = setInterval(loadRealtimeData, 30000); // Every 30 seconds
      loadRealtimeData();
      return () => clearInterval(interval);
    }
  }, [selectedTab, shop]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const promises = [
        fetch(`/api/analytics/dashboard?shop=${shop}&days=${timeRange}`),
        fetch(
          `/api/analytics/visitors?shop=${shop}&days=${timeRange}&limit=100`
        ),
        fetch(`/api/analytics/blocking?shop=${shop}&days=${timeRange}`),
      ];

      const [dashboardRes, visitorsRes, blockingRes] = await Promise.all(
        promises
      );

      if (dashboardRes.ok) {
        const data = await dashboardRes.json();
        setDashboardData(data);
      }

      if (visitorsRes.ok) {
        const data = await visitorsRes.json();
        setVisitorsData(data);
      }

      if (blockingRes.ok) {
        const data = await blockingRes.json();
        setBlockingData(data);
      }
    } catch (error) {
      console.error("Error loading analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadRealtimeData = async () => {
    try {
      const response = await fetch(`/api/analytics/realtime?shop=${shop}`);
      if (response.ok) {
        const data = await response.json();
        setRealtimeData(data);
      }
    } catch (error) {
      console.error("Error loading real-time data:", error);
    }
  };

  const handleTabChange = useCallback((selectedTabIndex) => {
    setSelectedTab(selectedTabIndex);
  }, []);

  const handleTimeRangeChange = useCallback((value) => {
    setTimeRange(value);
  }, []);

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
      }
    } catch (error) {
      console.error("Error exporting data:", error);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num?.toString() || "0";
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const renderOverview = () => {
    if (!dashboardData) return <Spinner size="large" />;

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
                  {formatNumber(dashboardData.overview.total_visits)}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {dashboardData.overview.unique_sessions} unique sessions
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" tone="subdued">
                  Unique Visitors
                </Text>
                <Text variant="displayLarge">
                  {formatNumber(dashboardData.overview.unique_visitors)}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Avg. duration:{" "}
                  {formatDuration(dashboardData.overview.avg_duration)}
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" tone="subdued">
                  Bot Visits
                </Text>
                <Text variant="displayLarge" tone="warning">
                  {formatNumber(dashboardData.overview.bot_visits)}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {(
                    (dashboardData.overview.bot_visits /
                      dashboardData.overview.total_visits) *
                    100
                  ).toFixed(1)}
                  % of total
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" tone="subdued">
                  Blocked Visits
                </Text>
                <Text variant="displayLarge" tone="critical">
                  {formatNumber(dashboardData.overview.blocked_visits)}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {(
                    (dashboardData.overview.blocked_visits /
                      dashboardData.overview.total_visits) *
                    100
                  ).toFixed(1)}
                  % of total
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
                {dashboardData.topCountries.length === 0 ? (
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
                      country.visits,
                      <Text
                        tone={
                          country.blocked_visits > 0 ? "critical" : "subdued"
                        }
                      >
                        {country.blocked_visits}
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
                {dashboardData.deviceStats.length === 0 ? (
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
                          {device.device_type}
                        </Badge>
                      </InlineStack>,
                      device.visits,
                      formatDuration(device.avg_duration),
                    ])}
                  />
                )}
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Top Pages */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Popular Pages
              </Text>
              {dashboardData.topPages.length === 0 ? (
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
                    <Text variant="bodyMd" as="span" breakWord>
                      {page.page_url?.length > 60
                        ? page.page_url.substring(0, 60) + "..."
                        : page.page_url}
                    </Text>,
                    page.visits,
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
    if (!visitorsData) return <Spinner size="large" />;

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
                  Showing {visitorsData.visitors.length} of{" "}
                  {visitorsData.pagination.total} visitors
                </Text>
              </InlineStack>

              {visitorsData.visitors.length === 0 ? (
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
                      {visitor.device_type}
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
    if (!blockingData) return <Spinner size="large" />;

    return (
      <Layout>
        <Layout.Section>
          <InlineGrid columns="4" gap="400">
            {blockingData.blockingReasons.map((reason) => (
              <Card key={reason.reason_category}>
                <BlockStack gap="200">
                  <Text variant="headingMd" tone="subdued">
                    {reason.reason_category}
                  </Text>
                  <Text variant="displayMedium" tone="critical">
                    {reason.count}
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
                {blockingData.blockedCountries.length === 0 ? (
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
                      country.country_code,
                      country.blocked_attempts,
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
                {blockingData.blockedIPs.length === 0 ? (
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
                      ip.ip_address,
                      ip.blocked_attempts,
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
              {blockingData.blockedBots.length === 0 ? (
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
                    bot.blocked_attempts,
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
    if (!realtimeData) return <Spinner size="large" />;

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
          <InlineGrid columns="4" gap="400">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" tone="subdued">
                  Current Visitors
                </Text>
                <Text variant="displayLarge" tone="success">
                  {realtimeData.stats.current_visitors}
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
                  {realtimeData.stats.unique_visitors}
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
                  {realtimeData.stats.bot_visits}
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
                  {realtimeData.stats.blocked_visits}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Last 30 minutes
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Recent Activity
              </Text>
              {realtimeData.recentVisitors.length === 0 ? (
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
                      {visitor.device_type}
                    </Badge>,
                    <Text variant="bodyMd" as="span" breakWord>
                      {visitor.page_url?.split("/").pop() || "/"}
                    </Text>,
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
            {selectedTab !== 3 && (
              <Select
                label="Time Range"
                labelHidden
                options={timeRangeOptions}
                value={timeRange}
                onChange={handleTimeRangeChange}
              />
            )}
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
