import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { api } from '@/utils/api';
import dayjs from 'dayjs';

interface PersonDetailProps {
  id: string;
}

const TEMP_COLOR: Record<string, string> = {
  热: '#E4572E',
  温: '#C9A227',
  冷: '#5B7C99',
};

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
          {/* 档案头部 */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-3xl font-bold text-foreground tracking-tight">{person.name}</Text>
              <Text className="mt-1 text-[14px] text-muted">{person.relationship || '未填写关系'}</Text>
            </View>
            <TouchableOpacity onPress={() => setEditModal(true)} className="px-4 h-9 bg-[#F1F1F1] rounded-full items-center justify-center">
              <Text className="text-[13px] text-foreground">编辑档案</Text>
            </TouchableOpacity>
          </View>
          {!!person.background && (
            <Text className="mt-3 text-[14px] text-muted leading-5">{person.background}</Text>
          )}

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

/** 温度趋势折线图（用 View 简化绘制） */
function TempChart({ data }: { data: { label: string; reason: string; created_at: string }[] }) {
  // 高度归一化：热=0.86 温=0.5 冷=0.14
  const yOf = (l: string) => (l === '热' ? 0.86 : l === '冷' ? 0.14 : 0.5);
  const w = 320, h = 120;
  const n = data.length;
  const pts = data.map((d, i) => ({
    x: n === 1 ? w / 2 : (i / (n - 1)) * w,
    y: yOf(d.label) * h,
    label: d.label,
  }));
  const isDown = n >= 2 && yOf(data[n - 1].label) < yOf(data[0].label);
  return (
    <View className="bg-white rounded-2xl px-4 py-4 border border-[#F0F0F0]">
      {/* 三条参考线 */}
      <View style={{ height: h, marginVertical: 8 }}>
        {['热', '温', '冷'].map((l) => (
          <View key={l} style={{ position: 'absolute', left: 0, right: 0, top: yOf(l) * h }}>
            <View className="flex-row items-center">
              <Text className="text-[10px] text-muted mr-2" style={{ width: 14 }}>{l}</Text>
              <View className="flex-1 h-px bg-[#EFEFEF]" />
            </View>
          </View>
        ))}
        {pts.map((p, i) => (
          <View key={i} style={{ position: 'absolute', left: p.x - 5, top: p.y - 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: TEMP_COLOR[p.label] }} />
          </View>
        ))}
      </View>
      {isDown && <Text className="text-[11px] text-danger mt-1">关系略有降温趋势，值得留意</Text>}
    </View>
  );
}

/** 时间线卡片 */
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
                  <Text className="text-[12px] text-muted mb-1">聊天记录</Text>
                  <Text className="text-[13px] text-foreground leading-5">{record.chat_input}</Text>
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