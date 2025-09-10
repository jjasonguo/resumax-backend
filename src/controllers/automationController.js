import puppeteer from "puppeteer";
import User from "../models/User.js";

export const fillNameInFirstTextbox = async (req, res) => {
  try {
    const { url, clerkUserId } = req.body || {};
    const keepOpen = String(req.query?.keepOpen ?? req.body?.keepOpen ?? "true").toLowerCase() === "true";
    const waitMsParam = req.query?.waitMs ?? req.body?.waitMs;
    const fillWaitMs = Number.isFinite(Number(waitMsParam)) ? Math.max(0, Number(waitMsParam)) : 10000;
    
    if (!url || typeof url !== "string") {
      return res.status(400).json({ message: "A valid url is required" });
    }
    
    if (!clerkUserId || typeof clerkUserId !== "string") {
      return res.status(400).json({ message: "A valid clerkUserId is required" });
    }

    // Get user's name from database
    console.log('🔍 Getting user name for Clerk ID:', clerkUserId);
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      console.log('❌ User not found for Clerk ID:', clerkUserId);
      return res.status(404).json({ message: "User not found" });
    }
    
    const userName = user.name;
    console.log('✅ Found user name:', userName, 'for Clerk ID:', clerkUserId);

    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    const browser = await puppeteer.launch({
      headless: false,
      slowMo: 200,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: null,
    });

    try {
      const page = await browser.newPage();
      await page.goto(normalizedUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

      const pageTitle = await page.title();

      // First, find and click the apply button
      const findApplyInFrame = async (frame) => {
        return frame.evaluate(() => {
          function isVisible(el) {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return (
              style &&
              style.visibility !== "hidden" &&
              style.display !== "none" &&
              rect.width > 0 &&
              rect.height > 0
            );
          }

          function getText(el) {
            return (
              (el.textContent || "").trim() ||
              el.getAttribute("value") ||
              el.getAttribute("aria-label") ||
              el.getAttribute("title") ||
              ""
            );
          }

          const APPLY_REGEX = /(apply|apply now|submit application|start application|apply today)/i;
          const candidates = Array.from(
            document.querySelectorAll(
              'button, a, input[type="submit"], input[type="button"], div[role="button"], span[role="button"]'
            )
          ).filter(isVisible);

          let match = candidates.find((el) => APPLY_REGEX.test(getText(el)));
          if (!match) {
            match = candidates.find((el) => (el.getAttribute("aria-label") || "").toLowerCase() === "apply");
          }
          if (!match) return null;

          match.setAttribute("data-resumax-apply", "true");
          const rect = match.getBoundingClientRect();
          return {
            selector: '[data-resumax-apply="true"]',
            text: getText(match),
            tag: match.tagName.toLowerCase(),
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            outerHTMLSnippet: (match.outerHTML || "").slice(0, 500),
          };
        });
      };

      // Find and click apply button
      let applyInfo = null;
      let applyFrame = page.mainFrame();
      let applyClicked = false;
      let clickMethod = null;
      
      // Search for apply button in main frame first, then child frames
      const applyInfoMain = await findApplyInFrame(page.mainFrame());
      if (applyInfoMain) {
        applyInfo = applyInfoMain;
        applyFrame = page.mainFrame();
      } else {
        for (const frame of page.frames()) {
          if (frame === page.mainFrame()) continue;
          const applyInfoChild = await findApplyInFrame(frame);
          if (applyInfoChild) {
            applyInfo = applyInfoChild;
            applyFrame = frame;
            break;
          }
        }
      }

      // Click the apply button if found
      if (applyInfo) {
        try {
          await applyFrame.waitForSelector(applyInfo.selector, { visible: true, timeout: 10000 });
          let el = await applyFrame.$(applyInfo.selector);
          if (el) {
            // Try multiple click strategies
            try {
              await el.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
            } catch (_) {}

            // Strategy 1: elementHandle.click
            try {
              await el.click({ delay: 50 });
              applyClicked = true;
              clickMethod = 'elementHandle.click';
            } catch (_) {}

            // Strategy 2: programmatic click in DOM
            if (!applyClicked) {
              try {
                await el.evaluate((node) => {
                  if (node && typeof node.click === 'function') {
                    node.click();
                  }
                });
                applyClicked = true;
                clickMethod = 'dom.click()';
              } catch (_) {}
            }

            // Strategy 3: dispatch mouse events
            if (!applyClicked) {
              try {
                await el.evaluate((node) => {
                  const e1 = new MouseEvent('mousedown', { bubbles: true });
                  const e2 = new MouseEvent('mouseup', { bubbles: true });
                  const e3 = new MouseEvent('click', { bubbles: true });
                  if (node && typeof node.dispatchEvent === 'function') {
                    node.dispatchEvent(e1);
                    node.dispatchEvent(e2);
                    node.dispatchEvent(e3);
                  }
                });
                applyClicked = true;
                clickMethod = 'dispatchMouseEvents';
              } catch (_) {}
            }

            if (applyClicked) {
              console.log('🔄 Apply button clicked, waiting for all events to complete...');
              await Promise.race([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null),
                page.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
                page.waitForTimeout(5000) // Wait 5 seconds after clicking apply
              ]);
              console.log('✅ Apply button events completed');
            }
          }
        } catch (_) {
          // ignore click errors
        }
      }

      // Additional wait to ensure ALL apply button events are fully processed
      console.log('⏳ Waiting additional 5 seconds to ensure all apply events are complete...');
      await page.waitForTimeout(5000);
      
      // Wait for any remaining network activity to settle
      try {
        await page.waitForLoadState?.('networkidle') || await page.waitForFunction(() => {
          return document.readyState === 'complete';
        }, { timeout: 10000 });
        console.log('✅ Page fully loaded and settled');
      } catch (_) {
        console.log('⚠️ Page load state check timed out, proceeding anyway');
      }

      // Only proceed with typing if apply button was clicked (or if no apply button was found)
      if (applyInfo && !applyClicked) {
        console.log('⚠️ Apply button found but not clicked, skipping name typing');
        textboxInfo = null;
      } else {
        console.log('✅ Proceeding with name typing...');
        
        // Now find the first text input field and type the name using Puppeteer
        const findFirstTextField = async (frame) => {
        return frame.evaluate(() => {
          function isVisible(el) {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return (
              style &&
              style.visibility !== "hidden" &&
              style.display !== "none" &&
              rect.width > 0 &&
              rect.height > 0
            );
          }

          function buildSimpleSelector(el) {
            if (!el) return "";
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${CSS.escape(el.id)}` : "";
            if (id) return `${tag}${id}`;
            const name = el.getAttribute("name");
            if (name) return `${tag}[name="${CSS.escape(name)}"]`;
            const elements = Array.from(document.querySelectorAll(tag));
            const index = elements.indexOf(el);
            return `${tag}:nth-of-type(${index + 1})`;
          }

          // Look for the first visible text input field (assume it's the name field)
          const textInputs = Array.from(
            document.querySelectorAll(
              'input[type="text"], input[type="email"], input[type="search"], input:not([type]), textarea'
            )
          ).filter(isVisible);

          // Skip password fields but include everything else
          const candidates = textInputs.filter(input => {
            const type = (input.type || "").toLowerCase();
            return type !== "password";
          });

          if (candidates.length === 0) {
            return null;
          }

          // Take the first text input field
          const targetInput = candidates[0];
          
          targetInput.setAttribute("data-resumax-target", "true");
          
          const rect = targetInput.getBoundingClientRect();
          return {
            selector: buildSimpleSelector(targetInput),
            fallbackSelector: '[data-resumax-target="true"]',
            tag: targetInput.tagName.toLowerCase(),
            type: targetInput.type || 'text',
            name: targetInput.name || '',
            id: targetInput.id || '',
            placeholder: targetInput.placeholder || '',
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            outerHTMLSnippet: (targetInput.outerHTML || "").slice(0, 500),
          };
        });
      };

      // Find the first text field
      let textboxInfo = null;
      let textboxFrame = page.mainFrame();
      
      // Search main frame first
      const textboxInfoMain = await findFirstTextField(page.mainFrame());
      if (textboxInfoMain) {
        textboxInfo = textboxInfoMain;
        textboxFrame = page.mainFrame();
      } else {
        // Search child frames
        for (const frame of page.frames()) {
          if (frame === page.mainFrame()) continue;
          const textboxInfoChild = await findFirstTextField(frame);
          if (textboxInfoChild) {
            textboxInfo = textboxInfoChild;
            textboxFrame = frame;
            break;
          }
        }
      }

      // Now type the name using Puppeteer's typing capabilities
      if (textboxInfo) {
        try {
          console.log('⌨️ Typing name into textbox:', textboxInfo.selector);
          
          // Wait for the element to be available
          await textboxFrame.waitForSelector(textboxInfo.fallbackSelector, { visible: true, timeout: 10000 });
          
          // Get the element handle
          const element = await textboxFrame.$(textboxInfo.fallbackSelector);
          
          if (element) {
            // Clear the field first
            await element.click({ clickCount: 3 }); // Triple click to select all
            await page.keyboard.press('Backspace'); // Clear selected text
            
            // Type the name character by character (more realistic)
            await element.type(userName, { delay: 100 }); // 100ms delay between keystrokes
            
            console.log('✅ Successfully typed name:', userName);
            
            // Update the textbox info with the filled value
            textboxInfo.filledValue = userName;
          }
        } catch (error) {
          console.error('❌ Error typing into textbox:', error);
          // Fallback: try direct value setting
          try {
            await textboxFrame.evaluate((selector, name) => {
              const element = document.querySelector(selector);
              if (element) {
                element.focus();
                element.value = name;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, textboxInfo.fallbackSelector, userName);
            console.log('✅ Fallback: Set value directly');
            textboxInfo.filledValue = userName;
          } catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError);
          }
        }
      }
      } // End of else block for apply button check

      if (!keepOpen) {
        await browser.close();
      }

      return res.json({ 
        url: normalizedUrl, 
        pageTitle, 
        apply: applyInfo,
        applyClicked,
        clickMethod,
        textbox: textboxInfo, 
        userName,
        keepOpen, 
        waitMs: fillWaitMs,
        status: applyInfo && !applyClicked ? 'apply_found_but_not_clicked' : 
                applyClicked ? 'apply_clicked_and_name_typed' : 
                'no_apply_button_found_name_typed'
      });
    } catch (err) {
      try { await browser.close(); } catch (_) {}
      throw err;
    }
  } catch (error) {
    console.error("Error filling name in first textbox:", error);
    return res.status(500).json({ message: "Failed to fill name in first textbox", error: error.message });
  }
};

export const inspectFirstTextbox = async (req, res) => {
  try {
    const { url } = req.body || {};
    const keepOpen = String(req.query?.keepOpen ?? req.body?.keepOpen ?? "true").toLowerCase() === "true";
    const waitMsParam = req.query?.waitMs ?? req.body?.waitMs;
    const fillWaitMs = Number.isFinite(Number(waitMsParam)) ? Math.max(0, Number(waitMsParam)) : 10000;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ message: "A valid url is required" });
    }

    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    const browser = await puppeteer.launch({
      headless: false,
      slowMo: 200,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: null,
    });

    try {
      const page = await browser.newPage();
      await page.goto(normalizedUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

      const pageTitle = await page.title();

      // Find an "Apply"-like button or link. Search main frame first, then child iframes.
      const findApplyInFrame = async (frame) => {
        return frame.evaluate(() => {
          function isVisible(el) {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return (
              style &&
              style.visibility !== "hidden" &&
              style.display !== "none" &&
              rect.width > 0 &&
              rect.height > 0
            );
          }

          function buildSimpleSelector(el) {
            if (!el) return "";
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${CSS.escape(el.id)}` : "";
            if (id) return `${tag}${id}`;
            const name = el.getAttribute("name");
            if (name) return `${tag}[name="${CSS.escape(name)}"]`;
            const elements = Array.from(document.querySelectorAll(tag));
            const index = elements.indexOf(el);
            return `${tag}:nth-of-type(${index + 1})`;
          }

          function getText(el) {
            return (
              (el.textContent || "").trim() ||
              el.getAttribute("value") ||
              el.getAttribute("aria-label") ||
              el.getAttribute("title") ||
              ""
            );
          }

          const APPLY_REGEX = /(apply|apply now|submit application|start application|apply today)/i;
          const candidates = Array.from(
            document.querySelectorAll(
              'button, a, input[type="submit"], input[type="button"], div[role="button"], span[role="button"]'
            )
          ).filter(isVisible);

          let match = candidates.find((el) => APPLY_REGEX.test(getText(el)));
          if (!match) {
            match = candidates.find((el) => (el.getAttribute("aria-label") || "").toLowerCase() === "apply");
          }
          if (!match) return null;

          match.setAttribute("data-resumax-apply", "true");
          const rect = match.getBoundingClientRect();
          return {
            selector: buildSimpleSelector(match),
            fallbackSelector: '[data-resumax-apply="true"]',
            text: getText(match),
            tag: match.tagName.toLowerCase(),
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            outerHTMLSnippet: (match.outerHTML || "").slice(0, 500),
          };
        });
      };

      let applyInfo = null;
      let applyFrame = page.mainFrame();
      let foundAfterMs = 0;
      let searchTries = 0;
      const searchStart = Date.now();
      const searchTimeoutMs = 20000;
      const searchIntervalMs = 500;
      while (!applyInfo && Date.now() - searchStart < searchTimeoutMs) {
        searchTries++;
        // main frame first
        const infoMain = await findApplyInFrame(page.mainFrame());
        if (infoMain) {
          applyInfo = infoMain;
          applyFrame = page.mainFrame();
          break;
        }
        // then children frames
        for (const frame of page.frames()) {
          if (frame === page.mainFrame()) continue;
          const infoChild = await findApplyInFrame(frame);
          if (infoChild) {
            applyInfo = infoChild;
            applyFrame = frame;
            break;
          }
        }
        if (applyInfo) break;
        await page.waitForTimeout(searchIntervalMs);
      }
      foundAfterMs = Date.now() - searchStart;

      // If we found an apply button, click it and optionally wait for navigation
      let clicked = false;
      let clickMethod = null;
      if (applyInfo) {
        const preferredSelector = applyInfo.fallbackSelector || applyInfo.selector;
        try {
          await applyFrame.waitForSelector(preferredSelector, { visible: true, timeout: 10000 });
          let el = await applyFrame.$(preferredSelector);
          if (el) {
            // Try multiple click strategies with fallbacks
            try {
              await el.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
            } catch (_) {}

            // Strategy 1: elementHandle.click
            try {
              await el.click({ delay: 50 });
              clicked = true;
              clickMethod = 'elementHandle.click';
            } catch (_) {}

            // Strategy 2: programmatic click in DOM
            if (!clicked) {
              try {
                await el.evaluate((node) => {
                  if (node && typeof node.click === 'function') {
                    node.click();
                  }
                });
                clicked = true;
                clickMethod = 'dom.click()';
              } catch (_) {}
            }

            // Strategy 3: dispatch mouse events
            if (!clicked) {
              try {
                await el.evaluate((node) => {
                  const e1 = new MouseEvent('mousedown', { bubbles: true });
                  const e2 = new MouseEvent('mouseup', { bubbles: true });
                  const e3 = new MouseEvent('click', { bubbles: true });
                  if (node && typeof node.dispatchEvent === 'function') {
                    node.dispatchEvent(e1);
                    node.dispatchEvent(e2);
                    node.dispatchEvent(e3);
                  }
                });
                clicked = true;
                clickMethod = 'dispatchMouseEvents';
              } catch (_) {}
            }

            // Strategy 4: hover + page.mouse click (works across frames)
            if (!clicked) {
              try {
                await el.hover();
                await page.mouse.click(0, 0); // ensure mouse is engaged
                const box = await el.boundingBox();
                if (box) {
                  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { delay: 50 });
                  clicked = true;
                  clickMethod = 'mouse.click@center';
                }
              } catch (_) {}
            }

            if (clicked) {
              await Promise.race([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null),
                page.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
                page.waitForTimeout(fillWaitMs)
              ]);
            }
          }
        } catch (_) {
          // ignore click errors
        }
      }

      if (!keepOpen) {
        await browser.close();
      }

      return res.json({ url: normalizedUrl, pageTitle, apply: applyInfo, clicked, clickMethod, keepOpen, waitMs: fillWaitMs, foundAfterMs, searchTries });
    } catch (err) {
      try { await browser.close(); } catch (_) {}
      throw err;
    }
  } catch (error) {
    console.error("Error inspecting first textbox:", error);
    return res.status(500).json({ message: "Failed to inspect first textbox", error: error.message });
  }
};


