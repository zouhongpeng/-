import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { api } from '@/utils/api';
import dayjs from 'dayjs';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle, Line, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const AVATAR_COLORS = ['#FF7A5C', '#7A9BCE', '#C9A227', '#6FB98F', '#C084FC', '#E4572E', '#5AA9E6'];

interface PersonDetailProps {
  id: string;
}

const TEMP_COLOR: Record<string, string> = {
  热: '#E4572E',
  温: '#C9A227',
  冷: '#7A9BCE',
};

const TEMP_POS: Record<string, number> = { 热: 0, 温: 0.5, 冷: 1 };

// 从档案存储的颜色值（可为空 / 旧数据无颜色）解析头图圆点色
function avatarColor(color?: string): string {
  if (color && (AVATAR_COLORS as string[]).includes(color)) return color;
  // 按称呼哈希稳定取色
  return AVATAR_COLORS[0];
}

/**
 * 人物详情页：档案 + 温度趋势图 + 重要日期 + 时间线
 * 时间线即每次分析历史（记录 + 想法 + 结果 + 温度标签）
 */
export default function PersonDetailScreen() {
  const params = useSafeSearchParams<PersonDetailProps>();
  const router = useSafeRouter();
  const id = params.id;

  const [person, setPerson] = useState<any>(null);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [temps, setTemps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editModal, setEditModal] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [p, a, t] = await Promise.all([
        api.person(id),
        api.personAnalyses(id),
        api.personTemperatures(id),
      ]);
      setPerson(p);
      setAnalyses(a || []);
      setTemps(t || []);
    } catch (e: any) {
      Alert.alert('加载失败', e?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!id) return null;

  const latestTemp = temps.length ? temps[temps.length - 1].label : '';
  const latestTempColor = TEMP_COLOR[latestTemp] || '#C9A227';

  return (
    <Screen safeAreaEdges={['top', 'left', 'right', 'bottom']}>
      <View className="px-4 pt-2 pb-1">
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} className="w-10 h-10 justify-center">
          <Text className="text-2xl text-foreground">‹</Text>
        </TouchableOpacity>
      </View>

      {loading && !person ? (
        <View className="flex-1 items-center pt-20"><ActivityIndicator color="#666" /></View>
      ) : person ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>
          {/* 档案头部：渐变卡片 + 称呼大字 + 关系标签 + 温度环 */}
          <LinearGradient
            colors={['#FFF1EC', '#FDE8E4', '#ECEEF8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="rounded-[26px] p-5"
            style={{ shadowColor: '#E4572E', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 }}
          >
            <View className="flex-row items-center">
              {/* 自定义彩色圆点头像 */}
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: avatarColor(person.avatar_color), alignItems: 'center', justifyContent: 'center' }}>
                <Text className="text-2xl font-bold" style={{ color: '#FFFFFF' }}>{person.name?.charAt(0)}</Text>
              </View>

              <View className="flex-1 ml-4">
                <Text className="text-[26px] font-bold text-foreground tracking-tight">{person.name}</Text>
                <View className="mt-1.5 flex-row items-center gap-2">
                  <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.72)' }}>
                    <Text className="text-[12px] font-medium text-foreground">{person.relationship || '关系未定义'}</Text>
                  </View>
                  {!!person.growth && (
                    <Text className="text-[11px] text-muted">{person.growth}</Text>
                  )}
                </View>
              </View>

              {/* 温度圆环 */}
              {temps.length > 0 && (
                <View className="items-center">
                  <Svg width={64} height={64} viewBox="0 0 64 64">
                    <Circle cx={32} cy={32} r={26} stroke="#EDE7DF" strokeWidth={6} fill="none" />
                    <Circle
                      cx={32} cy={32} r={26}
                      stroke={latestTempColor} strokeWidth={6} fill="none"
                      strokeDasharray={`${Math.max(2, (TEMP_POS[latestTemp] ?? 0.5) * 163)} 999`}
                      strokeLinecap="round"
                      transform="rotate(-90 32 32)"
                    />
                  </Svg>
                  <View className="absolute items-center">
                    <Text className="text-[22px] font-bold" style={{ color: latestTempColor }}>{latestTemp || '–'}</Text>
                    <Text className="text-[9px] text-muted">当前温度</Text>
                  </View>
                </View>
              )}
            </View>

            {!!person.background && (
              <Text className="mt-4 text-[13px] text-muted leading-5">{person.background}</Text>
            )}

            <TouchableOpacity onPress={() => setEditModal(true)} className="mt-4 self-start px-3.5 h-8 rounded-full items-center justify-center flex-row gap-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.66)' }}>
              <Text className="text-[12px] text-foreground">编辑档案</Text>
              <Text className="text-[12px] text-accent">›</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* 分析入口 */}
          <TouchableOpacity
            onPress={() => router.push('/analyze', { person_id: id, person_name: person.name })}
            className="mt-5 bg-foreground rounded-2xl px-5 py-4 flex-row items-center justify-between"
          >
            <Text className="text-white font-semibold text-base">让我帮你想清楚</Text>
            <Text className="text-white/70 text-[13px]">粘贴聊天 → 分析 {'›'}</Text>
          </TouchableOpacity>

          {/* 温度趋势 */}
          <View className="mt-7">
            <Text className="text-[15px] font-semibold text-foreground mb-3">关系温度</Text>
            {temps.length === 0 ? (
              <Text className="text-[13px] text-muted">还没有温度记录，做一次分析后这里会出现趋势</Text>
            ) : (
              <TempChart data={temps} />
            )}
            <Text className="mt-2 text-[11px] text-muted">次数越多，越能看出关系是在升温还是降温</Text>
          </View>

          {/* 重要日期 */}
          <View className="mt-7">
            <Text className="text-[15px] font-semibold text-foreground mb-3">重要日期</Text>
            {(person.dates || []).length === 0 ? (
              <Text className="text-[13px] text-muted">还没有记录重要日期</Text>
            ) : (
              (person.dates || []).map((d: any, i: number) => (
                <View key={i} className="flex-row items-center justify-between py-2 border-b border-[#F0F0F0]">
                  <Text className="text-[15px] text-foreground">{d.name}</Text>
                  <Text className="text-[15px] text-muted">{fmtDate(d.month_day)}</Text>
                </View>
              ))
            )}
          </View>

          {/* 时间线 */}
          <View className="mt-7">
            <Text className="text-[15px] font-semibold text-foreground mb-3">时间线</Text>
            {analyses.length === 0 ? (
              <Text className="text-[13px] text-muted">还没有分析记录</Text>
            ) : (
              analyses.map((a) => (
                <TimelineCard
                  key={a.id}
                  record={a}
                  personaName={person.name}
                  expanded={!!expanded[a.id]}
                  onToggle={() => setExpanded((s) => ({ ...s, [a.id]: !s[a.id] }))}
                  onDelete={async () => {
                    try { await api.deleteAnalysis(a.id); load(); } catch (e: any) { Alert.alert('删除失败', e?.message); }
                  }}
                />
              ))
            )}
          </View>
        </ScrollView>
      ) : null}

      {editModal && person ? (
        <EditPersonModal
          person={person}
          onClose={() => setEditModal(false)}
          onSaved={() => { setEditModal(false); load(); }}
          onDeleted={() => { setEditModal(false); router.replace('/', {}); }}
        />
      ) : null}
    </Screen>
  );
}

function fmtDate(month_day: string) {
  if (!/^\d{1,2}-\d{1,2}$/.test(month_day || '')) return month_day || '';
  const [m, d] = month_day.split('-');
  return `${+m}月${+d}日`;
}

/** 温度趋势：健康App式柔和渐变面积图（贝塞尔曲线） */
function TempChart({ data }: { data: { label: string; reason: string; created_at: string }[] }) {
  const w = 340, h = 130;
  const padTop = 14, padBottom = 16;
  const chartH = h - padTop - padBottom;
  const n = data.length;
  const lineColor = n >= 2 && TEMP_POS[data[n - 1].label] >= TEMP_POS[data[0].label] ? '#E4572E' : '#7A9BCE';

  // 生成归一化点
  const raw = data.map((d, i) => ({
    x: n === 1 ? w / 2 : (i / (n - 1)) * w,
    y: padTop + TEMP_POS[d.label] * chartH,
    label: d.label,
  }));

  // 单点：画一个小圆点 + 渐变点缀
  if (n === 1) {
    const p = raw[0];
    const color = TEMP_COLOR[p.label] || '#C9A227';
    return (
      <View className="rounded-3xl border border-border p-4" style={{ backgroundColor: 'rgba(255,253,251,0.92)' }}>
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <Defs>
            <SvgLinearGradient id="ctGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.55" />
              <Stop offset="1" stopColor={color} stopOpacity="0.05" />
            </SvgLinearGradient>
          </Defs>
          {['热', '温', '冷'].map((l) => (
            <Line key={l} x1={0} y1={padTop + TEMP_POS[l] * chartH} x2={w} y2={padTop + TEMP_POS[l] * chartH} stroke="#EFE9E2" strokeWidth={1} strokeDasharray="4 6" />
          ))}
          <Circle cx={p.x} cy={p.y} r={13} fill={color} opacity={0.2} />
          <Circle cx={p.x} cy={p.y} r={6} fill={color} />
        </Svg>
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-[12px] font-bold" style={{ color }}>{p.label}</Text>
          <Text className="text-[11px] text-muted">最近一次{data[0].label}，{dayjs(data[0].created_at).format('M月D日')}</Text>
        </View>
      </View>
    );
  }

  // 贝塞尔平滑曲线（Catmull-Rom → 三次 Bezier）
  let d = `M ${raw[0].x} ${raw[0].y}`;
  for (let i = 0; i < raw.length - 1; i++) {
    const cur = raw[i];
    const next = raw[i + 1];
    const prev = raw[i - 1] || cur;
    const c1 = { x: cur.x + (next.x - prev.x) / 6, y: cur.y + (next.y - prev.y) / 6 };
    const n2 = raw[i + 2] || next;
    const c2 = { x: next.x - (n2.x - cur.x) / 6, y: next.y - (n2.y - cur.y) / 6 };
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${next.x} ${next.y}`;
  }
  const area = `${d} L ${raw[raw.length - 1].x} ${h - padBottom} L ${raw[0].x} ${h - padBottom} Z`;

  const isDown = n >= 2 && TEMP_POS[data[n - 1].label] > TEMP_POS[data[0].label];

  return (
    <View className="rounded-3xl border border-border p-4" style={{ backgroundColor: 'rgba(255,253,251,0.92)' }}>
      <Text className="text-[13px] font-semibold text-foreground mb-1">关系温度</Text>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <SvgLinearGradient id="ctGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.42" />
            <Stop offset="1" stopColor={lineColor} stopOpacity="0.02" />
          </SvgLinearGradient>
        </Defs>
        {/* 参考线（低饱和虚线） */}
        {['热', '温', '冷'].map((l) => (
          <Line key={l} x1={0} y1={padTop + TEMP_POS[l] * chartH} x2={w} y2={padTop + TEMP_POS[l] * chartH} stroke="#EFE9E2" strokeWidth={1} strokeDasharray="4 6" />
        ))}
        {/* 渐变面积 */}
        <Path d={area} fill="url(#ctGrad)" />
        {/* 平滑曲线 */}
        <Path d={d} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" />
        {/* 数据点 */}
        {raw.map((p, i) => (
          <G key={i}>
            <Circle cx={p.x} cy={p.y} r={7} fill={TEMP_COLOR[p.label] || '#C9A227'} opacity={0.22} />
            <Circle cx={p.x} cy={p.y} r={3.5} fill={TEMP_COLOR[p.label] || '#C9A227'} />
          </G>
        ))}
      </Svg>
      <View className="mt-1.5 flex-row items-center justify-between">
        <Text className="text-[11px] text-muted">最近一次 · {data[data.length - 1].label}</Text>
        {isDown ? (
          <Text className="text-[11px]" style={{ color: lineColor }}>关系略降温，值得留意</Text>
        ) : (
          <Text className="text-[11px]" style={{ color: lineColor }}>关系在升温 · 很好</Text>
        )}
      </View>
    </View>
  );
}

/** 时间线卡片 */
/** iMessage 质感聊天气泡 */
function ChatBubbles({ text }: { text: string }) {
  const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const msgs: { me: boolean; content: string }[] = [];
  for (const line of lines) {
    const m = line.match(/^(我|对方|ta|Ta|TA)[:：](.*)$/);
    if (m) {
      msgs.push({ me: m[1] === '我', content: m[2] });
    } else {
      // 无法识别说话者的原始行：并入上一条，或作为对方消息兜底
      if (msgs.length) msgs[msgs.length - 1].content += '\n' + line;
      else msgs.push({ me: false, content: line });
    }
  }
  if (!msgs.length) return null;
  return (
    <View>
      {msgs.map((msg, i) => (
        <View key={i} className={`flex-row mb-2 ${msg.me ? 'justify-end' : 'justify-start'}`}>
          <View
            className={`px-3.5 py-2 max-w-[82%] ${msg.me ? 'rounded-[18px] rounded-br-[6px]' : 'rounded-[18px] rounded-bl-[6px]'}`}
            style={{ backgroundColor: msg.me ? '#F0E6DE' : '#FFFFFF', borderWidth: 1, borderColor: '#EFE9E2' }}
          >
            <Text className={`text-[13px] leading-5 ${msg.me ? 'text-foreground' : 'text-foreground'}`}>{msg.content}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TimelineCard({ record, personaName, expanded, onToggle, onDelete }: any) {
  const status = record.status;
  const res = record.result || {};
  const running = status === 'gen';
  return (
    <View className="bg-white rounded-2xl border border-[#F0F0F0] mb-3 overflow-hidden">
      <TouchableOpacity onPress={onToggle} className="px-4 py-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TEMP_COLOR[record.temp_label] || '#CCC' }} />
          <Text className="ml-2.5 text-[13px] text-foreground font-medium">
            {running ? '分析生成中…' : dayjs(record.created_at).format('M月D日 HH:mm')}
          </Text>
        </View>
        <Text className="text-[12px] text-muted">{expanded ? '收起' : '展开'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View className="px-4 pb-4">
          {running ? (
            <View className="flex-row items-center py-2">
              <ActivityIndicator size="small" color="#666" />
              <Text className="ml-2 text-[13px] text-muted">AI 正在思考……</Text>
            </View>
          ) : status === 'failed' ? (
            <Text className="text-[13px] text-danger py-2">分析失败，请稍后再试</Text>
          ) : (
            <View className="space-y-3">
              {!!record.chat_input && (
                <View>
                  <Text className="text-[12px] text-muted mb-1.5">聊天记录</Text>
                  <View className="bg-on-surface rounded-2xl px-3 py-3">
                    <ChatBubbles text={record.chat_input} />
                  </View>
                </View>
              )}
              {!!record.thought_input && (
                <View>
                  <Text className="text-[12px] text-muted mb-1">我的想法</Text>
                  <Text className="text-[13px] text-foreground leading-5">{record.thought_input}</Text>
                </View>
              )}
              {/* 对面在想什么 */}
              {(res.thoughts || []).length > 0 && (
                <View>
                  <Text className="text-[12px] text-muted mb-1">对面在想什么</Text>
                  {(res.thoughts || []).map((t: any, i: number) => (
                    <View key={i} className="mb-1.5">
                      <Text className="text-[13px] text-foreground font-medium">· {t.point}</Text>
                      {!!t.evidence && <Text className="text-[12px] text-muted mt-0.5">  {t.evidence}</Text>}
                    </View>
                  ))}
                </View>
              )}
              {/* 建议回复 */}
              {(res.suggestions || []).length > 0 && (
                <View>
                  <Text className="text-[12px] text-muted mb-1">建议回复</Text>
                  {(res.suggestions || []).map((s: any, i: number) => (
                    <View key={i} className="mb-1.5">
                      <Text className="text-[12px] text-accent">〔{s.style}〕</Text>
                      <Text className="text-[13px] text-foreground leading-5">{s.text}</Text>
                      {!!s.reason && <Text className="text-[12px] text-muted mt-0.5">  {s.reason}</Text>}
                    </View>
                  ))}
                </View>
              )}
              {(res.notes || []).length > 0 && (
                <View>
                  <Text className="text-[12px] text-muted mb-1">注意事项</Text>
                  {(res.notes || []).map((nt: string, i: number) => (
                    <Text key={i} className="text-[13px] text-foreground leading-5">{nt}</Text>
                  ))}
                </View>
              )}
              <View className="pt-2 border-t border-[#F4F4F4] flex-row items-center justify-between">
                <Text className="text-[12px] text-muted">
                  温度：{record.temp_label}  {record.temp_reason}
                </Text>
                <TouchableOpacity onPress={onDelete} hitSlop={8}>
                  <Text className="text-[12px] text-danger">删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/** 编辑档案 Modal（复用字段） */
function EditPersonModal({ person, onClose, onSaved, onDeleted }: any) {
  const [form, setForm] = useState({
    name: person.name,
    relationship: person.relationship || '',
    background: person.background || '',
    avatar_color: person.avatar_color || AVATAR_COLORS[0],
    dates: (person.dates || []).map((d: any) => ({ name: d.name, month_day: d.month_day })),
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.updatePerson(person.id, {
        name: form.name.trim(),
        relationship: form.relationship.trim(),
        background: form.background.trim(),
        avatar_color: form.avatar_color,
        dates: form.dates.filter((d: any) => d.name.trim() && /^\d{1,2}-\d{1,2}$/.test(d.month_day)),
      });
      onSaved();
    } catch (e: any) { Alert.alert('保存失败', e?.message); } finally { setSaving(false); }
  };

  const delPerson = () => {
    Alert.alert(`删除「${person.name}」`, '将删除该人物全部数据，无法恢复。确定？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => { try { await api.deletePerson(person.id); onDeleted(); } catch (e: any) { Alert.alert('删除失败', e?.message); } } },
    ]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/30 justify-end">
        <View className="bg-white rounded-t-3xl p-6 pb-8 max-h-[88%]">
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-xl font-bold text-foreground">编辑档案</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Text className="text-2xl text-muted">✕</Text></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label="称呼"><TextInput value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="称呼" placeholderTextColor="#C9C9C9" className="bg-[#F6F6F6] rounded-xl px-4 h-12 text-base text-foreground" /></Field>
            <Field label="关系"><TextInput value={form.relationship} onChangeText={(t) => setForm({ ...form, relationship: t })} placeholder="关系" placeholderTextColor="#C9C9C9" className="bg-[#F6F6F6] rounded-xl px-4 h-12 text-base text-foreground" /></Field>
            <Field label="头像颜色圆点">
              <View className="flex-row flex-wrap gap-3">
                {AVATAR_COLORS.map((c) => (
                  <TouchableOpacity key={c} onPress={() => setForm({ ...form, avatar_color: c })} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}>
                    {form.avatar_color === c && <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF' }} />}
                  </TouchableOpacity>
                ))}
              </View>
            </Field>
            <Field label="背景备注"><TextInput value={form.background} onChangeText={(t) => setForm({ ...form, background: t })} placeholder="性格/聊天风格/当前阶段" placeholderTextColor="#C9C9C9" multiline className="bg-[#F6F6F6] rounded-xl px-4 py-3 text-base text-foreground min-h-[80px]" /></Field>
            <Text className="text-[13px] text-muted mb-1.5">重要日期</Text>
            {(form.dates || []).map((d: any, i: number) => (
              <View key={i} className="flex-row items-center mb-2 space-x-2">
                <TextInput value={d.name} onChangeText={(t) => setForm({ ...form, dates: form.dates.map((x: any, idx: number) => idx === i ? { ...x, name: t } : x) })} placeholder="如：生日" placeholderTextColor="#C9C9C9" className="flex-1 bg-[#F6F6F6] rounded-xl px-4 h-11 text-[15px] text-foreground" />
                <TextInput value={d.month_day} onChangeText={(t) => setForm({ ...form, dates: form.dates.map((x: any, idx: number) => idx === i ? { ...x, month_day: t } : x) })} placeholder="月-日" placeholderTextColor="#C9C9C9" className="w-24 bg-[#F6F6F6] rounded-xl px-2 h-11 text-[15px] text-foreground text-center" />
                <TouchableOpacity onPress={() => setForm({ ...form, dates: form.dates.filter((_: any, idx: number) => idx !== i) })} hitSlop={8}><Text className="text-danger">✕</Text></TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => setForm({ ...form, dates: [...form.dates, { name: '', month_day: '' }] })}><Text className="text-accent text-[13px]">＋ 添加日期</Text></TouchableOpacity>
          </ScrollView>
          <TouchableOpacity onPress={delPerson} className="mt-3 self-center"><Text className="text-[13px] text-danger">删除此人物档案</Text></TouchableOpacity>
          <View className="flex-row space-x-3 mt-3">
            <TouchableOpacity onPress={onClose} className="flex-1 h-12 rounded-xl bg-[#F1F1F1] items-center justify-center"><Text className="text-foreground font-medium">取消</Text></TouchableOpacity>
            <TouchableOpacity onPress={save} disabled={saving} className="flex-1 h-12 rounded-xl bg-foreground items-center justify-center"><Text className="text-white font-medium">{saving ? '保存中…' : '保存'}</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children }: any) {
  return <View className="mb-4"><Text className="text-[13px] text-muted mb-1.5">{label}</Text>{children}</View>;
}