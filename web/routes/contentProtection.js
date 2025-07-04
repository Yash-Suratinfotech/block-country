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

// Get content protection script for storefront
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

    if (rows.length === 0) {
      return res.json({
        script: null,
        message: "No content protection enabled",
      });
    }

    const settings = rows[0];
    const script = generateProtectionScript(settings);

    res.setHeader("Content-Type", "application/javascript");
    res.send(script);
  } catch (error) {
    console.error("Error generating content protection script:", error);
    res.status(500).json({ error: "Failed to generate protection script" });
  } finally {
    client.release();
  }
});

// Generate the protection script based on settings
function generateProtectionScript(settings) {
  const protections = [];

  if (settings.disable_right_click) {
    protections.push(`
      // Disable right-click context menu
      document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showProtectionMessage('${settings.custom_protection_message}');
        return false;
      });
    `);
  }

  if (settings.disable_text_selection) {
    protections.push(`
      // Disable text selection
      document.addEventListener('selectstart', function(e) {
        e.preventDefault();
        return false;
      });
      
      // CSS to disable text selection
      const style = document.createElement('style');
      style.textContent = \`
        * {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
        }
        input, textarea {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
        }
      \`;
      document.head.appendChild(style);
    `);
  }

  if (settings.disable_image_drag) {
    protections.push(`
      // Disable image dragging
      document.addEventListener('dragstart', function(e) {
        if (e.target.tagName === 'IMG') {
          e.preventDefault();
          showProtectionMessage('${settings.custom_protection_message}');
          return false;
        }
      });
      
      // Make images non-draggable
      document.addEventListener('DOMContentLoaded', function() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
          img.draggable = false;
          img.oncontextmenu = function() { return false; };
        });
      });
    `);
  }

  if (settings.disable_copy_paste) {
    protections.push(`
      // Disable copy, cut, paste
      document.addEventListener('keydown', function(e) {
        // Disable Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+S, Ctrl+P
        if (e.ctrlKey && (e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 88 || 
            e.keyCode === 65 || e.keyCode === 83 || e.keyCode === 80)) {
          e.preventDefault();
          showProtectionMessage('${settings.custom_protection_message}');
          return false;
        }
      });
      
      document.addEventListener('copy', function(e) {
        e.preventDefault();
        showProtectionMessage('${settings.custom_protection_message}');
      });
      
      document.addEventListener('cut', function(e) {
        e.preventDefault();
        showProtectionMessage('${settings.custom_protection_message}');
      });
      
      document.addEventListener('paste', function(e) {
        e.preventDefault();
        showProtectionMessage('${settings.custom_protection_message}');
      });
    `);
  }

  if (settings.disable_dev_tools) {
    protections.push(`
      // Disable common developer tools shortcuts
      document.addEventListener('keydown', function(e) {
        // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+Shift+C
        if (e.keyCode === 123 || 
            (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) ||
            (e.ctrlKey && e.keyCode === 85)) {
          e.preventDefault();
          showProtectionMessage('Developer tools are disabled');
          return false;
        }
      });
      
      // Detect if developer tools are open (basic detection)
      setInterval(function() {
        if (window.outerHeight - window.innerHeight > 200 || 
            window.outerWidth - window.innerWidth > 200) {
          document.body.innerHTML = '<div style="text-align:center;margin-top:20%;font-size:24px;">Developer tools detected. Please close them to continue.</div>';
        }
      }, 1000);
    `);
  }

  // Add the protection message function
  const messageFunction = `
    function showProtectionMessage(message) {
      // Remove existing message
      const existingMessage = document.getElementById('protection-message');
      if (existingMessage) {
        existingMessage.remove();
      }
      
      // Create and show message
      const messageDiv = document.createElement('div');
      messageDiv.id = 'protection-message';
      messageDiv.style.cssText = \`
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      \`;
      messageDiv.textContent = message;
      document.body.appendChild(messageDiv);
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.parentNode.removeChild(messageDiv);
        }
      }, 3000);
    }
  `;

  return `
    (function() {
      'use strict';
      
      ${messageFunction}
      
      ${protections.join("\n")}
      
      console.log('Content protection active');
    })();
  `;
}

export default router;
