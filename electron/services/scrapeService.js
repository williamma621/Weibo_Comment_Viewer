import { fetchAllComments } from "../../scraper/weiboApi.js";
import {
  convertPostId,
  formatComments,
  formatTopComments,
  getDuplicateSummary,
  mergeAnalysisByComment,
} from "../../scraper/helper.js";
import { summarizeKeywords, analyzeSentiment } from "../../scraper/deepseekApi.js";

export function createScrapeService({
  authService,
  scrapeRepository,
}) {
  async function runCommentScrape(postUrl) {
    const maxRetries = 3;
    const urlParts = postUrl.match(/weibo\.com\/(\d+)\/([A-Za-z0-9]+)/);
    if (!urlParts) {
      throw new Error("Invalid Weibo URL");
    }

    const userId = urlParts[1];
    const postId = urlParts[2];
    const statusId = convertPostId(postId);

    let sessionCookie = await authService.getWeiboCookieFromSession();
    if (!sessionCookie) {
      sessionCookie = authService.getStoredCookie();
    }

    if (!sessionCookie) {
      throw new Error("Please log in to Weibo first.");
    }

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const comments = await fetchAllComments({
          cookie: sessionCookie,
          sid: Number.parseInt(statusId, 10),
          uid: Number.parseInt(userId, 10),
          authWin: null,
        });

        authService.saveWeiboCookie(sessionCookie);
        return {
          comments: getDuplicateSummary(formatComments(comments)),
          topComments: formatTopComments(comments),
        };
      } catch (error) {
        lastError = error;
        console.error(`runCommentScrape attempt ${attempt} failed:`, error.message);

        const refreshedCookie = await authService.getWeiboCookieFromSession();
        if (refreshedCookie && refreshedCookie !== sessionCookie) {
          sessionCookie = refreshedCookie;
          authService.saveWeiboCookie(sessionCookie);
          continue;
        }

        const storedCookie = authService.getStoredCookie();
        if (storedCookie && storedCookie !== sessionCookie) {
          sessionCookie = storedCookie;
          continue;
        }
      }
    }

    throw lastError || new Error("Failed to scrape Weibo comments after multiple attempts.");
  }

  async function analyzeCommentsForPost(comments, postUrl) {
    const previousScrape = await scrapeRepository.getLatestScrapeForUrl(postUrl);
    const [analyzedComments, keywordSummary] = await Promise.all([
      analyzeSentiment(comments, { existingResults: previousScrape?.comments || [] }),
      summarizeKeywords(comments),
    ]);

    return [analyzedComments, keywordSummary];
  }

  async function runFullScrapePipeline({ postUrl }) {
    const { comments: rawComments, topComments: rawTopComments } = await runCommentScrape(postUrl);
    const [comments, summary] = await analyzeCommentsForPost(rawComments, postUrl);
    const topComments = mergeAnalysisByComment(rawTopComments, comments);

    return scrapeRepository.saveScrapeRecord({
      postUrl,
      comments,
      summary,
      top_comments: topComments,
    });
  }

  function hasBadData(scrapeRecord) {
    return scrapeRecord.comments.some((comment) => comment.sentiment && comment.sentiment !== "POS");
  }

  return {
    runCommentScrape,
    analyzeCommentsForPost,
    runFullScrapePipeline,
    hasBadData,
  };
}
