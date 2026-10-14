import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, ScrollView, FlatList, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter, useSafeSearchParams } from '@/hooks/useSafeRouter';
import { Screen } from '@/components/Screen';
import { api } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { evaluateDateReminders, type UpcomingDate } from '@/utils/reminder';
import dayjs from 'dayjs';

type Person = any;
type DateItem = { name: string; month_day: string };

const EMPTY_FORM = { name: '', relationship: '', background: '', avatar_color: '#FF7A5C', dates: [] as DateItem[] };
const AVATAR_COLORS_HOME = ['#FF7A5C', '#7A9BCE', '#C9A227', '#6FB98F', '#C084FC', '#E4572E', '#5AA9E6'];

/**
 * 人物列表页（首页 Tab）
 * - 档案卡片：称呼 + 关系 + 最近互动时间
 * - 新增 / 编辑 / 删除（内嵌 Modal）
 */
export default function HomeScreen() {
  const router = useSafeRouter();
  const { isUnlocked } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [reminders, setReminders] = useState<UpcomingDate[]>([]);

  const load = useCallback(async () => {
    if (!isUnlocked) return;
    try {
      const data = await api.people();
      setPeople(data || []);
    } catch (e: any) {
      Alert.alert('加载失败', e?.message);
    } finally {
      setLoading(false);
    }
  }, [isUnlocked]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 重要日期提醒（提前 3 天浏览器通知 + 页面横幅）
  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const list = await api.upcomingDates();
        const due = await evaluateDateReminders(list || []);
        setReminders(due);
      } catch { /* ignore */ }
    })();
  }, []));

  const formatInteraction = (t?: string) => {
    if (!t) return '还没有分析记录';
    return `最近互动 ${dayjs(t).format('M月D日 HH:mm')}`;
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };
  const openEdit = (p: Person) => {
    setEditing(p);
    setForm({
      name: p.name,
      relationship: p.relationship || '',
      background: p.background || '',
      avatar_color: p.avatar_color || '#FF7A5C',
      dates: (p.dates || []).map((d: any) => ({ name: d.name, month_day: d.month_day })),
    });
    setShowModal(true);
  };

  const confirmDelete = (p: Person) => {
    Alert.alert(`删除「${p.name}」`, '将同时删除该人物的所有分析与时间线，且无法恢复。确定删除？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => { try { await api.deletePerson(p.id); load(); } catch (e: any) { Alert.alert('删除失败', e?.message); } } },
    ]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('提示', '请填写称呼'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        relationship: form.relationship.trim(),
        background: form.background.trim(),
        avatar_color: form.avatar_color,
        dates: form.dates.filter((d) => d.name.trim() && /^\d{1,2}-\d{1,2}$/.test(d.month_day)),
      };
      if (editing) {
        const patch: any = { name: payload.name, relationship: payload.relationship, background: payload.background, avatar_color: payload.avatar_color };
        await api.updatePerson(editing.id, { ...patch, dates: payload.dates });
      }
      else await api.createPerson(payload);
      setShowModal(false);
      load();
    } catch (e: any) {
      Alert.alert('保存失败', e?.message);
    } finally {
      setSaving(false);
    }
  };

  const updateDate = (i: number, patch: Partial<DateItem>) => {
    setForm((f) => {
      const dates = f.dates.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
      return { ...f, dates };
    });
  };

  // 渲染
  if (!isUnlocked) return null;

  return (
    <Screen safeAreaEdges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View className="px-6 pt-4 pb-2 flex-row items-end justify-between">
        <View>
          <Text className="text-3xl font-bold text-foreground tracking-tight">人物</Text>
          <Text className="mt-1 text-[13px] text-muted">你关心的人，值得想清楚再回应</Text>
        </View>
        <TouchableOpacity
          onPress={openAdd}
          className="bg-foreground px-4 h-10 rounded-full items-center justify-center"
        >
          <Text className="text-white font-medium">＋ 新增</Text>
        </TouchableOpacity>
      </View>

      {reminders.length > 0 && (
        <View className="mx-5 mb-2 bg-[#FFF7E6] border border-[#F2E1B3] rounded-2xl px-4 py-3">
          <Text className="text-[12px] font-medium text-[#8A6D1D] mb-1">重要日期提醒</Text>
          {reminders.map((r) => (
            <Text key={r.id} className="text-[13px] text-[#6B5513] leading-5">
              {r.date} 是 {r.person_name}的{r.name}（还有 {r.remind_in} 天），要不要主动问候？
            </Text>
          ))}
        </View>
      )}

      <FlatList
        data={people}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
        ListEmptyComponent={
          <View className="items-center pt-16 px-6">
            <Text className="text-lg text-foreground font-semibold">还没有人物档案</Text>
            <Text className="mt-2 text-center text-[13px] text-muted leading-5">
              先新增一位你想认真维系的人，{'\n'}下一次聊天后就能让我帮你分析
            </Text>
            <TouchableOpacity onPress={openAdd} className="mt-6 bg-foreground px-6 h-11 rounded-full items-center justify-center">
              <Text className="text-white font-medium">创建第一个人物</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/person', { id: item.id })}
            className="bg-white rounded-2xl px-5 py-4 mb-3 border border-[#F0F0F0]"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 flex-row items-center">
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: item.avatar_color || '#FF7A5C', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text className="text-lg font-bold text-white">{item.name?.charAt(0)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-semibold text-foreground">{item.name}</Text>
                  <Text className="mt-0.5 text-[13px] text-muted">
                    {item.relationship || '未填写关系'}
                  </Text>
                  <Text className="mt-2 text-[11px] text-muted">{formatInteraction(item.last_interaction_at)}</Text>
                </View>
              </View>
              <View className="flex-row items-center space-x-1">
                <TouchableOpacity onPress={() => openEdit(item)} hitSlop={8} className="w-9 h-9 items-center justify-center">
                  <Text className="text-[13px] text-muted">编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={8} className="w-9 h-9 items-center justify-center">
                  <Text className="text-[13px] text-danger">删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* 档案 Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View className="flex-1 bg-black/30 justify-end">
          <View className="bg-white rounded-t-3xl p-6 pb-8 max-h-[88%]">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-xl font-bold text-foreground">{editing ? '编辑档案' : '新增人物'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={10}>
                <Text className="text-2xl text-muted">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text className="text-[13px] text-muted mb-1.5">称呼</Text>
              <TextInput
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
                placeholder="如：安安 / 张老师"
                placeholderTextColor="#C9C9C9"
                className="bg-[#F6F6F6] rounded-xl px-4 h-12 text-base text-foreground mb-4"
              />
              <Text className="text-[13px] text-muted mb-1.5">关系</Text>
              <TextInput
                value={form.relationship}
                onChangeText={(t) => setForm({ ...form, relationship: t })}
                placeholder="如：大学同学 / 同事"
                placeholderTextColor="#C9C9C9"
                className="bg-[#F6F6F6] rounded-xl px-4 h-12 text-base text-foreground mb-4"
              />
              <Text className="text-[13px] text-muted mb-1.5">头像颜色圆点</Text>
              <View className="flex-row flex-wrap mb-4">
                {AVATAR_COLORS_HOME.map((c) => (
                  <TouchableOpacity key={c} onPress={() => setForm({ ...form, avatar_color: c })} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c, marginRight: 10, alignItems: 'center', justifyContent: 'center' }}>
                    {form.avatar_color === c && <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: '#FFFFFF' }} />}
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="text-[13px] text-muted mb-1.5">背景备注（性格 / 聊天风格 / 当前阶段）</Text>
              <TextInput
                value={form.background}
                onChangeText={(t) => setForm({ ...form, background: t })}
                placeholder="帮助 AI 更好地理解这个人，如：外向爱开玩笑，最近在忙提案"
                placeholderTextColor="#C9C9C9"
                multiline
                className="bg-[#F6F6F6] rounded-xl px-4 py-3 text-base text-foreground min-h-[90px] mb-4"
              />

              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-[13px] text-muted">重要日期</Text>
                <TouchableOpacity
                  onPress={() => setForm({ ...form, dates: [...form.dates, { name: '', month_day: '' }] })}
                >
                  <Text className="text-accent text-[13px] font-medium">＋ 添加</Text>
                </TouchableOpacity>
              </View>
              {form.dates.map((d, i) => (
                <View key={i} className="flex-row items-center mb-2 space-x-2">
                  <TextInput
                    value={d.name}
                    onChangeText={(t) => updateDate(i, { name: t })}
                    placeholder="如：生日"
                    placeholderTextColor="#C9C9C9"
                    className="flex-1 bg-[#F6F6F6] rounded-xl px-4 h-11 text-[15px] text-foreground"
                  />
                  <TextInput
                    value={d.month_day}
                    onChangeText={(t) => updateDate(i, { month_day: t })}
                    placeholder="月-日"
                    placeholderTextColor="#C9C9C9"
                    className="w-28 bg-[#F6F6F6] rounded-xl px-3 h-11 text-[15px] text-foreground text-center"
                  />
                  <TouchableOpacity onPress={() => setForm({ ...form, dates: form.dates.filter((_, idx) => idx !== i) })} hitSlop={8}>
                    <Text className="text-danger">✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View className="flex-row space-x-3 mt-4">
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                className="flex-1 h-12 rounded-xl bg-[#F1F1F1] items-center justify-center"
              >
                <Text className="text-foreground font-medium">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                className="flex-1 h-12 rounded-xl bg-foreground items-center justify-center"
              >
                <Text className="text-white font-medium">{saving ? '保存中…' : '保存'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}