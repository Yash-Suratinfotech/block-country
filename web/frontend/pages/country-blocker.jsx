import React, { useEffect, useState } from "react";
import {
  Page,
  Box,
  InlineStack,
  Badge,
  Select,
  Button,
  Spinner,
} from "@shopify/polaris";
import { countryOptions } from "../utils/countryOptions";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function BlockCountries() {
  const shopify = useAppBridge();
  const shop = shopify.config.shop;
  const [blockedCountries, setBlockedCountries] = useState([]);
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blocked-countries?shop=" + shop)
      .then((res) => res.json())
      .then((data) => {
        setBlockedCountries(data.countries);
        setLoading(false);
      });
  }, []);

  const addCountry = async () => {
    await fetch("/api/blocked-countries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop: shop, country }),
    });
    setBlockedCountries([...blockedCountries, country]);
    setCountry("");
  };

  const removeCountry = async (code) => {
    await fetch(`/api/blocked-countries/${code}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop: shop }),
    });
    setBlockedCountries(blockedCountries.filter((c) => c !== code));
  };

  return (
    <Page title="Blocked Countries">
      <Box sectioned>
        {loading ? (
          <Spinner />
        ) : (
          <InlineStack>
            {blockedCountries.map((code) => (
              <Badge key={code} onRemove={() => removeCountry(code)}>
                {code}
              </Badge>
            ))}
          </InlineStack>
        )}
      </Box>
      <Box sectioned>
        <Select
          label="Country"
          options={countryOptions}
          onChange={setCountry}
          value={country}
          placeholder="Select country"
        />
        <Button onClick={addCountry} primary disabled={!country}>
          Block Country
        </Button>
      </Box>
    </Page>
  );
}
