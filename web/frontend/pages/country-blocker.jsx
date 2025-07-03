import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Page,
  Card,
  BlockStack,
  Autocomplete,
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
} from "@shopify/polaris";
import {
  SearchIcon,
  DeleteIcon,
  LocationFilledIcon,
} from "@shopify/polaris-icons";
import { countryOptions } from "../utils/countryOptions";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function BlockCountries() {
  const shopify = useAppBridge();
  const shop = shopify.config.shop;
  const [blockedCountries, setBlockedCountries] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Create deselected options based on search input
  const deselectedOptions = useMemo(() => {
    const options = countryOptions.filter((option) => {
      // Filter out already blocked countries
      if (blockedCountries.some((c) => c.country_code === option.value)) return false;

      // Filter based on search input
      if (inputValue === "") return true;

      return (
        option.label.toLowerCase().includes(inputValue.toLowerCase()) ||
        option.value.toLowerCase().includes(inputValue.toLowerCase())
      );
    });

    return options;
  }, [inputValue, blockedCountries]);

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

  const updateText = useCallback((value) => {
    setInputValue(value);
  }, []);

  const updateSelection = useCallback((selected) => {
    setSelectedOptions(selected);
  }, []);

  const addCountries = async () => {
    if (selectedOptions.length === 0) return;

    setSaving(true);
    try {
      // Add multiple countries at once
      const promises = selectedOptions.map((country) =>
        fetch("/api/blocked-countries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shop: shop, country }),
        })
      );

      await Promise.all(promises);
      // After adding, refetch the list to get created_at
      const res = await fetch("/api/blocked-countries?shop=" + shop);
      const data = await res.json();
      setBlockedCountries(data.countries || []);
      setSelectedOptions([]);
      setInputValue("");
    } catch (error) {
      console.error("Error adding countries:", error);
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
      setBlockedCountries(blockedCountries.filter((c) => c.country_code !== code));
    } catch (error) {
      console.error("Error removing country:", error);
    }
  };

  const removeFromSelection = useCallback(
    (tag) => {
      const options = [...selectedOptions];
      options.splice(options.indexOf(tag), 1);
      setSelectedOptions(options);
    },
    [selectedOptions]
  );

  const getCountryName = (code) => {
    const option = countryOptions.find((opt) => opt.value === code);
    return option ? option.label : code;
  };

  const textField = (
    <Autocomplete.TextField
      onChange={updateText}
      label="Search countries"
      labelHidden
      value={inputValue}
      placeholder="Search for countries to block"
      prefix={<Icon source={SearchIcon} />}
      autoComplete="off"
    />
  );

  const hasSelectedOptions = selectedOptions.length > 0;

  const tagsMarkup = hasSelectedOptions
    ? selectedOptions.map((option) => (
        <Tag key={option} onRemove={() => removeFromSelection(option)}>
          {getCountryName(option)}
        </Tag>
      ))
    : null;

  const optionList = deselectedOptions.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  // Helper to format date
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
          <Banner title="Country Blocking Active" tone="info">
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
                <Text as="h2" variant="headingMd">
                  Add Blocked Countries
                </Text>
                <Text variant="bodyMd" tone="subdued">
                  Search and select countries to prevent customers from those
                  regions from placing orders
                </Text>
              </BlockStack>

              <BlockStack gap="300">
                <Autocomplete
                  allowMultiple
                  options={optionList}
                  selected={selectedOptions}
                  onSelect={updateSelection}
                  textField={textField}
                />

                {tagsMarkup && (
                  <InlineStack gap="200">{tagsMarkup}</InlineStack>
                )}

                <Box>
                  <Button
                    variant="primary"
                    onClick={addCountries}
                    loading={saving}
                    disabled={!hasSelectedOptions || saving}
                    fullWidth={false}
                  >
                    Block {selectedOptions.length > 1 ? "Countries" : "Country"}
                  </Button>
                </Box>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Blocked Countries List */}
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
                      Start by selecting a country from the dropdown above to
                      block orders from that region.
                    </p>
                  </EmptyState>
                ) : (
                  <BlockStack gap="300">
                    {blockedCountries.map((item, index) => (
                      <React.Fragment key={item.country_code}>
                        <Box>
                          <InlineStack
                            align="space-between"
                            blockAlign="center"
                          >
                            <InlineStack gap="400" blockAlign="center">
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
                                <Icon source={LocationFilledIcon} tone="base" />
                              </div>
                              <BlockStack gap="100">
                                <Text
                                  as="span"
                                  variant="bodyMd"
                                  fontWeight="semibold"
                                >
                                  {getCountryName(item.country_code)}
                                </Text>
                                <Text as="span" variant="bodySm" tone="subdued">
                                  Country code: {item.country_code}
                                </Text>
                                <Text as="span" variant="bodySm" tone="subdued">
                                  Blocked on {formatDate(item.created_at)}
                                </Text>
                              </BlockStack>
                            </InlineStack>
                            <Button
                              variant="plain"
                              tone="critical"
                              onClick={() => removeCountry(item.country_code)}
                              icon={DeleteIcon}
                            >
                              Remove
                            </Button>
                          </InlineStack>
                        </Box>
                        {index < blockedCountries.length - 1 && <Divider />}
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
                    • You can unblock countries at any time
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
