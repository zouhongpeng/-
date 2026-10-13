import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/contexts/AuthContext';

/**
 * PIN 锁全屏 Gate
 * - 首次：设置 4 位 PIN
 * - 之后：输入 4 位 PIN 解锁
 * 居中简洁的 Apple 极简风
 */
export default function PinScreen() {
  const { initialized, loaded, setup, unlock, isUnlocked } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isUnlocked) return;
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [loaded, isUnlocked]);

  // 已解锁直接不渲染（由 LockGate 控制）
  if (isUnlocked) return null;

  const isSetup = initialized === false;

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setError('');
    if (digits.length === 4) {
      setBusy(true);
      (isSetup ? setup(digits) : unlock(digits))
        .then(() => setPin(''))
        .catch((e: any) => {
          setError(e?.message || (isSetup ? '设置失败' : 'PIN 不正确'));
          setPin('');
          setTimeout(() => inputRef.current?.focus(), 200);
        })
        .finally(() => setBusy(false));
    }
  };

  return (
    <Screen>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-4xl font-bold text-foreground tracking-tight">回复小助手</Text>
        <Text className="mt-2 text-sm text-muted">安静地陪你把关系想清楚</Text>

        <View className="mt-12 w-full max-w-[320px] items-center">
          <Text className="text-sm text-muted mb-4">
            {isSetup ? '设置 4 位 PIN 以保护隐私' : '输入 PIN 解锁'}
          </Text>
          <TextInput
            ref={inputRef}
            value={pin}
            onChangeText={handleChange}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            editable={!busy}
            className="w-48 h-14 text-center text-3xl font-bold tracking-[1.5rem] text-foreground bg-surface border border-border rounded-2xl"
            placeholder="••••"
            placeholderTextColor="#D1D1D1"
          />
          {error ? <Text className="mt-3 text-sm text-danger">{error}</Text> : null}
        </View>

        <View className="absolute bottom-10 items-center">
          <Text className="text-[11px] text-muted">聊天记录涉及他人隐私，请勿分享本应用数据</Text>
        </View>
      </View>
    </Screen>
  );
}