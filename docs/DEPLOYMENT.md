# Prompt-to-PWA — Deployment Guide

Last updated: 2026-08-12

## Table of Contents

1. [Overview](#overview)
2. [PocketBase Hosting Options](#pocketbase-hosting-options)
3. [PocketBase Setup](#pocketbase-setup)
4. [Netlify Deployment](#netlify-deployment)
5. [Environment Variables](#environment-variables)
6. [Backup Strategy](#backup-strategy)
7. [Schema Migrations](#schema-migrations)
8. [Domain & SSL](#domain--ssl)
9. [Go-Live Checklist](#go-live-checklist)

---

## Overview

Prompt-to-PWA runs on two services:

| Component | Host | Role |
|-----------|------|------|
| **Frontend + Functions** | Netlify | React SPA, serverless functions (Gemini/Claude proxy, Stripe, ZIP packaging) |
| **Database** | PocketBase | User accounts, generated apps, Stripe event idempotency |

Netlify functions call PocketBase for all data operations. The React frontend also connects directly to PocketBase for real-time auth and polling.

---

## PocketBase Hosting Options

### Option A: pockethost.io (Recommended for MVP)

**Pros:**
- Zero DevOps — managed PocketBase hosting
- Automatic backups, SSL, updates
- Built-in admin UI
- Free tier available for development

**Cons:**
- Less control over server location
- Costs scale with usage ($10-50+/mo)
- Cannot run custom Go hooks

**Setup:**
1. Sign up at [pockethost.io](https://pockethost.io)
2. Create a new project
3. Import the `pb_schema.json` from this repo
4. Note your project URL (e.g., `https://my-project.pockethost.io`)
5. Set `VITE_POCKETBASE_URL` in Netlify env vars to this URL

### Option B: Self-Hosted on VPS

**Pros:**
- Full control over the PocketBase binary
- One fixed cost (~$5-20/mo for a VPS)
- Can run custom Go hooks/extensions
- Better performance (dedicated resources)

**Cons:**
- You manage backups, updates, security
- Need to configure SSL (Let's Encrypt)
- Need to monitor disk and memory

**Recommended VPS Providers:**
- **Hetzner** — CX22 (2 vCPU, 4GB RAM, 40GB SSD) — ~€4/mo
- **DigitalOcean** — Basic Droplet (2 vCPU, 4GB RAM, 80GB SSD) — $24/mo
- **Vultr** — High Frequency (2 vCPU, 4GB RAM, 128GB NVMe) — $24/mo

**Setup (Ubuntu 24.04):**

```bash
# 1. Create a dedicated user
sudo useradd -m -s /bin/bash pocketbase
sudo su - pocketbase

# 2. Download and install PocketBase
mkdir -p ~/pb
cd ~/pb
wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_linux_amd64.zip
unzip pocketbase_0.22.0_linux_amd64.zip
chmod +x pocketbase

# 3. Create a systemd service
sudo tee /etc/systemd/system/pocketbase.service << 'EOF'
[Unit]
Description=PocketBase
After=network.target

[Service]
Type=simple
User=pocketbase
WorkingDirectory=/home/pocketbase/pb
ExecStart=/home/pocketbase/pb/pocketbase serve --http=127.0.0.1:8090
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# 4. Start PocketBase
sudo systemctl daemon-reload
sudo systemctl enable --now pocketbase

# 5. Set up Nginx reverse proxy with SSL
sudo apt install nginx certbot python3-certbot-nginx

sudo tee /etc/nginx/sites-available/pocketbase << 'EOF'
server {
    listen 80;
    server_name pb.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/pocketbase /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 6. Get SSL certificate
sudo certbot --nginx -d pb.yourdomain.com
```

### Option C: Fly.io

**Pros:**
- Simple `fly deploy` workflow
- Auto-scaling, global regions
- Free tier includes 3 shared VMs
- Built-in SSL, persistent volumes

**Cons:**
- Cold starts on free tier
- Persistent volume management adds complexity
- Slightly more complex than pockethost.io

**Setup:**
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Create a fly.toml in your PocketBase directory
fly launch --name prompt-to-pwa-pb --region iad

# Deploy
fly deploy

# Set a volume for data persistence
fly volumes create pb_data --size 1 --region iad

# Your PocketBase will be at: https://prompt-to-pwa-pb.fly.dev
```

---

## PocketBase Setup

### 1. Create Admin Account

On first run, PocketBase serves an admin UI at `http://127.0.0.1:8090/_/`. Visit it and:

1. Enter an admin email and password (use the same values you'll set in Netlify env vars)
2. Navigate to **Settings → Collections**
3. Import the schema:

```bash
# Option A: Use the PocketBase UI
# Go to Settings → Import Collections, paste the contents of pb_schema.json

# Option B: Use the PocketBase CLI
./pocketbase import collections /path/to/pb_schema.json
```

### 2. Configure CORS

In the PocketBase admin UI, go to **Settings → Application**:

Set **Allowed Origins** to your Netlify domain:
```
https://your-app.netlify.app,http://localhost:5173
```

### 3. Configure Collection Access Rules

For the `generated_apps` collection, set these API rules:

| Rule | Expression |
|------|-----------|
| List/Search | `user = @request.auth.id` |
| View | `user = @request.auth.id` |
| Create | `@request.auth.id != ""` |
| Update | `user = @request.auth.id` |
| Delete | `user = @request.auth.id` |

For the `stripe_events` collection, set ALL rules to admin-only:
```
@request.auth.id != "" && @request.auth.id = ""
```
(Leave all blank — effectively admin-only)

### 4. Verify Security

```bash
# Attempt to list generated_apps without auth — should return 0 results
curl https://pb.yourdomain.com/api/collections/generated_apps/records

# Attempt with a user token — should only return that user''s apps
curl -H "Authorization: Bearer USER_TOKEN" \
  https://pb.yourdomain.com/api/collections/generated_apps/records
```

---

## Netlify Deployment

### 1. Connect Repository

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **Add new site → Import an existing project**
3. Connect your GitHub repository
4. Netlify auto-detects the build settings from `netlify.toml`

### 2. Set Environment Variables

In Netlify Dashboard: **Site settings → Environment variables**

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_POCKETBASE_URL` | `https://pb.yourdomain.com` | Client-safe (VITE_ prefix) |
| `POCKETBASE_ADMIN_EMAIL` | `admin@example.com` | Server-only |
| `POCKETBASE_ADMIN_PASSWORD` | `your-strong-password` | Server-only |
| `GEMINI_API_KEY` | `AIza...` | Server-only |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Server-only |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Server-only |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Server-only |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Client-safe |
| `STRIPE_PRO_PRICE_ID` | `price_...` | Server-only |

### 3. Deploy

Push to `main` branch, or trigger manual deploy:
```bash
# Option A: Git push (triggers CI/CD)
git push origin main

# Option B: Netlify CLI
npx netlify-cli deploy --prod --dir=dist

# Option C: Manual deploy in Netlify Dashboard
# Deploys → Trigger deploy → Deploy site
```

### 4. Verify Deploy

```bash
# Check the health endpoint
curl https://your-app.netlify.app/.netlify/functions/health

# Check a protected function (should return 401 without auth)
curl -X POST https://your-app.netlify.app/api/generate-blueprint

# Check CSP headers
curl -I https://your-app.netlify.app | grep -i content-security-policy
```

---

## Environment Variables

Full reference: See `.env.example` in the project root.

### CI/CD Secrets (GitHub Actions)

In GitHub: **Settings → Secrets and variables → Actions**

Set these secrets exactly as named in `deploy.yml`:
- `NETLIFY_AUTH_TOKEN` — from Netlify User Settings → Applications → Personal access tokens
- `NETLIFY_SITE_ID` — from Netlify Site settings → Site details → Site ID
- `SITE_URL` — your production URL (e.g., `https://your-app.netlify.app`)
- Plus all the env vars listed above as GitHub secrets

### Local Development

```bash
cp .env.example .env
# Edit .env with your real values — NEVER commit this file
```

---

## Backup Strategy

### Automated Daily Backups (Recommended)

#### Option A: pockethost.io — Built-in

pockethost.io provides automatic daily backups. Verify in your project dashboard.

#### Option B: Self-Hosted — cron + S3/R2

```bash
#!/bin/bash
# /usr/local/bin/pb-backup.sh
# Run via cron: 0 2 * * * /usr/local/bin/pb-backup.sh

set -e

PB_DIR="/home/pocketbase/pb"
BACKUP_DIR="/tmp/pb-backups"
S3_BUCKET="s3://your-backup-bucket/pocketbase/"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="pb_backup_${DATE}.tar.gz"

mkdir -p "$BACKUP_DIR"

# 1. Stop PocketBase briefly (or use a replica)
sudo systemctl stop pocketbase

# 2. Archive the data directory
tar -czf "$BACKUP_DIR/$BACKUP_FILE" -C "$PB_DIR" pb_data

# 3. Restart PocketBase
sudo systemctl start pocketbase

# 4. Upload to S3 (using AWS CLI or rclone)
aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "$S3_BUCKET$BACKUP_FILE"

# 5. Cleanup old local backups (keep last 7 days)
find "$BACKUP_DIR" -name "pb_backup_*.tar.gz" -mtime +7 -delete

# 6. Optional: Remove old S3 backups (keep last 30 days)
aws s3 ls "$S3_BUCKET" | while read -r line; do
  createDate=$(echo "$line" | awk ''''{print $1" "$2}'''')
  createDate=$(date -d "$createDate" +%s)
  olderThan=$(date -d "30 days ago" +%s)
  if [[ $createDate -lt $olderThan ]]; then
    fileName=$(echo "$line" | awk ''''{print $4}'''')
    aws s3 rm "$S3_BUCKET$fileName"
  fi
done
```

#### Option C: PocketBase''s built-in backup

PocketBase (v0.22+) has an experimental backup API:

```bash
# Requires admin auth
curl -X POST https://pb.yourdomain.com/api/backups \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d ''''{"name": "backup-'$(date +%Y%m%d)'"}''''
```

### Backup Retention Policy

| Period | Retention |
|--------|-----------|
| Daily | 7 days |
| Weekly | 4 weeks |
| Monthly | 12 months |

### Restore Procedure

```bash
# 1. Stop PocketBase
sudo systemctl stop pocketbase

# 2. Move current data aside
mv /home/pocketbase/pb/pb_data /home/pocketbase/pb/pb_data.broken

# 3. Extract backup
tar -xzf pb_backup_YYYY-MM-DD.tar.gz -C /home/pocketbase/pb/

# 4. Start PocketBase
sudo systemctl start pocketbase

# 5. Verify
curl https://pb.yourdomain.com/api/health
```

---

## Schema Migrations

### Adding a New Field

1. **In PocketBase admin UI**: Add the field to the collection
2. **Update `pb_schema.json`**: Export and commit the updated schema
3. **Update types** (if using TypeScript): Add the field to `types.ts`

```bash
# Export updated schema to commit to Git
# Go to PocketBase admin → Settings → Export Collections → Copy JSON
# Paste into pb_schema.json and commit
```

### Adding a New Collection

1. Create the collection in PocketBase admin UI
2. Set access rules immediately (default is public read!)
3. Export and update `pb_schema.json`
4. Update any TypeScript types

### Migration Safety Rules

- **Never** delete a field without checking all code references
- **Never** change a field type — create a new field and migrate data
- Always test migrations on a staging instance first
- Keep `pb_schema.json` in sync with what''s actually deployed

---

## Domain & SSL

### Custom Domain on Netlify

1. Go to **Site settings → Domain management → Add custom domain**
2. Add your domain (e.g., `app.prompt-to-pwa.com`)
3. Update DNS with your registrar:
   - If using Netlify DNS: Add nameservers `dns1.p01.nsone.net` through `dns4.p01.nsone.net`
   - If using external DNS: Add a `CNAME` record pointing to `your-site.netlify.app`
4. Netlify auto-provisions SSL via Let''s Encrypt

### Custom Domain for PocketBase

1. Point a DNS `A` record to your VPS IP
2. Or, for pockethost.io, use their custom domain feature
3. Set `VITE_POCKETBASE_URL` to the custom domain

---

## Go-Live Checklist

- [ ] PocketBase is running with admin account created
- [ ] PocketBase CORS allows the Netlify domain
- [ ] PocketBase collection access rules are set (NOT public)
- [ ] All Netlify environment variables are set
- [ ] Stripe webhook endpoint is configured in Stripe Dashboard
- [ ] Stripe webhook secret matches between Netlify and Stripe
- [ ] `netlify.toml` CSP headers are correct
- [ ] Function timeouts are configured (compile-app=120s)
- [ ] `.env.example` is up to date
- [ ] GitHub CI/CD pipeline is configured with secrets
- [ ] `scripts/validate-env.mjs` passes on CI
- [ ] Health check endpoint returns `ok`
- [ ] SSL is working on all endpoints
- [ ] Backup cron job is running (self-hosted PB only)
- [ ] Monitoring and alerting is configured (see `MONITORING.md`)

---

## Support

- PocketBase: [pocketbase.io/docs](https://pocketbase.io/docs)
- Netlify Functions: [docs.netlify.com/functions](https://docs.netlify.com/functions)
- Stripe Webhooks: [docs.stripe.com/webhooks](https://docs.stripe.com/webhooks)
