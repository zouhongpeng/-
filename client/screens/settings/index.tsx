import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, TextInput, Platform,
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
 * 设置页：成长模式三档 + 修改 PIN + 锁定 + 隐私说明
 */
export default function SettingsScreen() {
  const [growthMode, setGrowthMode] = useState<string>('canned');
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const { lock } = useAuth();

  const load = useCallback(async () => {
    try {
      const s = await api.settings();
      if (s?.growth_mode) setGrowthMode(s.growth_mode);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeMode = async (key: string) => {
    setGrowthMode(key);
    setLoading(true);
    try { await api.updateSettings({ growth_mode: key }); } catch (e: any) { Alert.alert('保存失败', e?.message); } finally { setLoading(false); }
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
      <ScrollView className="flex-1 bg-[#FAFAFA] dark:bg-gray-900" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }}>
        <Text className="text-[28px] font-bold text-gray-900 dark:text-white mb-1">设置</Text>
        <Text className="text-[13px] text-gray-500 mb-5">回复小助手 · 训练轮的设定</Text>

        {/* 成长模式 */}
        <Text className="text-[15px] font-semibold text-gray-900 dark:text-white mb-2">成长模式</Text>
        <Text className="text-[12px] text-gray-400 mb-3">从代写到点评，逐步放手——直到你不再需要它</Text>
        {MODES.map((m) => (
          <TouchableOpacity key={m.key} onPress={() => changeMode(m.key)} disabled={loading}
            className={`rounded-3xl p-4 mb-3 border ${growthMode === m.key ? 'border-gray-900 dark:border-white' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800`}>
            <View className="flex-row items-center justify-between">
              <Text className="text-[15px] font-semibold text-gray-900 dark:text-white">{m.title}</Text>
              <View className={`w-5 h-5 rounded-full border-2 ${growthMode === m.key ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white' : 'border-gray-300'}`}>
                {growthMode === m.key && <View className="flex-1 m-[3px] rounded-full bg-white dark:bg-gray-900" />}
              </View>
            </View>
            <Text className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">{m.desc}</Text>
          </TouchableOpacity>
        ))}

        {/* 安全 */}
        <Text className="text-[15px] font-semibold text-gray-900 dark:text-white mt-6 mb-2">安全</Text>
        <TouchableOpacity onPress={() => setShowPin(true)} className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3 border border-gray-100 dark:border-gray-700 flex-row items-center justify-between">
          <Text className="text-[14px] text-gray-800 dark:text-gray-200">修改 PIN 锁</Text>
          <Text className="text-gray-300">›</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { Alert.alert('确认锁定？', '锁定后需要输入 PIN 才能继续使用', [{ text: '取消', style: 'cancel' }, { text: '锁定', onPress: () => lock() }]); }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 flex-row items-center justify-between">
          <Text className="text-[14px] text-red-500">立即锁定</Text>
          <Text className="text-gray-300">›</Text>
        </TouchableOpacity>

        {/* 隐私说明 */}
        <View className="mt-8 py-4 border-t border-gray-200 dark:border-gray-800">
          <Text className="text-center text-[11px] text-gray-400 leading-5 px-4">
            「关于教练式陪伴」：AI 的判断仅供参考，真实的关系由真实的人维护。
            {'\n'}
            聊天记录涉及他人隐私，请勿分享本应用数据。
          </Text>
        </View>
      </ScrollView>

      {/* PIN 修改 Modal */}
      <Modal visible={showPin} transparent animationType="fade" onRequestClose={() => setShowPin(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 28 }} onPress={() => setShowPin(false)}>
          <Pressable className="bg-white dark:bg-gray-800 rounded-3xl p-6" onPress={() => undefined}>
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-1">设置新 PIN</Text>
            <Text className="text-[13px] text-gray-500 mb-4">4 位数字</Text>
            <TextInput
              value={pinInput} onChangeText={setPinInput} keyboardType="number-pad" maxLength={4} placeholder="••••"
              placeholderTextColor="#BBB" secureTextEntry
              selectionColorClassName="accent-500"
              className="bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3 text-lg tracking-[12px] text-center text-gray-900 dark:text-white mb-4"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setShowPin(false)} className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-xl py-3.5 items-center">
                <Text className="text-gray-600 dark:text-gray-300">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={savePin} className="flex-1 bg-gray-900 dark:bg-white rounded-xl py-3.5 items-center">
                <Text className="text-white dark:text-gray-900 font-semibold">保存</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}