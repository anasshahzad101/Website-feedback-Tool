# Deploy on a VPS (OpenLiteSpeed + Node.js)

This app is **Next.js 15**, **Prisma + MySQL**, and **Auth.js**. OpenLiteSpeed (OLS) sits in front and **reverse-proxies** to Node (recommended). Below assumes a fresh **Ubuntu 22.04/24.04** VPS; adapt paths if you use Debian, AlmaLinux, or **CyberPanel** (which bundles OLS).

---

## 1. What you need on the server

| Component | Notes |
|-----------|--------|
| **Node.js** | **20.x or 22.x** (`node -v`). This repo expects `>=20`. |
| **MySQL** | 8.x locally on the VPS or a managed DB (same `DATABASE_URL` idea as Hostinger). |
| **OpenLiteSpeed** | Web server + TLS; will proxy to Node. |
| **PM2** (recommended) | Keeps `next start` running and restarts on reboot. |
| **Git** | To pull updates from GitHub. |

---

## 2. MySQL

```bash
sudo mysql -e "CREATE DATABASE your_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'your_app'@'localhost' IDENTIFIED BY 'strong_password';"
sudo mysql -e "GRANT ALL PRIVILEGES ON your_app.* TO 'your_app'@'localhost'; FLUSH PRIVILEGES;"
```

Build your `DATABASE_URL`:

`mysql://your_app:strong_password@127.0.0.1:3306/your_app`

(URL-encode special characters in the password: `@` → `%40`, `#` → `%23`, etc.)

---

## 3. App directory and code

```bash
sudo mkdir -p /var/www
sudo chown "$USER":"$USER" /var/www
cd /var/www
git clone https://github.com/anasshahzad101/Website-feedback-Tool.git website-feedback-tool
cd website-feedback-tool
```

Create **`.env`** (never commit it). Copy from **`hostinger.env.template`** or **`.env.example`** and set at least:

| Variable | Example |
|----------|---------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `mysql://user:pass@127.0.0.1:3306/dbname` |
| `USE_SQLITE` | `false` or unset |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_URL` | `https://yourdomain.com` (no trailing slash) |
| `NEXT_PUBLIC_APP_URL` | same as `AUTH_URL` |
| `STORAGE_TYPE` | `local` |
| `UPLOAD_DIR` | `./public/uploads` |

Install and build:

```bash
npm ci
npx prisma migrate deploy
npm run build
```

Ensure upload directory exists and is writable by the user that runs Node:

```bash
mkdir -p public/uploads
chmod -R u+rwX public/uploads
```

---

## 4. Run Next.js with PM2

Install PM2 globally:

```bash
sudo npm i -g pm2
```

Copy the example config and edit **`cwd`**, domain, and port if needed:

```bash
cp ecosystem.config.example.cjs ecosystem.config.cjs
nano ecosystem.config.cjs
```

PM2 does not load `.env` files automatically. Easiest options:

**A)** Export variables before start (simple):

```bash
set -a && source .env && set +a && pm2 start ecosystem.config.cjs
```

**B)** Put production vars in `ecosystem.config.cjs` under `env: { ... }` (do not commit secrets).

**C)** Use a small shell wrapper that `source`s `.env` then execs `next start`.

Start and enable on boot:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# Run the command PM2 prints (sudo …)
```

Confirm Node is listening (default example uses **3000**):

```bash
curl -sI http://127.0.0.1:3000 | head -3
```

---

## 5. OpenLiteSpeed → reverse proxy to Node

Goal: browsers hit **443** on OLS; OLS forwards to **`http://127.0.0.1:3000`** (or whatever `PORT` you set).

### 5.1 Define a “web server” (backend) in OLS

In **OpenLiteSpeed WebAdmin** (port **7088** by default):

1. **Server Configuration** → **External App** → **Add**.
2. **Name**: e.g. `node_next`
3. **Address**: `http://127.0.0.1:3000`
4. **Max Connections**: reasonable default (e.g. 100)
5. **Init Timeout / Retry Timeout**: e.g. `60` / `0`
6. Save.

(Exact labels vary slightly by OLS version; you want a **proxy / PPROXY / Web Server** style external app pointing at your Node port.)

### 5.2 Map your vhost to that backend

1. **Virtual Hosts** → your site → **Context** → **Add**.
2. **URI**: `/`
3. **Type**: **`proxy`** (or **Proxy**).
4. **Web Server** / **Handler**: select the external app you created (`node_next`).
5. Save and **graceful restart** OpenLiteSpeed.

### 5.3 Headers (recommended)

So Auth.js and redirects see the public URL, the reverse proxy should pass:

- `X-Forwarded-Proto: https`
- `X-Forwarded-Host: yourdomain.com`

Many OLS proxy contexts have **“Add default header”** or custom header fields. If something is off, set these in the proxy context or in OLS global rewrite rules. Keep **`AUTH_URL`** and **`NEXT_PUBLIC_APP_URL`** exactly matching the URL users type in the browser.

### 5.4 Large uploads (comments / files)

The app allows large server actions in `next.config.js`. If uploads fail with 413, increase **max body** in OLS for that vhost (and any LiteSpeed cache limits) to at least **50–100 MB** if you use big attachments.

---

## 6. TLS (HTTPS)

- **CyberPanel**: often has **SSL** per site (Let’s Encrypt).
- **Plain OLS**: use WebAdmin **SSL** for the vhost, or terminate with **Certbot** + configure the certificate path in the vhost.

You must use **HTTPS** in production for `AUTH_URL` / cookies.

---

## 7. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Do NOT expose 3000 publicly if OLS proxies locally
sudo ufw enable
```

---

## 8. After each deploy

```bash
cd /var/www/website-feedback-tool
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart website-feedback-tool
```

---

## 9. Health check

Open:

`https://yourdomain.com/api/health`

Fix anything reported missing (especially `AUTH_URL`, `DATABASE_URL`).

---

## 10. Troubleshooting

| Symptom | Check |
|--------|--------|
| **502 / bad gateway** | `pm2 logs website-feedback-tool`, `curl http://127.0.0.1:3000`, OLS external app URL/port. |
| **Login loops / CSRF** | `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `AUTH_TRUST_HOST`, HTTPS, `X-Forwarded-*` headers. |
| **500 on API** | Server logs, `npx prisma migrate deploy`, MySQL user host (`localhost` vs `127.0.0.1`). |
| **Uploads 404** | `public/uploads` exists, same disk as app, permissions; `UPLOAD_DIR` matches. |

---

## References

- [OpenLiteSpeed documentation](https://openlitespeed.org/kb/)
- [Next.js self-hosting](https://nextjs.org/docs/app/building-your-application/deploying#self-hosting)
- [PM2](https://pm2.keymetrics.io/docs/usage/quick-start/)
