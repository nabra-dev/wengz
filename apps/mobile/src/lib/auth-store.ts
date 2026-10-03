import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "wengz_access_token";
const USER_KEY = "wengz_user";
const LOCALE_KEY = "wengz_locale";

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  image: string | null;
  phone: string | null;
};

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setSession(params: { accessToken: string; user: StoredUser }): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, params.accessToken);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(params.user));
}

export async function getStoredUser(): Promise<StoredUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function getStoredLocale(): Promise<"en" | "ar"> {
  const v = await SecureStore.getItemAsync(LOCALE_KEY);
  return v === "ar" ? "ar" : "en";
}

export async function setStoredLocale(locale: "en" | "ar"): Promise<void> {
  await SecureStore.setItemAsync(LOCALE_KEY, locale);
}
