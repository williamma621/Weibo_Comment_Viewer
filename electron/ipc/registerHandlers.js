export function registerIpcHandlers({
  ipcMain,
  loginUrl,
  authService,
  scrapeService,
  scrapeRepository,
  schedulePatternRepository,
  sendMail,
  startSchedule,
  getWeiboCredentials,
}) {
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

  ipcMain.handle("start-schedule", async (event, { schedules, postUrl, email }) => {
    return startSchedule(
      schedules,
      { postUrl, email },
      async ({ postUrl: scheduledPostUrl, email: scheduledEmail }) => {
        const scrapeRecord = await scrapeService.runFullScrapePipeline({ postUrl: scheduledPostUrl });
        if (scheduledEmail && scrapeService.hasBadData(scrapeRecord)) {
          await sendMail(scheduledEmail, scrapeRecord);
        }
      },
    );
  });
}
