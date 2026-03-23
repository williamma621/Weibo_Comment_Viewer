import OpenAI from "openai";
import { getDeepseekConfig } from "./appConfig.js";

let client;

function getClient() {
  if (!client) {
    const config = getDeepseekConfig();
    client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  return client;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function analyzeSentimentBatch({
  batch,
  offset,
  textCol,
  maxRetries,
  model,
  systemPrompt,
}) {
  const payload = batch.map((item, index) => ({
    i: offset + index,
    text: item[textCol],
  }));

  const userMsg = `请对以下评论逐条进行情感判断，JSON 格式：{"results": [{"i": 0, "label": "POS|NEG|MIXED", "confidence": 0.9}]}. 评论：${JSON.stringify(payload)}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      });

      const resultJson = JSON.parse(response.choices[0].message.content);
      return Array.isArray(resultJson.results) ? resultJson.results : [];
    } catch (error) {
      console.error(`Sentiment batch starting at ${offset} attempt ${attempt + 1} failed:`, error.message);
      if (attempt < maxRetries - 1) {
        await sleep(1500 * Math.pow(2, attempt));
      }
    }
  }

  return batch.map((_, index) => ({
    i: offset + index,
    label: "MIXED",
    confidence: 0.5,
  }));
}

async function processWithConcurrency(tasks, concurrency, worker) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(tasks[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}

export async function analyzeSentiment(
  data,
  {
    textCol = "comment",
    rowsPerRequest = 100,
    concurrency = 3,
    maxRetries = 5,
    model = "deepseek-chat",
    existingResults = [],
  } = {},
) {
  const SYSTEM_PROMPT = `你是中文微博评论的情感分析器。判断情感倾向，只能输出：POS, NEG, MIXED。输出严格 JSON。`;

  // Clone data to avoid mutating original
  let processedData = [...data];
  const existingResultMap = new Map(
    existingResults
      .filter((item) => item?.[textCol] && item?.sentiment && item?.confidence !== undefined)
      .map((item) => [
        item[textCol],
        { sentiment: item.sentiment, confidence: item.confidence },
      ]),
  );

  const pendingRows = [];

  processedData = processedData.map((item) => {
    const existingMatch = existingResultMap.get(item[textCol]);
    if (existingMatch) {
      return {
        ...item,
        sentiment: existingMatch.sentiment,
        confidence: existingMatch.confidence,
      };
    }

    pendingRows.push(item);
    return item;
  });

  if (pendingRows.length === 0) {
    return processedData;
  }

  const batches = chunkArray(pendingRows, rowsPerRequest);
  const batchResults = await processWithConcurrency(
    batches,
    concurrency,
    (batch, batchIndex) =>
      analyzeSentimentBatch({
        batch,
        offset: batchIndex * rowsPerRequest,
        textCol,
        maxRetries,
        model,
        systemPrompt: SYSTEM_PROMPT,
      }),
  );

  const analyzedRows = [...pendingRows];
  batchResults.flat().forEach((res) => {
    if (analyzedRows[res.i]) {
      analyzedRows[res.i].sentiment = res.label;
      analyzedRows[res.i].confidence = res.confidence;
    }
  });

  const analyzedResultMap = new Map(
    analyzedRows.map((item) => [
      item[textCol],
      { sentiment: item.sentiment, confidence: item.confidence },
    ]),
  );

  return processedData.map((item) => {
    const analyzedMatch = analyzedResultMap.get(item[textCol]);
    return analyzedMatch
      ? {
          ...item,
          sentiment: analyzedMatch.sentiment,
          confidence: analyzedMatch.confidence,
        }
      : item;
  });
}


export async function summarizeKeywords(commentsData, model = "deepseek-chat") {


  const comments = commentsData.map(item => String(item.comment || ""));

  const SYSTEM_PROMPT = `你是中文社交媒体评论分析助手。
  任务：从给定评论中提炼最重要的3个关键词，并为每个关键词挑选3条最能代表该关键词的原始评论（逐字引用）。
  要求：
  - 只输出 JSON（不要输出任何额外文字）
  - keywords 必须恰好 3 个
  - 每个 keyword 的 supporting_comments 必须恰好 3 条，且必须来自输入评论原文（逐字）
  - summary 用中文，不超过两句话
  - 关键词要尽量是“主题/实体/概念词”，避免过于泛化（如“感觉”“东西”）`;

  const userMsg = `请从以下评论中提炼关键词并给出例句。
  输出严格 JSON，格式必须为：
  {
    "keywords": [
      {"keyword": "xxx", "supporting_comments": ["原始评论1","原始评论2","原始评论3"]},
      {"keyword": "yyy", "supporting_comments": ["...","...","..."]},
      {"keyword": "zzz", "supporting_comments": ["...","...","..."]}
    ],
    "summary": "两句话以内"
  }

  注意：supporting_comments 必须逐字来自输入评论，不要改写。

  评论列表：${JSON.stringify(comments)}`;

  try {
    const response = await getClient().chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      temperature: 0,
      // Note: Ensure the provider supports response_format: { type: "json_object" }
      response_format: { type: "json_object" },
    });

    // In JS, we parse the string content back into an object
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error calling the LLM:", error);
    throw error;
  }
}
