/* =========================================================================
   game.js — Live Game Tracker page

   Two modes, decided by the logged-in user's role:

   - Operator (admin/coach): the existing tracker. Game state lives in
     memory in the operator's own browser tab while the game is live (no
     need to hit the database on every point/foul); the final result is
     still persisted in one request when the game is ended. The only
     addition is that the same state is also pushed to /api/live-game on
     every change, so it can be watched elsewhere.
   - Viewer: no setup form, no controls — just polls GET /api/live-game
     every few seconds and renders whatever's there read-only, with a
     lightweight local countdown between polls so the timer doesn't look
     frozen.
   ========================================================================= */

(function () {
  'use strict';
  var PCTE = window.PCTE;

  var setupForm = document.getElementById('gameSetup');
  if (!setupForm) return;

  var DEFAULT_QUARTER_MINUTES = 10;

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  document.addEventListener('DOMContentLoaded', function () {
    PCTE.getCurrentUser().then(function (user) {
      if (user && user.role_can_edit) {
        initOperator();
      } else {
        initViewer();
      }
    });
  });

  /* =======================================================================
     OPERATOR MODE (admin / coach)
     ======================================================================= */
  function initOperator() {
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

    var state = null;
    var timerInterval = null;
    var secondsLeft = DEFAULT_QUARTER_MINUTES * 60;
    var timerRunning = false;

    function normalizeMinutes(value) {
      var mins = parseFloat(value);
      if (!mins || mins <= 0) return DEFAULT_QUARTER_MINUTES;
      return Math.min(mins, 60);
    }

    function renderTimer() {
      var m = Math.floor(secondsLeft / 60), s = secondsLeft % 60;
      timerEl.textContent = 'Q' + state.quarter + ' ' + m + ':' + pad(s);
    }

    // Pushes the current tracker state to the shared /api/live-game row so
    // viewers watching along see the update. Fire-and-forget: a sync
    // hiccup shouldn't interrupt the person actually running the game.
    var liveGameStarted = false;
    function syncLiveGame() {
      if (!state) return;
      var call = liveGameStarted ? PCTE.updateLiveGame : PCTE.startLiveGame;
      liveGameStarted = true;
      call(state, secondsLeft, timerRunning).catch(function () {});
    }

    PCTE.getTeams().then(function (teams) {
      PCTE.populateTeamSelect(team1Select, teams, 'Team 1');
      PCTE.populateTeamSelect(team2Select, teams, 'Team 2');
    }).catch(function (err) { PCTE.modal.alert('Could not load teams: ' + err.message); });
    if (scoreboard) scoreboard.classList.add('bento-section');

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
        liveGameStarted = false;
        syncLiveGame();
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

    function bump(el) {
      if (window.gsap) {
        gsap.fromTo(el, { scale: 1.4 }, { scale: 1, duration: .35, ease: 'back.out(2)' });
      }
    }

    document.getElementById('addPointTeam1').addEventListener('click', function () { state.team1.points++; team1PointsEl.textContent = state.team1.points; bump(team1PointsEl); syncLiveGame(); });
    document.getElementById('addPointTeam2').addEventListener('click', function () { state.team2.points++; team2PointsEl.textContent = state.team2.points; bump(team2PointsEl); syncLiveGame(); });
    document.getElementById('addFoulTeam1').addEventListener('click', function () { state.team1.fouls++; team1FoulsEl.textContent = state.team1.fouls; bump(team1FoulsEl); syncLiveGame(); });
    document.getElementById('addFoulTeam2').addEventListener('click', function () { state.team2.fouls++; team2FoulsEl.textContent = state.team2.fouls; bump(team2FoulsEl); syncLiveGame(); });

    scoreboard.addEventListener('click', function (e) {
      var btn = e.target.closest('.player-foul-btn');
      if (!btn) return;
      var teamKey = btn.dataset.team, idx = parseInt(btn.dataset.idx, 10);
      state[teamKey].playerFouls[idx]++;
      state[teamKey].fouls++;
      renderAll();
      syncLiveGame();
    });

    quarterSelect.addEventListener('change', function () {
      state.quarter = parseInt(quarterSelect.value, 10);
      secondsLeft = Math.round(state.quarterMinutes * 60);
      renderTimer();
      syncLiveGame();
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
        syncLiveGame();
      });
    }

    startTimerBtn.addEventListener('click', function () {
      if (timerRunning) return;
      timerRunning = true;
      syncLiveGame();
      timerInterval = setInterval(function () {
        if (secondsLeft <= 0) { clearInterval(timerInterval); timerRunning = false; syncLiveGame(); return; }
        secondsLeft--;
        renderTimer();
      }, 1000);
    });

    stopTimerBtn.addEventListener('click', function () {
      timerRunning = false;
      clearInterval(timerInterval);
      syncLiveGame();
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
          return PCTE.endLiveGame().catch(function () {});
        }).then(function () {
          return PCTE.modal.alert('Game saved! Redirecting to Results.');
        }).then(function () {
          window.location.href = 'results.html';
        }).catch(function (err) {
          PCTE.modal.alert('Could not save result: ' + err.message);
        });
      });
    });
  }

  /* =======================================================================
     VIEWER MODE (read-only)
     ======================================================================= */
  function initViewer() {
    var section = document.getElementById('viewerLiveGame');
    var emptyState = document.getElementById('viewerEmptyState');
    var gameInfoBox = document.getElementById('viewerGameInfo');
    var infoEl = document.getElementById('viewerInfo');
    var timerEl = document.getElementById('viewerTimer');
    var team1NameEl = document.getElementById('viewerTeam1Name');
    var team2NameEl = document.getElementById('viewerTeam2Name');
    var team1PointsEl = document.getElementById('viewerTeam1Points');
    var team2PointsEl = document.getElementById('viewerTeam2Points');
    var team1FoulsEl = document.getElementById('viewerTeam1Fouls');
    var team2FoulsEl = document.getElementById('viewerTeam2Fouls');
    if (!section) return;

    section.style.display = 'block';

    var pollInterval = null;
    var localTick = null;

    function renderTimer(quarter, secondsLeft) {
      var m = Math.floor(secondsLeft / 60), s = secondsLeft % 60;
      timerEl.textContent = 'Q' + quarter + ' ' + m + ':' + pad(s);
    }

    function showEmpty() {
      emptyState.style.display = 'block';
      gameInfoBox.style.display = 'none';
      clearInterval(localTick);
    }

    function showGame(data) {
      var state = data.state;
      emptyState.style.display = 'none';
      gameInfoBox.style.display = 'block';
      infoEl.textContent = state.team1.name + ' vs ' + state.team2.name + ' · started ' + PCTE.formatDate(state.startTime);
      team1NameEl.textContent = state.team1.name;
      team2NameEl.textContent = state.team2.name;
      team1PointsEl.textContent = state.team1.points;
      team2PointsEl.textContent = state.team2.points;
      team1FoulsEl.textContent = state.team1.fouls;
      team2FoulsEl.textContent = state.team2.fouls;

      clearInterval(localTick);
      var localSeconds = data.timerSecondsLeft || 0;
      renderTimer(state.quarter, localSeconds);
      if (data.timerRunning) {
        localTick = setInterval(function () {
          if (localSeconds > 0) localSeconds--;
          renderTimer(state.quarter, localSeconds);
        }, 1000);
      }
    }

    function poll() {
      PCTE.getLiveGame().then(function (data) {
        if (!data || !data.active) {
          showEmpty();
        } else {
          showGame(data);
        }
      }).catch(function () { /* transient network hiccup — try again next poll */ });
    }

    function startPolling() {
      poll();
      if (!pollInterval) pollInterval = setInterval(poll, 3000);
    }
    function stopPolling() {
      clearInterval(pollInterval);
      clearInterval(localTick);
      pollInterval = null;
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    });

    startPolling();
  }
})();
