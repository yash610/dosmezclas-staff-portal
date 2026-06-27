# Dos Mezclas — Restaurant Staff Scheduler

Internal staff portal for **Dos Mezclas Restaurant and Bar** (Aubrey, TX).
A full-stack scheduling app themed to match [dosmezclas.com](https://dosmezclas.com/) — warm Tex-Mex / Latin fusion look with dark charcoal sections, cream cards, and red/orange/yellow/green accents.

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + React Router
- **Backend:** Node.js + Express + JWT auth
- **Database:** SQLite by default (zero config). PostgreSQL fully supported — flip a single env var.
- **Auth:** JWT, bcrypt password hashing, role-based access (`admin` / `employee`)

## Features

1. Admin and employee login (JWT)
2. Role-based dashboards
3. Admin CRUD for employees (create / edit / deactivate)
4. Admin builds weekly schedules and assigns shifts
5. Employees view today's shift + the full week
6. Employees submit weekly availability
7. Employees request shift transfers (cover requests)
8. Employees request additional shifts
9. Admin approves or rejects requests
10. Hours summary report — by employee, day, week, month, custom range
11. Drill-down report — date, shift start/end, break, total hours, status

## Project layout

```
DosMezClas Employee Scheduling/
├── server/        # Express API + SQLite/Postgres
│   ├── server.js
│   ├── db/        # database adapter, schema, seed
│   ├── routes/    # auth, employees, schedules, availability, requests, reports
│   └── middleware/
└── client/        # React + Tailwind SPA
    └── src/
        ├── pages/
        ├── components/
        └── context/
```

## Quick start (local, SQLite)

```bash
# 1. Backend
cd server
npm install
npm run seed          # creates dosmezclas.db with sample data
npm run dev           # http://localhost:4000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev           # http://localhost:5173
```

Open **http://localhost:5173** and log in with one of the seeded accounts below.

### Seeded logins

| Role     | Email                       | Password    |
| -------- | --------------------------- | ----------- |
| Admin    | `manager@dosmezclas.com`    | `admin123`  |
| Employee | `maria@dosmezclas.com`      | `pass123`   |
| Employee | `carlos@dosmezclas.com`     | `pass123`   |
| Employee | `priya@dosmezclas.com`      | `pass123`   |
| Employee | `diego@dosmezclas.com`      | `pass123`   |
| Employee | `aisha@dosmezclas.com`      | `pass123`   |

## Switching to PostgreSQL

Set `DB_CLIENT=pg` and `DATABASE_URL=postgres://user:pass@host:5432/dosmezclas` in `server/.env`. The schema is auto-applied on first run. SQL is portable between both engines.

```bash
DB_CLIENT=pg DATABASE_URL=postgres://localhost/dosmezclas npm run seed
DB_CLIENT=pg DATABASE_URL=postgres://localhost/dosmezclas npm run dev
```

## Environment variables (`server/.env`)

```
PORT=4000
JWT_SECRET=change-me-in-production
DB_CLIENT=sqlite          # or "pg"
SQLITE_PATH=./dosmezclas.db
DATABASE_URL=             # required when DB_CLIENT=pg
```

## API surface (summary)

```
POST  /api/auth/login
GET   /api/auth/me

GET   /api/employees                # admin
POST  /api/employees                # admin
PATCH /api/employees/:id            # admin
PATCH /api/employees/:id/deactivate # admin

GET   /api/schedules?week=YYYY-MM-DD
POST  /api/schedules                # admin — create shift
PATCH /api/schedules/:id            # admin
DELETE /api/schedules/:id           # admin
GET   /api/schedules/me/today
GET   /api/schedules/me/week

GET   /api/availability/me
POST  /api/availability             # employee submits

GET   /api/requests                 # admin sees all, employee sees own
POST  /api/requests                 # employee creates (transfer or extra)
PATCH /api/requests/:id/decide      # admin approve/reject

GET   /api/reports/hours?group=employee|day|week|month&from=&to=
GET   /api/reports/drilldown?employeeId=&from=&to=
```

## Deployment notes

- **Backend:** any Node host (Render, Railway, Fly, Heroku-style). Set `DB_CLIENT=pg` and `DATABASE_URL`. Run `npm run migrate` then `npm start`.
- **Frontend:** `npm run build` produces `client/dist/` — host on Vercel, Netlify, Cloudflare Pages, or serve statically behind the API.
- Set `VITE_API_URL` in `client/.env` if API is on a different origin in production.

## Theme tokens

Tailwind config exposes the Dos Mezclas palette:

- `bg-charcoal` `#1a1614` — primary dark background
- `bg-cream` `#f5ead8` — card surface
- `text-clay` `#3a2a1f` — primary text on cream
- `accent-red` `#c0392b`, `accent-orange` `#e67e22`, `accent-yellow` `#f1c40f`, `accent-green` `#27ae60`
