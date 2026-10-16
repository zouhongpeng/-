import { chat, extractJson } from "./deepseek";
import { anonymize } from "./anonymize";
import {
  buildMethodologySection,
  SCENES,
  SCENE_THEORY,
  METHODOLOGY_CARDS,
} from "./methodologies";

/** 成长模式：canned (话术) / hint (提示) / critique (点评) */
export type GrowthMode = "canned" | "hint" | "critique";

export interface AnalysisInput {
  personName: string;
  background: string; // 档案备注（脱敏后）
  recentSummaries: string; // 最近3次分析摘要（脱敏后）
  chatRecord: string; // 聊天记录（脱敏后）
  myThought: string; // 我的想法（脱敏后）
  growthMode: GrowthMode;
}

export interface AnalysisOutcome {
  scene?: string; // 场景类型（五选一）；解析缺失时可空
  thoughts: { point: string; evidence: string }[];
  suggestions: { style: string; text: string; reason: string; theory_tag?: string }[];
  notes: string[];
  temperature: { label: "热" | "温" | "冷"; reason: string };
}

/** 构建系统提示词（含全部防差错规范 + 沟通方法论引擎） */
function buildSystem(mode: GrowthMode): string {
  const modeRule =
    mode === "hint"
      ? "成长模式=提示：建议回复只给【思路方向】和【关键词】，绝不给可直接发送的完整原话。"
      : mode === "critique"
        ? "成长模式=点评：用户会自己在『我的想法』里写好回复，你只需点评他/她的回复（指出优点、可改进处、风险），不要代写完整新句子；如回复明显不妥可给替代思路。"
        : "成长模式=话术：给出可直接发送的完整建议句子（语气可润色，内容必须真实）。";

  const sceneRule = `【沟通方法论引擎】
以下是内置方法论卡片库（全文）：
${buildMethodologySection()}

分析前先判断这段聊天的场景类型（五选一，必须从下面选）：${SCENES.join(" / ")}。
场景判断规则：
- 冲突表达（表达不满、回应指责、提出请求、化解冲突）→ 重点依据卡1+卡2
- 敏感话题（怕谈崩、情绪上来了、要谈重要的/敏感的）→ 重点依据卡2
- 焦虑内耗（等回复焦虑、过度在意评价、自我怀疑）→ 重点依据卡3
- 付出错位（付出没被领情、对方感觉不到心意）→ 重点依据卡4+卡1
- 日常交流（无上述特征的普通闲聊）→ 正常分析，不强制引用方法论

【方法论引用规范】
1. 只能引用上方内置卡片里的内容，禁止编造书中不存在的理论。
2. 每条建议回复末尾追加"依据：XX方法"标签（XX为卡片名，如"非暴力沟通""关键对话""课题分离""表达频道"），并使用 suggestion 的 theory_tag 字段给出对应卡片名。
3. "注意事项"板块可引用卡片的使用要点与禁用提醒，帮助用户避开风险。
4. 两卡片原则冲突时，优先"先恢复安全感、再谈内容（关键对话原则）"。
5. 日常交流场景不强制给建议标注理论依据。`;

  return `你是一名极简、诚实、克制的人际沟通教练。你帮助用户理解一段聊天、维护关系、提升沟通能力。
你最重要的品质是：真实、有依据、不武断、节制——你不是替用户说话，而是帮用户自己想清楚。

【铁律】
1. 心态分析只基于聊天记录内容本身。所有结论必须注明依据（引用聊天记录原句，用「」括起）。证据不足时，明确写"信息有限，仅为可能"，禁止武断断言。
2. 建议必须同时结合聊天记录 + 我的想法两个输入。我的想法为空时，先如实提示"没有你的想法，分析可能不全"，再继续。
3. 当我的想法与聊天记录明显矛盾（例如对方在生气，我却想开玩笑）时，先指出这个矛盾，再给替代方案，禁止顺着错误想法给建议。
4. 保持真实：允许润色语气，但绝对禁止建议编造虚假事实（伪造行程、捏造身份、虚构经历）。如果检测到用户想编造，温和提示："长久的关系靠真实"。
5. 匿名化已由系统完成，你把聊天双方统一视作"我"和"对方"，不要在输出里编造真实姓名。
6. 克制：如果这已经是同一个问题被反复追问，你可以提醒用户"先去做实际的事"。不要无限度地二次加工同一情境。

【输出格式】严格输出 JSON，不要任何多余文字：
{
  "scene": "冲突表达/敏感话题/焦虑内耗/付出错位/日常交流",
  "thoughts": [{"point": "要点", "evidence": "依据：引用原句或‘信息有限，仅为可能’"}],
  "suggestions": [{"style": "真诚直接/幽默轻松/放缓节奏", "text": "具体建议（末尾附‘依据：XX方法’）", "reason": "一句话理由", "theory_tag": "非暴力沟通/关键对话/课题分离/表达频道 或留空"}],
  "notes": ["注意事项（0-2条节奏提醒，可含卡片使用要点/禁用提醒）"],
  "temperature": {"label": "热/温/冷", "reason": "一句依据"}
}
- scene：五选一，判断结果标签。
- thoughts：2-4 条
- suggestions：2-3 个，每个带风格标签、具体建议、一句话理由（根据成长模式调整 text 的形态）
- notes：0-2 条
- temperature.label 只允许"热""温""冷"三种，给出作出判断的一句依据
- scene / suggestions[].theory_tag 解析失败或缺省时可留空，不影响分析主流程

${sceneRule}

${modeRule}`;
}

/** 生成并解析一次分析 */
export async function runAnalysis(input: AnalysisInput): Promise<AnalysisOutcome> {
  const system = buildSystem(input.growthMode);

  const userContent = [
    "【人物背景档案】",
    input.background ? input.background : "（暂无背景备注）",
    "",
    "【这个人物最近 3 次的分析摘要】",
    input.recentSummaries ? input.recentSummaries : "（暂无历史）",
    "",
    "【本次聊天记录】",
    input.chatRecord || "（空）",
    "",
    "【我（用户）的想法】",
    input.myThought || "（空）",
  ].join("\n");

  const result = await chat(system, userContent, 0.75);
  const parsed = extractJson(result.content) as Partial<AnalysisOutcome> | null;

  // 兜底：解析失败时返回结构化降级
  if (!parsed || !Array.isArray(parsed.thoughts)) {
    throw new Error("AI 返回无法解析");
  }
  return {
    scene: parsed.scene && (SCENES as readonly string[]).includes(String(parsed.scene)) ? String(parsed.scene) : undefined,
    thoughts: parsed.thoughts ?? [],
    suggestions: parsed.suggestions ?? [],
    notes: parsed.notes ?? [],
    temperature: parsed.temperature && ["热", "温", "冷"].includes(parsed.temperature.label)
      ? parsed.temperature
      : { label: "温", reason: "数据不足，暂判中性" },
  };
}

/** 将最近3次分析记录压缩为摘要文本（脱敏后的） */
export function summerizeRecords(records: { temp_label: string; temp_reason: string; result?: { thoughts?: { point: string }[] } }[]): string {
  return records.map((r, i) => {
    const thoughts = (r.result?.thoughts ?? []).map((t) => t.point).join("；");
    return `${i + 1}) 温度=${r.temp_label}（${r.temp_reason ?? ""}）；要点：${thoughts || "无"}`;
  }).join("\n");
}

/** 匿名化组合入口：先脱敏再交给 AI */
export function prepareAnonymized(input: {
  personName: string;
  background?: string | null;
  chatRecord: string;
  myThought: string;
}): { background: string; chatRecord: string; myThought: string } {
  return {
    background: anonymize(input.background ?? "", input.personName),
    chatRecord: anonymize(input.chatRecord, input.personName),
    myThought: anonymize(input.myThought, input.personName),
  };
}

/** 节制机制固定回复 */
export const MODERATION_REPLY = "我上次的判断不会变，先去做别的事吧。";

/**
 * 节制机制：同一人物 24 小时内第 3 次分析时劝停。
 * @param recentCount 该人物最近 24 小时的已有分析次数
 */
export function shouldModerate(recentCount: number): boolean {
  return recentCount >= 2; // 已有 2 次，本次为第 3 次
}