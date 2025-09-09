import puppeteer from "puppeteer";

export const inspectFirstTextbox = async (req, res) => {
  try {
    const { url } = req.body || {};
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

      const textboxInfo = await page.evaluate(() => {
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

        function getLabelText(el) {
          const id = el.getAttribute("id");
          if (id) {
            const byFor = document.querySelector(`label[for="${CSS.escape(id)}"]`);
            if (byFor && byFor.textContent) return byFor.textContent.trim();
          }
          let current = el.parentElement;
          while (current) {
            if (current.tagName && current.tagName.toLowerCase() === "label") {
              const text = current.textContent || "";
              return text.trim();
            }
            current = current.parentElement;
          }
          const labelledBy = el.getAttribute("aria-labelledby");
          if (labelledBy) {
            const text = labelledBy
              .split(/\s+/)
              .map((idPart) => document.getElementById(idPart))
              .filter(Boolean)
              .map((n) => (n && n.textContent ? n.textContent.trim() : ""))
              .filter(Boolean)
              .join(" ");
            if (text) return text;
          }
          const ariaLabel = el.getAttribute("aria-label");
          if (ariaLabel) return ariaLabel;
          return "";
        }

        function buildSimpleSelector(el) {
          if (!el) return "";
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${CSS.escape(el.id)}` : "";
          if (id) return `${tag}${id}`;
          const name = el.getAttribute("name");
          if (name) return `${tag}[name="${CSS.escape(name)}"]`;
          const placeholder = el.getAttribute("placeholder");
          if (placeholder) return `${tag}[placeholder="${CSS.escape(placeholder)}"]`;
          const inputs = Array.from(document.querySelectorAll(tag));
          const index = inputs.indexOf(el);
          return `${tag}:nth-of-type(${index + 1})`;
        }

        const candidates = Array.from(document.querySelectorAll("input, textarea"))
          .filter((el) => {
            const tag = el.tagName.toLowerCase();
            if (tag === "textarea") return true;
            if (tag === "input") {
              const t = (el.getAttribute("type") || "text").toLowerCase();
              return ["text", "email", "search", "tel", "url", "number", "password"].includes(t);
            }
            return false;
          })
          .filter(isVisible);

        const target = candidates[0] || null;
        if (!target) return null;

        const rect = target.getBoundingClientRect();
        const tag = target.tagName.toLowerCase();
        const type = tag === "input" ? (target.getAttribute("type") || "text").toLowerCase() : tag;
        const form = target.form;
        const placeholder = target.getAttribute("placeholder") || "";
        const ariaLabel = target.getAttribute("aria-label") || "";
        const name = target.getAttribute("name") || "";
        const id = target.getAttribute("id") || "";
        const labelText = getLabelText(target);
        const value = (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
          ? (target.value || "")
          : "";

        // Mark the target so the Node context can reliably select it
        target.setAttribute("data-resumax-target", "true");

        return {
          selector: buildSimpleSelector(target),
          fallbackSelector: '[data-resumax-target="true"]',
          tag,
          type,
          name,
          id,
          placeholder,
          ariaLabel,
          labelText,
          value,
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          form: form
            ? {
                method: (form.getAttribute("method") || "").toUpperCase(),
                action: form.getAttribute("action") || "",
              }
            : null,
          outerHTMLSnippet: (target.outerHTML || "").slice(0, 500),
        };
      });

      // If we found a textbox, fill it with "jason" and wait 10 seconds
      let filled = false;
      if (textboxInfo) {
        const preferredSelector = textboxInfo.fallbackSelector || textboxInfo.selector;
        try {
          await page.waitForSelector(preferredSelector, { visible: true, timeout: 5000 });
          const el = await page.$(preferredSelector);
          if (el) {
            await el.click({ clickCount: 3 }).catch(() => {});
            await page.keyboard.press('Backspace').catch(() => {});
            await el.type('jason', { delay: 50 });
            filled = true;
            await page.waitForTimeout(10000);
          }
        } catch (_) {
          // ignore fill errors; we'll just return the inspection info
        }
      }

      await browser.close();

      return res.json({ url: normalizedUrl, pageTitle, textbox: textboxInfo, filled });
    } catch (err) {
      await browser.close();
      throw err;
    }
  } catch (error) {
    console.error("Error inspecting first textbox:", error);
    return res.status(500).json({ message: "Failed to inspect first textbox", error: error.message });
  }
};


