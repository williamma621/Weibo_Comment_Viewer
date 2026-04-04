import fs from "node:fs";
import path from "node:path";

const DEFAULT_ENV_PATH = path.resolve(process.cwd(), ".env");
const ENV_FILE_PATH = process.env.WEIBO_ENV_PATH
  ? path.resolve(process.env.WEIBO_ENV_PATH)
  : DEFAULT_ENV_PATH;

loadDotEnvFile();

function loadDotEnvFile() {
  if (!fs.existsSync(ENV_FILE_PATH)) {
    return;
  }

  const contents = fs.readFileSync(ENV_FILE_PATH, "utf8");
  contents.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const normalizedValue = rawValue.replace(/^['"]|['"]$/g, "");

    if (key && !process.env[key]) {
      process.env[key] = normalizedValue;
    }
  });
}

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readOptionalEnv(name, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

export function getDeepseekConfig() {
  return {
    apiKey: readRequiredEnv("DEEPSEEK_API_KEY"),
    baseURL: readOptionalEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
  };
}

export function getMailConfig() {
  return {
    service: readOptionalEnv("SMTP_SERVICE", "gmail"),
    user: readRequiredEnv("SMTP_USER"),
    pass: readRequiredEnv("SMTP_PASS"),
    from: readOptionalEnv("MAIL_FROM", process.env.SMTP_USER || ""),
  };
}
