"""
models.py — SQLAlchemy models for the PCTE Basketball Club Manager.

Tables
------
User               an account with a role (admin / coach / viewer)
Team               one row per club team
Player             one row per player, belongs to a Team (cascade delete)
Game               a scheduled fixture between two teams
Result             a completed game (final score / fouls / MVP)
ResultPlayerFoul   per-player foul count captured at the end of a Result,
                   stored as a roster *snapshot* (by name) so history stays
                   intact even if the team/player is later renamed or deleted
"""

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

# The three account roles.
#   admin   - controls who can make changes: creates/removes user accounts
#             and assigns roles. (Admins can also make edits themselves.)
#   coach   - makes changes: manage teams/players, schedule games, run the
#             live game tracker, and edit/delete saved results.
#   viewer  - read-only: can log in and view every page, but cannot create,
#             edit, or delete anything.
ROLES = ("admin", "coach", "viewer")


class User(db.Model, UserMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="viewer")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_admin(self):
        return self.role == "admin"

    @property
    def can_edit(self):
        """Admins and coaches may create/edit/delete data; viewers may not."""
        return self.role in ("admin", "coach")

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Team(db.Model):
    __tablename__ = "teams"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    players = db.relationship(
        "Player", backref="team", cascade="all, delete-orphan", lazy=True
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "players": [p.name for p in self.players],
            "player_ids": {p.name: p.id for p in self.players},
        }


class Player(db.Model):
    __tablename__ = "players"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("teams.id"), nullable=False)


class Game(db.Model):
    """A scheduled (not-yet-played) fixture."""

    __tablename__ = "games"

    id = db.Column(db.Integer, primary_key=True)
    team1_id = db.Column(db.Integer, db.ForeignKey("teams.id", ondelete="SET NULL"))
    team2_id = db.Column(db.Integer, db.ForeignKey("teams.id", ondelete="SET NULL"))
    datetime_str = db.Column(db.String(40), nullable=False)  # raw datetime-local value

    team1 = db.relationship("Team", foreign_keys=[team1_id])
    team2 = db.relationship("Team", foreign_keys=[team2_id])

    def to_dict(self):
        return {
            "id": self.id,
            "team1": self.team1_id,
            "team2": self.team2_id,
            "team1_name": self.team1.name if self.team1 else "Unknown team",
            "team2_name": self.team2.name if self.team2 else "Unknown team",
            "datetime": self.datetime_str,
        }


class Result(db.Model):
    """A completed game, saved once the Live Game tracker is ended."""

    __tablename__ = "results"

    id = db.Column(db.Integer, primary_key=True)
    start_time = db.Column(db.String(40), nullable=False)
    team1_name = db.Column(db.String(80), nullable=False)
    team2_name = db.Column(db.String(80), nullable=False)
    team1_points = db.Column(db.Integer, default=0)
    team2_points = db.Column(db.Integer, default=0)
    team1_fouls = db.Column(db.Integer, default=0)
    team2_fouls = db.Column(db.Integer, default=0)
    mvp = db.Column(db.String(80), default="")

    player_fouls = db.relationship(
        "ResultPlayerFoul", backref="result", cascade="all, delete-orphan", lazy=True
    )

    def to_dict(self):
        team1_players = [pf.player_name for pf in self.player_fouls if pf.side == "team1"]
        team2_players = [pf.player_name for pf in self.player_fouls if pf.side == "team2"]
        team1_player_fouls = [pf.fouls for pf in self.player_fouls if pf.side == "team1"]
        team2_player_fouls = [pf.fouls for pf in self.player_fouls if pf.side == "team2"]

        return {
            "id": self.id,
            "startTime": self.start_time,
            "mvp": self.mvp,
            "team1": {
                "name": self.team1_name,
                "points": self.team1_points,
                "fouls": self.team1_fouls,
                "players": team1_players,
                "playerFouls": team1_player_fouls,
            },
            "team2": {
                "name": self.team2_name,
                "points": self.team2_points,
                "fouls": self.team2_fouls,
                "players": team2_players,
                "playerFouls": team2_player_fouls,
            },
        }


class ResultPlayerFoul(db.Model):
    __tablename__ = "result_player_fouls"

    id = db.Column(db.Integer, primary_key=True)
    result_id = db.Column(db.Integer, db.ForeignKey("results.id"), nullable=False)
    side = db.Column(db.String(5), nullable=False)  # 'team1' or 'team2'
    player_name = db.Column(db.String(80), nullable=False)
    fouls = db.Column(db.Integer, default=0)
