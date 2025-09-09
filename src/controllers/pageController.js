import puppeteer from "puppeteer";

export const fetchPageTitle = async (req, res) => {
  try {
    const { url } = req.body;
    const keepOpen = String(req.query?.keepOpen ?? req.body?.keepOpen ?? "true").toLowerCase() === "true";
    if (!url || typeof url !== "string") {
      return res.status(400).json({ message: "A valid url is required" });
    }

    const isHttp = /^https?:\/\//i.test(url);
    const targetUrl = isHttp ? url : `https://${url}`;

    const browser = await puppeteer.launch({
      headless: false,
      slowMo: 200,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: null,
    });

    try {
      const page = await browser.newPage();
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      const title = await page.title();
      if (!keepOpen) {
        await browser.close();
      }

      return res.json({ title, keepOpen });
    } catch (err) {
      try { await browser.close(); } catch (_) {}
      throw err;
    }
  } catch (error) {
    console.error("Error fetching page title:", error);
    return res.status(500).json({ message: "Failed to fetch page title", error: error.message });
  }
};


