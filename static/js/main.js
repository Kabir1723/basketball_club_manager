/* =========================================================================
   main.js — shared API + formatting helpers used by every page of the
   PCTE Basketball Club Manager.

   Data used to live in localStorage; it now lives in a real database
   (SQLite/MySQL) behind the Flask backend in app.py. These helpers talk to
   that backend's JSON REST API under /api/... and return Promises.
   ========================================================================= */

(function (window, document) {
  'use strict';

  var PCTE = {};
  var API_BASE = '/api';

  /* ---------------- low-level fetch helper ---------------- */
  function request(path, options) {
    return fetch(API_BASE + path, Object.assign({
      headers: { 'Content-Type': 'application/json' }
    }, options || {})).then(function (res) {
      if (res.status === 401) {
        window.location.href = 'login.html';
        throw new Error('Login required');
      }
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          throw new Error(body.error || ('Request failed: ' + res.status));
        });
      }
      if (res.status === 204) return null;
      return res.json();
    });
  }

  /* ---------------- teams & players ---------------- */
  PCTE.getTeams = function () {
    return request('/teams');
  };
  PCTE.createTeam = function (name) {
    return request('/teams', { method: 'POST', body: JSON.stringify({ name: name }) });
  };
  PCTE.deleteTeam = function (teamId) {
    return request('/teams/' + teamId, { method: 'DELETE' });
  };
  PCTE.addPlayer = function (teamId, name) {
    return request('/teams/' + teamId + '/players', { method: 'POST', body: JSON.stringify({ name: name }) });
  };
  PCTE.removePlayer = function (teamId, playerId) {
    return request('/teams/' + teamId + '/players/' + playerId, { method: 'DELETE' });
  };

  /* ---------------- schedule ---------------- */
  PCTE.getSchedule = function () {
    return request('/schedule');
  };
  PCTE.createGame = function (team1, team2, datetimeValue) {
    return request('/schedule', {
      method: 'POST',
      body: JSON.stringify({ team1: team1, team2: team2, datetime: datetimeValue })
    });
  };
  PCTE.deleteGame = function (gameId) {
    return request('/schedule/' + gameId, { method: 'DELETE' });
  };

  /* ---------------- results ---------------- */
  PCTE.getResults = function () {
    return request('/results');
  };
  PCTE.createResult = function (payload) {
    return request('/results', { method: 'POST', body: JSON.stringify(payload) });
  };
  PCTE.deleteResult = function (resultId) {
    return request('/results/' + resultId, { method: 'DELETE' });
  };

  /* ---------------- users (admin only) ---------------- */
  PCTE.getUsers = function () {
    return request('/users');
  };
  PCTE.createUser = function (username, password, role) {
    return request('/users', { method: 'POST', body: JSON.stringify({ username: username, password: password, role: role }) });
  };
  PCTE.updateUser = function (userId, payload) {
    return request('/users/' + userId, { method: 'PUT', body: JSON.stringify(payload) });
  };
  PCTE.deleteUser = function (userId) {
    return request('/users/' + userId, { method: 'DELETE' });
  };

  /* ---------------- formatting helpers ---------------- */
  PCTE.formatDate = function (dateString) {
    if (!dateString) return '';
    var d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  PCTE.escapeHtml = function (str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  };

  PCTE.teamName = function (teams, id) {
    var t = teams.find(function (t) { return String(t.id) === String(id); });
    return t ? t.name : 'Unknown team';
  };

  PCTE.populateTeamSelect = function (select, teams, placeholder) {
    if (!select) return;
    var current = select.value;
    select.innerHTML =
      '<option value="" disabled' + (current ? '' : ' selected') + '>' + (placeholder || 'Select team') + '</option>' +
      teams.map(function (t) { return '<option value="' + t.id + '">' + PCTE.escapeHtml(t.name) + '</option>'; }).join('');
    if (current && teams.some(function (t) { return String(t.id) === String(current); })) select.value = current;
  };

  window.PCTE = PCTE;
})(window, document);
