import { fetchAllComments } from "../scraper/weiboApi.js";
import { convertPostId, formatComments, getDuplicateSummary } from "../scraper/helper.js"

const activeSchedules = new Map(); // Tracks running schedules by ID

export function startSchedule(scheduleArray, postUrl) {
    // 1. Convert the schedule objects into a flat list of "ticks"
    let executionTimes = [];

    scheduleArray.forEach(segment => {
        const start = parseInt(segment.startTime);
        const end = parseInt(segment.endTime);
        const freq = parseInt(segment.frequency);
        const unit = segment.unit || "minutes"; // Default to minutes if missing
        
        // Multiplier to convert units to milliseconds
        const msMultiplier = unit === "minutes" ? 60000 : 1000;

        for (let t = start + freq; t <= end; t += freq) {
            executionTimes.push({
                timeInMs: t * msMultiplier,
                id: segment.id
            });
        }
    });

    // 2. Sort by time (just in case)
    executionTimes.sort((a, b) => a.timeInMs - b.timeInMs);

    // 3. Recursive Runner
    const startTime = Date.now();

    function runNext() {
        if (executionTimes.length === 0) {
            console.log(`Schedule ${scheduleArray[0].id} finished.`);
            activeSchedules.delete(scheduleArray[0].id);
            return;
        }

        const nextTask = executionTimes.shift();
        const targetTime = startTime + nextTask.timeInMs;
        const delay = targetTime - Date.now();

        const timerId = setTimeout(() => {
            performScrape(postUrl);
            runNext(); // Schedule the next tick
        }, Math.max(0, delay));

        // Store timer so we can cancel it if needed
        activeSchedules.set(nextTask.id, timerId);
    }

    runNext();
}

async function performScrape (postUrl){
  const MAX_RETRIES = 3;
  const urlParts = postUrl.match(/weibo\.com\/(\d+)\/([A-Za-z0-9]+)/);
  if (!urlParts) throw new Error("Invalid Weibo URL");
  const user_id = urlParts[1];       // "1742666164"
  const post_id = urlParts[2];       // "QqyVupk9l"
  const status_id = convertPostId(post_id);  // "5263307886035659"
  let authWin;
  let newCookie

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // 1. Pull the cookie from the persistent store
      let sessionCookie = store.get('weibo_cookie');
      if (!sessionCookie) {
        [authWin, newCookie] = await getWeiboCredentials(postUrl); //Authwindow and Cookie
        store.set('weibo_cookie', newCookie); // Save it!
      }
      
      const comments = await fetchAllComments({cookie: sessionCookie, sid: parseInt(status_id), uid: parseInt(user_id), authWin: authWin});
      console.log("Scrape was Successful!")
      return getDuplicateSummary(formatComments(comments))


    } catch (error) {
      if ( attempt < MAX_RETRIES ) {
        // Refresh and update the store on failure
        [authWin, newCookie] = await getWeiboCredentials(postUrl);
        store.set('weibo_cookie', newCookie); 
      } else {
        throw error;
      }
    }
  }
}