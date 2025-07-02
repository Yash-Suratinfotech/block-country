import React, { useEffect, useState } from "react";
import {
  Page,
  Card,
  BlockStack,
  Select,
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
} from "@shopify/polaris";
import {
  LayoutBlockIcon,
  LocationFilledIcon,
} from "@shopify/polaris-icons";
import { countryOptions } from "../utils/countryOptions";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function CountryBlocker() {
  const shopify = useAppBridge();
  const shop = shopify.config.shop;
  const [blockedCountries, setBlockedCountries] = useState([]);
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/blocked-countries?shop=" + shop)
      .then((res) => res.json())
      .then((data) => {
        setBlockedCountries(data.countries || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [shop]);

  const addCountry = async () => {
    if (!country) return;
    
    setSaving(true);
    try {
      await fetch("/api/blocked-countries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: shop, country }),
      });
      setBlockedCountries([...blockedCountries, country]);
      setCountry("");
    } catch (error) {
      console.error("Error adding country:", error);
    } finally {
      setSaving(false);
    }
  };

  const removeCountry = async (code) => {
    try {
      await fetch(`/api/blocked-countries/${code}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: shop }),
      });
      setBlockedCountries(blockedCountries.filter((c) => c !== code));
    } catch (error) {
      console.error("Error removing country:", error);
    }
  };

  const getCountryName = (code) => {
    const option = countryOptions.find(opt => opt.value === code);
    return option ? option.label : code;
  };

  const availableCountries = countryOptions.filter(
    option => !blockedCountries.includes(option.value)
  );

  if (loading) {
    return (
      <Page title="Blocked Countries">
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
      title="Blocked Countries"
      subtitle="Manage countries where you don't want to accept orders"
    >
      <Layout>
        {/* Statistics Banner */}
        <Layout.Section>
          <Banner
            title="Country Blocking Active"
            tone="info"
          >
            <p>
              You have blocked {blockedCountries.length}{" "}
              {blockedCountries.length === 1 ? "country" : "countries"} from
              placing orders in your store.
            </p>
          </Banner>
        </Layout.Section>

        {/* Add Country Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">Add Blocked Country</Text>
                <Text variant="bodyMd" tone="subdued">
                  Select a country to prevent customers from that region from
                  placing orders
                </Text>
              </BlockStack>

              <div style={{ maxWidth: "400px" }}>
                <InlineStack gap="300">
                  <InlineStack>
                    <Select
                      label="Select country"
                      labelHidden
                      options={[
                        { label: "Choose a country...", value: "" },
                        ...availableCountries,
                      ]}
                      onChange={setCountry}
                      value={country}
                      disabled={saving || availableCountries.length === 0}
                    />
                  </InlineStack>
                  <InlineStack>
                    <Button
                      variant="primary"
                      onClick={addCountry}
                      loading={saving}
                      disabled={!country || saving}
                      icon={LayoutBlockIcon}
                    >
                      Block Country
                    </Button>
                  </InlineStack>
                </InlineStack>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Blocked Countries List */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Box
                paddingBlockStart="400"
                paddingBlockEnd="400"
                paddingInlineStart="500"
                paddingInlineEnd="500"
              >
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Currently Blocked Countries
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    {blockedCountries.length === 0
                      ? "No countries are currently blocked"
                      : `${blockedCountries.length} countries blocked`}
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
                {blockedCountries.length === 0 ? (
                  <EmptyState
                    heading="No blocked countries"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>
                      Start by searching for countries above to block orders from those regions.
                    </p>
                  </EmptyState>
                ) : (
                  <Box>
                    <InlineStack gap="200" wrap>
                      {blockedCountries.map((code) => (
                        <Tag
                          key={code}
                          onRemove={() => removeCountry(code)}
                        >
                          <InlineStack gap="200" blockAlign="center">
                            <Icon source={LocationFilledIcon} />
                            <span>{getCountryName(code)}</span>
                          </InlineStack>
                        </Tag>
                      ))}
                    </InlineStack>
                  </Box>
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
                  How country blocking works
                </Text>
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    • Customers from blocked countries won't be able to complete
                    checkout
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    • Existing orders from blocked countries remain unaffected
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    • You can unblock countries at any time by clicking Remove
                  </Text>
                </BlockStack>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}