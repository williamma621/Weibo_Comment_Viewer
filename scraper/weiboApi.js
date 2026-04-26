import axios from "axios";
import randomUseragent from "random-useragent";

const BASE = "https://weibo.com/ajax/statuses/buildComments";
const PRIMARY_PAGE_DELAY_MS = 1000;
const REPLY_PAGE_DELAY_MS = 600;
const REPLY_THREAD_DELAY_MS = 400;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function warmUpClient(client) {
  try {
    await client.get("https://weibo.com/");
  } catch {
    // Ignore warm-up failures and let the actual API call surface the problem.
  }
}

async function fetchRepliesForPrimary({
  client,
  primaryComment,
  uid,
  perPage = 20,
  maxPages = 200,
}) {
  const primaryId = primaryComment?.id || primaryComment?.idstr;
  if (!primaryId) {
    return [];
  }

  const totalExpected = primaryComment?.total_number;
  if (totalExpected === 0) {
    return [];
  }

  const params = {
    flow: 0,
    is_reload: 1,
    is_show_bulletin: 2,
    is_mix: 0,
    count: perPage,
    fetch_level: 1,
    max_id: 0,
    id: String(primaryId),
    uid,
  };

  const replies = [];

  for (let page = 1; page <= maxPages; page += 1) {
    try {
      const response = await client.get(BASE, { params });
      const data = response.data;
      if (data.ok === -100) {
        throw new Error("Invalid Cookie");
      }

      const pageReplies = data.data || [];
      replies.push(...pageReplies);

      const nextMaxId = data.max_id;
      if (!pageReplies.length || !nextMaxId) {
        break;
      }

      params.max_id = nextMaxId;
      await sleep(REPLY_PAGE_DELAY_MS);
    } catch (error) {
      console.warn(
        `[WARN] reply fetch failed for primary ${primaryId} page ${page}: ${error.message}`,
      );
      break;
    }
  }

  return replies;
}

export async function fetchAllComments({ cookie, sid, uid, maxPages = 30, authWin }) {
  let ua;
  if (authWin) {
    ua = authWin.webContents.getUserAgent();
  } else {
    ua = randomUseragent.getRandom();
  }

  const client = axios.create({
    headers: {
      "User-Agent": ua,
      Accept: "application/json, text/plain, */*",
      Referer: "https://weibo.com/",
      Cookie: cookie,
      Connection: "keep-alive",
    },
    timeout: 15000,
  });

  await warmUpClient(client);

  const params = {
    flow: 0,
    is_reload: 1,
    is_show_bulletin: 2,
    is_mix: 0,
    count: 20,
    fetch_level: 0,
    max_id: 0,
    id: sid,
    uid,
  };

  const allComments = [];

  try {
    for (let page = 1; page <= maxPages; page += 1) {
      const response = await client.get(BASE, { params });
      const data = response.data;
      if (data.ok === -100) {
        throw new Error("Invalid Cookie");
      }

      const comments = data.data || [];
      allComments.push(...comments);
      const nextMaxId = data.max_id;
      console.log(`[primary] page=${page} got=${comments.length} next_max_id=${nextMaxId}`);
      if (!comments.length || !nextMaxId) {
        break;
      }
      params.max_id = nextMaxId;
      await sleep(PRIMARY_PAGE_DELAY_MS);
    }

    const commentsWithReplies = allComments.filter((comment) => (comment?.total_number || 0) > 0);
    console.log(
      `[replies] ${commentsWithReplies.length}/${allComments.length} primary comments have replies; fetching...`,
    );

    let fetchedReplyThreads = 0;
    for (const comment of allComments) {
      const totalExpected = comment?.total_number || 0;
      if (totalExpected === 0) {
        comment._all_replies = [];
        continue;
      }

      comment._all_replies = await fetchRepliesForPrimary({
        client,
        primaryComment: comment,
        uid,
      });
      fetchedReplyThreads += 1;

      if (fetchedReplyThreads % 20 === 0) {
        console.log(
          `[replies] fetched ${fetchedReplyThreads}/${commentsWithReplies.length} reply threads`,
        );
      }

      await sleep(REPLY_THREAD_DELAY_MS);
    }

    console.log(`[replies] done. Fetched ${fetchedReplyThreads} reply threads.`);
    return allComments;
  } finally {
    if (authWin) {
      authWin.close();
    }
  }
}

