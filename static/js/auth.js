/* =========================================================================
   auth.js — shared login-state helper used by every logged-in page.

   Responsibilities:
   - Fetch the current user (/api/me) and stash it on window.PCTE_USER
   - Inject a "Users" pill into the nav for admins only
   - Inject a small "signed in as ... (role) | Log out" control into the nav
   - Hide/disable any element marked data-role="coach,admin" (or similar)
     when the current user's role isn't in that list, so viewers only see
     read-only controls
   - Redirect to the login page if a fetch ever comes back 401 (session
     expired, logged out in another tab, etc.)
   ========================================================================= */

(function (window, document) {
  'use strict';

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function applyRoleGating(user) {
    // Any element tagged data-requires-role="coach admin" is only shown to
    // those roles; everyone else (viewers) gets it hidden.
    document.querySelectorAll('[data-requires-role]').forEach(function (node) {
      var allowed = node.getAttribute('data-requires-role').split(/\s+/);
      if (!user || allowed.indexOf(user.role) === -1) {
        node.style.display = 'none';
      }
    });

    if (user && !user.role_can_edit) {
      document.body.classList.add('viewer-mode');
    }
  }

  function injectNavControls(user) {
    var nav = document.querySelector('nav');
    if (!nav) return;

    // Users link for admins, added to both the desktop pill list and the
    // mobile menu list that pillnav.js already rendered.
    if (user.role === 'admin') {
      var active = (window.location.pathname.split('/').pop() || 'index.html') === 'users.html';
      var pillList = nav.querySelector('.pill-list');
      if (pillList && !pillList.querySelector('[data-nav="users"]')) {
        var li = el(
          '<li role="none">' +
            '<a role="menuitem" href="users.html" data-nav="users" class="pill' + (active ? ' is-active' : '') + '">' +
              '<span class="hover-circle" aria-hidden="true"></span>' +
              '<span class="label-stack">' +
                '<span class="pill-label">Users</span>' +
                '<span class="pill-label-hover">Users</span>' +
              '</span>' +
            '</a>' +
          '</li>'
        );
        pillList.appendChild(li);
      }
      var mobileList = nav.querySelector('.mobile-menu-list');
      if (mobileList && !mobileList.querySelector('[data-nav="users"]')) {
        mobileList.appendChild(el(
          '<li><a href="users.html" data-nav="users" class="mobile-menu-link' + (active ? ' is-active' : '') + '">Users</a></li>'
        ));
      }
    }

    // Small "signed in as" + logout control.
    if (!nav.querySelector('.auth-status')) {
      var status = el(
        '<div class="auth-status">' +
          '<span class="auth-user">Signed in as <strong>' + PCTE_escape(user.username) + '</strong> (' + PCTE_escape(user.role) + ')</span>' +
          '<button type="button" class="secondary auth-logout-btn">Log Out</button>' +
        '</div>'
      );
      nav.appendChild(status);
      status.querySelector('.auth-logout-btn').addEventListener('click', function () {
        fetch('/api/logout', { method: 'POST' }).finally(function () {
          window.location.href = 'login.html';
        });
      });
    }
  }

  function PCTE_escape(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function init() {
    fetch('/api/me').then(function (res) { return res.json(); }).then(function (user) {
      if (!user) {
        // Not logged in — the server should already have redirected
        // protected pages, but just in case, send them to login.
        if ((window.location.pathname.split('/').pop() || '') !== 'login.html') {
          window.location.href = 'login.html';
        }
        return;
      }
      user.role_can_edit = (user.role === 'admin' || user.role === 'coach');
      window.PCTE_USER = user;
      injectNavControls(user);
      applyRoleGating(user);
      document.dispatchEvent(new CustomEvent('pcte:user-ready', { detail: user }));
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})(window, document);
