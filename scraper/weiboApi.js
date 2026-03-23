import axios from "axios";
import randomUseragent from "random-useragent";
const BASE = "https://weibo.com/ajax/statuses/buildComments";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAllComments({ cookie, sid, uid, maxPages = 30, authWin}) {
  console.log(1)
  let ua;
  if(authWin) ua = authWin.webContents.getUserAgent();
  else {ua =  randomUseragent.getRandom();}
  console.log(3)
  const client = axios.create({
    headers: { "User-Agent": ua,"Accept": "application/json, text/plain, */*",
      "Referer": "https://weibo.com/", "Cookie": cookie, "Connection": "keep-alive"}, timeout: 15000,});
  console.log(4)
  // Warm up
  await client.get("https://weibo.com/");

  let params = { flow: 1, is_reload: 1, is_show_bulletin: 2,
    is_mix: 0, count: 20, fetch_level: 0, max_id: 0,
    id: sid, uid: uid,
  };

  let allComments = [];


  for (let page = 1; page <= maxPages; page++) {
    const response = await client.get(BASE, { params });
    const data = response.data;
    if (data.ok === -100) { throw new Error("Invalid Cookie"); }

    const comments = data.data || [];
    allComments.push(...comments);
    const nextMaxId = data.max_id;
    console.log(`page=${page} got=${comments.length} next_max_id=${nextMaxId}`);
    if (!comments.length || !nextMaxId) {break;}
    params.max_id = nextMaxId;
    await sleep(100); // 0.1 second delay
  }
  if(authWin) authWin.close();

  return allComments;
}



