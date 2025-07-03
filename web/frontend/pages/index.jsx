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
  const [stats, setStats] = useState({
    blockedCountries: 0,
    blockedIps: 0,
    hasBlockedCountries: false,
    hasBlockedIps: false,
  });

  const [items, setItems] = useState();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Update setup guide items based on stats
    setItems([
      {
        id: 0,
        title: "Block countries",
        description:
          "Block countries to prevent customers from purchasing from your store.",
        image: {
          url: "https://cdn.shopify.com/shopifycloud/shopify/assets/admin/home/onboarding/shop_pay_task-70830ae12d3f01fed1da23e607dc58bc726325144c29f96c949baca598ee3ef6.svg",
          alt: "Illustration highlighting Block Country",
        },
        complete: stats.hasBlockedCountries,
        primaryButton: {
          content: stats.hasBlockedCountries
            ? "Manage countries"
            : "Block country",
          props: {
            onClick: () => handleAction("/country-blocker"),
          },
        },
        secondaryButton: stats.hasBlockedCountries
          ? {
              content: `View ${stats.blockedCountries} blocked ${
                stats.blockedCountries === 1 ? "country" : "countries"
              }`,
              props: {
                onClick: () => handleAction("/country-blocker"),
              },
            }
          : null,
      },
      {
        id: 1,
        title: "Block IP addresses",
        description:
          "Block IP addresses to prevent specific visitors from accessing your store.",
        complete: stats.hasBlockedIps,
        primaryButton: {
          content: stats.hasBlockedIps ? "Manage IPs" : "Block IP",
          props: {
            onClick: () => handleAction("/ip-blocker"),
          },
        },
        secondaryButton: stats.hasBlockedIps
          ? {
              content: `View ${stats.blockedIps} blocked ${
                stats.blockedIps === 1 ? "IP" : "IPs"
              }`,
              props: {
                onClick: () => handleAction("/ip-blocker"),
              },
            }
          : null,
      },
    ]);
  }, [stats]);

  const loadData = async () => {
    try {
      const [storeRes, statsRes] = await Promise.all([
        fetch("/api/store/info"),
        fetch("/api/store/stats"),
      ]);

      if (storeRes.ok && statsRes.ok) {
        const storeInfoData = await storeRes.json();
        const statsData = await statsRes.json();

        setStoreInfo(storeInfoData);
        setStats(statsData);
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
              Welcome to <strong>Block Country</strong>, handcrafted by Yash
              Borda.
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
            <StatCard
              title="Blocked countries"
              value={stats.blockedCountries}
            />
            <StatCard title="Blocked IP addresses" value={stats.blockedIps} />
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
                <Button url="mailto:yashborda.suratinfotech@gmail.com">
                  Chat with us
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
