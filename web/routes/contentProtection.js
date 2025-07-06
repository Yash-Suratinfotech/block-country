// web/routes/contentProtection.js
import express from "express";
import db from "../db.js";

const router = express.Router();

function getShop(req) {
  return req.query.shop || req.body.shop;
}

// Get content protection settings
router.get("/content-protection", async (req, res) => {
  const shop = getShop(req);
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
      SELECT * FROM content_protection_settings 
      WHERE shop_domain = $1
    `,
      [shop]
    );

    await client.query("COMMIT");

    // Return default settings if none exist
    const defaultSettings = {
      shop_domain: shop,
      disable_right_click: false,
      disable_text_selection: false,
      disable_image_drag: false,
      disable_copy_paste: false,
      disable_dev_tools: false,
      custom_protection_message: "Content is protected",
    };

    res.json(rows.length > 0 ? rows[0] : defaultSettings);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error fetching content protection settings:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch content protection settings" });
  } finally {
    client.release();
  }
});

// Update content protection settings
router.post("/content-protection", async (req, res) => {
  const shop = getShop(req);
  const {
    disable_right_click,
    disable_text_selection,
    disable_image_drag,
    disable_copy_paste,
    disable_dev_tools,
    custom_protection_message,
  } = req.body;
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
      INSERT INTO content_protection_settings (
        shop_domain, disable_right_click, disable_text_selection, 
        disable_image_drag, disable_copy_paste, disable_dev_tools,
        custom_protection_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (shop_domain) 
      DO UPDATE SET 
        disable_right_click = EXCLUDED.disable_right_click,
        disable_text_selection = EXCLUDED.disable_text_selection,
        disable_image_drag = EXCLUDED.disable_image_drag,
        disable_copy_paste = EXCLUDED.disable_copy_paste,
        disable_dev_tools = EXCLUDED.disable_dev_tools,
        custom_protection_message = EXCLUDED.custom_protection_message,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
      [
        shop,
        disable_right_click || false,
        disable_text_selection || false,
        disable_image_drag || false,
        disable_copy_paste || false,
        disable_dev_tools || false,
        custom_protection_message || "Content is protected",
      ]
    );

    await client.query("COMMIT");
    res.json({
      message: "Content protection settings updated",
      settings: rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating content protection settings:", error);
    res
      .status(500)
      .json({ error: "Failed to update content protection settings" });
  } finally {
    client.release();
  }
});

// Enhanced content protection script generator
router.get("/content-protection/script", async (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  const client = await db.getClient();

  try {
    const { rows } = await client.query(
      `
      SELECT * FROM content_protection_settings 
      WHERE shop_domain = $1
    `,
      [shop]
    );

    if (rows.length === 0 || !hasAnyProtectionEnabled(rows[0])) {
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send("// No content protection enabled\nconsole.log('Content protection: disabled');");
      return;
    }

    const settings = rows[0];
    const script = generateEnhancedProtectionScript(settings);

    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(script);
  } catch (error) {
    console.error("Error generating content protection script:", error);
    res.setHeader("Content-Type", "application/javascript");
    res.send("// Error loading content protection\nconsole.error('Content protection script failed to load');");
  } finally {
    client.release();
  }
});

// Check if any protection is enabled
function hasAnyProtectionEnabled(settings) {
  return settings.disable_right_click ||
         settings.disable_text_selection ||
         settings.disable_image_drag ||
         settings.disable_copy_paste ||
         settings.disable_dev_tools;
}

// Generate comprehensive protection script
function generateEnhancedProtectionScript(settings) {
  const protections = [];
  const message = settings.custom_protection_message || "Content is protected";

  if (settings.disable_right_click) {
    protections.push(`
      // Enhanced right-click protection
      function disableRightClick() {
        document.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          showProtectionMessage('${message}');
          return false;
        }, true);
        
        // Block right-click on touch devices
        document.addEventListener('touchstart', function(e) {
          if (e.touches.length > 1) {
            e.preventDefault();
            showProtectionMessage('${message}');
          }
        }, { passive: false });
        
        // Block long press on mobile
        document.addEventListener('touchend', function(e) {
          e.preventDefault();
        }, { passive: false });
        
        console.log('✓ Right-click protection enabled');
      }
      disableRightClick();
    `);
  }

  if (settings.disable_text_selection) {
    protections.push(`
      // Enhanced text selection protection
      function disableTextSelection() {
        // Prevent selection start
        document.addEventListener('selectstart', function(e) {
          if (e.target.tagName !== 'INPUT' && 
              e.target.tagName !== 'TEXTAREA' && 
              !e.target.isContentEditable) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }, true);
        
        // Prevent mouse selection
        document.addEventListener('mousedown', function(e) {
          if (e.detail > 1 && 
              e.target.tagName !== 'INPUT' && 
              e.target.tagName !== 'TEXTAREA' && 
              !e.target.isContentEditable) {
            e.preventDefault();
            return false;
          }
        }, true);
        
        // Apply CSS to disable selection
        const selectionStyle = document.createElement('style');
        selectionStyle.id = 'text-selection-protection';
        selectionStyle.textContent = \`
          * {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
            -webkit-touch-callout: none !important;
            -webkit-tap-highlight-color: transparent !important;
          }
          input, textarea, [contenteditable="true"] {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            user-select: text !important;
          }
          ::selection {
            background: transparent !important;
          }
          ::-moz-selection {
            background: transparent !important;
          }
        \`;
        
        if (!document.getElementById('text-selection-protection')) {
          document.head.appendChild(selectionStyle);
        }
        
        console.log('✓ Text selection protection enabled');
      }
      disableTextSelection();
    `);
  }

  if (settings.disable_image_drag) {
    protections.push(`
      // Enhanced image drag protection
      function disableImageDrag() {
        // Prevent image dragging
        document.addEventListener('dragstart', function(e) {
          if (e.target.tagName === 'IMG' || e.target.tagName === 'PICTURE') {
            e.preventDefault();
            e.stopPropagation();
            showProtectionMessage('${message}');
            return false;
          }
        }, true);
        
        // Prevent image context menu on touch
        document.addEventListener('touchstart', function(e) {
          if (e.target.tagName === 'IMG' || e.target.tagName === 'PICTURE') {
            e.preventDefault();
          }
        }, { passive: false });
        
        // Protect all images
        function protectImages() {
          const images = document.querySelectorAll('img, picture');
          images.forEach(img => {
            img.draggable = false;
            img.ondragstart = function() { return false; };
            img.onselectstart = function() { return false; };
            img.oncontextmenu = function() { 
              showProtectionMessage('${message}');
              return false; 
            };
            
            // Additional protection attributes
            img.setAttribute('draggable', 'false');
            img.setAttribute('ondragstart', 'return false;');
            img.setAttribute('onselectstart', 'return false;');
            img.setAttribute('oncontextmenu', 'return false;');
            
            // CSS protection
            img.style.pointerEvents = 'none';
            img.style.userSelect = 'none';
            img.style.webkitUserSelect = 'none';
            img.style.mozUserSelect = 'none';
            img.style.msUserSelect = 'none';
          });
        }
        
        // Protect existing images
        protectImages();
        
        // Protect new images as they're added
        const imageObserver = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
              if (node.nodeType === 1) { // Element node
                if (node.tagName === 'IMG' || node.tagName === 'PICTURE') {
                  protectImages();
                } else if (node.querySelectorAll) {
                  const imgs = node.querySelectorAll('img, picture');
                  if (imgs.length > 0) {
                    protectImages();
                  }
                }
              }
            });
          });
        });
        
        imageObserver.observe(document.body, { 
          childList: true, 
          subtree: true 
        });
        
        console.log('✓ Image drag protection enabled');
      }
      disableImageDrag();
    `);
  }

  if (settings.disable_copy_paste) {
    protections.push(`
      // Enhanced copy/paste protection
      function disableCopyPaste() {
        const protectedKeys = {
          67: 'copy',     // Ctrl+C
          86: 'paste',    // Ctrl+V  
          88: 'cut',      // Ctrl+X
          65: 'select all', // Ctrl+A
          83: 'save',     // Ctrl+S
          80: 'print',    // Ctrl+P
          70: 'find'      // Ctrl+F
        };
        
        // Keyboard protection
        document.addEventListener('keydown', function(e) {
          const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
          const cmdKey = isMac ? e.metaKey : e.ctrlKey;
          
          if (cmdKey && protectedKeys[e.keyCode]) {
            // Allow in input/textarea fields and contenteditable
            if (e.target.tagName !== 'INPUT' && 
                e.target.tagName !== 'TEXTAREA' && 
                !e.target.isContentEditable) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              showProtectionMessage('${message}');
              return false;
            }
          }
          
          // Block F12 and other dev shortcuts
          if (e.keyCode === 123 || // F12
              (e.keyCode === 116) || // F5 refresh
              (cmdKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
              (cmdKey && e.shiftKey && e.keyCode === 74) || // Ctrl+Shift+J
              (cmdKey && e.shiftKey && e.keyCode === 67) || // Ctrl+Shift+C
              (cmdKey && e.keyCode === 85)) { // Ctrl+U
            e.preventDefault();
            e.stopPropagation();
            showProtectionMessage('Developer tools are disabled');
            return false;
          }
        }, true);
        
        // Clipboard events protection
        ['copy', 'cut', 'paste'].forEach(event => {
          document.addEventListener(event, function(e) {
            if (e.target.tagName !== 'INPUT' && 
                e.target.tagName !== 'TEXTAREA' && 
                !e.target.isContentEditable) {
              e.preventDefault();
              e.stopPropagation();
              showProtectionMessage('${message}');
            }
          }, true);
        });
        
        console.log('✓ Copy/paste protection enabled');
      }
      disableCopyPaste();
    `);
  }

  if (settings.disable_dev_tools) {
    protections.push(`
      // Enhanced developer tools protection
      function disableDevTools() {
        let devtools = {
          open: false,
          orientation: null
        };
        
        // Console protection
        (function() {
          let devtools_detect = false;
          Object.defineProperty(window, 'console', {
            get: function() {
              if (!devtools_detect) {
                devtools_detect = true;
                showProtectionMessage('Console access is disabled');
              }
              return {
                log: function() {},
                error: function() {},
                warn: function() {},
                info: function() {},
                debug: function() {},
                clear: function() {},
                dir: function() {},
                dirxml: function() {},
                table: function() {},
                trace: function() {},
                group: function() {},
                groupCollapsed: function() {},
                groupEnd: function() {},
                time: function() {},
                timeEnd: function() {},
                timeStamp: function() {},
                profile: function() {},
                profileEnd: function() {},
                count: function() {}
              };
            },
            configurable: false
          });
        })();
        
        // DevTools detection via window size
        const threshold = 160;
        let checkCount = 0;
        
        function detectDevTools() {
          const widthThreshold = window.outerWidth - window.innerWidth > threshold;
          const heightThreshold = window.outerHeight - window.innerHeight > threshold;
          
          if (widthThreshold || heightThreshold) {
            if (!devtools.open) {
              devtools.open = true;
              document.body.innerHTML = \`
                <div style="
                  position: fixed;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  background: #000;
                  color: #fff;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-family: Arial, sans-serif;
                  font-size: 24px;
                  z-index: 999999;
                  text-align: center;
                  flex-direction: column;
                ">
                  <h1 style="color: #ff4444; margin-bottom: 20px;">⚠️ Developer Tools Detected</h1>
                  <p>Please close developer tools to continue browsing.</p>
                  <p style="font-size: 16px; color: #ccc; margin-top: 20px;">This page will reload automatically when tools are closed.</p>
                </div>
              \`;
            }
          } else {
            if (devtools.open) {
              devtools.open = false;
              window.location.reload();
            }
          }
        }
        
        // Check every 100ms for faster detection
        setInterval(detectDevTools, 100);
        
        // Debug detection via timing
        let startTime = performance.now();
        debugger;
        let endTime = performance.now();
        
        if (endTime - startTime > 100) {
          showProtectionMessage('Debugging detected');
        }
        
        // Prevent common debugging
        setInterval(function() {
          debugger;
        }, 1000);
        
        console.log('✓ Developer tools protection enabled');
      }
      disableDevTools();
    `);
  }

  // Enhanced protection message function with better UX
  const messageFunction = `
    let messageQueue = [];
    let messageDisplaying = false;
    
    function showProtectionMessage(message) {
      // Add to queue if another message is displaying
      if (messageDisplaying) {
        if (!messageQueue.includes(message)) {
          messageQueue.push(message);
        }
        return;
      }
      
      messageDisplaying = true;
      
      // Remove existing message
      const existingMessage = document.getElementById('protection-message');
      if (existingMessage) {
        existingMessage.remove();
      }
      
      // Create enhanced message with better styling
      const messageDiv = document.createElement('div');
      messageDiv.id = 'protection-message';
      messageDiv.style.cssText = \`
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: linear-gradient(135deg, #ff4444, #cc0000) !important;
        color: white !important;
        padding: 16px 24px !important;
        border-radius: 12px !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(255,68,68,0.4) !important;
        transform: translateX(100%) !important;
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        max-width: 320px !important;
        word-wrap: break-word !important;
        pointer-events: none !important;
        user-select: none !important;
        border: 2px solid rgba(255,255,255,0.2) !important;
        backdrop-filter: blur(10px) !important;
      \`;
      
      // Add icon and text
      messageDiv.innerHTML = \`
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">🛡️</span>
          <span>\${message}</span>
        </div>
      \`;
      
      document.body.appendChild(messageDiv);
      
      // Animate in
      requestAnimationFrame(() => {
        messageDiv.style.transform = 'translateX(0) !important';
      });
      
      // Auto-remove after 4 seconds with animation
      setTimeout(() => {
        messageDiv.style.transform = 'translateX(100%) !important';
        messageDiv.style.opacity = '0 !important';
        
        setTimeout(() => {
          if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
          }
          messageDisplaying = false;
          
          // Show next message in queue
          if (messageQueue.length > 0) {
            const nextMessage = messageQueue.shift();
            setTimeout(() => showProtectionMessage(nextMessage), 100);
          }
        }, 400);
      }, 4000);
    }
  `;

  // Main script wrapper
  return `
    (function() {
      'use strict';
      
      // Check if protection already loaded
      if (window.contentProtectionLoaded) {
        console.log('Content protection already loaded');
        return;
      }
      
      window.contentProtectionLoaded = true;
      
      ${messageFunction}
      
      // Initialize protection when DOM is ready
      function initProtection() {
        try {
          ${protections.join('\n')}
          
          // Log successful initialization
          console.log('🛡️ Content protection initialized successfully');
          
          // Notify that protection is active
          const event = new CustomEvent('contentProtectionLoaded', {
            detail: { 
              enabled: true,
              features: [
                ${settings.disable_right_click ? "'right-click'" : ''}
                ${settings.disable_text_selection ? ",'text-selection'" : ''}
                ${settings.disable_image_drag ? ",'image-drag'" : ''}
                ${settings.disable_copy_paste ? ",'copy-paste'" : ''}
                ${settings.disable_dev_tools ? ",'dev-tools'" : ''}
              ].filter(Boolean)
            }
          });
          window.dispatchEvent(event);
          
        } catch (error) {
          console.error('Content protection initialization error:', error);
        }
      }
      
      // Initialize based on document state
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProtection);
      } else {
        initProtection();
      }
      
      // Re-initialize on page changes (for SPAs)
      let currentUrl = window.location.href;
      const urlObserver = new MutationObserver(() => {
        if (window.location.href !== currentUrl) {
          currentUrl = window.location.href;
          setTimeout(initProtection, 100);
        }
      });
      
      urlObserver.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
      
    })();
  `;
}

export default router;