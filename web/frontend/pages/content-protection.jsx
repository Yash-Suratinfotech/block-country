// web/frontend/pages/content-protection.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Layout,
  Banner,
  FormLayout,
  Checkbox,
  TextField,
  InlineStack,
  Badge,
  Spinner,
  Toast,
  Frame,
  Icon,
} from "@shopify/polaris";
import { LockIcon, ViewIcon, SettingsIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function ContentProtection() {
  const shopify = useAppBridge();
  const shop = shopify.config.shop;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    disable_right_click: false,
    disable_text_selection: false,
    disable_image_drag: false,
    disable_copy_paste: false,
    disable_dev_tools: false,
    custom_protection_message: "Content is protected",
  });

  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, [shop]);

  const loadSettings = async () => {
    try {
      const response = await fetch(`/api/content-protection?shop=${shop}`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Error loading content protection settings:", error);
      showToast("Error loading settings");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message) => {
    setToastMessage(message);
    setToastActive(true);
  };

  const handleSettingChange = useCallback(
    (field) => (value) => {
      setSettings((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/content-protection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shop,
          ...settings,
        }),
      });

      if (response.ok) {
        showToast("Content protection settings saved successfully");
      } else {
        showToast("Error saving settings");
      }
    } catch (error) {
      console.error("Error saving content protection settings:", error);
      showToast("Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  const testProtection = () => {
    // Open a test page in a new window to demonstrate protection
    const testScript = `
      <html>
        <head>
          <title>Content Protection Test</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
            .test-section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
            .protected-image { width: 200px; height: 150px; background: linear-gradient(45deg, #4CAF50, #45a049); border-radius: 8px; }
            .test-text { background: #f5f5f5; padding: 15px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>Content Protection Test Page</h1>
          <p>This page demonstrates the content protection features you've enabled.</p>
          
          <div class="test-section">
            <h3>Protected Text</h3>
            <div class="test-text">
              Try to select this text, copy it, or right-click on it. 
              The protection features you enabled should prevent these actions.
            </div>
          </div>
          
          <div class="test-section">
            <h3>Protected Image</h3>
            <div class="protected-image" style="display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
              Try to drag or right-click this "image"
            </div>
          </div>
          
          <div class="test-section">
            <h3>Developer Tools</h3>
            <p>Try pressing F12 or using Ctrl+Shift+I to open developer tools.</p>
          </div>
          
          <script>
            ${generateTestProtectionScript()}
          </script>
        </body>
      </html>
    `;

    const newWindow = window.open("", "_blank");
    newWindow.document.write(testScript);
    newWindow.document.close();
  };

  const generateTestProtectionScript = () => {
    const protections = [];

    if (settings.disable_right_click) {
      protections.push(`
        document.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          showMessage('${settings.custom_protection_message}');
          return false;
        });
      `);
    }

    if (settings.disable_text_selection) {
      protections.push(`
        document.addEventListener('selectstart', function(e) {
          e.preventDefault();
          return false;
        });
        const style = document.createElement('style');
        style.textContent = '* { user-select: none !important; } input, textarea { user-select: text !important; }';
        document.head.appendChild(style);
      `);
    }

    if (settings.disable_image_drag) {
      protections.push(`
        document.addEventListener('dragstart', function(e) {
          e.preventDefault();
          showMessage('${settings.custom_protection_message}');
          return false;
        });
      `);
    }

    if (settings.disable_copy_paste) {
      protections.push(`
        document.addEventListener('keydown', function(e) {
          if (e.ctrlKey && (e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 88 || e.keyCode === 65)) {
            e.preventDefault();
            showMessage('${settings.custom_protection_message}');
            return false;
          }
        });
      `);
    }

    if (settings.disable_dev_tools) {
      protections.push(`
        document.addEventListener('keydown', function(e) {
          if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74))) {
            e.preventDefault();
            showMessage('Developer tools are disabled');
            return false;
          }
        });
      `);
    }

    return `
      function showMessage(message) {
        const existingMessage = document.getElementById('protection-message');
        if (existingMessage) existingMessage.remove();
        
        const messageDiv = document.createElement('div');
        messageDiv.id = 'protection-message';
        messageDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ff4444; color: white; padding: 10px 20px; border-radius: 4px; z-index: 10000; font-family: Arial, sans-serif;';
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
          if (messageDiv.parentNode) messageDiv.parentNode.removeChild(messageDiv);
        }, 3000);
      }
      
      ${protections.join("\n")}
    `;
  };

  const getActiveProtections = () => {
    return Object.entries(settings).filter(
      ([key, value]) => key.startsWith("disable_") && value
    ).length;
  };

  if (loading) {
    return (
      <Page title="Content Protection">
        <Card>
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Spinner size="large" />
          </div>
        </Card>
      </Page>
    );
  }

  const toastMarkup = toastActive ? (
    <Toast content={toastMessage} onDismiss={() => setToastActive(false)} />
  ) : null;

  return (
    <Frame>
      <Page
        title="Content Protection"
        subtitle="Protect your store content from unauthorized copying and downloading"
        primaryAction={{
          content: "Save Settings",
          onAction: saveSettings,
          loading: saving,
        }}
        secondaryActions={[
          {
            content: "Test Protection",
            onAction: testProtection,
            disabled: getActiveProtections() === 0,
          },
        ]}
      >
        <Layout>
          {/* Status Banner */}
          <Layout.Section>
            {getActiveProtections() > 0 ? (
              <Banner title="Content Protection Active" tone="success">
                <p>
                  You have {getActiveProtections()} protection feature(s)
                  enabled. Your content is being protected from unauthorized
                  access.
                </p>
              </Banner>
            ) : (
              <Banner title="Content Protection Disabled" tone="warning">
                <p>
                  No content protection features are currently enabled. Enable
                  features below to protect your store content.
                </p>
              </Banner>
            )}
          </Layout.Section>

          {/* Protection Settings */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Protection Features
                    </Text>
                    <Badge
                      tone={getActiveProtections() > 0 ? "success" : "subdued"}
                    >
                      {getActiveProtections()} Active
                    </Badge>
                  </InlineStack>
                  <Text variant="bodyMd" tone="subdued">
                    Configure which content protection features to enable on
                    your storefront
                  </Text>
                </BlockStack>

                <FormLayout>
                  <FormLayout.Group>
                    <Checkbox
                      label="Disable Right-Click Context Menu"
                      checked={settings.disable_right_click}
                      onChange={handleSettingChange("disable_right_click")}
                      helpText="Prevents customers from right-clicking to access context menus"
                    />

                    <Checkbox
                      label="Disable Text Selection"
                      checked={settings.disable_text_selection}
                      onChange={handleSettingChange("disable_text_selection")}
                      helpText="Prevents customers from selecting and copying text content"
                    />
                  </FormLayout.Group>

                  <FormLayout.Group>
                    <Checkbox
                      label="Disable Image Dragging"
                      checked={settings.disable_image_drag}
                      onChange={handleSettingChange("disable_image_drag")}
                      helpText="Prevents customers from dragging and saving images"
                    />

                    <Checkbox
                      label="Disable Copy & Paste"
                      checked={settings.disable_copy_paste}
                      onChange={handleSettingChange("disable_copy_paste")}
                      helpText="Disables keyboard shortcuts for copy, cut, and paste operations"
                    />
                  </FormLayout.Group>

                  <Checkbox
                    label="Disable Developer Tools"
                    checked={settings.disable_dev_tools}
                    onChange={handleSettingChange("disable_dev_tools")}
                    helpText="Attempts to prevent access to browser developer tools (Note: This can be bypassed by determined users)"
                  />

                  <TextField
                    label="Custom Protection Message"
                    value={settings.custom_protection_message}
                    onChange={handleSettingChange("custom_protection_message")}
                    helpText="Message shown when protected actions are attempted"
                    placeholder="Content is protected"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Information Cards */}
          <Layout.Section secondary>
            <BlockStack gap="400">
              {/* How it Works */}
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="start" blockAlign="center" gap="200">
                    <InlineStack>
                      <Icon source={LockIcon} tone="base" />
                    </InlineStack>
                    <Text as="h3" variant="headingSm">
                      How Content Protection Works
                    </Text>
                  </InlineStack>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      • JavaScript-based protection runs on your storefront
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      • Blocks common methods of content copying and saving
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      • Provides deterrent against casual content theft
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      • Does not affect legitimate customers' shopping
                      experience
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Important Notes */}
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="start" blockAlign="center" gap="200">
                    <InlineStack>
                      <Icon source={ViewIcon} tone="base" />
                    </InlineStack>
                    <Text as="h3" variant="headingSm">
                      Important Considerations
                    </Text>
                  </InlineStack>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      <strong>Accessibility:</strong> Some protections may
                      affect users with disabilities who rely on assistive
                      technologies.
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      <strong>User Experience:</strong> Overly restrictive
                      protections might frustrate legitimate customers.
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      <strong>Limitations:</strong> Determined users can still
                      bypass these protections using various methods.
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      <strong>SEO Impact:</strong> Search engines and social
                      media crawlers should not be affected.
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Best Practices */}
              <Card>
                <BlockStack gap="200">
                  <InlineStack align="start" blockAlign="center" gap="200">
                    <InlineStack>
                      <Icon source={SettingsIcon} tone="base" />
                    </InlineStack>
                    <Text as="h3" variant="headingSm">
                      Best Practices
                    </Text>
                  </InlineStack>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      • Start with basic protections (right-click, text
                      selection)
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      • Test thoroughly on different devices and browsers
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      • Monitor customer feedback for usability issues
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      • Consider watermarking images for additional protection
                    </Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      • Use clear, friendly protection messages
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
        {toastMarkup}
      </Page>
    </Frame>
  );
}
