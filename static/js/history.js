/* =========================================================================
   history.js — Edit Results page (full detail table with delete)
   ========================================================================= */

(function () {
  'use strict';
  var PCTE = window.PCTE;
  var tbody = document.querySelector('#historyTable tbody');
  if (!tbody) return;

  function foulsList(players, fouls) {
    if (!players || !players.length) return '—';
    return players.map(function (p, i) { return PCTE.escapeHtml(p) + ': ' + (fouls && fouls[i] ? fouls[i] : 0); }).join(', ');
  }

  function render(results) {
    if (!results.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);">No previous game data available.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    results.forEach(function (game) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + PCTE.formatDate(game.startTime) + '</td>' +
        '<td>' + PCTE.escapeHtml(game.team1.name) + ' vs ' + PCTE.escapeHtml(game.team2.name) + '</td>' +
        '<td>' + game.team1.points + ' - ' + game.team2.points + '</td>' +
        '<td>' + game.team1.fouls + '</td>' +
        '<td>' + game.team2.fouls + '</td>' +
        '<td><strong>' + PCTE.escapeHtml(game.team1.name) + ':</strong> ' + foulsList(game.team1.players, game.team1.playerFouls) +
          '<br><strong>' + PCTE.escapeHtml(game.team2.name) + ':</strong> ' + foulsList(game.team2.players, game.team2.playerFouls) + '</td>' +
        '<td>' + (game.mvp ? '🔱 ' + PCTE.escapeHtml(game.mvp) : '—') + '</td>' +
        '<td><button class="delete-btn" data-id="' + game.id + '">Delete</button></td>';
      tbody.appendChild(tr);
    });
  }

  function load() {
    return PCTE.getResults().then(render).catch(function (err) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--danger);">Could not load results: ' + PCTE.escapeHtml(err.message) + '</td></tr>';
    });
  }

  tbody.addEventListener('click', function (e) {
    var btn = e.target.closest('.delete-btn');
    if (!btn) return;
    var id = btn.dataset.id;
    if (!confirm('Delete this result? This cannot be undone.')) return;
    PCTE.deleteResult(id).then(load).catch(function (err) { alert(err.message); });
  });

  document.addEventListener('DOMContentLoaded', load);
})();
