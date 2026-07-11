/* =========================================================================
   results.js — Results page (read-only glow-card view of saved games)
   ========================================================================= */

(function () {
  'use strict';
  var PCTE = window.PCTE;
  var listEl = document.getElementById('resultsList');
  if (!listEl) return;

  listEl.classList.add('card-grid', 'bento-section');

  function render(results) {
    results = results.slice().reverse(); // most recent first
    listEl.innerHTML = '';

    if (!results.length) {
      listEl.innerHTML = '<p class="empty-state">No games played yet — results will appear here once a Live Game is ended.</p>';
      return;
    }

    results.forEach(function (game) {
      var card = document.createElement('div');
      card.className = 'magic-bento-card magic-bento-card--border-glow';

      var winner = game.team1.points === game.team2.points ? null : (game.team1.points > game.team2.points ? game.team1.name : game.team2.name);

      card.innerHTML =
        '<div class="magic-bento-card__header">' +
          '<span class="magic-bento-card__label">' + PCTE.formatDate(game.startTime) + '</span>' +
          (game.mvp ? '<span class="magic-bento-card__label">🔱 ' + PCTE.escapeHtml(game.mvp) + '</span>' : '') +
        '</div>' +
        '<div class="magic-bento-card__content">' +
          '<h2 class="magic-bento-card__title">' + PCTE.escapeHtml(game.team1.name) + ' ' + game.team1.points + ' – ' + game.team2.points + ' ' + PCTE.escapeHtml(game.team2.name) + '</h2>' +
          '<p class="magic-bento-card__description">' +
            (winner ? '<strong>' + PCTE.escapeHtml(winner) + '</strong> won' : 'Match ended in a tie') +
            ' · Fouls ' + game.team1.fouls + '–' + game.team2.fouls +
          '</p>' +
        '</div>';

      listEl.appendChild(card);
      if (window.MagicBento) window.MagicBento.wireCard(card);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    PCTE.getResults().then(render).catch(function (err) {
      listEl.innerHTML = '<p class="empty-state">Could not load results: ' + PCTE.escapeHtml(err.message) + '</p>';
    });
  });
})();
