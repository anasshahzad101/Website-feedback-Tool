# Hostinger deployment – SpeedX Feedback Tool

Deploy this Next.js + Prisma app via **ZIP upload** on Hostinger. Follow this checklist so builds don’t fail.

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
| **Build command** | `npm run build` |
| **Start command** | `npm start` (recommended) or `npm run start -- -p $PORT` |

The app’s `start` script uses **`next start -p ${PORT:-3002}`**, so when Hostinger sets `PORT`, the app listens on that port. No need to pass `-p $PORT` in the start command unless the panel doesn’t set `PORT`.

**Application root:** Leave as the folder that contains `package.json` (usually the root of the ZIP).

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

- **`postinstall`: `prisma generate`**  
  Ensures the Prisma client (and types like `UserRole`) is generated right after `npm install`, so the Next.js build and any code that imports from `@prisma/client` or `@/lib/db/client` don’t fail with “has no exported member”.

- **`build`: `prisma generate && next build`**  
  Runs `prisma generate` again before `next build` so the client is always up to date on the server.

- **`start`: `next start -p ${PORT:-3002}`**  
  Uses Hostinger’s `PORT` when set; otherwise uses 3002 for local runs.

---

## 5. Database (migrations and seed)

- Create a **MySQL database** in Hostinger and set its URL in `DATABASE_URL`.
- Run migrations on the server (e.g. via SSH or a one-off script):
  - `npx prisma generate`
  - `npx prisma migrate deploy`
- Optionally seed: `npx prisma db seed`

---

## 6. If the deployment fails

1. Open **Deployments** in the Node.js app dashboard and open the **failed** deployment.
2. Open **Build logs** and check:
   - **Exit codes** and lines marked **ERROR**
   - **Stack traces** or **module-not-found** (e.g. missing `UserRole` → Prisma client not generated; ensure `postinstall` / build script are unchanged)
   - Messages near the **end** of the log (often the real cause)

3. **Common causes (from Hostinger’s docs):**
   - Syntax or configuration errors in the app
   - **Missing environment variables**
   - **Unsupported Node.js version** (use 18.x / 20.x / 22.x)
   - **Invalid build or start commands**
   - **Missing or incorrect dependencies** (e.g. wrong install command or corrupted ZIP)

4. **Checklist before redeploying:**
   - [ ] ZIP does **not** contain `node_modules` or `.env`
   - [ ] `package.json` has correct `build` and `start` scripts (and `postinstall`)
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
