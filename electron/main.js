import { app, BrowserWindow, session, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { fetchAllComments } from "../scraper/weiboApi.js";
import { convertPostId, formatComments, formatTopComments, getDuplicateSummary, mergeAnalysisByComment } from "../scraper/helper.js"
import { summarizeKeywords, analyzeSentiment } from "../scraper/deepseekApi.js";
import { sendMail } from "../scraper/mailService.js";
import { startSchedule } from "../scraper/scheduleHandler.js";
import * as fs from 'node:fs/promises';

import Store from 'electron-store';
const store = new Store();

// Ensure a directory exists for our data

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
const DATA_PATH = path.join(app.getPath('userData'), 'scrapes');
const WEIBO_DOMAIN = ".weibo.com";
const WEIBO_LOGIN_URL = "https://weibo.com";

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
      win.loadURL("http://localhost:5173");
      win.webContents.openDevTools(); // 👈 Add this
    } else {
      // Correct way to load the local file
      win.loadFile(path.join(__dirname, '../dist/index.html'));

  }
}

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

async function ensureDataDir() {
  await fs.mkdir(DATA_PATH, { recursive: true });
}

async function getWeiboCookieFromSession() {
  const cookies = await session.defaultSession.cookies.get({ domain: WEIBO_DOMAIN });
  const cookieString = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  return cookieString.includes("SUB=") ? cookieString : "";
}

async function clearWeiboSession() {
  const cookies = await session.defaultSession.cookies.get({ domain: WEIBO_DOMAIN });
  await Promise.all(
    cookies.map((cookie) =>
      session.defaultSession.cookies.remove(
        `https://${cookie.domain.replace(/^\./, "")}${cookie.path || "/"}`,
        cookie.name,
      ),
    ),
  );
  store.delete("weibo_cookie");
}

function saveWeiboCookie(cookieString) {
  if (cookieString) {
    store.set("weibo_cookie", cookieString);
  }
}

async function getLatestScrapeForUrl(postUrl) {
  await ensureDataDir();
  const normalizedUrl = normalizePostUrl(postUrl);
  const files = await fs.readdir(DATA_PATH);
  let latestScrape = null;

  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(DATA_PATH, file), "utf8");
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

async function runCommentScrape(postUrl) {
  const MAX_RETRIES = 3;
  const urlParts = postUrl.match(/weibo\.com\/(\d+)\/([A-Za-z0-9]+)/);
  if (!urlParts) {
    throw new Error("Invalid Weibo URL");
  }

  const user_id = urlParts[1];
  const post_id = urlParts[2];
  const status_id = convertPostId(post_id);

  let sessionCookie = await getWeiboCookieFromSession();
  if (!sessionCookie) {
    sessionCookie = store.get("weibo_cookie") || "";
  }

  if (!sessionCookie) {
    throw new Error("Please log in to Weibo first.");
  }

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const comments = await fetchAllComments({
        cookie: sessionCookie,
        sid: Number.parseInt(status_id, 10),
        uid: Number.parseInt(user_id, 10),
        authWin: null,
      });

      saveWeiboCookie(sessionCookie);
      console.log(`Scrape was successful on attempt ${attempt}.`);
      return {
        comments: getDuplicateSummary(formatComments(comments)),
        topComments: formatTopComments(comments),
      };
    } catch (error) {
      lastError = error;
      console.error(`runCommentScrape attempt ${attempt} failed:`, error.message);

      const refreshedCookie = await getWeiboCookieFromSession();
      if (refreshedCookie && refreshedCookie !== sessionCookie) {
        sessionCookie = refreshedCookie;
        saveWeiboCookie(sessionCookie);
        continue;
      }

      const storedCookie = store.get("weibo_cookie") || "";
      if (storedCookie && storedCookie !== sessionCookie) {
        sessionCookie = storedCookie;
        continue;
      }
    }
  }

  throw lastError || new Error("Failed to scrape Weibo comments after multiple attempts.");
}

async function analyzeCommentsForPost(comments, postUrl) {
  const previousScrape = await getLatestScrapeForUrl(postUrl);
  const [deepseek_analyzed_comments, deepseek_keyword_summary] = await Promise.all([
    analyzeSentiment(comments, { existingResults: previousScrape?.comments || [] }),
    summarizeKeywords(comments),
  ]);

  return [deepseek_analyzed_comments, deepseek_keyword_summary];
}

async function saveScrapeRecord({ postUrl, top_comments, comments, summary }) {
  await ensureDataDir();
  const payload = {
    id: Date.now().toString(),
    url: postUrl,
    top_comments,
    comments,
    summary,
    date: new Date().toISOString(),
  };
  const filePath = path.join(DATA_PATH, `${payload.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(payload));
  console.log("File Write was Successful!");
  return payload;
}

async function runFullScrapePipeline({ postUrl }) {
  const { comments: rawComments, topComments: rawTopComments } = await runCommentScrape(postUrl);
  const [comments, summary] = await analyzeCommentsForPost(rawComments, postUrl);
  const topComments = mergeAnalysisByComment(rawTopComments, comments);

  return saveScrapeRecord({
    postUrl,
    comments,
    summary,
    top_comments: topComments,
  });
}

function hasBadData(scrapeRecord) {
  return scrapeRecord.comments.some((comment) => comment.sentiment && comment.sentiment !== "POS");
}


ipcMain.handle("get-comments-pipeline", async (event, { postUrl }) => {  
  return runCommentScrape(postUrl);
})

ipcMain.handle("login-weibo", async () => {
  const cookieString = await getWeiboCredentials(WEIBO_LOGIN_URL, {
    interactive: true,
    clearSession: false,
  });
  saveWeiboCookie(cookieString);
  return { ok: true };
})


ipcMain.handle("deepseek-analysis-pipeline", async(event, { comments, postUrl }) => {
  const [deepseek_analyzed_comments, deepseek_keyword_summary] = await analyzeCommentsForPost(comments, postUrl);
  console.log("Deepseek Analysis was Successful!")
  return [deepseek_analyzed_comments, deepseek_keyword_summary]
})

ipcMain.handle("save-scrape", async(event, {postUrl, top_comments, comments, summary}) => {
  const payload = await saveScrapeRecord({ postUrl, top_comments, comments, summary });
  return payload.id
})


ipcMain.handle("get-saved-scrapes", async () => {
  try {
    await ensureDataDir();
    const files = await fs.readdir(DATA_PATH);
    const scrapes = [];
    
    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(DATA_PATH, file), 'utf8');
        const data = JSON.parse(content);
        
        scrapes.push({
          id: data.id,
          url: data.url,
          date: data.date,
          display_name: data.summary?.keywords?.[0]?.keyword || NaN
        });
      } catch (fileError) {
        console.error(`Error reading file ${file}:`, fileError);
        // Continue with other files even if one fails
      }
    }
    
    return scrapes;
    
  } catch (error) {
    console.error("Error getting saved scrapes:", error);
    throw error;
  }
});

// Add a handler to get ONE specific scrape by ID
ipcMain.handle("get-scrape-by-id", async (event, id) => {
  const filePath = path.join(DATA_PATH, `${id}.json`);
  const scrapeData = await fs.readFile(filePath)
  return JSON.parse(scrapeData);

});

ipcMain.handle("send-mail", async (event, {email, postId}) => {
  const filePath = path.join(DATA_PATH, `${postId}.json`);
  const scrapeData = JSON.parse(await fs.readFile(filePath, "utf8"));
  await sendMail(email, scrapeData);
  console.log("Send Mail was Successful!")
});


ipcMain.handle("start-schedule", async(event, {schedules, postUrl, email}) => {
  return startSchedule(
    schedules,
    { postUrl, email },
    async ({ postUrl: scheduledPostUrl, email: scheduledEmail }) => {
      const scrapeRecord = await runFullScrapePipeline({ postUrl: scheduledPostUrl });
      if (scheduledEmail && hasBadData(scrapeRecord)) {
        await sendMail(scheduledEmail, scrapeRecord);
      }
    },
  );
})

app.whenReady().then(createWindow);



async function getWeiboCredentials(postUrl, { interactive = false, clearSession = false } = {}) {

  if (clearSession) {
    await clearWeiboSession();
  }

  const existingCookie = await getWeiboCookieFromSession();
  if (existingCookie && !interactive) {
    saveWeiboCookie(existingCookie);
    return existingCookie;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const authWin = new BrowserWindow({
      width: 500,
      height: 600,
      title: "Log in to Weibo",
      autoHideMenuBar: true,
      show: interactive,
    });

    const cleanupAndResolve = async () => {
      if (interactive) {
        return;
      }

      const cookieString = await getWeiboCookieFromSession();
      if (settled || !cookieString) {
        return;
      }

      settled = true;
      saveWeiboCookie(cookieString);
      if (!authWin.isDestroyed()) {
        authWin.close();
      }
      resolve(cookieString);
    };

    authWin.webContents.on("did-finish-load", cleanupAndResolve);
    authWin.webContents.on("did-navigate", cleanupAndResolve);
    authWin.webContents.on("did-redirect-navigation", cleanupAndResolve);
    authWin.on("closed", async () => {
      if (settled) {
        return;
      }

      const cookieString = await getWeiboCookieFromSession();
      if (cookieString) {
        settled = true;
        saveWeiboCookie(cookieString);
        resolve(cookieString);
        return;
      }

      reject(new Error("Weibo login was cancelled before a valid session was created."));
    });

    authWin.loadURL(postUrl).catch((error) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    });

    if (!interactive) {
      authWin.hide();
    }
  });
}
