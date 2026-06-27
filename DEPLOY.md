# Deploying Dos Mezclas Staff Portal to Vercel

Two separate Vercel projects: one for the **API** (`server/`) and one for the **frontend** (`client/`).

---

## 1. Set up PostgreSQL (Neon — free tier)

1. Go to [neon.tech](https://neon.tech) and create a free account.
2. Create a new project → name it `dosmezclas`.
3. Copy the **connection string** — it looks like:
   ```
   postgres://user:password@ep-xyz.us-east-2.aws.neon.tech/dosmezclas?sslmode=require
   ```
4. Keep this handy; you'll paste it into Vercel as `DATABASE_URL`.

---

## 2. Deploy the API (`server/`)

1. Push your code to GitHub (if not already).
2. Go to [vercel.com](https://vercel.com) → **Add New Project**.
3. Import your repo and set **Root Directory** to `server`.
4. Vercel will auto-detect Node.js. Set the following **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `DB_CLIENT` | `pg` |
   | `DATABASE_URL` | *(your Neon connection string)* |
   | `JWT_SECRET` | *(run `openssl rand -hex 32` and paste the output)* |
   | `ADMIN_REGISTRATION_CODE` | *(a secret word/phrase only the manager knows)* |
   | `CORS_ORIGIN` | *(leave blank for now — fill in after step 3)* |

5. Click **Deploy**. Once done, copy the URL (e.g. `https://dosmezclas-api.vercel.app`).
6. Go back to the project **Settings → Environment Variables** and set:
   - `CORS_ORIGIN` = your frontend URL (from step 3) — then **Redeploy**.

---

## 3. Deploy the Frontend (`client/`)

1. Go to [vercel.com](https://vercel.com) → **Add New Project** again.
2. Import the same repo and set **Root Directory** to `client`.
3. Framework preset: **Vite** (auto-detected).
4. Set the following **Environment Variable**:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | *(your API URL from step 2, e.g. `https://dosmezclas-api.vercel.app`)* |

5. Click **Deploy**. Your app is live!

---

## 4. First-time setup (create the manager account)

1. Open the live frontend URL.
2. Click **"Create one"** on the login page.
3. Select **Manager**, fill in your details, and enter the `ADMIN_REGISTRATION_CODE` you set in step 2.
4. You're in! From the **Employees** page you can add staff accounts, or staff can self-register as **Staff member** at `/register`.

---

## 5. Local development

```bash
# Terminal 1 — API
cd server
cp .env.example .env        # edit: set DB_CLIENT=sqlite (default)
npm install
npm run dev                 # runs on http://localhost:4000

# Terminal 2 — Frontend
cd client
npm install
npm run dev                 # runs on http://localhost:5173
```

The Vite dev server proxies `/api/*` to `localhost:4000` automatically — no `VITE_API_URL` needed locally.

To seed the local SQLite database with demo data:
```bash
cd server && npm run seed
```
Demo credentials after seeding: `manager@dosmezclas.com / admin123` and `maria@dosmezclas.com / pass123`.

---

## Environment variable reference

### `server/`
| Variable | Required | Description |
|----------|----------|-------------|
| `DB_CLIENT` | Yes | `pg` for production, `sqlite` for local |
| `DATABASE_URL` | Yes (pg) | Neon/Postgres connection string |
| `JWT_SECRET` | Yes | Long random string — sign auth tokens |
| `ADMIN_REGISTRATION_CODE` | Yes | Secret code required to register as manager |
| `CORS_ORIGIN` | Yes (prod) | Frontend URL(s), comma-separated |
| `PORT` | No | Defaults to 4000 |

### `client/`
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes (prod) | API base URL, no trailing slash |
