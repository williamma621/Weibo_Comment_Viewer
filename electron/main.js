import { app, BrowserWindow, session, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { sendMail } from "../scraper/mailService.js";
import { startSchedule } from "../scraper/scheduleHandler.js";
import { createScrapeRepository } from "./repositories/scrapeRepository.js";
import { createSchedulePatternRepository } from "./repositories/schedulePatternRepository.js";
import { createWeiboAuthService } from "./services/weiboAuthService.js";
import { createScrapeService } from "./services/scrapeService.js";
import { registerIpcHandlers } from "./ipc/registerHandlers.js";

import Store from 'electron-store';
const store = new Store();

// Ensure a directory exists for our data

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
const DATA_PATH = path.join(app.getPath('userData'), 'scrapes');
const SCHEDULE_PATTERN_PATH = path.join(app.getPath("appData"), "weibo-comment-viewer", "saved-schedule-patterns");
const WEIBO_DOMAIN = ".weibo.com";
const WEIBO_LOGIN_URL = "https://weibo.com";
const scrapeRepository = createScrapeRepository(DATA_PATH);
const schedulePatternRepository = createSchedulePatternRepository(SCHEDULE_PATTERN_PATH);
const authService = createWeiboAuthService({
  session,
  store,
  cookieDomain: WEIBO_DOMAIN,
});
const scrapeService = createScrapeService({
  authService,
  scrapeRepository,
});

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
registerIpcHandlers({
  ipcMain,
  loginUrl: WEIBO_LOGIN_URL,
  authService,
  scrapeService,
  scrapeRepository,
  schedulePatternRepository,
  sendMail,
  startSchedule,
  getWeiboCredentials,
});

app.whenReady().then(createWindow);



async function getWeiboCredentials(postUrl, { interactive = false, clearSession = false } = {}) {

  if (clearSession) {
    await authService.clearWeiboSession();
  }

  const existingCookie = await authService.getWeiboCookieFromSession();
  if (existingCookie && !interactive) {
    authService.saveWeiboCookie(existingCookie);
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

      const cookieString = await authService.getWeiboCookieFromSession();
      if (settled || !cookieString) {
        return;
      }

      settled = true;
      authService.saveWeiboCookie(cookieString);
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

      const cookieString = await authService.getWeiboCookieFromSession();
      if (cookieString) {
        settled = true;
        authService.saveWeiboCookie(cookieString);
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
