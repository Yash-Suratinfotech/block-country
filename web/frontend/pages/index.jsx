import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  InlineGrid,
  Banner,
  InlineStack,
  SkeletonBodyText,
  SkeletonDisplayText,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { SetupGuide } from "../components/SetupGuide";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const [loading, setLoading] = useState(true);
  const [storeInfo, setStoreInfo] = useState(null);
  const [items, setItems] = useState([
    {
      id: 0,
      title: "Block countries",
      description:
        "Block countries to prevent customers from purchasing from your store.",
      image: {
        url: "https://cdn.shopify.com/shopifycloud/shopify/assets/admin/home/onboarding/shop_pay_task-70830ae12d3f01fed1da23e607dc58bc726325144c29f96c949baca598ee3ef6.svg",
        alt: "Illustration highlighting Block Country",
      },
      complete: false,
      primaryButton: {
        content: "Block country",
        props: {
          onClick: () => handleAction("/country-blocker"),
        },
      },
      secondaryButton: {
        content: "View blocked countries",
        props: {
          onClick: () => handleAction("/country-blocker"),
        },
      },
    },
    {
      id: 1,
      title: "Block ips",
      description:
        "Block ips to prevent customers from purchasing from your store.",
      complete: false,
      primaryButton: {
        content: "Block ip",
        props: {
          onClick: () => handleAction("/ip-blocker"),
        },
      },
      secondaryButton: {
        content: "View blocked ips",
        props: {
          onClick: () => handleAction("/ip-blocker"),
        },
      },
    },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const storeRes = await fetch("/api/store/info");

      if (storeRes.ok) {
        const storeInfoData = await storeRes.json();
        setStoreInfo(storeInfoData);
      }
    } catch (error) {
      shopify.toast.show("There was an error fetching store data", {
        isError: true,
      });
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = useCallback(
    (action) => {
      navigate(action);
    },
    [navigate]
  );

  if (loading) {
    return (
      <Page>
        <Layout>
          {/* Welcome Banner */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={2} />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Setup Guide */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={6} />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Stats Grid */}
          <Layout.Section>
            <InlineGrid columns="2" gap="400">
              <Card>
                <BlockStack gap="200">
                  <SkeletonDisplayText size="large" />
                  <SkeletonBodyText lines={1} />
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <SkeletonDisplayText size="large" />
                  <SkeletonBodyText lines={1} />
                </BlockStack>
              </Card>
            </InlineGrid>
          </Layout.Section>

          {/* Current Plan */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={2} />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Quick Actions */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={2} />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Help Section */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={2} />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const StatCard = ({ title, value, suffix = "" }) => (
    <Card>
      <BlockStack gap="200">
        <Text variant="headingMd" color="subdued">
          {title}
        </Text>
        <Text variant="displayLarge">
          {value}
          {suffix}
        </Text>
      </BlockStack>
    </Card>
  );

  return (
    <Page>
      <Layout>
        {/* Welcome Banner */}
        <Layout.Section>
          <Banner
            title={`Hello, ${
              storeInfo?.shop_owner || storeInfo?.name || "there"
            }!`}
            status="info"
            onDismiss={() => {}}
          >
            <p>
              Welcome to <strong>Block Country</strong>, handcrafted by Surat
              Infotech.
            </p>
          </Banner>
        </Layout.Section>

        {/* Setup Guide */}
        <Layout.Section>
          <SetupGuide items={items} />
        </Layout.Section>

        {/* Stats Grid */}
        <Layout.Section>
          <InlineGrid columns="2" gap="400">
            <StatCard title="Blocked countries" value={0} />
            <StatCard title="Blocked ips" value={0} />
          </InlineGrid>
        </Layout.Section>

        {/* Current Plan */}
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd">Current plan</Text>
              <Text color="subdued">
                You are currently on a{" "}
                <b>{storeInfo?.plan_display_name || "development"}</b> plan
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Help Section */}
        <Layout.Section secondary>
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd">Need help setting up your app?</Text>
              <Text color="subdued">
                Our support team is ready to help with our in-app live chat.
              </Text>
              <InlineStack>
                <Button>Chat with us</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
