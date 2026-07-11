/* =========================================================================
   teams.js — Teams & Players page
   Renders each team as a MagicBento glow card with an inline roster editor.
   Data is loaded from / saved to the database via the PCTE API helpers.
   ========================================================================= */

(function () {
  'use strict';
  var PCTE = window.PCTE;

  var listEl = document.getElementById('teamsList');
  var addBtn = document.getElementById('addTeamBtn');
  if (!listEl) return;

  listEl.classList.add('card-grid', 'bento-section');

  function renderTeams(teams) {
    listEl.innerHTML = '';

    if (!teams.length) {
      listEl.innerHTML = '<p class="empty-state">No teams yet — click &ldquo;Add Team&rdquo; to build your first roster.</p>';
      return;
    }

    teams.forEach(function (team) {
      var card = document.createElement('div');
      card.className = 'magic-bento-card magic-bento-card--text-autohide magic-bento-card--border-glow';
      card.dataset.teamId = team.id;

      var playersHtml = team.players.length
        ? team.players.map(function (p) {
            var playerId = team.player_ids ? team.player_ids[p] : '';
            return '<li><span>' + PCTE.escapeHtml(p) + '</span>' +
              '<button class="chip-remove" data-team="' + team.id + '" data-player="' + playerId + '" title="Remove player">✕</button></li>';
          }).join('')
        : '<li class="muted">No players yet</li>';

      card.innerHTML =
        '<div class="magic-bento-card__header">' +
          '<span class="magic-bento-card__label">' + team.players.length + ' player' + (team.players.length === 1 ? '' : 's') + '</span>' +
          '<button class="icon-btn delete-team" data-team="' + team.id + '" title="Delete team">🗑</button>' +
        '</div>' +
        '<div class="magic-bento-card__content">' +
          '<h2 class="magic-bento-card__title">' + PCTE.escapeHtml(team.name) + '</h2>' +
          '<ul class="roster-list">' + playersHtml + '</ul>' +
          '<form class="add-player-form" data-team="' + team.id + '">' +
            '<input type="text" placeholder="Add player name" maxlength="40" required />' +
            '<button type="submit" title="Add player">+</button>' +
          '</form>' +
        '</div>';

      listEl.appendChild(card);
      if (window.MagicBento) window.MagicBento.wireCard(card);
    });
  }

  function render() {
    return PCTE.getTeams().then(renderTeams).catch(function (err) {
      listEl.innerHTML = '<p class="empty-state">Could not load teams: ' + PCTE.escapeHtml(err.message) + '</p>';
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', function () {
      PCTE.modal.prompt('Team name:').then(function (name) {
        name = (name || '').trim();
        if (!name) return;
        return PCTE.createTeam(name).then(render).catch(function (err) { PCTE.modal.alert(err.message); });
      });
    });
  }

  listEl.addEventListener('submit', function (e) {
    var form = e.target.closest('.add-player-form');
    if (!form) return;
    e.preventDefault();
    var input = form.querySelector('input');
    var name = input.value.trim();
    if (!name) return;
    var teamId = form.dataset.team;
    PCTE.addPlayer(teamId, name).then(render).catch(function (err) { PCTE.modal.alert(err.message); });
  });

  listEl.addEventListener('click', function (e) {
    var delTeamBtn = e.target.closest('.delete-team');
    if (delTeamBtn) {
      var id = delTeamBtn.dataset.team;
      PCTE.modal.confirm('Delete this team and its roster? This cannot be undone.').then(function (ok) {
        if (ok) return PCTE.deleteTeam(id).then(render).catch(function (err) { PCTE.modal.alert(err.message); });
      });
      return;
    }
    var removeBtn = e.target.closest('.chip-remove');
    if (removeBtn) {
      var teamId = removeBtn.dataset.team;
      var playerId = removeBtn.dataset.player;
      if (!playerId) return;
      PCTE.removePlayer(teamId, playerId).then(render).catch(function (err) { PCTE.modal.alert(err.message); });
    }
  });

  document.addEventListener('DOMContentLoaded', render);
})();
