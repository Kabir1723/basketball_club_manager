/* =========================================================================
   index.js — Dashboard quick links + live stat cards
   ========================================================================= */

(function () {
  'use strict';
  var PCTE = window.PCTE;
  var grid = document.getElementById('dashboardGrid');
  if (!grid) return;

  grid.classList.add('card-grid', 'bento-section', 'quicklinks');

  function render(teams, schedule, results, user) {
    var upcoming = schedule.filter(function (g) { return new Date(g.datetime) >= new Date(); }).length;
    var lastResult = results[results.length - 1];

    var cards = [];
    if (user && user.role_can_edit) {
      cards.push({ href: 'teams.html', icon: '👥', title: 'Teams', desc: teams.length + ' team' + (teams.length === 1 ? '' : 's') + ' registered — manage rosters and players.' });
    }
    cards.push(
      { href: 'schedule.html', icon: '📅', title: 'Schedule', desc: upcoming + ' upcoming fixture' + (upcoming === 1 ? '' : 's') + ' on the calendar.' },
      { href: 'live-game.html', icon: '🔥', title: 'Live Game', desc: 'Start a live tracker for scoring, fouls and MVP.' },
      { href: 'results.html', icon: '📊', title: 'Results', desc: lastResult ? 'Last: ' + PCTE.escapeHtml(lastResult.team1.name) + ' ' + lastResult.team1.points + '–' + lastResult.team2.points + ' ' + PCTE.escapeHtml(lastResult.team2.name) : 'No games recorded yet.' }
    );

    grid.innerHTML = cards.map(function (c) {
      return '<a class="magic-bento-card magic-bento-card--border-glow quicklink-card" href="' + c.href + '">' +
        '<div class="magic-bento-card__header"><span class="quicklink-icon">' + c.icon + '</span></div>' +
        '<div class="magic-bento-card__content">' +
          '<h2 class="magic-bento-card__title">' + c.title + '</h2>' +
          '<p class="magic-bento-card__description">' + c.desc + '</p>' +
        '</div>' +
      '</a>';
    }).join('');

    grid.querySelectorAll('.magic-bento-card').forEach(function (card) {
      if (window.MagicBento) window.MagicBento.wireCard(card);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    Promise.all([PCTE.getTeams(), PCTE.getSchedule(), PCTE.getResults(), PCTE.getCurrentUser()])
      .then(function (values) { render(values[0], values[1], values[2], values[3]); })
      .catch(function (err) {
        grid.innerHTML = '<p class="empty-state">Could not load dashboard data: ' + PCTE.escapeHtml(err.message) + '</p>';
      });
  });
})();
