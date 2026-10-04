# Hostinger VPS deploy (GitHub Actions)

Automated deploys run on every push to `main` (and via **Actions → CI and Deploy → Run workflow**).

## What runs

1. **CI** (GitHub, ~1 min): `npm ci`, type-check, lint. No production build here (avoids building twice).
2. **Deploy** (SSH → VPS): `/usr/local/bin/deploy-nabra.sh`
   - `git fetch` + `reset --hard origin/main`
   - `npm ci` **only if** `package-lock.json` changed
   - `db:push` **only if** `prisma/schema.prisma` changed
   - `npm run build` into `.next-staging` (reuses `.next/cache`), then swap onto `.next` and restart
   - `pm2 restart` + health check; restore the previous build on failure
   - logs: `/var/log/nabra-deploy.log`

App secrets stay in `/var/www/nabra-ai-system/.env` on the VPS. GitHub only needs SSH access.

## SSH access (laptop → production)

Use this when you need to change production secrets, inspect PM2, or run a one-off deploy **without** waiting on GitHub Actions.

### Connection details

|               |                                                                           |
| ------------- | ------------------------------------------------------------------------- |
| Host          | `72.62.181.253`                                                           |
| User          | `root`                                                                    |
| App dir       | `/var/www/nabra-ai-system`                                                |
| App `.env`    | `/var/www/nabra-ai-system/.env` (not in git; source of truth for secrets) |
| Process       | PM2 app name `nabra-ai-system`                                            |
| Deploy script | `/usr/local/bin/deploy-nabra.sh`                                          |

### Deploy key on your machine

GitHub Actions and local ops share the same dedicated key pair (already authorized on the VPS):

- Private: `nabra-gha-deploy` (repo root, **gitignored** — never commit)
- Public: `nabra-gha-deploy.pub` (gitignored)

If the private key is missing locally, restore it from a password manager / secure backup, or regenerate and update both VPS `authorized_keys` and GitHub secret `VPS_SSH_KEY` (see [GitHub Actions secrets](#github-actions-secrets)).

Permissions:

```bash
chmod 600 nabra-gha-deploy
```

### Connect

From the repo root:

```bash
ssh -i ./nabra-gha-deploy -o IdentitiesOnly=yes root@72.62.181.253
```

One-shot remote command:

```bash
ssh -i ./nabra-gha-deploy -o IdentitiesOnly=yes root@72.62.181.253 'hostname; pm2 list'
```

Optional `~/.ssh/config` alias:

```sshconfig
Host wengz-prod
  HostName 72.62.181.253
  User root
  IdentityFile /ABSOLUTE/PATH/TO/nabra-ai-system/nabra-gha-deploy
  IdentitiesOnly yes
```

Then: `ssh wengz-prod`.

Hostinger panel also shows `ssh root@72.62.181.253` (password login). Prefer the deploy key above so you do not rely on the root password day to day.

### Common production updates over SSH

**Edit secrets (SMTP, etc.)**

```bash
cd /var/www/nabra-ai-system
nano .env
grep '^EMAIL_' .env
```

Local `.env` / `.env.production` on your laptop do **not** deploy. Only the VPS file matters at runtime.

**Apply env changes to the running app**

Next.js will **not** override variables already set on the Node process. If PM2 was once started with old `EMAIL_*` (or other) values, they stay in `~/.pm2/dump.pm2` and win over `.env`.

Check what the process actually has:

```bash
pm2 env 0 | grep -E 'EMAIL_|NEXTAUTH_|CONTACT_FORMS'
```

Preferred restart after `.env` edits (drops stale PM2-baked env so Next loads `.env`):

```bash
cd /var/www/nabra-ai-system
pm2 delete nabra-ai-system
pm2 start npm --name nabra-ai-system --cwd /var/www/nabra-ai-system -- start
pm2 save
curl -fsS http://127.0.0.1:3000/api/health
```

`pm2 restart nabra-ai-system --update-env` only refreshes env from the **current shell**, not from `.env`. Prefer delete + start when secrets changed.

**Full code deploy (same as Actions)**

```bash
/usr/local/bin/deploy-nabra.sh
tail -n 80 /var/log/nabra-deploy.log
```

**Logs**

```bash
pm2 logs nabra-ai-system --lines 100
tail -n 100 /var/log/nabra-deploy.log
```

### Security

- Keep `nabra-gha-deploy` off git, chat, and screenshots.
- Do not paste production `.env` contents into tickets or PRs.
- Rotate the key if it leaks: new key → VPS `authorized_keys` → GitHub `VPS_SSH_KEY` → remove the old public key from the VPS.

## Domain: `wengz.tech`

Canonical app URL: **`https://wengz.tech`** (apex). `www` must **301** to apex so Google does not treat two hosts as duplicates.

### DNS (at your registrar)

Point both to the VPS IP `72.62.181.253`:

| Type | Name  | Value           |
| ---- | ----- | --------------- |
| A    | `@`   | `72.62.181.253` |
| A    | `www` | `72.62.181.253` |

### VPS `.env` (then rebuild / PM2 restart)

```bash
cd /var/www/nabra-ai-system
nano .env
# set (apex only — do not use www):
# NEXTAUTH_URL=https://wengz.tech
# NEXT_PUBLIC_APP_URL=https://wengz.tech
# NEXT_PUBLIC_GTM_ID=GTM-58DDFXLX
# GOOGLE_SITE_VERIFICATION=...   # optional meta tag for Search Console
# CONTACT_FORMS_RECIPIENT=info@wengz.tech   # if you have that mailbox
# SMTP_* From address if needed

pm2 restart nabra-ai-system --update-env
# or full deploy: /usr/local/bin/deploy-nabra.sh
```

`NEXT_PUBLIC_*` is baked into the client at **build** time — you must run `npm run build` (or the deploy script) after changing it.

In Google Search Console prefer a **Domain** property on `wengz.tech`, or the URL-prefix `https://wengz.tech`. Submit `https://wengz.tech/sitemap.xml`.

### Nginx + SSL

```bash
# Issue cert (after DNS propagates)
certbot --nginx -d wengz.tech -d www.wengz.tech
```

Prefer an explicit www → apex redirect (in addition to the app middleware redirect):

```nginx
# /etc/nginx/sites-available/wengz-www-redirect (or inside ssl server blocks)
server {
  listen 443 ssl http2;
  server_name www.wengz.tech;
  # ssl_certificate … (certbot)
  return 301 https://wengz.tech$request_uri;
}

server {
  listen 443 ssl http2;
  server_name wengz.tech;
  # … proxy_pass to Next / PM2 …
}
```

```bash
# Optional: redirect old nabarawy hosts to wengz
# return 301 https://wengz.tech$request_uri;
nginx -t && systemctl reload nginx
```

The Next.js proxy also 301s `www.wengz.tech` → `wengz.tech` for matched routes; nginx covers static files (`robots.txt`, assets) the matcher skips.

### Large uploads (request attachments up to 500MB)

Request/delivery files use **chunked** uploads (~5MB parts) to local disk. Nginx still needs room for a chunk and for single-shot uploads (creator CVs up to 50MB):

```nginx
# inside the wengz.tech server { } block
client_max_body_size 64m;
proxy_read_timeout 600s;
proxy_send_timeout 600s;
proxy_request_buffering off;
```

Then `nginx -t && systemctl reload nginx`.

Ensure the VPS volume behind `LOCAL_UPLOAD_DIR` (default `storage/` in the app dir) has enough free space. Incomplete chunk sessions live under `storage/uploads/<userId>/.tmp/` and are removed on complete/abort.

## One-time VPS setup

### 1. Install the deploy script

From the app directory (after pulling this commit):

```bash
sudo install -m 755 /var/www/nabra-ai-system/scripts/deploy-nabra.sh /usr/local/bin/deploy-nabra.sh
sudo mkdir -p /var/lib/nabra
sudo touch /var/log/nabra-deploy.log
sudo chmod 644 /var/log/nabra-deploy.log
```

Re-install the script whenever `scripts/deploy-nabra.sh` changes (or add a line in the script to self-copy from the repo after `git reset`).

### 2. Let the VPS pull from GitHub

Create a **read-only deploy key** for this repo and add it on the VPS:

```bash
sudo -u root ssh-keygen -t ed25519 -f /root/.ssh/nabra_github_ro -N "" -C "nabra-vps-deploy"
cat /root/.ssh/nabra_github_ro.pub
```

In GitHub: **Settings → Deploy keys → Add** (read-only), paste the public key.

Configure SSH for `github.com`:

```bash
cat >> /root/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile /root/.ssh/nabra_github_ro
  IdentitiesOnly yes
EOF
chmod 600 /root/.ssh/config
```

Ensure the app remote uses SSH:

```bash
cd /var/www/nabra-ai-system
git remote -v
# if https, switch:
git remote set-url origin git@github.com:omarahmed8k/nabra-ai-system.git
git fetch origin
```

### 3. Smoke-test locally on the VPS

```bash
/usr/local/bin/deploy-nabra.sh
tail -n 50 /var/log/nabra-deploy.log
curl -fsS http://127.0.0.1:3000/api/health
```

## GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions**:

| Secret        | Example              | Notes                                               |
| ------------- | -------------------- | --------------------------------------------------- |
| `VPS_HOST`    | `72.62.181.253`      | Or hostname                                         |
| `VPS_USER`    | `root`               | SSH user                                            |
| `VPS_SSH_KEY` | full private key PEM | Dedicated **deploy** key, not your daily laptop key |
| `VPS_PORT`    | `22`                 | Optional; defaults to 22                            |

Generate a dedicated key for Actions (on your laptop or VPS):

```bash
ssh-keygen -t ed25519 -f ./nabra-gha-deploy -N "" -C "github-actions-nabra"
```

- Add **public** key to VPS: `~/.ssh/authorized_keys` for `VPS_USER`
- Put **private** key contents into `VPS_SSH_KEY` (including `-----BEGIN ... KEY-----` lines)

## Manual deploy (no GitHub)

Using the [SSH access](#ssh-access-laptop--production) key:

```bash
ssh -i ./nabra-gha-deploy -o IdentitiesOnly=yes root@72.62.181.253 '/usr/local/bin/deploy-nabra.sh'
```

Or, if you already have shell access:

```bash
ssh root@72.62.181.253 '/usr/local/bin/deploy-nabra.sh'
```

## Notes

- Until Prisma migration files exist, deploy uses `npm run db:push` (`--accept-data-loss`). That is required for intentional column drops (e.g. removing `hasWhatsapp`). Switch the script to `npm run db:migrate:deploy` when migrations are committed.
- Concurrent deploys are blocked by `/var/lib/nabra/deploy.lock` and by the workflow `concurrency` group.
- After changing `scripts/deploy-nabra.sh`, reinstall it on the VPS before the next Actions deploy (or pull manually once, then install).
