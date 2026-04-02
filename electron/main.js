import { app, BrowserWindow, session, ipcMain, Tray, Menu, nativeImage, powerSaveBlocker } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { sendMail } from "../scraper/mailService.js";
import { startSchedule, getActiveSchedules, stopSchedule } from "../scraper/scheduleHandler.js";
import { createScrapeRepository } from "./repositories/scrapeRepository.js";
import { createSchedulePatternRepository } from "./repositories/schedulePatternRepository.js";
import { createScheduleRepository } from "./repositories/scheduleRepository.js";
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
const ACTIVE_SCHEDULE_PATH = path.join(app.getPath("appData"), "weibo-comment-viewer", "active-schedules");
const TRAY_ICON_PATH = path.join(__dirname, "assets", "trayTemplate.png");
const WEIBO_DOMAIN = ".weibo.com";
const WEIBO_LOGIN_URL = "https://weibo.com";
const scrapeRepository = createScrapeRepository(DATA_PATH);
const schedulePatternRepository = createSchedulePatternRepository(SCHEDULE_PATTERN_PATH);
const scheduleRepository = createScheduleRepository(ACTIVE_SCHEDULE_PATH);
const authService = createWeiboAuthService({
  session,
  store,
  cookieDomain: WEIBO_DOMAIN,
});
const scrapeService = createScrapeService({
  authService,
  scrapeRepository,
});

let mainWindow;
let tray;
let isQuitting = false;
let powerSaveBlockerId = null;

function hasActiveSchedules() {
  return getActiveSchedules().length > 0;
}

function ensureTray() {
  if (tray) {
    return;
  }

  const trayImage = nativeImage.createFromPath(TRAY_ICON_PATH);
  if (process.platform === "darwin") {
    trayImage.setTemplateImage(true);
  }

  tray = new Tray(trayImage);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show App",
      click: () => {
        if (!mainWindow) {
          createWindow();
        } else {
          mainWindow.show();
          if (process.platform === "darwin") {
            app.dock.show();
          }
        }
      },
    },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setToolTip("Weibo Comment Viewer is running");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (!mainWindow) {
      createWindow();
      return;
    }

    if (mainWindow.isVisible()) {
      mainWindow.hide();
      if (process.platform === "darwin") {
        app.dock.hide();
      }
    } else {
      mainWindow.show();
      if (process.platform === "darwin") {
        app.dock.show();
      }
    }
  });
}

function updatePowerSaveBlocker(active) {
  if (active && powerSaveBlockerId === null) {
    powerSaveBlockerId = powerSaveBlocker.start("prevent-app-suspension");
    return;
  }

  if (!active && powerSaveBlockerId !== null) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
  }
}

function updateBackgroundMode() {
  const active = hasActiveSchedules();
  if (active) {
    ensureTray();
  }
  updatePowerSaveBlocker(active);
}

async function restoreActiveSchedules() {
  const persistedSchedules = await scheduleRepository.listActiveSchedules();
  if (persistedSchedules.length === 0) {
    return;
  }

  persistedSchedules.forEach((schedule) => {
    const baseTime = Date.parse(schedule.startedAt || "");
    startSchedule(
      schedule.schedules,
      schedule.options,
      async ({ postId: scheduledPostId, postUrl: scheduledPostUrl, email: scheduledEmail }) => {
        try {
          const scrapeRecord = await scrapeService.runScheduledScrapePipeline({
            postId: scheduledPostId,
            postUrl: scheduledPostUrl,
          });
          if (scheduledEmail && scrapeService.hasBadData(scrapeRecord)) {
            await sendMail(scheduledEmail, scrapeRecord);
          }
        } catch (error) {
          console.error("Restored schedule run failed:", error);
        } finally {
          updateBackgroundMode();
        }
      },
      {
        baseTime: Number.isFinite(baseTime) ? baseTime : Date.now(),
        scheduleId: schedule.id,
        onRunComplete: async ({ scheduleId, remainingRuns }) => {
          await scheduleRepository.updateSchedule(scheduleId, {
            lastRunAt: new Date().toISOString(),
            remainingRuns,
          });
        },
        onScheduleComplete: async ({ scheduleId }) => {
          await scheduleRepository.updateSchedule(scheduleId, {
            status: "completed",
            remainingRuns: 0,
          });
          updateBackgroundMode();
        },
      },
    );
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  mainWindow = win;

  win.on("close", (event) => {
    if (isQuitting) {
      return;
    }
    if (hasActiveSchedules()) {
      event.preventDefault();
      win.hide();
      ensureTray();
      if (process.platform === "darwin") {
        app.dock.hide();
      }
    }
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
  scheduleRepository,
  sendMail,
  startSchedule,
  stopSchedule,
  getActiveSchedules,
  getWeiboCredentials,
  onScheduleStatusChange: updateBackgroundMode,
});

app.whenReady().then(() => {
  createWindow();
  restoreActiveSchedules().finally(() => {
    updateBackgroundMode();
  });
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    if (process.platform === "darwin") {
      app.dock.show();
    }
  } else {
    createWindow();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});



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
