"""
app.py — PCTE Basketball Club Manager backend.

Serves the site's pages and a small JSON REST API backed by a real
database (SQLite by default, MySQL if you set DATABASE_URL).

Run:
    pip install -r requirements.txt
    python app.py
Then open http://127.0.0.1:5000/
"""

import os
import functools
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_login import (
    LoginManager,
    login_user,
    logout_user,
    login_required,
    current_user,
)
from models import db, Team, Player, Game, Result, ResultPlayerFoul, User, ROLES

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Database configuration
#
# Defaults to a local SQLite file (database.db). On Render, set DATABASE_URL
# to a Postgres connection string (Render's free Postgres add-on provides
# one automatically as an env var you can link to this service) — SQLite
# alone isn't safe on Render because its filesystem is wiped on every
# redeploy, so anything saved to a plain SQLite file will be lost.
#
#   export DATABASE_URL="postgresql://user:password@host/dbname"
#
# For local MySQL instead:
#
#   export DATABASE_URL="mysql+pymysql://user:password@localhost/pcte_basketball"
#
# (drivers for both are already listed in requirements.txt)
# ---------------------------------------------------------------------------
default_sqlite_uri = "sqlite:///" + os.path.join(BASE_DIR, "database.db")
database_url = os.environ.get("DATABASE_URL", default_sqlite_uri)
# Render (and some other hosts) hand out "postgres://" URLs, but modern
# SQLAlchemy requires the "postgresql://" scheme — normalize it here.
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Used to sign the session cookie. Set SECRET_KEY in your environment for
# production; a random fallback is generated here so the app still runs.
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32).hex())

db.init_app(app)

login_manager = LoginManager()
login_manager.login_view = "login_page"
login_manager.init_app(app)


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


@login_manager.unauthorized_handler
def unauthorized():
    # API calls get a JSON 401 instead of an HTML redirect.
    if request.path.startswith("/api/"):
        return jsonify({"error": "Login required"}), 401
    return redirect(url_for("login_page", next=request.path))


with app.app_context():
    db.create_all()

    # Seed a default admin account on first run so there's always a way in.
    # CHANGE THIS PASSWORD after logging in for the first time.
    if User.query.count() == 0:
        default_admin = User(username="admin", role="admin")
        default_admin.set_password("admin123")
        db.session.add(default_admin)
        db.session.commit()
        print(
            "Created default admin account -> username: 'admin', "
            "password: 'admin123'. Please log in and change this password "
            "(or create a new admin and delete this one)."
        )


# ---------------------------------------------------------------------------
# Access-control helpers
#
#   @login_required       -> must be logged in (any role) to view/use a page
#   @editor_required       -> must be logged in AND be an admin or coach
#   @admin_required        -> must be logged in AND be an admin
# ---------------------------------------------------------------------------

def editor_required(view):
    @functools.wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        if not current_user.can_edit:
            return jsonify({"error": "Viewers cannot make changes. Ask a coach or admin."}), 403
        return view(*args, **kwargs)
    return wrapped


def editor_page_required(view):
    # Same role check as editor_required, but for HTML page routes: send
    # viewers back to the dashboard instead of returning a bare JSON 403.
    @functools.wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        if not current_user.can_edit:
            return redirect(url_for("index"))
        return view(*args, **kwargs)
    return wrapped


def admin_required(view):
    @functools.wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        if not current_user.is_admin:
            return jsonify({"error": "Admin access required."}), 403
        return view(*args, **kwargs)
    return wrapped


# ---------------------------------------------------------------------------
# Auth: login / logout / current user / user management (admin only)
# ---------------------------------------------------------------------------

@app.route("/login.html")
def login_page():
    if current_user.is_authenticated:
        return redirect(url_for("index"))
    return render_template("login.html")


@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(force=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid username or password"}), 401
    login_user(user)
    return jsonify(user.to_dict())


@app.route("/api/logout", methods=["POST"])
@login_required
def api_logout():
    logout_user()
    return jsonify({"ok": True})


@app.route("/api/me", methods=["GET"])
def api_me():
    if not current_user.is_authenticated:
        return jsonify(None)
    return jsonify(current_user.to_dict())


@app.route("/users.html")
@admin_required
def users_page():
    return render_template("users.html")


@app.route("/api/users", methods=["GET"])
@admin_required
def get_users():
    users = User.query.order_by(User.id).all()
    return jsonify([u.to_dict() for u in users])


@app.route("/api/users", methods=["POST"])
@admin_required
def create_user():
    data = request.get_json(force=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    role = (data.get("role") or "viewer").strip()
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    if role not in ROLES:
        return jsonify({"error": "Role must be one of: " + ", ".join(ROLES)}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "That username is already taken"}), 400
    user = User(username=username, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@app.route("/api/users/<int:user_id>", methods=["PUT"])
@admin_required
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json(force=True) or {}
    if "role" in data:
        role = (data.get("role") or "").strip()
        if role not in ROLES:
            return jsonify({"error": "Role must be one of: " + ", ".join(ROLES)}), 400
        if user.id == current_user.id and role != "admin":
            return jsonify({"error": "You cannot remove your own admin role"}), 400
        user.role = role
    if data.get("password"):
        user.set_password(data["password"])
    db.session.commit()
    return jsonify(user.to_dict())


@app.route("/api/users/<int:user_id>", methods=["DELETE"])
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        return jsonify({"error": "You cannot delete your own account"}), 400
    db.session.delete(user)
    db.session.commit()
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Page routes (server-rendered templates; keeps the existing page URLs)
# Every page requires login; write actions are further restricted below.
# ---------------------------------------------------------------------------

@app.route("/")
@app.route("/index.html")
@login_required
def index():
    return render_template("index.html")


@app.route("/teams.html")
@editor_page_required
def teams_page():
    return render_template("teams.html")


@app.route("/schedule.html")
@login_required
def schedule_page():
    return render_template("schedule.html")


@app.route("/live-game.html")
@login_required
def live_game_page():
    return render_template("live-game.html")


@app.route("/results.html")
@login_required
def results_page():
    return render_template("results.html")


@app.route("/history.html")
@login_required
def history_page():
    return render_template("history.html")


# ---------------------------------------------------------------------------
# API: Teams & Players
# ---------------------------------------------------------------------------

@app.route("/api/teams", methods=["GET"])
@login_required
def get_teams():
    teams = Team.query.order_by(Team.id).all()
    return jsonify([t.to_dict() for t in teams])


@app.route("/api/teams", methods=["POST"])
@editor_required
def create_team():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Team name is required"}), 400
    team = Team(name=name)
    db.session.add(team)
    db.session.commit()
    return jsonify(team.to_dict()), 201


@app.route("/api/teams/<int:team_id>", methods=["DELETE"])
@editor_required
def delete_team(team_id):
    team = Team.query.get_or_404(team_id)
    db.session.delete(team)
    db.session.commit()
    return jsonify({"ok": True})


@app.route("/api/teams/<int:team_id>/players", methods=["POST"])
@editor_required
def add_player(team_id):
    team = Team.query.get_or_404(team_id)
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Player name is required"}), 400
    player = Player(name=name, team_id=team.id)
    db.session.add(player)
    db.session.commit()
    return jsonify(team.to_dict()), 201


@app.route("/api/teams/<int:team_id>/players/<int:player_id>", methods=["DELETE"])
@editor_required
def remove_player(team_id, player_id):
    player = Player.query.filter_by(id=player_id, team_id=team_id).first_or_404()
    db.session.delete(player)
    db.session.commit()
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# API: Schedule
# ---------------------------------------------------------------------------

@app.route("/api/schedule", methods=["GET"])
@login_required
def get_schedule():
    games = Game.query.order_by(Game.datetime_str).all()
    return jsonify([g.to_dict() for g in games])


@app.route("/api/schedule", methods=["POST"])
@editor_required
def create_game():
    data = request.get_json(force=True) or {}
    team1_id = data.get("team1")
    team2_id = data.get("team2")
    dt = (data.get("datetime") or "").strip()
    if not team1_id or not team2_id or not dt:
        return jsonify({"error": "team1, team2 and datetime are required"}), 400
    if str(team1_id) == str(team2_id):
        return jsonify({"error": "Team 1 and Team 2 must be different"}), 400
    game = Game(team1_id=team1_id, team2_id=team2_id, datetime_str=dt)
    db.session.add(game)
    db.session.commit()
    return jsonify(game.to_dict()), 201


@app.route("/api/schedule/<int:game_id>", methods=["DELETE"])
@editor_required
def delete_game(game_id):
    game = Game.query.get_or_404(game_id)
    db.session.delete(game)
    db.session.commit()
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# API: Results
# ---------------------------------------------------------------------------

@app.route("/api/results", methods=["GET"])
@login_required
def get_results():
    results = Result.query.order_by(Result.id).all()
    return jsonify([r.to_dict() for r in results])


@app.route("/api/results", methods=["POST"])
@editor_required
def create_result():
    data = request.get_json(force=True) or {}
    team1 = data.get("team1") or {}
    team2 = data.get("team2") or {}

    result = Result(
        start_time=data.get("startTime", ""),
        mvp=data.get("mvp", ""),
        team1_name=team1.get("name", "Team 1"),
        team2_name=team2.get("name", "Team 2"),
        team1_points=team1.get("points", 0),
        team2_points=team2.get("points", 0),
        team1_fouls=team1.get("fouls", 0),
        team2_fouls=team2.get("fouls", 0),
    )
    db.session.add(result)
    db.session.flush()  # get result.id before committing

    for side, team in (("team1", team1), ("team2", team2)):
        players = team.get("players") or []
        fouls = team.get("playerFouls") or []
        for i, pname in enumerate(players):
            db.session.add(
                ResultPlayerFoul(
                    result_id=result.id,
                    side=side,
                    player_name=pname,
                    fouls=fouls[i] if i < len(fouls) else 0,
                )
            )

    db.session.commit()
    return jsonify(result.to_dict()), 201


@app.route("/api/results/<int:result_id>", methods=["DELETE"])
@editor_required
def delete_result(result_id):
    result = Result.query.get_or_404(result_id)
    db.session.delete(result)
    db.session.commit()
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True)
