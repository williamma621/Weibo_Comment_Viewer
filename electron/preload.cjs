const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  loginWeibo: () => ipcRenderer.invoke("login-weibo"),
  getCommentsPipeline: (data) => ipcRenderer.invoke("get-comments-pipeline", data),
  deepseekAnalysisPipeline: (data) => ipcRenderer.invoke("deepseek-analysis-pipeline", data),
  saveScrape: (data) => ipcRenderer.invoke("save-scrape", data),
  deleteScrape: (data) => ipcRenderer.invoke("delete-scrape", data),
  getSavedScrapes: (data) => ipcRenderer.invoke("get-saved-scrapes", data),
  getScrapeById: (data) => ipcRenderer.invoke("get-scrape-by-id", data),
  sendMail: (data) => ipcRenderer.invoke("send-mail", data),
  saveSchedulePattern: (data) => ipcRenderer.invoke("save-schedule-pattern", data),
  getSavedSchedulePatterns: () => ipcRenderer.invoke("get-saved-schedule-patterns"),
  setSchedule: (data) => ipcRenderer.invoke("start-schedule", data),
  getActiveSchedules: () => ipcRenderer.invoke("get-active-schedules"),
  stopSchedule: (scheduleId) => ipcRenderer.invoke("stop-schedule", scheduleId),
});
