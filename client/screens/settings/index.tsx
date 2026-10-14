import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { Pressable } from 'react-native';
import { Screen } from '@/components/Screen';
import { api } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

const MODES = [
  { key: 'canned', title: '话术模式', desc: '给完整建议句子（默认）' },
  { key: 'hint', title: '提示模式', desc: '只给思路方向，不给原话' },
  { key: 'critique', title: '点评模式', desc: '你写下回复，AI 只点评不代写' },
] as const;

/**
 * 设置页：成长模式三档 + 节制提醒开关 + 修改 PIN + 锁定 + 隐私说明
 */
export default function SettingsScreen() {
  const [growthMode, setGrowthMode] = useState<string>('canned');
  const [moderation, setModeration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const { lock } = useAuth();

  const load = useCallback(async () => {
    try {
      const s = await api.settings();
      if (s?.growth_mode) setGrowthMode(s.growth_mode);
      if (typeof s?.moderation === 'boolean') setModeration(s.moderation);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeMode = async (key: string) => {
    setGrowthMode(key);
    setLoading(true);
    try { await api.updateSettings({ growth_mode: key }); } catch (e: any) { Alert.alert('保存失败', e?.message); } finally { setLoading(false); }
  };

  const toggleModeration = async (v: boolean) => {
    setModeration(v);
    try { await api.updateSettings({ moderation: v }); } catch (e: any) { setModeration(!v); Alert.alert('保存失败', e?.message); }
  };

  const savePin = async () => {
    if (!/^\d{4}$/.test(pinInput)) { Alert.alert('提示', '请输入 4 位数字 PIN'); return; }
    try {
      await api.updateSettings({ pin: pinInput });
      setShowPin(false); setPinInput('');
      Alert.alert('已更新', '新的 PIN 已生效');
    } catch (e: any) { Alert.alert('失败', e?.message); }
  };

  return (
    <Screen>
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }}>
        <Text className="text-[28px] font-bold text-foreground mb-1">设置</Text>
        <Text className="text-[13px] text-muted mb-5">回复小助手 · 训练轮的设定</Text>

        {/* 成长模式 */}
        <Text className="text-[15px] font-semibold text-foreground mb-2">成长模式</Text>
        <Text className="text-[12px] text-muted mb-3">从代写到点评，逐步放手——直到你不再需要它</Text>
        {MODES.map((m) => (
          <TouchableOpacity key={m.key} onPress={() => changeMode(m.key)} disabled={loading}
            className={`rounded-3xl p-4 mb-3 border ${growthMode === m.key ? 'border-accent' : 'border-border'} bg-surface`}>
            <View className="flex-row items-center justify-between">
              <Text className="text-[15px] font-semibold text-foreground">{m.title}</Text>
              <View className={`w-5 h-5 rounded-full border-2 ${growthMode === m.key ? 'bg-accent border-accent' : 'border-muted'}`}>
                {growthMode === m.key && <View className="flex-1 m-[3px] rounded-full bg-white" />}
              </View>
            </View>
            <Text className="text-[13px] text-muted mt-1">{m.desc}</Text>
          </TouchableOpacity>
        ))}

        {/* 节制提醒 */}
        <Text className="text-[15px] font-semibold text-foreground mt-6 mb-2">克制</Text>
        <TouchableOpacity onPress={() => toggleModeration(!moderation)} className="bg-surface rounded-3xl p-4 mb-3 border border-border flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[15px] font-semibold text-foreground">节制提醒</Text>
            <Text className="text-[12px] text-muted mt-1">开启后，同一人物 24 小时内第 3 次分析将触发劝停「先去做别的事吧」，帮你克制反复追问</Text>
          </View>
          <View className={`w-12 h-7 rounded-full justify-center px-1 ${moderation ? 'bg-accent' : 'bg-[#E5E0DA]'}`}>
            <View className={`w-5 h-5 rounded-full bg-white shadow ${moderation ? 'self-end' : 'self-start'}`} />
          </View>
        </TouchableOpacity>

        {/* 安全 */}
        <Text className="text-[15px] font-semibold text-foreground mt-2 mb-2">安全</Text>
        <TouchableOpacity onPress={() => setShowPin(true)} className="bg-surface rounded-2xl p-4 mb-3 border border-border flex-row items-center justify-between">
          <Text className="text-[14px] text-foreground">修改 PIN 锁</Text>
          <Text className="text-muted">›</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { Alert.alert('确认锁定？', '锁定后需要输入 PIN 才能继续使用', [{ text: '取消', style: 'cancel' }, { text: '锁定', onPress: () => lock() }]); }}
          className="bg-surface rounded-2xl p-4 border border-border flex-row items-center justify-between">
          <Text className="text-[14px] text-danger">立即锁定</Text>
          <Text className="text-muted">›</Text>
        </TouchableOpacity>

        {/* 隐私说明 */}
        <View className="mt-8 py-4 border-t border-separator">
          <Text className="text-center text-[11px] text-muted leading-5 px-4">
            「关于教练式陪伴」：AI 的判断仅供参考，真实的关系由真实的人维护。
            {'\n'}
            聊天记录涉及他人隐私，请勿分享本应用数据。
          </Text>
        </View>
      </ScrollView>

      {/* PIN 修改 Modal */}
      <Modal visible={showPin} transparent animationType="fade" onRequestClose={() => setShowPin(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 28 }} onPress={() => setShowPin(false)}>
          <Pressable className="bg-surface rounded-3xl p-6" onPress={() => undefined}>
            <Text className="text-lg font-semibold text-foreground mb-1">设置新 PIN</Text>
            <Text className="text-[13px] text-muted mb-4">4 位数字</Text>
            <TextInput
              value={pinInput} onChangeText={setPinInput} keyboardType="number-pad" maxLength={4} placeholder="••••"
              placeholderTextColor="#BBB" secureTextEntry
              selectionColorClassName="accent-500"
              className="bg-on-surface rounded-xl px-4 py-3 text-lg tracking-[12px] text-center text-foreground mb-4"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setShowPin(false)} className="flex-1 bg-on-surface rounded-xl py-3.5 items-center">
                <Text className="text-muted">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={savePin} className="flex-1 bg-foreground rounded-xl py-3.5 items-center">
                <Text className="text-surface font-semibold">保存</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}