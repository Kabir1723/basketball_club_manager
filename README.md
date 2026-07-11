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

```
username: admin
password: admin123
```

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
