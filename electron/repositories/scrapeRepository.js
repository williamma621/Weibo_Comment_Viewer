import path from "path";
import * as fs from "node:fs/promises";

function normalizePostUrl(postUrl) {
  try {
    const url = new URL(postUrl);
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return postUrl.trim().replace(/\/$/, "");
  }
}

export function createScrapeRepository(dataPath) {
  async function ensureDataDir() {
    await fs.mkdir(dataPath, { recursive: true });
  }

  function buildScrapePayload({ id, postUrl, top_comments, comments, summary }) {
    return {
      id: id || Date.now().toString(),
      url: postUrl,
      top_comments,
      comments,
      summary,
      date: new Date().toISOString(),
    };
  }

  async function getLatestScrapeForUrl(postUrl) {
    await ensureDataDir();
    const normalizedUrl = normalizePostUrl(postUrl);
    const files = await fs.readdir(dataPath);
    let latestScrape = null;

    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(dataPath, file), "utf8");
        const data = JSON.parse(content);
        if (normalizePostUrl(data.url) !== normalizedUrl) {
          continue;
        }

        if (!latestScrape || new Date(data.date) > new Date(latestScrape.date)) {
          latestScrape = data;
        }
      } catch (error) {
        console.error(`Error reading scrape file ${file}:`, error);
      }
    }

    return latestScrape;
  }

  async function saveScrapeRecord({ postUrl, top_comments, comments, summary }) {
    await ensureDataDir();
    const payload = buildScrapePayload({ postUrl, top_comments, comments, summary });
    const filePath = path.join(dataPath, `${payload.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(payload));
    return payload;
  }

  async function saveLatestScrapeForUrl({ postUrl, top_comments, comments, summary }) {
    await ensureDataDir();
    const latestScrape = await getLatestScrapeForUrl(postUrl);
    const payload = buildScrapePayload({
      id: latestScrape?.id,
      postUrl,
      top_comments,
      comments,
      summary,
    });
    const filePath = path.join(dataPath, `${payload.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(payload));
    return payload;
  }

  async function saveScrapeById({ id, postUrl, top_comments, comments, summary }) {
    if (!id) {
      throw new Error("Scrape id is required to overwrite.");
    }
    await ensureDataDir();
    const payload = buildScrapePayload({
      id,
      postUrl,
      top_comments,
      comments,
      summary,
    });
    const filePath = path.join(dataPath, `${payload.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(payload));
    return payload;
  }

  async function listScrapeSummaries() {
    await ensureDataDir();
    const files = await fs.readdir(dataPath);
    const scrapes = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(dataPath, file), "utf8");
        const data = JSON.parse(content);

        scrapes.push({
          id: data.id,
          url: data.url,
          date: data.date,
          display_name: data.summary?.keywords?.[0]?.keyword || NaN,
        });
      } catch (error) {
        console.error(`Error reading scrape file ${file}:`, error);
      }
    }

    return scrapes;
  }

  async function getScrapeById(id) {
    await ensureDataDir();
    const filePath = path.join(dataPath, `${id}.json`);
    const scrapeData = await fs.readFile(filePath, "utf8");
    return JSON.parse(scrapeData);
  }

  async function deleteScrapeById(id) {
    await ensureDataDir();
    const filePath = path.join(dataPath, `${id}.json`);
    await fs.unlink(filePath);
    return { ok: true, id };
  }

  return {
    ensureDataDir,
    getLatestScrapeForUrl,
    saveScrapeRecord,
    saveLatestScrapeForUrl,
    saveScrapeById,
    listScrapeSummaries,
    getScrapeById,
    deleteScrapeById,
  };
}
