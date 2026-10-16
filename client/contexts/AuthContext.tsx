// @ts-nocheck
/**
 * PIN 锁认证上下文
 * - 首次使用：设置 4 位 PIN
 * - 之后：输入 PIN 解锁
 * - token 存 AsyncStorage，持久化保持解锁态
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, setPinToken, getPinToken } from "@/utils/api";

const TOKEN_KEY = "reply-assistant.pin-token";

interface AuthContextType {
  loaded: boolean; // 是否已从后端获取初始化状态
  initialized: boolean | null; // PIN 是否已初始化
  isUnlocked: boolean;
  token: string | null;
  unlock: (pin: string) => Promise<void>;
  setup: (pin: string) => Promise<void>;
  disableLock: () => Promise<void>;
  lock: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  loaded: false,
  initialized: null,
  isUnlocked: false,
  token: null,
  unlock: async () => { throw new Error("Auth not ready"); },
  setup: async () => { throw new Error("Auth not ready"); },
  disableLock: async () => { throw new Error("Auth not ready"); },
  lock: async () => { throw new Error("Auth not ready"); },
  refetch: async () => { return; },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loaded, setLoaded] = useState(false);
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // 从 AsyncStorage 恢复 token
  const restoreToken = async () => {
    try {
      const t = await AsyncStorage.getItem(TOKEN_KEY);
      if (t) {
        setPinToken(t);
        setToken(t);
      }
    } catch {
      // 忽略恢复失败
    }
  };

  const fetchStatus = async () => {
    try {
      const st = await api.pinStatus();
      setInitialized(st.initialized);
    } catch {
      setInitialized(null);
    }
  };

  useEffect(() => {
    (async () => {
      await restoreToken();
      await fetchStatus();
      setLoaded(true);
    })();
  }, []);

  const persist = async (t: string) => {
    setPinToken(t);
    setToken(t);
    try {
      await AsyncStorage.setItem(TOKEN_KEY, t);
    } catch {
      // 忽略
    }
  };

  const unlock = async (pin: string) => {
    const res = await api.pinUnlock(pin);
    await persist(res.token);
    setInitialized(true);
  };

  const setup = async (pin: string) => {
    const res = await api.pinSetup(pin);
    await persist(res.token);
    setInitialized(true);
  };

  const disableLock = async () => {
    await api.pinDisable();
    setPinToken(null);
    setToken(null);
    setInitialized(false);
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch {
      // 忽略
    }
  };

  const lock = async () => {
    setPinToken(null);
    setToken(null);
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch {
      // 忽略
    }
  };

  const refetch = async () => {
    await fetchStatus();
  };

  return (
    <AuthContext.Provider
      value={{
        loaded,
        initialized,
        isUnlocked: initialized === false ? true : !!(token && getPinToken()),
        token,
        unlock,
        setup,
        disableLock,
        lock,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};