import OpenAI from "openai";

// Initialize client (Replace with your actual key and DeepSeek base URL)
const client = new OpenAI({
  apiKey: "sk-c5a612559dd34d3bad39a081efc08374",
  baseURL: "https://api.deepseek.com", 
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function analyzeSentiment(data, textCol = "comment", rowsPerRequest = 50) {
  const n = data.length;
  const SYSTEM_PROMPT = `你是中文微博评论的情感分析器。判断情感倾向，只能输出：POS, NEG, MIXED。输出严格 JSON。`;

  // Clone data to avoid mutating original
  let processedData = [...data];

  for (let start = 0; start < n; start += rowsPerRequest) {
    const end = Math.min(start + rowsPerRequest, n);
    const batch = data.slice(start, end);

    // Prepare payload
    const payload = batch.map((item, index) => ({
      i: start + index,
      text: item[textCol]
    }));

    const userMsg = `请对以下评论逐条进行情感判断，JSON 格式：{"results": [{"i": 0, "label": "POS|NEG|MIXED", "confidence": 0.9}]}. 评论：${JSON.stringify(payload)}`;

    let success = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMsg },
          ],
          response_format: { type: "json_object" },
          temperature: 0,
        });

        const resultJson = JSON.parse(response.choices[0].message.content);

        // Merge results back into our objects
        resultJson.results.forEach((res) => {
          processedData[res.i].sentiment = res.label;
          processedData[res.i].confidence = res.confidence;
        });

        success = true;
        break; // Success! Exit retry loop
      } catch (error) {
        console.error(`Attempt ${attempt + 1} failed:`, error.message);
        if (attempt === 4) {
          // Final failure: set defaults
          for (let i = start; i < end; i++) {
            processedData[i].sentiment = "MIXED";
            processedData[i].confidence = 0.5;
          }
        } else {
          await sleep(1500 * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }
  }
  return processedData;
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
    const response = await client.chat.completions.create({
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