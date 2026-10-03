import Constants from "expo-constants";

const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

/** Backend origin (Next.js). Dev default matches `npm run dev` port 3001. */
export const API_URL = fromEnv || fromExtra || "http://localhost:3001";

export const REST_BASE = `${API_URL}/api/rest`;
export const UPLOAD_URL = `${API_URL}/api/upload`;
