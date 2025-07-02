(async () => {
  try {
    // Geo-IP API (replace with your key)
    // const geoRes = await fetch("https://api.ipgeolocation.io/ipgeo?apiKey=YOUR_API_KEY&fields=country_code2");
    // const { country_code2 } = await geoRes.json();
    const country_code2 = "IN";

    // App backend endpoint, include secret key for auth
    const check = await fetch(`/apps/proxy-1/check_country?shop=${Shopify.shop}&country=${country_code2}`);
    const { blocked } = await check.json();

    if (blocked) {
      document.body.innerHTML = "<h1 style='text-align:center;margin-top:20%'>Sorry, this store is not available in your country.</h1>";
    }
  } catch (e) {
    // Fail open (do nothing)
  }
})();
