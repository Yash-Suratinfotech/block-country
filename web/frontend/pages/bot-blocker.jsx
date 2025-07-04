// web/frontend/pages/bot-blocker.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Button,
  DataTable,
  EmptyState,
  Layout,
  Banner,
  ButtonGroup,
  Modal,
  FormLayout,
  TextField,
  Select,
  Badge,
  InlineStack,
  Tabs,
  Box,
  Spinner,
  Toast,
  Frame,
} from "@shopify/polaris";
import { PlusIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function BotBlocker() {
  const shopify = useAppBridge();
  const shop = shopify.config.shop;

  const [loading, setLoading] = useState(true);
  const [botSettings, setBotSettings] = useState([]);
  const [globalSettings, setGlobalSettings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);

  // Modal states
  const [modalActive, setModalActive] = useState(false);
  const [editingBot, setEditingBot] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Form states
  const [botPattern, setBotPattern] = useState("");
  const [botName, setBotName] = useState("");
  const [botUrl, setBotUrl] = useState("");
  const [listType, setListType] = useState("whitelist");

  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const tabs = [
    {
      id: "settings",
      content: "Bot Settings",
      accessibilityLabel: "Bot Settings",
    },
    {
      id: "analytics",
      content: "Bot Analytics",
      accessibilityLabel: "Bot Analytics",
    },
    {
      id: "global",
      content: "Global Bots",
      accessibilityLabel: "Global Bot List",
    },
  ];

  useEffect(() => {
    loadData();
  }, [shop]);

  const loadData = async () => {
    try {
      const [settingsRes, analyticsRes] = await Promise.all([
        fetch(`/api/bot-settings?shop=${shop}`),
        fetch(`/api/bot-analytics?shop=${shop}&days=7`),
      ]);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setBotSettings(settingsData.shopSettings || []);
        setGlobalSettings(settingsData.globalSettings || []);
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }
    } catch (error) {
      console.error("Error loading bot data:", error);
      showToast("Error loading bot management data");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message) => {
    setToastMessage(message);
    setToastActive(true);
  };

  const handleTabChange = useCallback((selectedTabIndex) => {
    setSelectedTab(selectedTabIndex);
  }, []);

  const openModal = (bot = null) => {
    if (bot) {
      setEditingBot(bot);
      setBotPattern(bot.user_agent_pattern);
      setBotName(bot.bot_name || "");
      setBotUrl(bot.bot_url || "");
      setListType(bot.list_type);
    } else {
      setEditingBot(null);
      setBotPattern("");
      setBotName("");
      setBotUrl("");
      setListType("whitelist");
    }
    setModalActive(true);
  };

  const closeModal = () => {
    setModalActive(false);
    setEditingBot(null);
    setBotPattern("");
    setBotName("");
    setBotUrl("");
    setListType("whitelist");
  };

  const saveBotSetting = async () => {
    if (!botPattern.trim()) {
      showToast("Bot pattern is required");
      return;
    }

    setModalLoading(true);
    try {
      const response = await fetch("/api/bot-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shop,
          user_agent_pattern: botPattern.trim(),
          bot_name: botName.trim() || null,
          bot_url: botUrl.trim() || null,
          list_type: listType,
        }),
      });

      if (response.ok) {
        await loadData();
        closeModal();
        showToast(
          `Bot setting ${editingBot ? "updated" : "created"} successfully`
        );
      } else {
        showToast("Error saving bot setting");
      }
    } catch (error) {
      console.error("Error saving bot setting:", error);
      showToast("Error saving bot setting");
    } finally {
      setModalLoading(false);
    }
  };

  const toggleBotStatus = async (bot) => {
    try {
      const response = await fetch(`/api/bot-settings/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shop,
          is_enabled: !bot.is_enabled,
        }),
      });

      if (response.ok) {
        await loadData();
        showToast(`Bot ${bot.is_enabled ? "disabled" : "enabled"}`);
      }
    } catch (error) {
      console.error("Error toggling bot status:", error);
      showToast("Error updating bot status");
    }
  };

  const deleteBotSetting = async (bot) => {
    if (
      !confirm(
        `Are you sure you want to delete the bot setting for "${
          bot.bot_name || bot.user_agent_pattern
        }"?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/bot-settings/${bot.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: shop }),
      });

      if (response.ok) {
        await loadData();
        showToast("Bot setting deleted");
      }
    } catch (error) {
      console.error("Error deleting bot setting:", error);
      showToast("Error deleting bot setting");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Page title="Bot Blocker">
        <Card>
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Spinner size="large" />
          </div>
        </Card>
      </Page>
    );
  }

  const botRows = botSettings.map((bot) => [
    bot.bot_name || bot.user_agent_pattern,
    bot.user_agent_pattern,
    <Badge tone={bot.list_type === "whitelist" ? "success" : "critical"}>
      {bot.list_type}
    </Badge>,
    <Badge tone={bot.is_enabled ? "success" : "subdued"}>
      {bot.is_enabled ? "Enabled" : "Disabled"}
    </Badge>,
    formatDate(bot.created_at),
    <ButtonGroup>
      <Button variant="tertiary" size="micro" onClick={() => openModal(bot)}>
        Edit
      </Button>
      <Button
        variant="tertiary"
        size="micro"
        tone={bot.is_enabled ? "critical" : "success"}
        onClick={() => toggleBotStatus(bot)}
      >
        {bot.is_enabled ? "Disable" : "Enable"}
      </Button>
      <Button
        variant="tertiary"
        size="micro"
        tone="critical"
        onClick={() => deleteBotSetting(bot)}
      >
        Delete
      </Button>
    </ButtonGroup>,
  ]);

  const globalRows = globalSettings.map((bot) => [
    bot.bot_name || bot.user_agent_pattern,
    bot.user_agent_pattern,
    <Badge tone={bot.list_type === "whitelist" ? "success" : "critical"}>
      {bot.list_type}
    </Badge>,
    bot.bot_url ? (
      <Button variant="plain" url={bot.bot_url} external>
        Learn more
      </Button>
    ) : (
      "-"
    ),
  ]);

  const renderBotSettings = () => (
    <Layout>
      <Layout.Section>
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Bot Management Rules
                </Text>
                <Text variant="bodyMd" tone="subdued">
                  Control which bots can access your store
                </Text>
              </BlockStack>
              <Button
                variant="primary"
                onClick={() => openModal()}
                icon={PlusIcon}
              >
                Add Bot Rule
              </Button>
            </InlineStack>

            <Banner title="Bot Blocking Active" tone="info">
              <p>
                You have{" "}
                {
                  botSettings.filter(
                    (b) => b.list_type === "whitelist" && b.is_enabled
                  ).length
                }{" "}
                whitelisted bots and{" "}
                {
                  botSettings.filter(
                    (b) => b.list_type === "blacklist" && b.is_enabled
                  ).length
                }{" "}
                blacklisted bots.
              </p>
            </Banner>

            {botSettings.length === 0 ? (
              <EmptyState
                heading="No bot rules configured"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                action={{
                  content: "Add Bot Rule",
                  onAction: () => openModal(),
                }}
              >
                <p>
                  Start by adding rules to control bot access to your store.
                </p>
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
                  "Bot Name",
                  "Pattern",
                  "Type",
                  "Status",
                  "Created",
                  "Actions",
                ]}
                rows={botRows}
              />
            )}
          </BlockStack>
        </Card>
      </Layout.Section>

      <Layout.Section secondary>
        <Card>
          <BlockStack gap="200">
            <Text as="h3" variant="headingMd">
              How bot blocking works
            </Text>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">
                • <strong>Whitelist:</strong> Only listed bots can access your
                store
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                • <strong>Blacklist:</strong> Listed bots are blocked from
                accessing your store
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                • Pattern matching is case-insensitive and uses partial matching
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                • Legitimate search engine bots are generally recommended to be
                whitelisted
              </Text>
            </BlockStack>
          </BlockStack>
        </Card>
      </Layout.Section>
    </Layout>
  );

  const renderAnalytics = () => (
    <Layout>
      <Layout.Section>
        {analytics ? (
          <BlockStack gap="400">
            {/* Stats Cards */}
            <InlineStack gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" tone="subdued">
                    Total Bot Visits
                  </Text>
                  <Text variant="displayMedium">
                    {analytics.stats.total_bot_visits}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" tone="subdued">
                    Blocked Bot Visits
                  </Text>
                  <Text variant="displayMedium" tone="critical">
                    {analytics.stats.blocked_visits}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" tone="subdued">
                    Allowed Bot Visits
                  </Text>
                  <Text variant="displayMedium" tone="success">
                    {analytics.stats.allowed_visits}
                  </Text>
                </BlockStack>
              </Card>
            </InlineStack>

            {/* Top Bots */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Top Bots (Last 7 Days)
                </Text>
                {analytics.topBots.length === 0 ? (
                  <EmptyState
                    heading="No bot activity"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>No bot visits recorded in the last 7 days.</p>
                  </EmptyState>
                ) : (
                  <DataTable
                    columnContentTypes={[
                      "text",
                      "numeric",
                      "numeric",
                      "numeric",
                    ]}
                    headings={[
                      "Bot Name",
                      "Total Visits",
                      "Unique Sessions",
                      "Blocked Visits",
                    ]}
                    rows={analytics.topBots.map((bot) => [
                      bot.bot_name || "Unknown Bot",
                      bot.total_visits,
                      bot.unique_sessions,
                      <Text
                        tone={bot.blocked_visits > 0 ? "critical" : "subdued"}
                      >
                        {bot.blocked_visits}
                      </Text>,
                    ])}
                  />
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        ) : (
          <Card>
            <div style={{ padding: "40px", textAlign: "center" }}>
              <Spinner size="large" />
              <Text>Loading analytics...</Text>
            </div>
          </Card>
        )}
      </Layout.Section>
    </Layout>
  );

  const renderGlobalBots = () => (
    <Layout>
      <Layout.Section>
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Globally Recognized Bots
              </Text>
              <Text variant="bodyMd" tone="subdued">
                These are commonly recognized legitimate bots. You can override
                these settings with your own rules.
              </Text>
            </BlockStack>

            <Banner title="Information" tone="info">
              <p>
                Global bot settings serve as defaults. Your custom bot rules
                take precedence over these global settings.
              </p>
            </Banner>

            {globalSettings.length === 0 ? (
              <EmptyState
                heading="No global bot settings"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>No global bot configurations are currently loaded.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={["text", "text", "text", "text"]}
                headings={["Bot Name", "Pattern", "Default Type", "Learn More"]}
                rows={globalRows}
              />
            )}
          </BlockStack>
        </Card>
      </Layout.Section>

      <Layout.Section secondary>
        <Card>
          <BlockStack gap="200">
            <Text as="h3" variant="headingMd">
              Recommended Bot Management
            </Text>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">
                <strong>Always Whitelist:</strong>
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                • Google, Bing, and other search engine bots
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                • Social media crawlers (Facebook, Twitter, LinkedIn)
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                • Legitimate SEO tools (if you use them)
              </Text>

              <Text as="p" variant="bodyMd" tone="subdued">
                <strong>Consider Blacklisting:</strong>
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                • Aggressive scrapers or spam bots
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                • Bots that consume excessive bandwidth
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                • Unknown or suspicious bot patterns
              </Text>
            </BlockStack>
          </BlockStack>
        </Card>
      </Layout.Section>
    </Layout>
  );

  const toastMarkup = toastActive ? (
    <Toast content={toastMessage} onDismiss={() => setToastActive(false)} />
  ) : null;

  const modalMarkup = modalActive ? (
    <Modal
      open={modalActive}
      onClose={closeModal}
      title={editingBot ? "Edit Bot Rule" : "Add Bot Rule"}
      primaryAction={{
        content: editingBot ? "Update" : "Create",
        onAction: saveBotSetting,
        loading: modalLoading,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: closeModal,
        },
      ]}
    >
      <Modal.Section>
        <FormLayout>
          <TextField
            label="Bot Pattern"
            value={botPattern}
            onChange={setBotPattern}
            placeholder="e.g., googlebot, facebookexternalhit"
            helpText="Enter a pattern that matches the bot's user agent (case-insensitive)"
            autoComplete="off"
            error={
              !botPattern.trim() && modalLoading
                ? "Pattern is required"
                : undefined
            }
          />

          <TextField
            label="Bot Name (Optional)"
            value={botName}
            onChange={setBotName}
            placeholder="e.g., Google Bot"
            helpText="Friendly name for this bot"
            autoComplete="off"
          />

          <TextField
            label="Bot URL (Optional)"
            value={botUrl}
            onChange={setBotUrl}
            placeholder="e.g., https://www.google.com/bot.html"
            helpText="Documentation URL for this bot"
            autoComplete="off"
          />

          <Select
            label="Rule Type"
            options={[
              { label: "Whitelist (Allow)", value: "whitelist" },
              { label: "Blacklist (Block)", value: "blacklist" },
            ]}
            value={listType}
            onChange={setListType}
            helpText="Choose whether to allow or block this bot"
          />
        </FormLayout>
      </Modal.Section>
    </Modal>
  ) : null;

  return (
    <Frame>
      <Page
        title="Bot Blocker"
        subtitle="Manage automated access to your store"
      >
        <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
          <Box paddingBlockStart="400">
            {selectedTab === 0 && renderBotSettings()}
            {selectedTab === 1 && renderAnalytics()}
            {selectedTab === 2 && renderGlobalBots()}
          </Box>
        </Tabs>
        {modalMarkup}
        {toastMarkup}
      </Page>
    </Frame>
  );
}
