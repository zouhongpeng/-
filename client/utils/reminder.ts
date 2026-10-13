import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UpcomingDate {
  id: string;
  person_id: string;
  name: string;
  month_day: string;
  person_name: string;
  remind_in: number;
  date: string;
}

const REMIND_WINDOW = 3; // 提前 3 天提醒
const notifiedKey = 'reply-assistant.notified-dates';

/**
 * 过滤出需要提醒（3 天内）的重要日期
 */
export function dueDates(list: UpcomingDate[]): UpcomingDate[] {
  return (list || []).filter((d) => d.remind_in <= REMIND_WINDOW && d.remind_in >= 0);
}

async function getNotified(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(notifiedKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function markNotified(id: string) {
  try {
    const cur = await getNotified();
    if (!cur.includes(id)) await AsyncStorage.setItem(notifiedKey, JSON.stringify([...cur, id]));
  } catch {
    /* ignore */
  }
}

/**
 * 浏览器系统通知（web 端），移动端为纯静默降级。
 * 返回是否实际触发。
 */
export async function notifyBrowser(title: string, body: string): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  try {
    const g = globalThis as any;
    if (!('Notification' in g)) return false;
    if (g.Notification.permission === 'granted') {
      new g.Notification(title, { body });
      return true;
    }
    if (g.Notification.permission !== 'denied') {
      const perm = await g.Notification.requestPermission();
      if (perm === 'granted') {
        new g.Notification(title, { body });
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * 统一的日期提醒入口：
 * - 3 天内的重要日期 → 触发浏览器通知（仅一次）+ 返回提醒文案供页面展示
 */
export async function evaluateDateReminders(list: UpcomingDate[]): Promise<UpcomingDate[]> {
  const due = dueDates(list);
  for (const d of due) {
    const notified = await getNotified();
    if (notified.includes(d.id)) continue;
    notifyBrowser(
      `${d.person_name}的${d.name}`,
      `还有 ${d.remind_in} 天（${d.date}），要不要主动问候一下？`,
    );
    await markNotified(d.id);
  }
  return due;
}