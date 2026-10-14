import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable } from 'react-native';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/contexts/AuthContext';

/**
 * PIN 锁全屏 Gate
 * - 首次：设置 4 位 PIN
 * - 之后：输入 4 位 PIN 解锁
 * 极简居中，温柔的数据风格
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

  const pressDigit = (d: string) => {
    if (busy || pin.length >= 4) return;
    handleChange(pin + d);
  };
  const pressBack = () => {
    if (busy) return;
    handleChange(pin.slice(0, -1));
  };

  return (
    <Screen>
      <View className="flex-1 items-center justify-center px-8 bg-background">
        <View className="items-center">
          <Text className="text-4xl font-bold text-foreground tracking-tight">回复小助手</Text>
          <Text className="mt-2 text-sm text-muted">安静地陪你把关系想清楚</Text>
        </View>

        <Text className="mt-12 text-xs text-muted">{isSetup ? '设置 4 位 PIN 以保护隐私' : '输入 4 位 PIN'}</Text>

        {/* 圆点指示器 */}
        <View className="my-6 flex-row gap-4">
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              className={`w-3.5 h-3.5 rounded-full ${i < pin.length ? 'bg-accent' : 'bg-border'}`}
            />
          ))}
        </View>

        {error ? <Text className="mb-2 text-sm text-danger">{error}</Text> : null}

        {/* 数字键盘 */}
        <View className="w-full max-w-[280px] flex-row flex-wrap justify-center">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <Pressable
              key={d}
              onPress={() => pressDigit(d)}
              disabled={busy}
              className="w-[88px] h-[62px] items-center justify-center active:opacity-50"
            >
              <Text className="text-2xl font-medium text-foreground">{d}</Text>
            </Pressable>
          ))}
          <View className="w-[88px] h-[62px]" />
          <Pressable
            onPress={() => pressDigit('0')}
            disabled={busy}
            className="w-[88px] h-[62px] items-center justify-center active:opacity-50"
          >
            <Text className="text-2xl font-medium text-foreground">0</Text>
          </Pressable>
          <Pressable
            onPress={pressBack}
            disabled={busy}
            className="w-[88px] h-[62px] items-center justify-center active:opacity-50"
          >
            <Text className="text-xl text-muted">⌫</Text>
          </Pressable>
        </View>

        {/* 隐藏输入框以调用系统键盘 */}
        <TextInput
          ref={inputRef}
          value={pin}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={4}
          editable={!busy}
          className="absolute w-1 h-1 opacity-0"
        />

        <View className="absolute bottom-10 items-center">
          <Text className="text-[11px] text-muted">聊天记录涉及他人隐私，请勿分享本应用数据</Text>
        </View>
      </View>
    </Screen>
  );
}