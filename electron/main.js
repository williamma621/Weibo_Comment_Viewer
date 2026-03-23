import { app, BrowserWindow, session, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { fetchAllComments } from "../scraper/weiboApi.js";
import { convertPostId, formatComments, getDuplicateSummary } from "../scraper/helper.js"
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


ipcMain.handle("get-comments-pipeline", async (event, { postUrl }) => {  
  const MAX_RETRIES = 3;
  const urlParts = postUrl.match(/weibo\.com\/(\d+)\/([A-Za-z0-9]+)/);
  if (!urlParts) throw new Error("Invalid Weibo URL");
  const user_id = urlParts[1];       // "1742666164"
  const post_id = urlParts[2];       // "QqyVupk9l"
  const status_id = convertPostId(post_id);  // "5263307886035659"
  let authWin;
  let newCookie;


  [authWin, newCookie] = await getWeiboCredentials(postUrl)
  setTimeout(() => {

  }, 10000);

  const comments = await fetchAllComments({cookie: newCookie, sid: parseInt(status_id), uid: parseInt(user_id), authWin: null});
  console.log(newCookie, status_id, user_id)
  console.log("Scrape was Successful!")
  return getDuplicateSummary(formatComments(comments))

  // for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  //   try {
  //     // 1. Pull the cookie from the persistent store
  //     let sessionCookie = store.get('weibo_cookie');
  //     if (!sessionCookie) {
  //       [authWin, newCookie] = await getWeiboCredentials(postUrl); //Authwindow and Cookie
  //       store.set('weibo_cookie', newCookie); // Save it!
  //     }
      
  //     const comments = await fetchAllComments({cookie: sessionCookie, sid: parseInt(status_id), uid: parseInt(user_id), authWin: authWin});
  //     console.log(sessionCookie, status_id, user_id)
  //     console.log("Scrape was Successful!")
  //     return getDuplicateSummary(formatComments(comments))


  //   } catch (error) {
  //     if ( attempt < MAX_RETRIES ) {
  //       // Refresh and update the store on failure
  //       [authWin, newCookie] = await getWeiboCredentials(postUrl);
  //       store.set('weibo_cookie', newCookie); 
  //     } else {
  //       throw error;
  //     }
  //   }
  // }

})


ipcMain.handle("deepseek-analysis-pipeline", async(event, { comments, postUrl }) => {
  const deepseek_analyzed_comments = await analyzeSentiment(comments)
  const deepseek_keyword_summary = await summarizeKeywords(comments)
  console.log("Deepseek Analysis was Successful!")
  return [deepseek_analyzed_comments, deepseek_keyword_summary]
})




const DATA_PATH = path.join(app.getPath('userData'), 'scrapes');

ipcMain.handle("save-scrape", async(event, {postUrl, top_comments, comments, summary}) => {
  const payload = { 
    id: Date.now().toString(), // Use timestamp as a simple ID
    url: postUrl,
    top_comments: top_comments,
    comments: comments, 
    summary: summary,
    date: new Date().toISOString()
  };
  const filePath = path.join(DATA_PATH, `${payload.id}.json`);
  fs.writeFile(filePath, JSON.stringify(payload));
  console.log("File Write was Successful!")
  return payload.id
})


ipcMain.handle("get-saved-scrapes", async () => {
  try {
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
  await sendMail(email, JSON.parse(fs.readFile(filePath)));
  console.log("Send Mail was Successful!")
});


ipcMain.handle("start-schedule", async(event, {schedules, postUrl}) => {
  await startSchedule(schedules, postUrl);
})

app.whenReady().then(createWindow);



async function getWeiboCredentials(postUrl) {
  return new Promise((resolve) => {
    const authWin = new BrowserWindow({ width: 500, height: 600, title: "Log in to Weibo", autoHideMenuBar: true });

    authWin.loadURL(postUrl);

    // Monitor for successful login
    authWin.webContents.on('did-finish-load', async () => {
      const cookies = await session.defaultSession.cookies.get({ domain: '.weibo.com' });
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      // Weibo 'SUB' cookie is the typical indicator of a logged-in session
      if (cookieString.includes('SUB=')) {
        const url = authWin.webContents.getURL();
        
        resolve([authWin, cookieString]);
      }
    });
  });
}