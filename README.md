# PCTE Basketball Club Manager

Flask + SQLAlchemy backend. Team rosters, fixtures, and game results are
now stored in a real database instead of the browser's `localStorage`.

## Run it

```bash
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000/ — a `database.db` SQLite file is created
automatically on first run (in the project folder). The whole site now
requires logging in; a default admin account is created automatically the
first time you run the app:


**Log in and change this password right away** (Users page → Reset
Password), or create a new admin account and delete the default one.

## User roles

| Role   | Can view pages | Can make changes (teams, schedule, live games, results) | Manages user accounts |
|--------|:--:|:--:|:--:|
| **Admin**  | ✅ | ✅ | ✅ |
| **Coach**  | ✅ | ✅ | ❌ |
| **Viewer** | ✅ | ❌ (read-only) | ❌ |

Admins manage the account list from the **Users** page (only visible to
admins, at `/users.html`), where they can create accounts, assign/change
roles, reset passwords, and delete accounts. An admin can't demote or delete
their own account, so there's always at least one admin left.

## Project structure

- `app.py` — Flask routes (pages) + JSON REST API (`/api/...`), plus
  Flask-Login–based authentication and role checks (`@login_required`,
  `@editor_required`, `@admin_required`)
- `models.py` — SQLAlchemy models: `User` (auth + role), `Team`, `Player`,
  `Game` (schedule), `Result`, `ResultPlayerFoul`
- `templates/` — page HTML (Jinja); adds `login.html` (sign-in form) and
  `users.html` (admin-only account management)
- `static/js/` — front-end calls the API via `fetch` (see `main.js` for the
  `PCTE.*` helpers); `auth.js` fetches the current user, injects the
  sign-out control and admin-only "Users" nav link, and hides write
  controls for viewers
- `database.db` — SQLite database file (created automatically, git-ignored)

## Deploying to Render

This repo is ready to deploy to [Render](https://render.com) as-is — it
includes a `Procfile`, a `render.yaml` blueprint, `gunicorn` (production
server), and a Postgres driver (`psycopg2-binary`).

**Important:** don't rely on plain SQLite in production here — Render's
free web service filesystem is wiped on every redeploy/restart, so a
`database.db` file (and every team/user/result in it) would disappear.
Use Render's free Postgres database instead (both options below set this
up for you).

### Option A — One-click Blueprint (easiest)

1. Push this repo to GitHub (see "Pushing to GitHub" below if you haven't).
2. In Render, click **New +** → **Blueprint**, and point it at your GitHub repo.
3. Render reads `render.yaml` and automatically creates:
   - A free Postgres database (`pcte-basketball-db`)
   - A free web service (`pcte-basketball`) wired to that database via
     `DATABASE_URL`, with a random `SECRET_KEY` generated for you
4. Click **Apply** — Render builds and deploys automatically. Your app will
   be live at something like `https://pcte-basketball.onrender.com`.

### Option B — Manual setup

1. Push this repo to GitHub.
2. In Render: **New +** → **PostgreSQL** → create a free database. Copy its
   **Internal Database URL**.
3. In Render: **New +** → **Web Service** → connect your GitHub repo.
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
   - **Environment Variables:**
     - `DATABASE_URL` = the Postgres URL you copied
     - `SECRET_KEY` = any random string (Render can generate one for you)
4. Click **Create Web Service**. Render builds and deploys automatically.

### After it's deployed

- Visit your Render URL, log in with the default admin account
  (`admin` / `admin123`), and **change that password immediately** from
  the Users page.
- Every future `git push` to your connected branch triggers an automatic
  redeploy on Render.
- Your existing GitHub Pages site (a static-only page) can't run this
  Flask app — GitHub Pages has no way to execute Python. Point people to
  the Render URL instead, or set up a custom domain in Render's settings
  if you want a nicer URL than `*.onrender.com`.

## Pushing to GitHub

```bash
cd Basketball_SQL
git init                      # skip if already a git repo
git add .
git commit -m "Add user roles and Render deployment config"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

If the remote already exists and has commits, use `git pull --rebase
origin main` first, or just `git add . && git commit -m "..." && git push`
if it's already set up.

## Switching to MySQL

By default the app uses SQLite. To use MySQL instead:

1. Create a database, e.g. `CREATE DATABASE pcte_basketball;`
2. Install the MySQL driver (already in `requirements.txt`): `pymysql`
3. Set an environment variable before starting the app:

   ```bash
   export DATABASE_URL="mysql+pymysql://<user>:<password>@<host>/pcte_basketball"
   python app.py
   ```

No code changes needed — `app.py` reads `DATABASE_URL` and falls back to
SQLite if it isn't set.

## API endpoints

| Method | Path                                    | Description                     |
|--------|------------------------------------------|----------------------------------|
| GET    | /api/teams                               | List teams + rosters             |
| POST   | /api/teams                               | Create a team `{name}`           |
| DELETE | /api/teams/<id>                          | Delete a team                    |
| POST   | /api/teams/<id>/players                  | Add a player `{name}`            |
| DELETE | /api/teams/<id>/players/<player_id>      | Remove a player                  |
| GET    | /api/schedule                            | List fixtures                    |
| POST   | /api/schedule                            | Add fixture `{team1, team2, datetime}` |
| DELETE | /api/schedule/<id>                       | Remove a fixture                 |
| GET    | /api/results                             | List completed games             |
| POST   | /api/results                             | Save a completed game            |
| DELETE | /api/results/<id>                        | Delete a saved result             |
| POST   | /api/login                               | Log in `{username, password}`    |
| POST   | /api/logout                              | Log out                          |
| GET    | /api/me                                  | Current logged-in user (or `null`) |
| GET    | /api/users                                | List accounts *(admin only)*     |
| POST   | /api/users                                | Create account `{username, password, role}` *(admin only)* |
| PUT    | /api/users/<id>                           | Update role and/or password *(admin only)* |
| DELETE | /api/users/<id>                           | Delete an account *(admin only)* |

All of the endpoints above (except `/api/login` and `/api/me`) require
being logged in. Writes to teams/schedule/results (`POST`/`DELETE`) also
require the `admin` or `coach` role — `viewer` accounts get a `403`.

## What changed from the original version

- Added `models.py` (was empty) with a real schema
- Added `app.py` (was empty): Flask app, page routes, REST API, `db.create_all()`
- Rewrote `static/js/main.js` to wrap `fetch` calls to `/api/...` instead of
  reading/writing `localStorage`
- Updated `teams.js`, `schedule.js`, `game.js`, `results.js`, `history.js`,
  `index.js` to use the new async `PCTE.*` helpers
- Updated all templates to load static assets via Flask's `url_for('static', ...)`
