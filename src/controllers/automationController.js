import puppeteer from "puppeteer";

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


