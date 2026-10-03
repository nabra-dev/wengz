# Wengz Client (Expo)

Client-only iOS/Android app for Wengz. Talks to the Next.js backend over OpenAPI REST with Bearer JWT + `X-Locale`.

## Setup

From the monorepo root, ensure the API schema includes `PushDevice` (`npx prisma db push` or migrate). Then:

```bash
cd apps/mobile
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to your API origin (dev: http://localhost:3001 or your LAN IP)
npm install
npm start
```

Use a physical device or emulator. For a physical phone, `EXPO_PUBLIC_API_URL` must be reachable from the device (not `localhost` unless using a tunnel).

### Physical iPhone + Expo Go

Apple/Expo require the **same Expo account** on CLI and in Expo Go (this is not a Wengz API env):

```bash
cd apps/mobile
npx expo login          # browser / credentials
npx expo whoami         # confirm
npm start               # Metro on :8083
```

Then in Expo Go → account icon → sign in with that same account → open the project again.

Only Wengz env needed for the app itself:

```bash
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3001
```

## Auth

1. `POST /api/rest/auth/mobile-login` → `{ accessToken, user }`
2. Store token in SecureStore
3. Send `Authorization: Bearer …` and `X-Locale: en|ar` on every call

Web cookie sessions are unchanged.

## Environments

| Profile    | Env                                        | Notes           |
| ---------- | ------------------------------------------ | --------------- |
| Local      | `EXPO_PUBLIC_API_URL=http://<lan-ip>:3001` | `npm start`     |
| Preview    | `eas.json` → `preview.env`                 | Internal builds |
| Production | `eas.json` → `production.env`              | Store builds    |

Replace `extra.eas.projectId` in `app.json` after `eas init`.

## EAS

```bash
npm i -g eas-cli
eas login
eas init
eas build --profile preview --platform all
eas submit --profile production
```

Privacy / terms: reuse the website `/privacy` and `/terms` URLs in store listings.

## Smoke checks

```bash
# With API running and a client account:
npm run smoke
```

Manual: login → home credits → open a request → send a chat message → open notifications → change language.

## Push

On login the app registers an Expo push token via `POST /api/rest/notification/push-device`. The backend fans out from in-app notification helpers.
