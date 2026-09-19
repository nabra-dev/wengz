# Hostinger VPS deploy (GitHub Actions)

Automated deploys run on every push to `main` (and via **Actions → CI and Deploy → Run workflow**).

## What runs

1. **CI** (GitHub, ~1 min): `npm ci`, type-check, lint. No production build here (avoids building twice).
2. **Deploy** (SSH → VPS): `/usr/local/bin/deploy-nabra.sh`
   - `git fetch` + `reset --hard origin/main`
   - `npm ci` **only if** `package-lock.json` changed
   - `db:push` **only if** `prisma/schema.prisma` changed
   - `npm run build` (reuses `.next/cache` when present)
   - `pm2 restart` + health check; rollback on failure
   - logs: `/var/log/nabra-deploy.log`

App secrets stay in `/var/www/nabra-ai-system/.env` on the VPS. GitHub only needs SSH access.

## Domain: `wengz.tech`

Canonical app URL: `https://wengz.tech` (also serve `www.wengz.tech`).

### DNS (at your registrar)

Point both to the VPS IP `72.62.181.253`:

| Type | Name | Value |
|------|------|--------|
| A | `@` | `72.62.181.253` |
| A | `www` | `72.62.181.253` |

### VPS `.env` (then rebuild / PM2 restart)

```bash
cd /var/www/nabra-ai-system
nano .env
# set:
# NEXTAUTH_URL=https://wengz.tech
# NEXT_PUBLIC_APP_URL=https://wengz.tech
# NEXT_PUBLIC_GTM_ID=GTM-58DDFXLX
# CONTACT_FORMS_RECIPIENT=info@wengz.tech   # if you have that mailbox
# SMTP_* From address if needed

pm2 restart nabra-ai-system --update-env
# or full deploy: /usr/local/bin/deploy-nabra.sh
```

`NEXT_PUBLIC_*` is baked into the client at **build** time — you must run `npm run build` (or the deploy script) after changing it.

### Nginx + SSL

```bash
# Issue cert (after DNS propagates)
certbot --nginx -d wengz.tech -d www.wengz.tech

# Optional: redirect old nabarawy hosts to wengz
# (adjust server_name / return in the nabarawy site config)
# return 301 https://wengz.tech$request_uri;
nginx -t && systemctl reload nginx
```

### Large uploads (request attachments up to 500MB)

Request/delivery files use **chunked** uploads (~5MB parts) to local disk. Nginx still needs room for a chunk (and for small single-shot uploads ≤20MB):

```nginx
# inside the wengz.tech server { } block
client_max_body_size 32m;
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

| Secret | Example | Notes |
|--------|---------|--------|
| `VPS_HOST` | `72.62.181.253` | Or hostname |
| `VPS_USER` | `root` | SSH user |
| `VPS_SSH_KEY` | full private key PEM | Dedicated **deploy** key, not your daily laptop key |
| `VPS_PORT` | `22` | Optional; defaults to 22 |

Generate a dedicated key for Actions (on your laptop or VPS):

```bash
ssh-keygen -t ed25519 -f ./nabra-gha-deploy -N "" -C "github-actions-nabra"
```

- Add **public** key to VPS: `~/.ssh/authorized_keys` for `VPS_USER`
- Put **private** key contents into `VPS_SSH_KEY` (including `-----BEGIN ... KEY-----` lines)

## Manual deploy (no GitHub)

```bash
ssh root@72.62.181.253 '/usr/local/bin/deploy-nabra.sh'
```

## Notes

- Until Prisma migration files exist, deploy uses `npm run db:push` (`--accept-data-loss`). That is required for intentional column drops (e.g. removing `hasWhatsapp`). Switch the script to `npm run db:migrate:deploy` when migrations are committed.
- Concurrent deploys are blocked by `/var/lib/nabra/deploy.lock` and by the workflow `concurrency` group.
- After changing `scripts/deploy-nabra.sh`, reinstall it on the VPS before the next Actions deploy (or pull manually once, then install).
