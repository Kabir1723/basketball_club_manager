/* =========================================================================
   users.js — admin-only user account management page.
   ========================================================================= */

(function (window, document) {
  'use strict';

  var tbody = document.querySelector('#usersTable tbody');
  var formError = document.getElementById('formError');

  function showError(msg) {
    formError.textContent = msg;
    formError.style.display = 'block';
  }

  function clearError() {
    formError.style.display = 'none';
  }

  function render(users) {
    var me = window.PCTE_USER;
    tbody.innerHTML = users.map(function (u) {
      var roleOptions = ['admin', 'coach', 'viewer'].map(function (r) {
        return '<option value="' + r + '"' + (r === u.role ? ' selected' : '') + '>' + r.charAt(0).toUpperCase() + r.slice(1) + '</option>';
      }).join('');
      var isSelf = me && me.id === u.id;
      return (
        '<tr data-id="' + u.id + '">' +
          '<td>' + PCTE.escapeHtml(u.username) + (isSelf ? ' <em>(you)</em>' : '') + '</td>' +
          '<td>' + PCTE.escapeHtml(u.role) + '</td>' +
          '<td><select class="role-select">' + roleOptions + '</select> <button type="button" class="secondary save-role-btn">Save</button></td>' +
          '<td><input type="password" class="new-pass" placeholder="New password" /> <button type="button" class="secondary save-pass-btn">Reset</button></td>' +
          '<td>' + (isSelf ? '—' : '<button type="button" class="danger delete-user-btn">Delete</button>') + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function load() {
    PCTE.getUsers().then(render).catch(function (err) { showError(err.message); });
  }

  document.getElementById('createUserForm').addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();
    var username = document.getElementById('newUsername').value.trim();
    var password = document.getElementById('newPassword').value;
    var role = document.getElementById('newRole').value;
    PCTE.createUser(username, password, role).then(function () {
      document.getElementById('createUserForm').reset();
      load();
    }).catch(function (err) { showError(err.message); });
  });

  tbody.addEventListener('click', function (e) {
    var row = e.target.closest('tr');
    if (!row) return;
    var userId = row.getAttribute('data-id');

    if (e.target.classList.contains('save-role-btn')) {
      var role = row.querySelector('.role-select').value;
      PCTE.updateUser(userId, { role: role }).then(load).catch(function (err) { showError(err.message); });
    }

    if (e.target.classList.contains('save-pass-btn')) {
      var pass = row.querySelector('.new-pass').value;
      if (!pass) { showError('Enter a new password first'); return; }
      PCTE.updateUser(userId, { password: pass }).then(load).catch(function (err) { showError(err.message); });
    }

    if (e.target.classList.contains('delete-user-btn')) {
      PCTE.modal.confirm('Delete this user account?').then(function (ok) {
        if (ok) return PCTE.deleteUser(userId).then(load).catch(function (err) { showError(err.message); });
      });
    }
  });

  document.addEventListener('pcte:user-ready', load);
})(window, document);
