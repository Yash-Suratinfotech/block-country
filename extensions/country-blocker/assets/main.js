(async () => {
  try {
    // Function to guess country code from browser data (without external APIs)
    function guessCountryCode() {
      // // Method 1: Try to get country from language/locale
      // const language = navigator.language || navigator.userLanguage || 'en-US';
      // const localeParts = language.split('-');
      // if (localeParts.length > 1) {
      //   // Format is usually language-COUNTRY (e.g., en-US, fr-FR)
      //   return localeParts[1].toUpperCase();
      // }

      // Method 2: Use timezone to guess country
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const timezoneToCountry = {
        // Common timezone to country mappings
        'America/New_York': 'US',
        'America/Chicago': 'US',
        'America/Los_Angeles': 'US',
        'America/Denver': 'US',
        'America/Phoenix': 'US',
        'America/Anchorage': 'US',
        'America/Toronto': 'CA',
        'America/Vancouver': 'CA',
        'America/Mexico_City': 'MX',
        'America/Sao_Paulo': 'BR',
        'America/Buenos_Aires': 'AR',
        'Europe/London': 'GB',
        'Europe/Paris': 'FR',
        'Europe/Berlin': 'DE',
        'Europe/Rome': 'IT',
        'Europe/Madrid': 'ES',
        'Europe/Amsterdam': 'NL',
        'Europe/Brussels': 'BE',
        'Europe/Zurich': 'CH',
        'Europe/Vienna': 'AT',
        'Europe/Warsaw': 'PL',
        'Europe/Prague': 'CZ',
        'Europe/Budapest': 'HU',
        'Europe/Athens': 'GR',
        'Europe/Stockholm': 'SE',
        'Europe/Oslo': 'NO',
        'Europe/Copenhagen': 'DK',
        'Europe/Helsinki': 'FI',
        'Europe/Moscow': 'RU',
        'Europe/Istanbul': 'TR',
        'Africa/Cairo': 'EG',
        'Africa/Johannesburg': 'ZA',
        'Africa/Lagos': 'NG',
        'Africa/Nairobi': 'KE',
        'Asia/Dubai': 'AE',
        'Asia/Jerusalem': 'IL',
        'Asia/Riyadh': 'SA',
        'Asia/Tehran': 'IR',
        'Asia/Karachi': 'PK',
        'Asia/Kolkata': 'IN',
        'Asia/Calcutta': 'IN',
        'Asia/Dhaka': 'BD',
        'Asia/Bangkok': 'TH',
        'Asia/Jakarta': 'ID',
        'Asia/Singapore': 'SG',
        'Asia/Kuala_Lumpur': 'MY',
        'Asia/Manila': 'PH',
        'Asia/Hong_Kong': 'HK',
        'Asia/Shanghai': 'CN',
        'Asia/Beijing': 'CN',
        'Asia/Tokyo': 'JP',
        'Asia/Seoul': 'KR',
        'Australia/Sydney': 'AU',
        'Australia/Melbourne': 'AU',
        'Australia/Brisbane': 'AU',
        'Australia/Perth': 'AU',
        'Pacific/Auckland': 'NZ',
        'Pacific/Honolulu': 'US'
      };

      if (timezoneToCountry[timezone]) {
        return timezoneToCountry[timezone];
      }

      // // Method 3: Use timezone offset to guess region (very rough estimate)
      // const offset = new Date().getTimezoneOffset();
      // if (offset === 0 || offset === -60) {
      //   return 'GB'; // GMT/BST - default to UK
      // } else if (offset === -330) {
      //   return 'IN'; // India
      // } else if (offset === -480) {
      //   return 'CN'; // China
      // } else if (offset >= 240 && offset <= 480) {
      //   return 'US'; // Americas - default to US
      // }

      // Default fallback
      return null;
    }

    // Get the guessed country code
    const countryCode = guessCountryCode();
    console.log('Detected country code:', countryCode);

    // Check both country and IP using the combined endpoint
    const checkUrl = new URL(`/apps/proxy-1/check_access`, window.location.origin);
    checkUrl.searchParams.set('shop', Shopify.shop);
    if (countryCode) {
      checkUrl.searchParams.set('country', countryCode);
    }

    const response = await fetch(checkUrl.toString());
    const result = await response.json();

    console.log('Access check result:', result);

    if (result.blocked) {
      let message = '<h1 style="text-align:center;margin-top:20%">';
      
      if (result.ipBlocked && result.countryBlocked) {
        message += 'Sorry, access from your location is restricted.';
      } else if (result.ipBlocked) {
        message += 'Sorry, your access has been restricted.';
        if (result.reason) {
          message += `<br><small style="color:#666;font-size:0.8em">${result.reason}</small>`;
        }
      } else if (result.countryBlocked) {
        message += 'Sorry, this store is not available in your country.';
      }
      
      message += '</h1>';
      document.body.innerHTML = message;
      
      // Optionally, redirect after a delay
      // setTimeout(() => {
      //   window.location.href = 'https://www.google.com';
      // }, 3000);
    }

    // Alternative: Check country and IP separately
    /*
    // Check country if detected
    if (countryCode) {
      const countryCheck = await fetch(`/apps/proxy-1/check_country?shop=${Shopify.shop}&country=${countryCode}`);
      const countryResult = await countryCheck.json();
      
      if (countryResult.blocked) {
        document.body.innerHTML = '<h1 style="text-align:center;margin-top:20%">Sorry, this store is not available in your country.</h1>';
        return;
      }
    }

    // Check IP
    const ipCheck = await fetch(`/apps/proxy-1/check_ip?shop=${Shopify.shop}`);
    const ipResult = await ipCheck.json();
    
    if (ipResult.blocked) {
      let message = '<h1 style="text-align:center;margin-top:20%">Sorry, your access has been restricted.</h1>';
      if (ipResult.reason) {
        message = `<h1 style="text-align:center;margin-top:20%">Sorry, your access has been restricted.<br><small style="color:#666">${ipResult.reason}</small></h1>`;
      }
      document.body.innerHTML = message;
    }
    */

  } catch (e) {
    console.error('Error checking access:', e);
    // Fail open (do nothing) - allow access if check fails
  }
})();