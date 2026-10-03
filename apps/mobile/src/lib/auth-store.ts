import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "wengz_access_token";
const USER_KEY = "wengz_user";
const LOCALE_KEY = "wengz_locale";

/** SecureStore is native-only; web uses AsyncStorage for local Mac testing. */
const storage = {
  getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  deleteItem(key: string): Promise<void> {
    if (Platform.OS === "web") return AsyncStorage.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  },
};

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  image: string | null;
  phone: string | null;
};

export async function getAccessToken(): Promise<string | null> {
  return storage.getItem(TOKEN_KEY);
}

export async function setSession(params: { accessToken: string; user: StoredUser }): Promise<void> {
  await storage.setItem(TOKEN_KEY, params.accessToken);
  await storage.setItem(USER_KEY, JSON.stringify(params.user));
}

export async function getStoredUser(): Promise<StoredUser | null> {
  const raw = await storage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await storage.deleteItem(TOKEN_KEY);
  await storage.deleteItem(USER_KEY);
}

export async function getStoredLocale(): Promise<"en" | "ar"> {
  const v = await storage.getItem(LOCALE_KEY);
  return v === "ar" ? "ar" : "en";
}

export async function setStoredLocale(locale: "en" | "ar"): Promise<void> {
  await storage.setItem(LOCALE_KEY, locale);
}
