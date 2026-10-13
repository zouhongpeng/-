/**
 * DeepSeek 大模型接入服务（OpenAI 兼容接口）
 * - 文本分析：model=deepseek-chat
 * - 截图识别：model=deepseek-chat + 视觉输入（multimodal），失败时由调用方降级手动粘贴
 * 仅后端使用，读取 DEEPSEEK_API_KEY，前端零密钥。
 */
import crypto from "crypto";

const BASE_URL = "https://api.deepseek.com/v1/chat/completions";
const TIMEOUT_MS = 30000; // 30s 超时
const MAX_RETRY = 1; // 超时/失败重试 1 次

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY 未配置");
  return key;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface DeepSeekResult {
  content: string;
}

async function request(messages: ChatMessage[], temperature = 0.8): Promise<DeepSeekResult> {
  const key = getApiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature,
        stream: false,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DeepSeek ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = (data as any)?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("DeepSeek 返回格式异常");
    return { content };
  } finally {
    clearTimeout(timer);
  }
}

/** 带重试的调用 */
async function requestWithRetry(messages: ChatMessage[], temperature = 0.8): Promise<DeepSeekResult> {
  let lastErr: unknown;
  for (let i = 0; i <= MAX_RETRY; i++) {
    try {
      return await request(messages, temperature);
    } catch (e) {
      lastErr = e;
      if (i < MAX_RETRY) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  throw lastErr;
}

/** 文本对话 */
export async function chat(
  system: string,
  user: string,
  temperature = 0.8,
): Promise<DeepSeekResult> {
  return requestWithRetry(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature,
  );
}

/** 视觉识别（截图转文字并分离说话人）；调用方需自行捕获异常做降级 */
export async function recognizeImage(system: string, user: string, imageDataUri: string): Promise<string> {
  const result = await requestWithRetry(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: user },
          { type: "image_url", image_url: { url: imageDataUri } },
        ],
      },
    ],
    0.3,
  );
  return result.content;
}

/** 从 AI 文本中安全提取 JSON（容忍 markdown 代码块围栏） */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // 尝试直接解析
  try {
    return JSON.parse(trimmed);
  } catch {
    // 忽略
  }
  // 去掉 markdown ```json ``` 围栏
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      // 忽略
    }
  }
  // 提取第一个 { ... } 块
  const brace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (brace >= 0 && lastBrace > brace) {
    try {
      return JSON.parse(trimmed.slice(brace, lastBrace + 1));
    } catch {
      // 忽略
    }
  }
  return null;
}

/** 生成简单的幂等非敏感跟踪 id（内部日志用） */
export function genId(): string {
  return crypto.randomBytes(8).toString("hex");
}