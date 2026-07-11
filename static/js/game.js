/* =========================================================================
   game.js — Live Game Tracker page
   Game state lives in memory while the game is live (no need to hit the
   database on every point/foul); the final result is persisted to the
   database in one request when the game is ended.
   ========================================================================= */

(function () {
  'use strict';
  var PCTE = window.PCTE;

  var setupForm = document.getElementById('gameSetup');
  var team1Select = document.getElementById('team1Select');
  var team2Select = document.getElementById('team2Select');
  var quarterLengthInput = document.getElementById('quarterLength');
  var liveStats = document.getElementById('liveStats');
  var gameInfo = document.getElementById('gameInfo');
  var timerEl = document.getElementById('timer');
  var startTimerBtn = document.getElementById('startTimerBtn');
  var stopTimerBtn = document.getElementById('stopTimerBtn');
  var scoreboard = document.getElementById('scoreboard');
  var team1NameEl = document.getElementById('team1Name');
  var team2NameEl = document.getElementById('team2Name');
  var team1PointsEl = document.getElementById('team1Points');
  var team2PointsEl = document.getElementById('team2Points');
  var team1FoulsEl = document.getElementById('team1Fouls');
  var team2FoulsEl = document.getElementById('team2Fouls');
  var team1PlayersEl = document.getElementById('team1Players');
  var team2PlayersEl = document.getElementById('team2Players');
  var quarterSelect = document.getElementById('quarterSelect');
  var quarterLengthLiveInput = document.getElementById('quarterLengthLive');
  var applyQuarterLengthBtn = document.getElementById('applyQuarterLength');
  var mvpSelect = document.getElementById('mvpSelect');
  var endGameBtn = document.getElementById('endGameBtn');

  if (!setupForm) return;

  var DEFAULT_QUARTER_MINUTES = 10;
  var state = null;
  var timerInterval = null;
  var secondsLeft = DEFAULT_QUARTER_MINUTES * 60;
  var timerRunning = false;

  function normalizeMinutes(value) {
    var mins = parseFloat(value);
    if (!mins || mins <= 0) return DEFAULT_QUARTER_MINUTES;
    return Math.min(mins, 60);
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function renderTimer() {
    var m = Math.floor(secondsLeft / 60), s = secondsLeft % 60;
    timerEl.textContent = 'Q' + state.quarter + ' ' + m + ':' + pad(s);
  }

  document.addEventListener('DOMContentLoaded', function () {
    PCTE.getTeams().then(function (teams) {
      PCTE.populateTeamSelect(team1Select, teams, 'Team 1');
      PCTE.populateTeamSelect(team2Select, teams, 'Team 2');
    }).catch(function (err) { PCTE.modal.alert('Could not load teams: ' + err.message); });
    if (scoreboard) scoreboard.classList.add('bento-section');
  });

  setupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var t1id = team1Select.value, t2id = team2Select.value;
    if (!t1id || !t2id) { PCTE.modal.alert('Pick both teams first.'); return; }
    if (t1id === t2id) { PCTE.modal.alert('Team 1 and Team 2 must be different.'); return; }

    PCTE.getTeams().then(function (teams) {
      var t1 = teams.find(function (t) { return String(t.id) === String(t1id); });
      var t2 = teams.find(function (t) { return String(t.id) === String(t2id); });
      var quarterMinutes = normalizeMinutes(quarterLengthInput ? quarterLengthInput.value : DEFAULT_QUARTER_MINUTES);

      state = {
        startTime: new Date().toISOString(),
        quarter: 1,
        quarterMinutes: quarterMinutes,
        team1: { name: t1.name, points: 0, fouls: 0, players: t1.players.slice(), playerFouls: t1.players.map(function () { return 0; }) },
        team2: { name: t2.name, points: 0, fouls: 0, players: t2.players.slice(), playerFouls: t2.players.map(function () { return 0; }) }
      };

      secondsLeft = Math.round(quarterMinutes * 60);
      quarterSelect.value = '1';
      setupForm.style.display = 'none';
      liveStats.style.display = 'block';
      renderAll();
    }).catch(function (err) { PCTE.modal.alert('Could not start game: ' + err.message); });
  });

  function playerRows(teamKey) {
    var team = state[teamKey];
    if (!team.players.length) return '<p class="page-note">No players on this roster.</p>';
    return team.players.map(function (p, i) {
      return '<div class="player-row">' +
        '<span>' + PCTE.escapeHtml(p) + ' <span class="page-note" style="margin:0;">(' + team.playerFouls[i] + ' foul' + (team.playerFouls[i] === 1 ? '' : 's') + ')</span></span>' +
        '<button type="button" class="secondary player-foul-btn" data-team="' + teamKey + '" data-idx="' + i + '">+ Foul</button>' +
      '</div>';
    }).join('');
  }

  function renderAll() {
    gameInfo.textContent = state.team1.name + ' vs ' + state.team2.name + ' · started ' + PCTE.formatDate(state.startTime);
    team1NameEl.textContent = state.team1.name;
    team2NameEl.textContent = state.team2.name;
    team1PointsEl.textContent = state.team1.points;
    team2PointsEl.textContent = state.team2.points;
    team1FoulsEl.textContent = state.team1.fouls;
    team2FoulsEl.textContent = state.team2.fouls;
    team1PlayersEl.innerHTML = playerRows('team1');
    team2PlayersEl.innerHTML = playerRows('team2');

    var mvpOptions = ['<option value="" disabled selected>Select MVP</option>'];
    ['team1', 'team2'].forEach(function (key) {
      state[key].players.forEach(function (p) {
        mvpOptions.push('<option value="' + PCTE.escapeHtml(p) + '">' + PCTE.escapeHtml(state[key].name) + ' — ' + PCTE.escapeHtml(p) + '</option>');
      });
    });
    mvpSelect.innerHTML = mvpOptions.join('');

    if (quarterLengthLiveInput) quarterLengthLiveInput.value = state.quarterMinutes;
    renderTimer();

    // give the two scoreboard panels the glow-card treatment
    var panels = scoreboard.querySelectorAll(':scope > div');
    panels.forEach(function (panel) {
      panel.classList.add('magic-bento-card', 'magic-bento-card--border-glow');
      if (window.MagicBento) window.MagicBento.wireCard(panel);
    });
  }

  function bump(el, value) {
    if (window.gsap) {
      gsap.fromTo(el, { scale: 1.4 }, { scale: 1, duration: .35, ease: 'back.out(2)' });
    }
  }

  document.getElementById('addPointTeam1').addEventListener('click', function () { state.team1.points++; team1PointsEl.textContent = state.team1.points; bump(team1PointsEl); });
  document.getElementById('addPointTeam2').addEventListener('click', function () { state.team2.points++; team2PointsEl.textContent = state.team2.points; bump(team2PointsEl); });
  document.getElementById('addFoulTeam1').addEventListener('click', function () { state.team1.fouls++; team1FoulsEl.textContent = state.team1.fouls; bump(team1FoulsEl); });
  document.getElementById('addFoulTeam2').addEventListener('click', function () { state.team2.fouls++; team2FoulsEl.textContent = state.team2.fouls; bump(team2FoulsEl); });

  scoreboard.addEventListener('click', function (e) {
    var btn = e.target.closest('.player-foul-btn');
    if (!btn) return;
    var teamKey = btn.dataset.team, idx = parseInt(btn.dataset.idx, 10);
    state[teamKey].playerFouls[idx]++;
    state[teamKey].fouls++;
    renderAll();
  });

  quarterSelect.addEventListener('change', function () {
    state.quarter = parseInt(quarterSelect.value, 10);
    secondsLeft = Math.round(state.quarterMinutes * 60);
    renderTimer();
  });

  if (applyQuarterLengthBtn) {
    applyQuarterLengthBtn.addEventListener('click', function () {
      var mins = normalizeMinutes(quarterLengthLiveInput ? quarterLengthLiveInput.value : state.quarterMinutes);
      clearInterval(timerInterval);
      timerRunning = false;
      state.quarterMinutes = mins;
      secondsLeft = Math.round(mins * 60);
      if (quarterLengthLiveInput) quarterLengthLiveInput.value = mins;
      renderTimer();
    });
  }

  startTimerBtn.addEventListener('click', function () {
    if (timerRunning) return;
    timerRunning = true;
    timerInterval = setInterval(function () {
      if (secondsLeft <= 0) { clearInterval(timerInterval); timerRunning = false; return; }
      secondsLeft--;
      renderTimer();
    }, 1000);
  });

  stopTimerBtn.addEventListener('click', function () {
    timerRunning = false;
    clearInterval(timerInterval);
  });

  endGameBtn.addEventListener('click', function () {
    PCTE.modal.confirm('End the game and save this result to history?').then(function (ok) {
      if (!ok) return;
      clearInterval(timerInterval);
      timerRunning = false;

      var payload = {
        startTime: state.startTime,
        team1: state.team1,
        team2: state.team2,
        mvp: mvpSelect.value || ''
      };

      PCTE.createResult(payload).then(function () {
        return PCTE.modal.alert('Game saved! Redirecting to Results.');
      }).then(function () {
        window.location.href = 'results.html';
      }).catch(function (err) {
        PCTE.modal.alert('Could not save result: ' + err.message);
      });
    });
  });
})();
