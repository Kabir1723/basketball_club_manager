/* =========================================================================
   schedule.js — Game Schedule page
   ========================================================================= */

(function () {
  'use strict';
  var PCTE = window.PCTE;

  var form = document.getElementById('scheduleForm');
  var team1Select = document.getElementById('team1Select');
  var team2Select = document.getElementById('team2Select');
  var dateInput = document.getElementById('gameDateTime');
  var listEl = document.getElementById('gamesList');
  if (!form || !listEl) return;

  listEl.classList.add('card-grid', 'bento-section');

  function refreshSelects(teams) {
    PCTE.populateTeamSelect(team1Select, teams, 'Team 1');
    PCTE.populateTeamSelect(team2Select, teams, 'Team 2');
  }

  function renderGames(games) {
    games = games.slice().sort(function (a, b) {
      return new Date(a.datetime) - new Date(b.datetime);
    });

    listEl.innerHTML = '';

    if (!games.length) {
      listEl.innerHTML = '<p class="empty-state">No games scheduled yet — add one above.</p>';
      return;
    }

    games.forEach(function (game) {
      var card = document.createElement('li');
      card.className = 'magic-bento-card magic-bento-card--text-autohide magic-bento-card--border-glow';
      card.dataset.gameId = game.id;
      card.style.listStyle = 'none';

      card.innerHTML =
        '<div class="magic-bento-card__header">' +
          '<span class="magic-bento-card__label game-chip-time">' + PCTE.formatDate(game.datetime) + '</span>' +
          '<button class="icon-btn delete-game" data-game="' + game.id + '" title="Remove game">🗑</button>' +
        '</div>' +
        '<div class="magic-bento-card__content">' +
          '<h2 class="magic-bento-card__title">' + PCTE.escapeHtml(game.team1_name) + ' vs ' + PCTE.escapeHtml(game.team2_name) + '</h2>' +
          '<p class="magic-bento-card__description">Head to Live Game when tip-off is ready to start tracking the score.</p>' +
        '</div>';

      listEl.appendChild(card);
      if (window.MagicBento) window.MagicBento.wireCard(card);
    });
  }

  function render() {
    return PCTE.getSchedule().then(renderGames).catch(function (err) {
      listEl.innerHTML = '<p class="empty-state">Could not load schedule: ' + PCTE.escapeHtml(err.message) + '</p>';
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t1 = team1Select.value, t2 = team2Select.value;
    if (!t1 || !t2) { PCTE.modal.alert('Pick both teams first.'); return; }
    if (t1 === t2) { PCTE.modal.alert('Team 1 and Team 2 must be different.'); return; }
    if (!dateInput.value) return;

    PCTE.createGame(t1, t2, dateInput.value).then(function () {
      form.reset();
      return render();
    }).catch(function (err) { PCTE.modal.alert(err.message); });
  });

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.delete-game');
    if (!btn) return;
    var id = btn.dataset.game;
    PCTE.modal.confirm('Remove this fixture?').then(function (ok) {
      if (ok) return PCTE.deleteGame(id).then(render).catch(function (err) { PCTE.modal.alert(err.message); });
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    PCTE.getTeams().then(function (teams) {
      if (!teams.length) {
        listEl.innerHTML = '<p class="empty-state">Add teams first, then schedule fixtures between them.</p>';
      }
      refreshSelects(teams);
      return render();
    }).catch(function (err) {
      listEl.innerHTML = '<p class="empty-state">Could not load teams: ' + PCTE.escapeHtml(err.message) + '</p>';
    });
  });
})();
