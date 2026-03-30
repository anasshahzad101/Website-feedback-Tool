# Hostinger deployment – SpeedX Feedback Tool

Deploy this Next.js + Prisma app via **ZIP upload** on Hostinger. This repo is tuned for **low process/thread counts** during install and build (shared plans with caps around **~200 processes**).

**VPS + OpenLiteSpeed + PM2:** see **[`DEPLOY-VPS-OPENLITESPEED.md`](DEPLOY-VPS-OPENLITESPEED.md)** and **`ecosystem.config.example.cjs`**. For **push-to-deploy or a one-command script**, see **section 11** in that file (`scripts/deploy-vps.sh`, optional GitHub Actions workflow).

---

## 0. Deploy from scratch on Hostinger (clean slate)

1. **MySQL** — Create a database and user in hPanel; note host, name, user, password.
2. **Env vars** — In the Node app → Environment variables, set everything in **section 3** (especially `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`). Optionally add the **process-limit** vars in **section 2a** below.
3. **ZIP** — From your machine, zip the project per **section 1** (no `node_modules`, no `.env`). Upload the new ZIP (replace the old app files if you are reusing the same app slot).
4. **Build settings** — Set install / build / start commands exactly as in **section 2** (use `npm ci` and `npm run build`).
5. **Deploy once** — Start a single deployment and **wait until it finishes** before clicking deploy again (overlapping runs multiply processes and often hit the limit).
6. **Migrations** — After the first successful deploy, run `npx prisma migrate deploy` (SSH or Hostinger’s terminal) against the same `DATABASE_URL`.
7. **Smoke test** — Open `/api/health` on your live URL and fix any reported env/DB issues.

---

## 1. ZIP contents (what to include / exclude)

- **Include:** `src/`, `public/`, `prisma/`, `package.json`, `package-lock.json`, `next.config.*`, `tsconfig.json`, `.env.example`, and any other config at project root. You may include a pre-built `.next` for faster deploy, but Hostinger will run `npm run build` anyway.
- **Do NOT include:** `node_modules/`, `.env` (secrets), `.git/`.

Hostinger runs **Install → Build → Start**. If `node_modules` is in the ZIP, install can behave oddly; their docs say to avoid uploading it.

---

## 2. Build settings in Hostinger

In the Node.js app **Build settings** (or **Settings & Redeploy**), use:

| Setting | Value |
|--------|--------|
| **Framework** | Next.js |
| **Node.js version** | 18.x, 20.x, or 22.x (match `engines` in `package.json`) |
| **Install command** | `npm ci` (preferred) or `npm install` |
| **Build command** | `npm run build` (`scripts/prisma-generate.mjs` + `scripts/next-build.mjs`: no `npx` chain, `UV_THREADPOOL_SIZE=1`, `VIPS_CONCURRENCY=1`, and `next.config.js` caps webpack / static generation) |
| **Start command** | `npm start` or `npm run start` (no build; only `scripts/next-start.mjs` → `next start`) |

The `start` script uses **`process.env.PORT`** and **`0.0.0.0`** via `scripts/next-start.mjs`. Do not add `next build` or `prisma` here.

**Application root:** Leave as the folder that contains `package.json` (usually the root of the ZIP).

### 2a. Optional environment variables (process / thread pressure)

Set these in Hostinger’s environment variables if you want the **install** step to inherit the same caps (the build script already sets them for `next build`):

| Variable | Suggested value | Purpose |
|----------|-----------------|--------|
| `UV_THREADPOOL_SIZE` | `1` | Smaller libuv thread pool for Node (file/crypto/DNS). |
| `VIPS_CONCURRENCY` | `1` | Caps **sharp** / libvips threads during any image work in build. |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disables Next telemetry (fewer edge cases during build). |

If the build dies with **JavaScript heap out of memory**, try adding **`NODE_OPTIONS`** = **`--max-old-space-size=3072`** (adjust upward only if the plan allows more RAM).

### 503 or “too many processes” while deploying

`next build` can still fork workers; on shared Node plans the host may enforce a low **process/thread limit** (~200), which shows up as **503** or failed builds.

This repo reduces fan-out by: **calling Next and Prisma via `node` (not `npx`)**, **`UV_THREADPOOL_SIZE=1`**, **`VIPS_CONCURRENCY=1`**, **`eslint.ignoreDuringBuilds`**, and **`next.config.js`** (`experimental.cpus`, `workerThreads: false`, webpack `parallelism: 1`, static generation concurrency limits). If you still hit the cap:

1. **Do not start a new deploy until the current one finishes** (overlapping installs/builds multiply load).
2. **Optional — build on your machine or CI**, then upload a ZIP that **includes** a fresh `.next` from `npm ci && npm run build`. In hPanel, only skip or shorten the server **Build command** if their docs say that is supported when artifacts are already present; otherwise keep `npm run build`.
3. **Upgrade the hosting plan** if limits are still exceeded during build.

Run **`npm run lint`** on your PC or in CI before releases; production **`npm run build`** no longer runs ESLint (to save work on the server).

---

## 3. Environment variables (required)

In Hostinger’s **Environment variables** (or equivalent), set **before** deploying:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string (e.g. `mysql://user:pass@host:3306/dbname`) |
| `AUTH_SECRET` | Long random string (32+ characters) |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_URL` | **Full public URL** (e.g. `https://yourdomain.com`) — required for login behind reverse proxy so redirects and cookies use the correct domain. |
| `NEXT_PUBLIC_APP_URL` | Same as `AUTH_URL` (e.g. `https://yourdomain.com`) |

Optional: SMTP, storage, etc. (see `.env.example`).

Missing env vars are a **common cause of build or runtime failures**. Double-check they are set for the right environment (e.g. production).

---

## 4. Why the build script is set up this way

- **No `postinstall` Prisma**  
  On Cloud Startup, `postinstall` runs on **every** `npm ci` and can repeat when deploys retry—spiking CPU/processes. Prisma runs **only** during **`npm run build`**.

- **`build`: `prisma generate` + `next build` (via `scripts/prisma-generate.mjs` + `scripts/next-build.mjs`)**  
  Runs Prisma once per deploy, then Next **without `npx`**, with **`UV_THREADPOOL_SIZE=1`**, **`VIPS_CONCURRENCY=1`**, and Next config caps so deploys stay closer to shared-host process limits.

- **`start`: `node --max-old-space-size=512 scripts/next-start.mjs`**  
  Production `next start` on **`0.0.0.0`** and **`process.env.PORT`** (see `scripts/next-start.mjs`). No build, migrate, or generate.

---

## 5. Database (migrations and seed)

- Create a **MySQL database** in Hostinger and set its URL in `DATABASE_URL`.
- Run migrations on the server (e.g. via SSH or a one-off script):
  - `npx prisma generate`
  - `npx prisma migrate deploy`
- Optionally seed: `npx prisma db seed`

### “Setup” fails or tables are missing (`users`, `projects`, etc.)

`prisma migrate deploy` only creates tables that have **migration files** under `prisma/migrations/`. This repo includes:

1. `20260324153000_add_app_settings` — creates **`app_settings`** only.
2. `20260327120000_core_schema_tables` — creates the **rest** of the schema (`users`, `clients`, `projects`, …) and foreign keys.

If you ran deploy when only (1) existed, the database had **`app_settings`** but nothing else. **Upload a ZIP that includes the full `prisma/migrations/` folder** (including `migration_lock.toml`), then SSH and run **`migrate deploy`** again (see §5). Do **not** use `prisma db push` for routine deploys if you rely on migrations; use it only as a last resort on an empty dev DB when you know the implications.

---

## 6. If the deployment fails

1. Open **Deployments** in the Node.js app dashboard and open the **failed** deployment.
2. Open **Build logs** and check:
   - **Exit codes** and lines marked **ERROR**
   - **Stack traces** or **module-not-found** (e.g. missing `UserRole` → Prisma client not generated; ensure **`npm run build`** runs `prisma-generate` + `next-build`)
   - Messages near the **end** of the log (often the real cause)

3. **Common causes (from Hostinger’s docs):**
   - Syntax or configuration errors in the app
   - **Missing environment variables**
   - **Unsupported Node.js version** (use 18.x / 20.x / 22.x)
   - **Invalid build or start commands**
   - **Missing or incorrect dependencies** (e.g. wrong install command or corrupted ZIP)

4. **Checklist before redeploying:**
   - [ ] ZIP does **not** contain `node_modules` or `.env`
   - [ ] `package.json` has correct `build` (includes Prisma generate) and `start` (no build in `start`)
   - [ ] All required env vars are set in Hostinger
   - [ ] Node.js version in Hostinger matches the project (18/20/22)
   - [ ] You’re uploading the **latest** ZIP (with the fixes above), not an old one

---

## 7. Login not working after deploy

If the site loads but **login fails** (redirects to login again, or “Invalid email or password” with correct credentials):

1. **Set `AUTH_URL`** in Hostinger’s environment variables to your **exact public URL** (e.g. `https://yourdomain.com`). Auth.js uses this behind a reverse proxy to set redirect and cookie URLs correctly. Without it, cookies/redirects can point to the wrong host and login will not persist.

2. **Check env and DB** by opening **`https://YOUR_ACTUAL_DOMAIN/api/health`** in the browser (use your real domain). It returns: `authSecretSet`, `authTrustHost`, `authUrl`, `nextPublicAppUrl`, and `db` (ok/error). Fix any missing or wrong values in Hostinger env vars, then redeploy.

3. **Run migrations** if you haven’t: on the server run `npx prisma migrate deploy`. If the `User` table or columns are missing, login will fail.

4. **Ensure at least one user exists** (e.g. run `npx prisma db seed` if you use the seed script).

---

## 8. Port and routing

The app listens on **`$PORT`** (when set by Hostinger) or **3002** locally. Hostinger stores build output under `nodejs` and uses `.htaccess` in `public_html` for routing; you don’t need to change the port in the app.

---

## 9. References

- [Deploy Node.js website in Hostinger](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Troubleshoot failed Node.js deployment (build logs)](https://www.hostinger.com/support/how-to-troubleshoot-a-failed-node-js-deployment-using-build-logs/)
