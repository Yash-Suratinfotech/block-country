// extensions/country-blocker/assets/main.js - Simple direct version
(function() {
  'use strict';
  
  // Simple session ID generator
  function getSessionId() {
    try {
      let sessionId = sessionStorage.getItem('bc_session');
      if (!sessionId) {
        sessionId = 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        sessionStorage.setItem('bc_session', sessionId);
        console.log('✌️Created new session:', sessionId);
      } else {
        console.log('✌️Using existing session:', sessionId);
      }
      return sessionId;
    } catch (error) {
      console.log('✌️SessionStorage error, using temp session');
      return 'temp_' + Date.now();
    }
  }
  
  // Get shop domain directly
  function getShopDomain() {
    // Try multiple ways to get shop domain
    if (typeof Shopify !== 'undefined' && Shopify.shop) {
      console.log('✌️Got shop from Shopify object:', Shopify.shop);
      return Shopify.shop;
    }
    
    // Try to extract from current URL
    const hostname = window.location.hostname;
    if (hostname.includes('.myshopify.com')) {
      console.log('✌️Got shop from URL:', hostname);
      return hostname;
    }
    
    // Try to find in page content
    const scripts = document.querySelectorAll('script');
    for (let script of scripts) {
      if (script.textContent && script.textContent.includes('.myshopify.com')) {
        const match = script.textContent.match(/([a-zA-Z0-9\-]+\.myshopify\.com)/);
        if (match) {
          console.log('✌️Got shop from script content:', match[1]);
          return match[1];
        }
      }
    }
    
    console.log('✌️Could not determine shop domain');
    return null;
  }
  
  // Detect country from timezone
  function getCountryCode() {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('✌️Detected timezone:', timezone);
      
      const timezoneMap = {
        "America/New_York": "US",
        "America/Chicago": "US",
        "America/Los_Angeles": "US",
        "America/Denver": "US",
        "America/Phoenix": "US",
        "America/Anchorage": "US",
        "America/Toronto": "CA",
        "America/Vancouver": "CA",
        "America/Mexico_City": "MX",
        "America/Sao_Paulo": "BR",
        "America/Buenos_Aires": "AR",
        "Europe/London": "GB",
        "Europe/Paris": "FR",
        "Europe/Berlin": "DE",
        "Europe/Rome": "IT",
        "Europe/Madrid": "ES",
        "Europe/Amsterdam": "NL",
        "Europe/Brussels": "BE",
        "Europe/Zurich": "CH",
        "Europe/Vienna": "AT",
        "Europe/Warsaw": "PL",
        "Europe/Prague": "CZ",
        "Europe/Budapest": "HU",
        "Europe/Athens": "GR",
        "Europe/Stockholm": "SE",
        "Europe/Oslo": "NO",
        "Europe/Copenhagen": "DK",
        "Europe/Helsinki": "FI",
        "Europe/Moscow": "RU",
        "Europe/Istanbul": "TR",
        "Africa/Cairo": "EG",
        "Africa/Johannesburg": "ZA",
        "Africa/Lagos": "NG",
        "Africa/Nairobi": "KE",
        "Asia/Dubai": "AE",
        "Asia/Jerusalem": "IL",
        "Asia/Riyadh": "SA",
        "Asia/Tehran": "IR",
        "Asia/Karachi": "PK",
        "Asia/Kolkata": "IN",
        "Asia/Calcutta": "IN",
        "Asia/Dhaka": "BD",
        "Asia/Jakarta": "ID",
        "Asia/Singapore": "SG",
        "Asia/Kuala_Lumpur": "MY",
        "Asia/Manila": "PH",
        "Asia/Hong_Kong": "HK",
        "Asia/Shanghai": "CN",
        "Asia/Beijing": "CN",
        "Asia/Tokyo": "JP",
        "Asia/Seoul": "KR",
        "Australia/Sydney": "AU",
        "Australia/Melbourne": "AU",
        "Australia/Brisbane": "AU",
        "Australia/Perth": "AU",
        "Pacific/Auckland": "NZ",
        "Pacific/Honolulu": "US",
      };
      
      const country = timezoneMap[timezone] || null;
      console.log('✌️Detected country:', country);
      return country;
    } catch (error) {
      console.log('✌️Error detecting country:', error.message);
      return null;
    }
  }
  
  // Detect device type
  function getDeviceType() {
    try {
      const userAgent = navigator.userAgent;
      if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
        return 'tablet';
      }
      if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
        return 'mobile';
      }
      return 'desktop';
    } catch (error) {
      console.log('✌️Error detecting device:', error.message);
      return 'unknown';
    }
  }
  
  // Detect browser
  function getBrowser() {
    try {
      const userAgent = navigator.userAgent;
      if (userAgent.includes('Chrome')) return 'Chrome';
      if (userAgent.includes('Firefox')) return 'Firefox';
      if (userAgent.includes('Safari')) return 'Safari';
      if (userAgent.includes('Edge')) return 'Edge';
      if (userAgent.includes('Opera')) return 'Opera';
      return 'Unknown';
    } catch (error) {
      console.log('✌️Error detecting browser:', error.message);
      return 'Unknown';
    }
  }
  
  // Check if bot
  function isBot() {
    try {
      const userAgent = navigator.userAgent.toLowerCase();
      const botPatterns = [
        'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
        'facebookexternalhit', 'twitterbot', 'linkedinbot', 'pinterest', 'whatsapp',
        'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'bot', 'crawler', 'spider'
      ];
      
      const detected = botPatterns.some(pattern => userAgent.includes(pattern));
      console.log('✌️Bot detection:', detected);
      return detected;
    } catch (error) {
      console.log('✌️Error in bot detection:', error.message);
      return false;
    }
  }
  
  // Show blocking message
  function showBlockMessage(result) {
    console.log('✌️Showing block message:', result);
    
    let message = '<div style="text-align:center;margin-top:20%;font-family:Arial,sans-serif;">';
    message += '<h1 style="color:#d32f2f;">Access Restricted</h1>';
    
    if (result?.redirect_info && result?.redirect_info.custom_message) {
      message += '<p>' + result?.redirect_info.custom_message + '</p>';
    } else if (result?.reason) {
      if (result?.reason.includes('Country')) {
        message += '<p>Sorry, this store is not available in your country.</p>';
      } else if (result?.reason.includes('IP')) {
        message += '<p>Your access has been restricted.</p>';
      } else if (result?.reason.includes('Bot')) {
        message += '<p>Automated access is not allowed.</p>';
      } else {
        message += '<p>Access to this store has been restricted.</p>';
      }
    } else {
      message += '<p>Access to this store has been restricted.</p>';
    }
    
    message += '<p style="color:#666;font-size:14px;margin-top:20px;">If you believe this is an error, please contact support.</p>';
    message += '</div>';
    
    document.body.innerHTML = message;
  }
  
  // Handle redirect
  function handleRedirect(redirectInfo) {
    console.log('✌️Redirecting to:', redirectInfo.redirect_url);
    
    const loadingMessage = `
      <div style="text-align:center;margin-top:20%;font-family:Arial,sans-serif;">
        <h1 style="color:#d32f2f;">Access Restricted</h1>
        <p>Redirecting you to an appropriate page...</p>
        <div style="margin-top:20px;">
          <div style="display:inline-block;width:20px;height:20px;border:2px solid #d32f2f;border-top:2px solid transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </div>
    `;
    
    document.body.innerHTML = loadingMessage;
    
    setTimeout(function() {
      window.location.href = redirectInfo.redirect_url;
    }, 2000);
  }
  
  // Load content protection
  function loadContentProtection(shop) {
    try {
      console.log('✌️Loading content protection');
      const script = document.createElement('script');
      script.src = '/apps/proxy-1/content_protection_script?shop=' + shop;
      script.onload = function() {
        console.log('✌️Content protection loaded');
      };
      script.onerror = function() {
        console.log('✌️Content protection failed to load');
      };
      document.head.appendChild(script);
    } catch (error) {
      console.log('✌️Error loading content protection:', error.message);
    }
  }
  
  // Track analytics
  function trackAnalytics(shop, sessionData) {
    try {
      console.log('✌️Tracking analytics');
      
      const data = {
        shop: shop,
        session_id: sessionData.sessionId,
        country_code: sessionData.country,
        device_type: sessionData.device,
        browser: sessionData.browser,
        is_bot: sessionData.isBot,
        page_url: window.location.href,
        referrer: document.referrer || null,
        duration: Math.round((Date.now() - sessionData.startTime) / 1000),
        page_views: 1,
        user_agent: navigator.userAgent
      };
      
      fetch('/apps/proxy-1/track_analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      .then(function(response) {
        if (response?.ok) {
          console.log('✌️Analytics tracked successfully');
        } else {
          console.log('✌️Analytics tracking failed:', response?.status);
        }
      })
      .catch(function(error) {
        console.log('✌️Analytics error:', error.message);
      });
      
    } catch (error) {
      console.log('✌️Analytics tracking error:', error.message);
    }
  }
  
  // Main access check function
  function checkAccess() {
    console.log('✌️Starting access check');
    
    // Get shop domain
    const shop = getShopDomain();
    if (!shop) {
      console.log('✌️No shop domain found, skipping check');
      return;
    }
    
    // Collect session data
    const sessionData = {
      sessionId: getSessionId(),
      country: getCountryCode(),
      device: getDeviceType(),
      browser: getBrowser(),
      isBot: isBot(),
      startTime: Date.now()
    };
    
    console.log('✌️Session data:', sessionData);
    
    // Build API URL
    const apiUrl = new URL('/apps/proxy-1/check_access_enhanced', window.location.origin);
    apiUrl.searchParams.set('shop', shop);
    apiUrl.searchParams.set('session_id', sessionData.sessionId);
    apiUrl.searchParams.set('device_type', sessionData.device);
    apiUrl.searchParams.set('browser', sessionData.browser);
    apiUrl.searchParams.set('is_bot', sessionData.isBot);
    apiUrl.searchParams.set('page_url', window.location.href);
    apiUrl.searchParams.set('referrer', document.referrer || '');
    
    if (sessionData.country) {
      apiUrl.searchParams.set('country', sessionData.country);
    }
    
    console.log('✌️API URL:', apiUrl.toString());
    
    // Make API call
    fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(function(response) {
      
      if (!response?.ok) {
        throw new Error('HTTP ' + response?.status + ': ' + response?.statusText);
      }
      
      // Handle response
      return response?.text().then(function(text) {
        console.log('✌️Raw response:', text);
        
        try {
          return JSON.parse(text);
        } catch (parseError) {
          console.log('✌️JSON parse error:', parseError.message);
          console.log('✌️Response text:', text);
          throw new Error('Invalid JSON response');
        }
      });
    })
    .then(function(result) {
      console.log('✌️Access check result:', result);
      
      if (result?.blocked) {
        console.log('✌️Access is blocked:', result?.reason);
        
        // Handle redirect
        if (result?.redirect_info && result?.redirect_info.redirect_url) {
          handleRedirect(result?.redirect_info);
        } else {
          showBlockMessage(result);
        }
        return;
      }
      
      console.log('✌️Access allowed');
      
      // Load content protection if enabled
      if (result?.contentProtection && result?.contentProtection.enabled) {
        loadContentProtection(shop);
      }
      
      // Track analytics
      trackAnalytics(shop, sessionData);
      
    })
    .catch(function(error) {
      console.log('✌️Access check failed:', error.message);
      console.log('✌️Error details:', error);
      
      // Fail open - don't block if API call fails
      console.log('✌️Failing open due to error');
      
      // Still try to track analytics if we have shop data
      if (shop) {
        trackAnalytics(shop, {
          sessionId: getSessionId(),
          country: getCountryCode(),
          device: getDeviceType(),
          browser: getBrowser(),
          isBot: isBot(),
          startTime: Date.now()
        });
      }
    });
  }
  
  // Initialize when ready
  function init() {
    console.log('✌️Initializing...');
    
    // Run immediately
    checkAccess();
    
    // Set up periodic analytics (every 30 seconds)
    setInterval(function() {
      const shop = getShopDomain();
      if (shop) {
        trackAnalytics(shop, {
          sessionId: getSessionId(),
          country: getCountryCode(),
          device: getDeviceType(),
          browser: getBrowser(),
          isBot: isBot(),
          startTime: Date.now()
        });
      }
    }, 30000);
    
    console.log('✌️Initialization complete');
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Global error handler
  window.addEventListener('error', function(event) {
    console.log('✌️Global error:', event.message, event.filename, event.lineno);
  });
  
})();