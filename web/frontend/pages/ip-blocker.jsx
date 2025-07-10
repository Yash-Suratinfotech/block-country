// web/frontend/pages/ip-blocker.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  Page,
  Card,
  BlockStack,
  TextField,
  Button,
  Spinner,
  EmptyState,
  Layout,
  Text,
  Banner,
  Icon,
  Box,
  Divider,
  InlineStack,
  Badge,
  FormLayout,
  Toast,
  Frame,
  Select,
  ButtonGroup,
  Modal,
  Tabs,
} from "@shopify/polaris";
import {
  DeleteIcon,
  LockIcon,
  EditIcon,
  PlusIcon,
  SettingsIcon,
} from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function EnhancedIPBlocker() {
  const shopify = useAppBridge();
  const shop = shopify.config.shop;

  const [blockedIPs, setBlockedIPs] = useState([]);
  const [ipAddress, setIpAddress] = useState("");
  const [ipNote, setIpNote] = useState("");
  const [listType, setListType] = useState("all");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ipError, setIpError] = useState("");
  const [selectedTab, setSelectedTab] = useState(0);

  // Modal states
  const [modalActive, setModalActive] = useState(false);
  const [editingIP, setEditingIP] = useState(null);
  const [settingsModalActive, setSettingsModalActive] = useState(false);

  // Global settings
  const [globalSettings, setGlobalSettings] = useState({
    default_list_type: "all",
    redirect_url: "",
    custom_message:
      "Your IP address has been blocked from accessing this store.",
    auto_block_repeated_attempts: false,
    max_attempts_threshold: 5,
  });

  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const tabs = [
    { id: "all", content: "All Rules", accessibilityLabel: "All IP Rules" },
    {
      id: "blacklist",
      content: "Blacklist",
      accessibilityLabel: "Blacklisted IPs",
    },
    {
      id: "whitelist",
      content: "Whitelist",
      accessibilityLabel: "Whitelisted IPs",
    },
  ];

  // Filter IPs based on selected tab
  const filteredIPs = React.useMemo(() => {
    if (selectedTab === 1)
      return blockedIPs.filter((ip) => ip.list_type === "blacklist");
    if (selectedTab === 2)
      return blockedIPs.filter((ip) => ip.list_type === "whitelist");
    return blockedIPs;
  }, [blockedIPs, selectedTab]);

  useEffect(() => {
    loadData();
  }, [shop]);

  const loadData = async () => {
    try {
      const [ipsRes, settingsRes] = await Promise.all([
        fetch("/api/blocked-ips?shop=" + shop),
        fetch("/api/ip-settings?shop=" + shop),
      ]);

      if (ipsRes.ok) {
        const data = await ipsRes.json();
        setBlockedIPs(data.ips || []);
      }

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setGlobalSettings(data.settings || globalSettings);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
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

  const validateIPAddress = (ip) => {
    // IPv4 validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 validation (simplified)
    const ipv6Regex = /^([\da-fA-F]{0,4}:){2,7}[\da-fA-F]{0,4}$/;

    if (ipv4Regex.test(ip)) {
      const parts = ip.split(".");
      return parts.every(
        (part) => parseInt(part) >= 0 && parseInt(part) <= 255
      );
    }

    return ipv6Regex.test(ip) || ip === "::1";
  };

  const handleIpChange = useCallback(
    (value) => {
      setIpAddress(value);
      if (ipError && value) {
        setIpError("");
      }
    },
    [ipError]
  );

  const openModal = (ip = null) => {
    if (ip) {
      setEditingIP(ip);
      setIpAddress(ip.ip_address);
      setIpNote(ip.note || "");
      setListType(ip.list_type);
      setRedirectUrl(ip.redirect_url || "");
    } else {
      setEditingIP(null);
      setIpAddress("");
      setIpNote("");
      setListType(globalSettings.default_list_type);
      setRedirectUrl(globalSettings.redirect_url || "");
    }
    setModalActive(true);
  };

  const closeModal = () => {
    setModalActive(false);
    setEditingIP(null);
    setIpAddress("");
    setIpNote("");
    setIpError("");
    setRedirectUrl("");
  };

  const addOrUpdateIP = async () => {
    if (!ipAddress) {
      setIpError("Please enter an IP address");
      return;
    }

    if (!validateIPAddress(ipAddress)) {
      setIpError("Please enter a valid IP address");
      return;
    }

    // Check if IP already exists (for add mode)
    if (!editingIP && blockedIPs.some((ip) => ip.ip_address === ipAddress)) {
      setIpError("This IP address already has a rule configured");
      return;
    }

    setSaving(true);
    try {
      const method = editingIP ? "PUT" : "POST";
      const url = editingIP
        ? `/api/blocked-ips/${editingIP.ip_address}`
        : "/api/blocked-ips";

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shop,
          ip_address: ipAddress,
          note: ipNote.trim() || null,
          list_type: listType,
          redirect_url: redirectUrl.trim() || null,
        }),
      });

      if (response.ok) {
        await loadData();
        closeModal();
        showToast(`IP address ${editingIP ? "updated" : "added"} successfully`);
      } else {
        const errorData = await response.json();
        showToast(errorData.error || "Error saving IP address");
      }
    } catch (error) {
      console.error("Error saving IP:", error);
      showToast("Error saving IP address");
    } finally {
      setSaving(false);
    }
  };

  const removeIPAddress = async (ip) => {
    try {
      const response = await fetch(`/api/blocked-ips/${ip}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: shop }),
      });

      if (response.ok) {
        setBlockedIPs(blockedIPs.filter((item) => item.ip_address !== ip));
        showToast("IP address removed");
      }
    } catch (error) {
      console.error("Error removing IP:", error);
      showToast("Error removing IP address");
    }
  };

  const saveGlobalSettings = async () => {
    try {
      await fetch("/api/ip-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shop,
          ...globalSettings,
        }),
      });

      setSettingsModalActive(false);
      showToast("IP settings saved");
    } catch (error) {
      console.error("Error saving settings:", error);
      showToast("Error saving settings");
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

  const getListTypeStats = () => {
    const blacklistCount = blockedIPs.filter(
      (ip) => ip.list_type === "blacklist"
    ).length;
    const whitelistCount = blockedIPs.filter(
      (ip) => ip.list_type === "whitelist"
    ).length;
    return { blacklistCount, whitelistCount };
  };

  if (loading) {
    return (
      <Page title="IP Address Management">
        <Card>
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Spinner size="large" />
          </div>
        </Card>
      </Page>
    );
  }

  const { blacklistCount, whitelistCount } = getListTypeStats();

  const modalMarkup = modalActive ? (
    <Modal
      open={modalActive}
      onClose={closeModal}
      title={editingIP ? "Edit IP Rule" : "Add IP Rule"}
      primaryAction={{
        content: editingIP ? "Update Rule" : "Add IP Rule",
        onAction: addOrUpdateIP,
        loading: saving,
        disabled: !ipAddress || saving,
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
            label="IP Address"
            value={ipAddress}
            onChange={handleIpChange}
            placeholder="e.g., 192.168.1.1 or 2001:db8::1"
            error={ipError}
            autoComplete="off"
            monospaced
            disabled={editingIP !== null}
            helpText={
              editingIP
                ? "IP address cannot be changed. Delete and re-add to change IP."
                : "Supports both IPv4 and IPv6 addresses"
            }
          />

          <Select
            label="Rule Type"
            value={listType}
            onChange={setListType}
            options={[
              { label: "Blacklist (Block access)", value: "blacklist" },
              { label: "Whitelist (Allow access only)", value: "whitelist" },
            ]}
            helpText="Blacklist blocks access, Whitelist allows only these IPs"
          />

          <TextField
            label="Note (Optional)"
            value={ipNote}
            onChange={setIpNote}
            placeholder="e.g., Spam bot, Legitimate user, etc."
            autoComplete="off"
            helpText="Add a note to remember why this IP was added"
          />

          <TextField
            label="Redirect URL (Optional)"
            value={redirectUrl}
            onChange={setRedirectUrl}
            placeholder="https://example.com/blocked"
            helpText="Redirect blocked users to this URL instead of showing block message"
            autoComplete="off"
          />
        </FormLayout>
      </Modal.Section>
    </Modal>
  ) : null;

  const settingsModalMarkup = settingsModalActive ? (
    <Modal
      open={settingsModalActive}
      onClose={() => setSettingsModalActive(false)}
      title="Global IP Settings"
      primaryAction={{
        content: "Save Settings",
        onAction: saveGlobalSettings,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: () => setSettingsModalActive(false),
        },
      ]}
    >
      <Modal.Section>
        <FormLayout>
          <Select
            label="Default Rule Type"
            value={globalSettings.default_list_type}
            onChange={(value) =>
              setGlobalSettings((prev) => ({
                ...prev,
                default_list_type: value,
              }))
            }
            options={[
              { label: "Blacklist (Block access)", value: "blacklist" },
              { label: "Whitelist (Allow access only)", value: "whitelist" },
            ]}
            helpText="Default type for new IP rules"
          />

          <TextField
            label="Default Redirect URL"
            value={globalSettings.redirect_url}
            onChange={(value) =>
              setGlobalSettings((prev) => ({ ...prev, redirect_url: value }))
            }
            placeholder="https://example.com/blocked"
            helpText="Default redirect URL for blocked IPs"
            autoComplete="off"
          />

          <TextField
            label="Custom Block Message"
            value={globalSettings.custom_message}
            onChange={(value) =>
              setGlobalSettings((prev) => ({ ...prev, custom_message: value }))
            }
            multiline={3}
            helpText="Message shown when access is blocked (if no redirect URL)"
          />
        </FormLayout>
      </Modal.Section>
    </Modal>
  ) : null;

  const toastMarkup = toastActive ? (
    <Toast content={toastMessage} onDismiss={() => setToastActive(false)} />
  ) : null;

  return (
    <Frame>
      <Page
        title="IP Address Management"
        subtitle="Manage IP access with whitelist and blacklist rules"
        primaryAction={{
          content: "Add IP Rule",
          onAction: () => openModal(),
          icon: PlusIcon,
        }}
        secondaryActions={[
          {
            content: "Settings",
            onAction: () => setSettingsModalActive(true),
            icon: SettingsIcon,
          },
        ]}
      >
        <Layout>
          {/* Status Banner */}
          <Layout.Section>
            <Banner
              title={`IP Rules Active: ${blacklistCount} Blocked, ${whitelistCount} Allowed`}
              tone={blockedIPs.length > 0 ? "info" : "warning"}
            >
              <p>
                {whitelistCount > 0 && blacklistCount > 0
                  ? "Mixed mode: Whitelist takes precedence over blacklist rules"
                  : whitelistCount > 0
                  ? "Whitelist mode: Only listed IP addresses can access your store"
                  : blacklistCount > 0
                  ? "Blacklist mode: Listed IP addresses are blocked from accessing your store"
                  : "No IP rules configured"}
              </p>
            </Banner>
          </Layout.Section>

          {/* IP Rules List */}
          <Layout.Section>
            <Card>
              <BlockStack>
                <Box
                  paddingBlockStart="400"
                  paddingBlockEnd="400"
                  paddingInlineStart="500"
                  paddingInlineEnd="500"
                >
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">
                      IP Address Rules
                    </Text>
                    <Text variant="bodyMd" tone="subdued">
                      {filteredIPs.length === 0
                        ? "No IP addresses configured for this rule type"
                        : `${filteredIPs.length} IP addresses configured`}
                    </Text>
                  </BlockStack>
                </Box>

                <Tabs
                  tabs={tabs}
                  selected={selectedTab}
                  onSelect={handleTabChange}
                />

                <Box
                  paddingBlockStart="400"
                  paddingBlockEnd="400"
                  paddingInlineStart="500"
                  paddingInlineEnd="500"
                >
                  {filteredIPs.length === 0 ? (
                    <EmptyState
                      heading={`No ${tabs[
                        selectedTab
                      ].content.toLowerCase()} IP addresses`}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      action={{
                        content: "Add IP Rule",
                        onAction: () => openModal(),
                      }}
                    >
                      <p>
                        Start by adding IP addresses to your{" "}
                        {tabs[selectedTab].content.toLowerCase()}.
                      </p>
                    </EmptyState>
                  ) : (
                    <BlockStack gap="300">
                      {filteredIPs.map((item, index) => (
                        <React.Fragment key={item.ip_address}>
                          <Box>
                            <InlineStack
                              align="space-between"
                              blockAlign="start"
                            >
                              <InlineStack gap="400" blockAlign="start">
                                <div
                                  style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "8px",
                                    backgroundColor:
                                      item.list_type === "whitelist"
                                        ? "#d4edda"
                                        : "#f8d7da",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Icon source={LockIcon} tone="base" />
                                </div>
                                <BlockStack gap="100">
                                  <InlineStack gap="200" blockAlign="center">
                                    <Text
                                      as="span"
                                      variant="bodyMd"
                                      fontWeight="semibold"
                                    >
                                      {item.ip_address}
                                    </Text>
                                    <Badge
                                      tone={
                                        item.list_type === "whitelist"
                                          ? "success"
                                          : "critical"
                                      }
                                    >
                                      {item.list_type}
                                    </Badge>
                                  </InlineStack>
                                  {item.note && (
                                    <Text
                                      as="span"
                                      variant="bodySm"
                                      tone="subdued"
                                    >
                                      Note: {item.note}
                                    </Text>
                                  )}
                                  {item.redirect_url && (
                                    <Text
                                      as="span"
                                      variant="bodySm"
                                      tone="subdued"
                                    >
                                      Redirects to: {item.redirect_url}
                                    </Text>
                                  )}
                                  <Text
                                    as="span"
                                    variant="bodySm"
                                    tone="subdued"
                                  >
                                    Added on {formatDate(item.created_at)}
                                  </Text>
                                </BlockStack>
                              </InlineStack>

                              <ButtonGroup>
                                <Button
                                  variant="tertiary"
                                  onClick={() => openModal(item)}
                                  icon={EditIcon}
                                  accessibilityLabel="Edit IP rule"
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="tertiary"
                                  tone="critical"
                                  onClick={() =>
                                    removeIPAddress(item.ip_address)
                                  }
                                  icon={DeleteIcon}
                                  accessibilityLabel="Remove IP rule"
                                >
                                  Remove
                                </Button>
                              </ButtonGroup>
                            </InlineStack>
                          </Box>
                          {index < filteredIPs.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </BlockStack>
                  )}
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Information Card */}
          <Layout.Section secondary>
            <Card>
              <BlockStack gap="200">
                <InlineStack align="start" blockAlign="center" gap="200">
                  <InlineStack>
                    <Icon source={LockIcon} tone="base" />
                  </InlineStack>
                  <Text as="h3" variant="headingSm">
                    How IP address rules work
                  </Text>
                </InlineStack>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    • <strong>Blacklist:</strong> Blocks access from specified
                    IP addresses
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    • <strong>Whitelist:</strong> Allows access only from
                    specified IP addresses and take precedence over blacklist
                    country rules
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    • <strong>IPv4 & IPv6:</strong> Both IP address formats are
                    supported
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    • <strong>Redirects:</strong> Send blocked users to a custom
                    URL instead of showing a block message
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    • <strong>Notes:</strong> Add context to remember why
                    specific IPs were blocked or allowed
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
        {modalMarkup}
        {settingsModalMarkup}
        {toastMarkup}
      </Page>
    </Frame>
  );
}
