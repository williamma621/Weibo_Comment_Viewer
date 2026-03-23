const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  loginWeibo: () => ipcRenderer.invoke("login-weibo"),
  getCommentsPipeline: (data) => ipcRenderer.invoke("get-comments-pipeline", data),
  deepseekAnalysisPipeline: (data) => ipcRenderer.invoke("deepseek-analysis-pipeline", data),
  saveScrape: (data) => ipcRenderer.invoke("save-scrape", data),
  getSavedScrapes: (data) => ipcRenderer.invoke("get-saved-scrapes", data),
  getScrapeById: (data) => ipcRenderer.invoke("get-scrape-by-id", data),
  sendMail: (data) => ipcRenderer.invoke("send-mail", data),
  setSchedule: (data) => ipcRenderer.invoke("start-schedule", data),
});
