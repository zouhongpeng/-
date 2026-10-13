import crypto from "crypto";

/**
 * 匿名化处理器：任何发送给 AI 的内容必须经过本模块。
 * - 把人物真实称呼替换为 "对方"
 * - 数字中可能的个人信息（手机号、QQ、金额等）打码
 */
const REAL_NAME_REGEX = /[一-龥A-Za-z0-9]{1,6}/g;
const PHONE_REGEX = /\b1[3-9]\d{9}\b/g;
const QQ_REGEX = /\b\d{5,11}\b/g;
const ID_REGEX = /\b\d{17}[\dXx]\b/g;

/** 将人物真实称呼替换为 "对方" */
export function maskPersonName(text: string, personName: string): string {
  if (!personName) return text;
  // 使用中文括号包裹名字模式，防止误伤普通词；保留原字符边界
  const escaped = personName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = text;
  // 先整词精确替换
  out = out.replace(new RegExp(escaped, "g"), "对方");
  return out;
}

/** 打码数字中的个人信息（手机号、QQ/长数字、身份证） */
export function maskNumbers(text: string): string {
  return text
    .replace(ID_REGEX, "***************")
    .replace(PHONE_REGEX, "***********")
    .replace(QQ_REGEX, "****");
}

/** 完整匿名化管道：先姓名，再数字 */
export function anonymize(text: string, personName: string): string {
  if (!text) return text;
  let out = maskPersonName(text, personName);
  out = maskNumbers(out);
  return out;
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}