import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Platform, Modal, StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { api } from '@/utils/api';
import { createFormDataFile } from '@/utils';

interface AnalyzeProps {
  person_id: string;
  person_name?: string;
}

const TEMP_COLOR: Record<string, string> = { 热: '#E4572E', 温: '#C9A227', 冷: '#7A9BCE' };

/**
 * 核心分析页
 * - 双输入：聊天记录 + 我的想法
 * - 截图输入（识别后回填可编辑）
 * - 输出三段：对面在想什么 / 建议回复 / 注意事项 + 关系温度
 */
export default function AnalyzeScreen() {
  const params = useSafeSearchParams<AnalyzeProps>();
  const router = useSafeRouter();
  const personId = params.person_id;
  const personName = params.person_name || '对方';

  const [chatInput, setChatInput] = useState('');
  const [thoughtInput, setThoughtInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [moderated, setModerated] = useState(false);
  const [pollTimer, setPollTimer] = useState<any>(null);
  const [marks, setMarks] = useState<Record<string, boolean>>({});

  // 截图识别
  const [picking, setPicking] = useState(false);
  const [shotStep, setShotStep] = useState<null | 'edit'>(null);
  const [shotImage, setShotImage] = useState<string | null>(null);
  const [shotMessages, setShotMessages] = useState<{ speaker: string; text: string }[]>([]);

  const doCopy = async (t: string) => {
    try { await Clipboard.setStringAsync(t); Alert.alert('已复制'); } catch { Alert.alert('复制失败'); }
  };

  const stopPolling = () => { if (pollTimer) { clearInterval(pollTimer); setPollTimer(null); } };

  // 提交分析
  const submit = async (oChat?: string, oThought?: string) => {
    if (loading) return;
    const chat = oChat ?? chatInput;
    const thought = oThought ?? thoughtInput;
    if (!chat.trim() && !shotMessages.length) { Alert.alert('提示', '请先粘贴聊天记录，或用截图输入'); return; }
    if (!thought.trim()) { Alert.alert('提示', '请填写「我的想法」——没有你的视角，分析会不全'); return; }
    setLoading(true); setResult(null); setModerated(false); setMarks({});
    try {
      const payload: any = { person_id: personId, chat_input: chat, thought_input: thought };
      const growth = await api.settings().catch(() => ({ growth_mode: 'canned' }));
      if (growth?.growth_mode === 'critique') payload.my_reply = thought;
      const res = await api.analyze(payload);
      if (res.moderated) {
        setModerated(true);
        setResult({ message: res.message });
        setLoading(false);
        return;
      }
      setRecordId(res.record_id);
      // 轮询结果
      const tick = async () => {
        try {
          const rec = await api.analysis(res.record_id);
          if (rec.status === 'done') {
            stopPolling();
            setResult(rec.result || {});
            setMarks((rec.result?.marks) || {});
            setLoading(false);
          } else if (rec.status === 'failed') {
            stopPolling();
            Alert.alert('分析失败', '请稍后再试');
            setLoading(false);
          }
        } catch { /* 轮询期间出错继续 */ }
      };
      tick();
      const timer = setInterval(tick, 2000);
      setPollTimer(timer);
    } catch (e: any) {
      setLoading(false);
      Alert.alert('分析失败', e?.message);
    }
  };

  const markSuggestion = async (index: number, used: boolean) => {
    if (!recordId) return;
    const next = { ...marks, [String(index)]: used };
    setMarks(next);
    try { await api.markSuggestion(recordId, index, used); } catch { /* 忽略 */ }
  };

  // 选择截图
  const pickImage = async () => {
    try {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      const result2 = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
        base64: false,
      });
      if (result2.canceled || !result2.assets?.length) return;
      setShotImage(result2.assets[0].uri);
      setShotMessages([]);
      setPicking(true);
      await runRecognize({ uri: result2.assets[0].uri, mime: result2.assets[0].mimeType || 'image/jpeg', name: result2.assets[0].fileName || 'chat.jpg' });
    } catch (e: any) {
      Alert.alert('选择失败', e?.message);
    }
  };

  const runRecognize = async (file: any) => {
    try {
      const fd = new FormData();
      const f = await createFormDataFile(file.uri, file.name, file.mime);
      (fd as any).append('image', f as any);
      (fd as any).append('person_name', personName);
      const data = await api.recognize(fd);
      if (!data.messages || !data.messages.length) throw new Error('未识别出对话');
      setShotMessages(data.messages);
      setShotStep('edit');
    } catch (e: any) {
      Alert.alert('识别失败', '已为你降级为手动粘贴，请自行输入聊天记录', [
        { text: '知道了', onPress: () => { setShotImage(null); setPicking(false); setShotStep(null); } },
      ]);
      setPicking(false);
    }
  };

  const buildShotText = () => shotMessages.map((m) => `${m.speaker === '我' ? '我' : personName}：${m.text}`).join('\n');

  const useShot = () => {
    setChatInput(buildShotText());
    setShotStep(null); setShotImage(null); setPicking(false);
  };

  const underlyingGrowthRef = useRef('canned');

  if (!personId) return null;

  return (
    <Screen safeAreaEdges={['top', 'left', 'right', 'bottom']}>
      {/* 私密感：柔和背景层（半透明暖雾） */}
      <View style={StyleSheet.absoluteFill}>
        <View className="absolute -top-24 -right-16 w-64 h-64 rounded-full bg-mist-soft" />
        <View className="absolute top-40 -left-20 w-56 h-56 rounded-full bg-accent-soft" />
        <View className="absolute bottom-0 right-0 w-40 h-40 rounded-full bg-mist-soft" />
      </View>

      <View className="px-4 pt-2 pb-1 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => { stopPolling(); router.back(); }} hitSlop={10} className="w-10 h-10 justify-center">
          <Text className="text-2xl text-foreground">‹</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-foreground">帮我分析 · {personName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>
        {/* 分析入口说明 */}
        <Text className="mt-3 text-[13px] text-muted leading-5">
          把「对方说的话」和时间「我的想法」都给 AI，它会帮你猜对方怎么想、怎么回，并留意沟通的节奏。
        </Text>

        {/* 双输入 */}
        <View className="mt-5">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-[15px] font-semibold text-foreground">聊天记录</Text>
            <TouchableOpacity onPress={pickImage} className="px-3 h-8 bg-accent-soft rounded-full items-center justify-center">
              {picking ? <ActivityIndicator size="small" color="#E4572E" /> : <Text className="text-[12px] text-accent font-medium">截图识别</Text>}
            </TouchableOpacity>
          </View>
          <TextInput
            value={chatInput}
            onChangeText={setChatInput}
            placeholder={`例：\n${personName}：昨天加班到很晚，累死了\n我：那你早点休息吧`}
            placeholderTextColor="#C9C9C9"
            multiline
            textAlignVertical="top"
            className="bg-surface rounded-2xl border border-border px-4 py-3 text-[15px] text-foreground min-h-[150px]"
          />
        </View>

        <View className="mt-5">
          <Text className="text-[15px] font-semibold text-foreground mb-2">我的想法</Text>
          <TextInput
            value={thoughtInput}
            onChangeText={setThoughtInput}
            placeholder="此刻你想说什么 / 担心什么？例：我怕说错话让她更烦"
            placeholderTextColor="#C9C9C9"
            multiline
            textAlignVertical="top"
            className="bg-surface rounded-2xl border border-border px-4 py-3 text-[15px] text-foreground min-h-[90px]"
          />
          <Text className="mt-1.5 text-[11px] text-muted">我的想法留空时，分析可能不全，建议先填。</Text>
        </View>

        <TouchableOpacity
          onPress={() => submit()}
          disabled={loading}
          className="mt-6 bg-accent rounded-2xl py-4 items-center justify-center shadow-accent"
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold text-base">帮我分析</Text>}
        </TouchableOpacity>

        {/* 冷静一下（节制提示） */}
        <TouchableOpacity
          onPress={() => { if (!moderated) { Alert.alert('冷静一下', '先去做别的事吧。如果真的很纠结，等 24 小时后再回来。'); } }}
          className="mt-3 py-1 self-center"
        >
          <Text className="text-[13px] text-muted">冷静一下</Text>
        </TouchableOpacity>

        {/* 结果区 */}
        {moderated && result?.message && (
          <View className="mt-6 rounded-2xl border border-border px-5 py-6 items-center" style={{ backgroundColor: 'rgba(255,253,251,0.92)' }}>
            <Text className="text-[15px] text-muted text-center leading-6">{result.message}</Text>
            <View className="mt-4 flex-row space-x-3">
              <TouchableOpacity onPress={() => router.back()} className="px-5 h-10 bg-accent-soft rounded-full items-center justify-center">
                <Text className="text-accent text-[14px] font-medium">去做点什么</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModerated(false)} className="px-5 h-10 bg-accent rounded-full items-center justify-center">
                <Text className="text-white text-[14px] font-medium">冷静一下返回</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!moderated && result && result.thoughts && <ResultView result={result} marks={marks} onCopy={doCopy} onMark={markSuggestion} />}
      </ScrollView>

      {/* 截图核对 Modal */}
      <Modal visible={shotStep === 'edit'} transparent animationType="slide" onRequestClose={() => setShotStep(null)}>
        <View className="flex-1 bg-black/30 justify-end">
          <View className="bg-surface rounded-t-3xl p-6 pb-8">
            <Text className="text-xl font-bold text-foreground mb-1">核对识别结果</Text>
            <Text className="text-[13px] text-muted mb-4">请确认说话人和内容，识别可能不准确，可直接修改。</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {shotMessages.map((m, i) => (
                <View key={i} className="flex-row items-center mb-2 space-x-2">
                  <TouchableOpacity
                    onPress={() => setShotMessages((ms) => ms.map((x, idx) => idx === i ? { ...x, speaker: x.speaker === '我' ? '对方' : '我' } : x ))}
                    className="px-3 h-10 bg-accent-soft rounded-xl items-center justify-center"
                  >
                    <Text className="text-[13px] text-accent font-medium">{m.speaker === '我' ? '我' : personName}</Text>
                  </TouchableOpacity>
                  <TextInput
                    value={m.text}
                    onChangeText={(t) => setShotMessages((ms) => ms.map((x, idx) => idx === i ? { ...x, text: t } : x))}
                    className="flex-1 bg-on-surface rounded-xl px-3 py-2 text-[15px] text-foreground"
                    multiline
                  />
                </View>
              ))}
            </ScrollView>
            <View className="flex-row space-x-3 mt-4">
              <TouchableOpacity onPress={() => setShotStep(null)} className="flex-1 h-12 rounded-xl bg-accent-soft items-center justify-center">
                <Text className="text-accent font-medium">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={useShot} className="flex-1 h-12 rounded-xl bg-accent items-center justify-center">
                <Text className="text-white font-medium">使用并填入</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

/** 三段结果渲染 */
function ResultView({ result, marks, onCopy, onMark }: any) {
  const [copiedNote, setCopiedNote] = useState<string | null>(null);
  const temp = result.temperature || {};
  const handleCopy = (t: string, key: string) => { onCopy(t); setCopiedNote(key); setTimeout(() => setCopiedNote(null), 1500); };

  return (
    <View className="mt-8">
      {/* 关系温度 */}
      <View className="rounded-2xl border border-border px-5 py-4 flex-row items-center" style={{ backgroundColor: 'rgba(255,253,251,0.92)' }}>
        <Text className="text-[13px] text-muted">关系温度</Text>
        <View className="ml-3 flex-row items-center">
          {['热', '温', '冷'].map((l) => (
            <View key={l} className="mr-1 flex-row items-center">
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l === temp.label ? TEMP_COLOR[l] : '#E6E6E6' }} />
            </View>
          ))}
        </View>
        <Text className="ml-3 text-[15px] font-bold" style={{ color: TEMP_COLOR[temp.label] || '#666' }}>{temp.label}</Text>
      </View>
      {!!temp.reason && <Text className="mt-1.5 text-[12px] text-muted px-1">依据：{temp.reason}</Text>}

      {/* 对面在想什么 */}
      <Section title="对面在想什么">
        {(result.thoughts || []).map((t: any, i: number) => (
          <View key={i} className="rounded-2xl border border-border px-4 py-3 mb-2" style={{ backgroundColor: 'rgba(255,253,251,0.92)' }}>
            <Text className="text-[15px] text-foreground font-medium">· {t.point}</Text>
            {!!t.evidence && <Text className="text-[12px] text-muted mt-1 leading-4">{t.evidence}</Text>}
          </View>
        ))}
      </Section>

      {/* 建议回复 — iMessage 质感气泡 */}
      <Section title="建议回复" hint="点文字即可复制，可标记是否用了">
        {(result.suggestions || []).map((s: any, i: number) => {
          const used = marks[String(i)];
          return (
            <View key={i} style={{ backgroundColor: 'rgba(255,253,251,0.92)' }} className="rounded-2xl border border-border px-4 py-3 mb-2">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-[12px] text-accent font-medium">〔{s.style}〕</Text>
                <View className="flex-row items-center">
                  <TouchableOpacity onPress={() => onMark(i, !used)} className="px-2">
                    <Text className="text-[12px] text-muted">{used === undefined ? '标记' : used ? '✓ 用了' : '没用上'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleCopy(s.text, `s${i}`)} hitSlop={8} className="px-2">
                    <Text className="text-[12px] text-accent">{copiedNote === `s${i}` ? '已复制' : '复制'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleCopy(s.text, `s${i}`)}>
                <Text className="text-[15px] text-foreground leading-6">{s.text}</Text>
                {!!s.reason && <Text className="text-[12px] text-muted mt-1">理由：{s.reason}</Text>}
              </TouchableOpacity>
            </View>
          );
        })}
      </Section>

      {/* 注意事项 */}
      {(result.notes || []).length > 0 && (
        <Section title="注意事项">
          {(result.notes || []).map((nt: string, i: number) => (
            <View key={i} className="rounded-2xl border border-border px-4 py-3 mb-2" style={{ backgroundColor: 'rgba(255,253,251,0.92)' }}>
              <Text className="text-[14px] text-foreground leading-5">· {nt}</Text>
            </View>
          ))}
        </Section>
      )}
    </View>
  );
}

function Section({ title, hint, children }: any) {
  return (
    <View className="mt-6">
      <Text className="text-[15px] font-semibold text-foreground mb-2">{title}</Text>
      {!!hint && <Text className="text-[11px] text-muted mb-2">{hint}</Text>}
      {children}
    </View>
  );
}