export function registerIpcHandlers({
  ipcMain,
  loginUrl,
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
  onScheduleStatusChange,
}) {
  ipcMain.handle("open-user-data-folder", async () => {
    const { shell } = await import("electron");
    const { dirname } = await import("node:path");
    const envPath = process.env.WEIBO_ENV_PATH;
    if (!envPath) {
      throw new Error("Environment path is not configured.");
    }
    await shell.openPath(dirname(envPath));
    return { ok: true };
  });

  ipcMain.handle("get-comments-pipeline", async (event, { postUrl }) => {
    return scrapeService.runCommentScrape(postUrl);
  });

  ipcMain.handle("login-weibo", async () => {
    const cookieString = await getWeiboCredentials(loginUrl, {
      interactive: true,
      clearSession: false,
    });
    authService.saveWeiboCookie(cookieString);
    return { ok: true };
  });

  ipcMain.handle("deepseek-analysis-pipeline", async (event, { comments, postUrl }) => {
    return scrapeService.analyzeCommentsForPost(comments, postUrl);
  });

  ipcMain.handle("save-scrape", async (event, { postUrl, top_comments, comments, summary }) => {
    const payload = await scrapeRepository.saveScrapeRecord({ postUrl, top_comments, comments, summary });
    return payload.id;
  });

  ipcMain.handle("delete-scrape", async (event, id) => {
    return scrapeRepository.deleteScrapeById(id);
  });

  ipcMain.handle("get-saved-scrapes", async () => {
    return scrapeRepository.listScrapeSummaries();
  });

  ipcMain.handle("get-scrape-by-id", async (event, id) => {
    return scrapeRepository.getScrapeById(id);
  });

  ipcMain.handle("send-mail", async (event, { email, postId }) => {
    const scrapeData = await scrapeRepository.getScrapeById(postId);
    await sendMail(email, scrapeData);
  });

  ipcMain.handle("save-schedule-pattern", async (event, { name, schedules }) => {
    return schedulePatternRepository.savePattern({ name, schedules });
  });

  ipcMain.handle("get-saved-schedule-patterns", async () => {
    return schedulePatternRepository.listPatterns();
  });

  ipcMain.handle("get-active-schedules", async () => {
    return getActiveSchedules();
  });

  ipcMain.handle("stop-schedule", async (event, scheduleId) => {
    if (!scheduleId) {
      throw new Error("Schedule id is required.");
    }
    stopSchedule(scheduleId);
    if (scheduleRepository) {
      await scheduleRepository.updateSchedule(scheduleId, {
        status: "stopped",
        remainingRuns: 0,
      });
    }
    if (typeof onScheduleStatusChange === "function") {
      onScheduleStatusChange();
    }
    return { ok: true };
  });

  ipcMain.handle("start-schedule", async (event, { schedules, postId, postUrl, email }) => {
    const scheduleResult = startSchedule(
      schedules,
      { postId, postUrl, email },
      async ({ postId: scheduledPostId, postUrl: scheduledPostUrl, email: scheduledEmail }) => {
        try {
          const scrapeRecord = await scrapeService.runScheduledScrapePipeline({
            postId: scheduledPostId,
            postUrl: scheduledPostUrl,
          });
          if (scheduledEmail && scrapeService.hasBadData(scrapeRecord)) {
            await sendMail(scheduledEmail, scrapeRecord);
          }
        } finally {
          if (typeof onScheduleStatusChange === "function") {
            onScheduleStatusChange();
          }
        }
      },
      {
        onRunComplete: async ({ scheduleId, remainingRuns }) => {
          if (!scheduleRepository) {
            return;
          }
          await scheduleRepository.updateSchedule(scheduleId, {
            lastRunAt: new Date().toISOString(),
            remainingRuns,
          });
        },
        onScheduleComplete: async ({ scheduleId }) => {
          if (!scheduleRepository) {
            return;
          }
          await scheduleRepository.updateSchedule(scheduleId, {
            status: "completed",
            remainingRuns: 0,
          });
        },
      },
    );
    if (scheduleRepository) {
      await scheduleRepository.saveActiveSchedule({
        id: scheduleResult.scheduleId,
        schedules,
        options: { postId, postUrl, email },
        startedAt: new Date(scheduleResult.baseTime).toISOString(),
      });
    }
    if (typeof onScheduleStatusChange === "function") {
      onScheduleStatusChange();
    }
    return scheduleResult;
  });
}
