/**
 * Minimal API smoke test for mobile REST + Bearer auth.
 * Usage:
 *   API_URL=http://localhost:3001 SMOKE_EMAIL=a@b.com SMOKE_PASSWORD=secret node scripts/smoke.mjs
 */
const API_URL = (process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001").replace(
  /\/$/,
  ""
);
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

if (!email || !password) {
  console.error("Set SMOKE_EMAIL and SMOKE_PASSWORD");
  process.exit(1);
}

async function rest(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_URL}/api/rest${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Locale": "en",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${typeof data === "string" ? data : data?.message}`);
  }
  return data;
}

const login = await rest("/auth/mobile-login", {
  method: "POST",
  body: { email, password },
});
if (!login.accessToken) throw new Error("No accessToken");
if (login.user?.role !== "CLIENT") throw new Error(`Expected CLIENT, got ${login.user?.role}`);

const token = login.accessToken;
await rest("/subscription/active", { token });
const list = await rest("/request/list?limit=5", { token });
if (!Array.isArray(list.requests)) throw new Error("request/list missing requests");
await rest("/notification?limit=5", { token });
await rest("/user/me", { token });

console.log("smoke ok", {
  user: login.user.email,
  requests: list.requests.length,
});
