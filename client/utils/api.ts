/**
 * 后端 API 封装（前端零密钥）
 * 所有请求统一带 x-pin-token header
 */
const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

let pinToken: string | null = null;

export function setPinToken(t?: string | null) {
  pinToken = t ?? null;
}
export function getPinToken() {
  return pinToken;
}

async function request<T = any>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {};
  const url = `${BASE_URL}${path}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (pinToken) headers["x-pin-token"] = pinToken;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({ code: res.status, msg: "服务器响应异常" }));
  if (!res.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.msg || `请求失败(${res.status})`);
  }
  return json.data as T;
}

export const api = {
  base: BASE_URL,

  // ===== PIN =====
  pinStatus: () => request<{ initialized: boolean }>("GET", "/api/v1/pin/status"),
  pinSetup: (pin: string) =>
    request<{ token: string; growth_mode: string }>("POST", "/api/v1/pin/setup", { pin }),
  pinUnlock: (pin: string) =>
    request<{ token: string; growth_mode: string }>("POST", "/api/v1/pin/unlock", { pin }),

  // ===== People =====
  people: () => request<any[]>("GET", "/api/v1/people"),
  person: (id: string) => request<any>("GET", `/api/v1/people/${id}`),
  createPerson: (data: any) => request<any>("POST", "/api/v1/people", data),
  updatePerson: (id: string, data: any) => request<any>("PUT", `/api/v1/people/${id}`, data),
  deletePerson: (id: string) => request<any>("DELETE", `/api/v1/people/${id}`),

  // ===== Analysis =====
  analyze: (data: any) =>
    request<any>(
      "POST",
      "/api/v1/analyze",
      data
    ),
  analysis: (id: string) => request<any>("GET", `/api/v1/analysis/${id}`),
  markSuggestion: (id: string, index: number, used: boolean) =>
    request<any>("PUT", `/api/v1/analysis/${id}/mark`, { index, used }),
  deleteAnalysis: (id: string) => request<any>("DELETE", `/api/v1/analysis/${id}`),

  // ===== Timeline / Temperature =====
  personAnalyses: (personId: string) =>
    request<any[]>("GET", `/api/v1/people/${personId}/analyses`),
  personTemperatures: (personId: string) =>
    request<any[]>("GET", `/api/v1/people/${personId}/temperatures`),

  // ===== Screenshot =====
  recognize: async (formData: FormData) =>
    fetch(`${api.base}/api/v1/recognize`, {
      method: "POST",
      headers: pinToken ? { "x-pin-token": pinToken } : {},
      body: formData,
    }).then(async (r) => {
      const json = await r.json().catch(() => ({ code: r.status, msg: "识别失败" }));
      if (!r.ok) throw new Error(json.msg || "识别失败");
      return json.data as { messages: { speaker: string; text: string }[] };
    }),

  // ===== Reports =====
  reports: () => request<any[]>("GET", "/api/v1/reports"),
  generateReport: () =>
    request<{ id: string; content: any }>("POST", "/api/v1/reports/generate"),

  // ===== Settings =====
  settings: () => request<{ growth_mode: string }>("GET", "/api/v1/settings"),
  setMode: (mode: string) =>
    request<{ growth_mode: string }>("PUT", "/api/v1/settings/mode", { mode }),
  updateSettings: async (data: { growth_mode?: string; pin?: string }) => {
    // 后端分开两个接口：growth_mode 走 /settings/mode，pin 变更走 pin/setup（已解锁态下允许改）
    if (data.growth_mode !== undefined) {
      return request("PUT", "/api/v1/settings/mode", { mode: data.growth_mode });
    }
    if (data.pin !== undefined) {
      return request("POST", "/api/v1/pin/setup", { pin: data.pin });
    }
    return null;
  },

  // ===== Dates =====
  upcomingDates: () => request<any[]>("GET", "/api/v1/dates/upcoming"),
};