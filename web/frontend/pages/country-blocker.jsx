// web/frontend/pages/country-blocker.jsx
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
  Badge,
  Select,
  TextField,
  ButtonGroup,
  Modal,
  FormLayout,
  Tabs,
  Toast,
  Frame,
} from "@shopify/polaris";
import {
  SearchIcon,
  DeleteIcon,
  LocationFilledIcon,
  EditIcon,
  ExportIcon,
  PlusIcon,
  SettingsIcon,
} from "@shopify/polaris-icons";
import { countryOptions } from "../utils/countryOptions";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function EnhancedCountryBlocker() {
  const shopify = useAppBridge();
  const shop = shopify.config.shop;
  
  const [blockedCountries, setBlockedCountries] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  
  // Modal states
  const [modalActive, setModalActive] = useState(false);
  const [editingCountry, setEditingCountry] = useState(null);
  const [settingsModalActive, setSettingsModalActive] = useState(false);
  
  // Form states
  const [listType, setListType] = useState("blacklist");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [globalSettings, setGlobalSettings] = useState({
    default_list_type: "blacklist",
    redirect_url: "",
    custom_message: "Sorry, this store is not available in your country."
  });
  
  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const tabs = [
    { id: "blacklist", content: "Blacklist", accessibilityLabel: "Blacklisted Countries" },
    { id: "whitelist", content: "Whitelist", accessibilityLabel: "Whitelisted Countries" },
    { id: "all", content: "All Rules", accessibilityLabel: "All Country Rules" },
  ];

  // Filter countries based on selected tab
  const filteredCountries = useMemo(() => {
    if (selectedTab === 0) return blockedCountries.filter(c => c.list_type === 'blacklist');
    if (selectedTab === 1) return blockedCountries.filter(c => c.list_type === 'whitelist');
    return blockedCountries;
  }, [blockedCountries, selectedTab]);

  // Get available countries for selection (excluding already added ones)
  const deselectedOptions = useMemo(() => {
    const options = countryOptions.filter((option) => {
      if (blockedCountries.some((c) => c.country_code === option.value)) return false;
      if (inputValue === "") return true;
      return (
        option.label.toLowerCase().includes(inputValue.toLowerCase()) ||
        option.value.toLowerCase().includes(inputValue.toLowerCase())
      );
    });
    return options;
  }, [inputValue, blockedCountries]);

  useEffect(() => {
    loadData();
  }, [shop]);

  const loadData = async () => {
    try {
      const [countriesRes, settingsRes] = await Promise.all([
        fetch("/api/blocked-countries?shop=" + shop),
        fetch("/api/country-settings?shop=" + shop)
      ]);

      if (countriesRes.ok) {
        const data = await countriesRes.json();
        setBlockedCountries(data.countries || []);
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

  const updateText = useCallback((value) => {
    setInputValue(value);
  }, []);

  const updateSelection = useCallback((selected) => {
    setSelectedOptions(selected);
  }, []);

  const handleTabChange = useCallback((selectedTabIndex) => {
    setSelectedTab(selectedTabIndex);
  }, []);

  const openModal = (country = null) => {
    if (country) {
      setEditingCountry(country);
      setListType(country.list_type);
      setRedirectUrl(country.redirect_url || "");
    } else {
      setEditingCountry(null);
      setListType(globalSettings.default_list_type);
      setRedirectUrl(globalSettings.redirect_url || "");
    }
    setModalActive(true);
  };

  const closeModal = () => {
    setModalActive(false);
    setEditingCountry(null);
    setSelectedOptions([]);
    setInputValue("");
  };

  const addCountries = async () => {
    if (selectedOptions.length === 0) return;

    setSaving(true);
    try {
      const promises = selectedOptions.map((country) =>
        fetch("/api/blocked-countries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop: shop,
            country,
            list_type: listType,
            redirect_url: redirectUrl.trim() || null
          }),
        })
      );

      await Promise.all(promises);
      await loadData();
      closeModal();
      showToast(`${selectedOptions.length} ${selectedOptions.length === 1 ? 'country' : 'countries'} added to ${listType}`);
    } catch (error) {
      console.error("Error adding countries:", error);
      showToast("Error adding countries");
    } finally {
      setSaving(false);
    }
  };

  const updateCountry = async () => {
    if (!editingCountry) return;

    setSaving(true);
    try {
      await fetch(`/api/blocked-countries/${editingCountry.country_code}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shop,
          list_type: listType,
          redirect_url: redirectUrl.trim() || null
        }),
      });

      await loadData();
      closeModal();
      showToast("Country rule updated");
    } catch (error) {
      console.error("Error updating country:", error);
      showToast("Error updating country");
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
      showToast("Country removed");
    } catch (error) {
      console.error("Error removing country:", error);
      showToast("Error removing country");
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

  const saveGlobalSettings = async () => {
    try {
      await fetch("/api/country-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shop,
          ...globalSettings
        }),
      });
      
      setSettingsModalActive(false);
      showToast("Global settings saved");
    } catch (error) {
      console.error("Error saving settings:", error);
      showToast("Error saving settings");
    }
  };

  const exportCountries = async () => {
    try {
      const response = await fetch(`/api/blocked-countries/export?shop=${shop}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `country-rules-${shop}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting countries:", error);
      showToast("Error exporting data");
    }
  };

  const getCountryName = (code) => {
    const option = countryOptions.find((opt) => opt.value === code);
    return option ? option.label : code;
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
    const blacklistCount = blockedCountries.filter(c => c.list_type === 'blacklist').length;
    const whitelistCount = blockedCountries.filter(c => c.list_type === 'whitelist').length;
    return { blacklistCount, whitelistCount };
  };

  if (loading) {
    return (
      <Page title="Country Management">
        <Card>
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Spinner size="large" />
          </div>
        </Card>
      </Page>
    );
  }

  const { blacklistCount, whitelistCount } = getListTypeStats();
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

  const textField = (
    <Autocomplete.TextField
      onChange={updateText}
      label="Search countries"
      labelHidden
      value={inputValue}
      placeholder="Search for countries to add"
      prefix={<Icon source={SearchIcon} />}
      autoComplete="off"
    />
  );

  const modalMarkup = modalActive ? (
    <Modal
      open={modalActive}
      onClose={closeModal}
      title={editingCountry ? "Edit Country Rule" : "Add Country Rules"}
      primaryAction={{
        content: editingCountry ? "Update Rule" : "Add Countries",
        onAction: editingCountry ? updateCountry : addCountries,
        loading: saving,
        disabled: editingCountry ? false : !hasSelectedOptions,
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
          {!editingCountry && (
            <>
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
            </>
          )}

          {editingCountry && (
            <TextField
              label="Country"
              value={getCountryName(editingCountry.country_code)}
              disabled
              helpText="Country cannot be changed. Delete and re-add to change country."
            />
          )}

          <Select
            label="Rule Type"
            value={listType}
            onChange={setListType}
            options={[
              { label: "Blacklist (Block access)", value: "blacklist" },
              { label: "Whitelist (Allow access only)", value: "whitelist" },
            ]}
            helpText="Blacklist blocks access, Whitelist allows only these countries"
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
      title="Global Country Settings"
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
            onChange={(value) => setGlobalSettings(prev => ({ ...prev, default_list_type: value }))}
            options={[
              { label: "Blacklist (Block access)", value: "blacklist" },
              { label: "Whitelist (Allow access only)", value: "whitelist" },
            ]}
            helpText="Default type for new country rules"
          />

          <TextField
            label="Default Redirect URL"
            value={globalSettings.redirect_url}
            onChange={(value) => setGlobalSettings(prev => ({ ...prev, redirect_url: value }))}
            placeholder="https://example.com/blocked"
            helpText="Default redirect URL for blocked countries"
            autoComplete="off"
          />

          <TextField
            label="Custom Block Message"
            value={globalSettings.custom_message}
            onChange={(value) => setGlobalSettings(prev => ({ ...prev, custom_message: value }))}
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
        title="Country Management"
        subtitle="Manage country access with whitelist and blacklist rules"
        primaryAction={{
          content: "Add Countries",
          onAction: () => openModal(),
          icon: PlusIcon,
        }}
        secondaryActions={[
          {
            content: "Settings",
            onAction: () => setSettingsModalActive(true),
            icon: SettingsIcon,
          },
          {
            content: "Export",
            onAction: exportCountries,
            icon: ExportIcon,
          },
        ]}
      >
        <Layout>
          {/* Status Banner */}
          <Layout.Section>
            <Banner 
              title={`Country Rules Active: ${blacklistCount} Blocked, ${whitelistCount} Allowed`} 
              tone={blockedCountries.length > 0 ? "info" : "warning"}
            >
              <p>
                {whitelistCount > 0 && blacklistCount > 0 
                  ? "Mixed mode: Whitelist takes precedence over blacklist rules"
                  : whitelistCount > 0 
                  ? "Whitelist mode: Only listed countries can access your store"
                  : blacklistCount > 0
                  ? "Blacklist mode: Listed countries are blocked from accessing your store"
                  : "No country rules configured"
                }
              </p>
            </Banner>
          </Layout.Section>

          {/* Countries List */}
          <Layout.Section>
            <Card>
              <BlockStack>
                <Box paddingBlockStart="400" paddingBlockEnd="400" paddingInlineStart="500" paddingInlineEnd="500">
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Country Rules
                    </Text>
                    <Text variant="bodyMd" tone="subdued">
                      {filteredCountries.length === 0
                        ? "No countries configured for this rule type"
                        : `${filteredCountries.length} countries configured`}
                    </Text>
                  </BlockStack>
                </Box>

                <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} />

                <Box paddingBlockStart="400" paddingBlockEnd="400" paddingInlineStart="500" paddingInlineEnd="500">
                  {filteredCountries.length === 0 ? (
                    <EmptyState
                      heading={`No ${tabs[selectedTab].content.toLowerCase()} countries`}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      action={{
                        content: "Add Country Rule",
                        onAction: () => openModal(),
                      }}
                    >
                      <p>
                        Start by adding countries to your {tabs[selectedTab].content.toLowerCase()}.
                      </p>
                    </EmptyState>
                  ) : (
                    <BlockStack gap="300">
                      {filteredCountries.map((item, index) => (
                        <React.Fragment key={item.country_code}>
                          <Box>
                            <InlineStack align="space-between" blockAlign="center">
                              <InlineStack gap="400" blockAlign="center">
                                <div
                                  style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "8px",
                                    backgroundColor: item.list_type === 'whitelist' ? "#d4edda" : "#f8d7da",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Icon source={LocationFilledIcon} tone="base" />
                                </div>
                                <BlockStack gap="100">
                                  <InlineStack gap="200" blockAlign="center">
                                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                                      {getCountryName(item.country_code)}
                                    </Text>
                                    <Badge tone={item.list_type === 'whitelist' ? 'success' : 'critical'}>
                                      {item.list_type}
                                    </Badge>
                                  </InlineStack>
                                  <Text as="span" variant="bodySm" tone="subdued">
                                    Country code: {item.country_code}
                                  </Text>
                                  {item.redirect_url && (
                                    <Text as="span" variant="bodySm" tone="subdued">
                                      Redirects to: {item.redirect_url}
                                    </Text>
                                  )}
                                  <Text as="span" variant="bodySm" tone="subdued">
                                    Added on {formatDate(item.created_at)}
                                  </Text>
                                </BlockStack>
                              </InlineStack>
                              <ButtonGroup>
                                <Button
                                  variant="tertiary"
                                  onClick={() => openModal(item)}
                                  icon={EditIcon}
                                  accessibilityLabel="Edit country rule"
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="tertiary"
                                  tone="critical"
                                  onClick={() => removeCountry(item.country_code)}
                                  icon={DeleteIcon}
                                  accessibilityLabel="Remove country rule"
                                >
                                  Remove
                                </Button>
                              </ButtonGroup>
                            </InlineStack>
                          </Box>
                          {index < filteredCountries.length - 1 && <Divider />}
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
              <Box background="bg-surface-secondary" padding="400">
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    How country rules work
                  </Text>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      <strong>Blacklist:</strong> Blocks access from specified countries
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      <strong>Whitelist:</strong> Allows access only from specified countries
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      <strong>Redirects:</strong> Send blocked users to a custom URL instead of showing a block message
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      <strong>Detection:</strong> Uses browser timezone and locale for country detection
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Box>
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