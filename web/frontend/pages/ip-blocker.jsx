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
  Tag,
  FormLayout,
  Toast,
  Frame,
} from "@shopify/polaris";
import { LayoutBlockIcon, DeleteIcon, LockIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function BlockIPAddresses() {
  const shopify = useAppBridge();
  const shop = shopify.config.shop;
  const [blockedIPs, setBlockedIPs] = useState([]);
  const [ipAddress, setIpAddress] = useState("");
  const [ipNote, setIpNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ipError, setIpError] = useState("");
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    fetchBlockedIPs();
  }, [shop]);

  const fetchBlockedIPs = async () => {
    try {
      const response = await fetch("/api/blocked-ips?shop=" + shop);
      const data = await response.json();
      setBlockedIPs(data.ips || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching blocked IPs:", error);
      setLoading(false);
    }
  };

  const validateIPAddress = (ip) => {
    // Basic IP validation (IPv4 and IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([\da-fA-F]{0,4}:){2,7}[\da-fA-F]{0,4}$/;

    if (ipv4Regex.test(ip)) {
      // For IPv4, check if each octet is valid
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

  const addIPAddress = async () => {
    if (!ipAddress) {
      setIpError("Please enter an IP address");
      return;
    }

    if (!validateIPAddress(ipAddress)) {
      setIpError("Please enter a valid IP address");
      return;
    }

    // Check if IP is already blocked
    if (blockedIPs.some((ip) => ip.ip_address === ipAddress)) {
      setIpError("This IP address is already blocked");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/blocked-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shop,
          ip_address: ipAddress,
          note: ipNote,
        }),
      });

      if (response.ok) {
        await fetchBlockedIPs(); // Refresh the list
        setIpAddress("");
        setIpNote("");
        showToast("IP address blocked successfully");
      }
    } catch (error) {
      console.error("Error adding IP:", error);
      showToast("Error blocking IP address");
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
        showToast("IP address unblocked");
      }
    } catch (error) {
      console.error("Error removing IP:", error);
      showToast("Error unblocking IP address");
    }
  };

  const showToast = (message) => {
    setToastMessage(message);
    setToastActive(true);
  };

  const toggleToast = useCallback(
    () => setToastActive((active) => !active),
    []
  );

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
      <Page title="Blocked IP Addresses">
        <Card>
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Spinner size="large" />
          </div>
        </Card>
      </Page>
    );
  }

  const toastMarkup = toastActive ? (
    <Toast content={toastMessage} onDismiss={toggleToast} />
  ) : null;

  return (
    <Frame>
      <Page
        title="Blocked IP Addresses"
        subtitle="Manage IP addresses that are blocked from accessing your store"
      >
        <Layout>
          {/* Statistics Banner */}
          <Layout.Section>
            <Banner title="IP Blocking Active" tone="info">
              <p>
                You have blocked {blockedIPs.length}{" "}
                {blockedIPs.length === 1 ? "IP address" : "IP addresses"} from
                accessing your store.
              </p>
            </Banner>
          </Layout.Section>

          {/* Add IP Section */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Block IP Address
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    Enter an IP address to prevent access from that location
                  </Text>
                </BlockStack>

                <FormLayout>
                  <FormLayout.Group>
                    <TextField
                      label="IP Address"
                      value={ipAddress}
                      onChange={handleIpChange}
                      placeholder="e.g., 192.168.1.1"
                      error={ipError}
                      autoComplete="off"
                      monospaced
                    />
                    <TextField
                      label="Note (optional)"
                      value={ipNote}
                      onChange={setIpNote}
                      placeholder="e.g., Spam bot"
                      autoComplete="off"
                    />
                  </FormLayout.Group>

                  <Button
                    variant="primary"
                    onClick={addIPAddress}
                    loading={saving}
                    disabled={!ipAddress || saving}
                    icon={LayoutBlockIcon}
                  >
                    Block IP Address
                  </Button>
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Blocked IPs List */}
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
                      Currently Blocked IP Addresses
                    </Text>
                    <Text variant="bodyMd" tone="subdued">
                      {blockedIPs.length === 0
                        ? "No IP addresses are currently blocked"
                        : `${blockedIPs.length} IP addresses blocked`}
                    </Text>
                  </BlockStack>
                </Box>

                <Divider />

                <Box
                  paddingBlockStart="400"
                  paddingBlockEnd="400"
                  paddingInlineStart="500"
                  paddingInlineEnd="500"
                >
                  {blockedIPs.length === 0 ? (
                    <EmptyState
                      heading="No blocked IP addresses"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>
                        Start by entering an IP address above to block access
                        from that location.
                      </p>
                    </EmptyState>
                  ) : (
                    <BlockStack gap="300">
                      {blockedIPs.map((item, index) => (
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
                                    backgroundColor: "#f3f4f6",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Icon source={LockIcon} tone="base" />
                                </div>
                                <BlockStack gap="100">
                                  <Text
                                    as="span"
                                    variant="bodyMd"
                                    fontWeight="semibold"
                                  >
                                    {item.ip_address}
                                  </Text>
                                  {item.note && (
                                    <Text
                                      as="span"
                                      variant="bodySm"
                                      tone="subdued"
                                    >
                                      Note: {item.note}
                                    </Text>
                                  )}
                                  <Text
                                    as="span"
                                    variant="bodySm"
                                    tone="subdued"
                                  >
                                    Blocked on {formatDate(item.created_at)}
                                  </Text>
                                </BlockStack>
                              </InlineStack>

                              <Button
                                variant="plain"
                                tone="critical"
                                onClick={() => removeIPAddress(item.ip_address)}
                                icon={DeleteIcon}
                              >
                                Remove
                              </Button>
                            </InlineStack>
                          </Box>
                          {index < blockedIPs.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </BlockStack>
                  )}
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Information Card */}
          <Layout.Section>
            <Card>
              <Box background="bg-surface-secondary" padding="400">
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    How IP blocking works
                  </Text>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      • Visitors from blocked IP addresses cannot access your
                      store
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      • Both IPv4 and IPv6 addresses are supported
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      • You can add notes to remember why an IP was blocked
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      • Blocked IPs can be removed at any time
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
        {toastMarkup}
      </Page>
    </Frame>
  );
}
