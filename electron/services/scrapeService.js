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

  async function runFullScrapePipeline({ postUrl, overwriteExisting = false }) {
    const { comments: rawComments, topComments: rawTopComments } = await runCommentScrape(postUrl);
    const [comments, summary] = await analyzeCommentsForPost(rawComments, postUrl);
    const topComments = mergeAnalysisByComment(rawTopComments, comments);

    const saveScrape = overwriteExisting
      ? scrapeRepository.saveLatestScrapeForUrl
      : scrapeRepository.saveScrapeRecord;

    return saveScrape({
      postUrl,
      comments,
      summary,
      top_comments: topComments,
    });
  }

  function buildAnalysisMaps(existingComments) {
    const sentimentMap = new Map();
    existingComments.forEach((item) => {
      if (item?.comment && item.sentiment && item.confidence !== undefined) {
        sentimentMap.set(item.comment, {
          sentiment: item.sentiment,
          confidence: item.confidence,
        });
      }
    });
    return sentimentMap;
  }

  function mergeSentimentResults(comments, existingMap, newMap) {
    return comments.map((item) => {
      const fresh = newMap.get(item.comment);
      if (fresh) {
        return { ...item, sentiment: fresh.sentiment, confidence: fresh.confidence };
      }
      const previous = existingMap.get(item.comment);
      if (previous) {
        return { ...item, sentiment: previous.sentiment, confidence: previous.confidence };
      }
      return item;
    });
  }

  async function runScheduledScrapePipeline({ postId, postUrl }) {
    const baseScrape = postId ? await scrapeRepository.getScrapeById(postId).catch(() => null) : null;
    const targetUrl = baseScrape?.url || postUrl;
    if (!targetUrl) {
      throw new Error("Missing post URL for scheduled scrape.");
    }

    const { comments: rawComments, topComments: rawTopComments } = await runCommentScrape(targetUrl);
    const existingMap = buildAnalysisMaps(baseScrape?.comments || []);

    const newComments = rawComments.filter((item) => !existingMap.has(item.comment));
    const analyzedNew = newComments.length > 0
      ? await analyzeSentiment(newComments, { existingResults: [] })
      : [];
    const newMap = buildAnalysisMaps(analyzedNew);

    const comments = mergeSentimentResults(rawComments, existingMap, newMap);
    const summary = newComments.length > 0
      ? await summarizeKeywords(newComments)
      : baseScrape?.summary || null;

    const topComments = mergeAnalysisByComment(rawTopComments, comments);

    if (baseScrape?.id) {
      return scrapeRepository.saveScrapeById({
        id: baseScrape.id,
        postUrl: targetUrl,
        comments,
        summary,
        top_comments: topComments,
      });
    }

    return scrapeRepository.saveLatestScrapeForUrl({
      postUrl: targetUrl,
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
    runScheduledScrapePipeline,
    hasBadData,
  };
}
