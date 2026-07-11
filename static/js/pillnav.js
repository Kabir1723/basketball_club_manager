/* =========================================================================
   pillnav.js — vanilla JS port of the React Bits <PillNav /> component.
   Renders the club's page navigation as animated GSAP "pill" buttons with a
   fill-on-hover circle, replacing the old plain .navbox links. Mounts into
   any <div id="pillNavRoot"></div> found on the page and highlights the
   current page automatically.
   ========================================================================= */

(function (window, document) {
  'use strict';

  var ITEMS = [
    { label: 'Dashboard', href: 'index.html' },
    { label: 'Teams', href: 'teams.html' },
    { label: 'Schedule', href: 'schedule.html' },
    { label: 'Live Game', href: 'live-game.html' },
    { label: 'Results', href: 'results.html' },
    { label: 'Edit Results', href: 'history.html' }
  ];

  var LOGO_SVG =
    '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Basketball logo">' +
      '<circle cx="32" cy="32" r="30" style="fill:var(--accent)" stroke="#fff6ec" stroke-width="2"/>' +
      '<path d="M2 32h60M32 2v60M9 9c10 10 10 34 0 46M55 9c-10 10-10 34 0 46" stroke="#fff6ec" stroke-width="2" fill="none"/>' +
    '</svg>';

  var EASE = 'power3.out';

  function currentPage() {
    var path = window.location.pathname.split('/').pop();
    return path && path.length ? path : 'index.html';
  }

  function build(root) {
    var active = currentPage();
    var hasGsap = typeof window.gsap !== 'undefined';

    root.innerHTML =
      '<div class="pill-nav-wrap">' +
        '<nav class="pill-nav" aria-label="Primary">' +
          '<a class="pill-logo" href="index.html" aria-label="Home">' + LOGO_SVG + '</a>' +
          '<div class="pill-nav-items desktop-only">' +
            '<ul class="pill-list" role="menubar">' +
              ITEMS.map(function (item, i) {
                return '<li role="none">' +
                  '<a role="menuitem" href="' + item.href + '" class="pill' + (item.href === active ? ' is-active' : '') + '" data-idx="' + i + '">' +
                    '<span class="hover-circle" aria-hidden="true"></span>' +
                    '<span class="label-stack">' +
                      '<span class="pill-label">' + item.label + '</span>' +
                      '<span class="pill-label-hover" aria-hidden="true">' + item.label + '</span>' +
                    '</span>' +
                  '</a>' +
                '</li>';
              }).join('') +
            '</ul>' +
          '</div>' +
          '<button type="button" class="mobile-menu-button mobile-only" aria-label="Toggle menu">' +
            '<span class="hamburger-line"></span><span class="hamburger-line"></span>' +
          '</button>' +
        '</nav>' +
        '<div class="mobile-menu-backdrop mobile-only"></div>' +
        '<div class="mobile-menu-popover mobile-only">' +
          '<ul class="mobile-menu-list">' +
            ITEMS.map(function (item) {
              return '<li><a href="' + item.href + '" class="mobile-menu-link' + (item.href === active ? ' is-active' : '') + '">' + item.label + '</a></li>';
            }).join('') +
          '</ul>' +
        '</div>' +
      '</div>';

    var pills = Array.prototype.slice.call(root.querySelectorAll('.pill'));
    var timelines = [];
    var activeTweens = [];

    function layout() {
      pills.forEach(function (pill, i) {
        var circle = pill.querySelector('.hover-circle');
        var rect = pill.getBoundingClientRect();
        var w = rect.width, h = rect.height;
        if (!w || !h) return;
        var R = ((w * w) / 4 + h * h) / (2 * h);
        var D = Math.ceil(2 * R) + 2;
        var delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
        var originY = D - delta;

        circle.style.width = D + 'px';
        circle.style.height = D + 'px';
        circle.style.bottom = '-' + delta + 'px';

        var label = pill.querySelector('.pill-label');
        var hoverLabel = pill.querySelector('.pill-label-hover');

        if (!hasGsap) {
          circle.style.transform = 'translateX(-50%) scale(0)';
          return;
        }

        gsap.set(circle, { xPercent: -50, scale: 0, transformOrigin: '50% ' + originY + 'px' });
        gsap.set(label, { y: 0 });
        gsap.set(hoverLabel, { y: h + 12, opacity: 0 });

        if (timelines[i]) timelines[i].kill();
        var tl = gsap.timeline({ paused: true });
        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease: EASE, overwrite: 'auto' }, 0);
        tl.to(label, { y: -(h + 8), duration: 2, ease: EASE, overwrite: 'auto' }, 0);
        gsap.set(hoverLabel, { y: Math.ceil(h + 100), opacity: 0 });
        tl.to(hoverLabel, { y: 0, opacity: 1, duration: 2, ease: EASE, overwrite: 'auto' }, 0);
        timelines[i] = tl;
      });
    }

    layout();
    window.addEventListener('resize', layout, { passive: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(layout).catch(function () {});
    }

    if (hasGsap) {
      pills.forEach(function (pill, i) {
        pill.addEventListener('mouseenter', function () {
          var tl = timelines[i];
          if (!tl) return;
          if (activeTweens[i]) activeTweens[i].kill();
          activeTweens[i] = tl.tweenTo(tl.duration(), { duration: .3, ease: EASE, overwrite: 'auto' });
        });
        pill.addEventListener('mouseleave', function () {
          var tl = timelines[i];
          if (!tl) return;
          if (activeTweens[i]) activeTweens[i].kill();
          activeTweens[i] = tl.tweenTo(0, { duration: .2, ease: EASE, overwrite: 'auto' });
        });
      });

      var logo = root.querySelector('.pill-logo svg');
      if (logo) {
        root.querySelector('.pill-logo').addEventListener('mouseenter', function () {
          gsap.killTweensOf(logo);
          gsap.set(logo, { rotate: 0, transformOrigin: '50% 50%' });
          gsap.to(logo, { rotate: 360, duration: .5, ease: EASE });
        });
      }
    }

    /* ---- mobile menu ---- */
    var menuBtn = root.querySelector('.mobile-menu-button');
    var popover = root.querySelector('.mobile-menu-popover');
    var backdrop = root.querySelector('.mobile-menu-backdrop');
    var isOpen = false;

    function closeMenu() {
      if (!isOpen) return;
      isOpen = false;
      var lines = menuBtn.querySelectorAll('.hamburger-line');
      if (hasGsap) {
        gsap.to(lines[0], { rotation: 0, y: 0, duration: .3, ease: EASE });
        gsap.to(lines[1], { rotation: 0, y: 0, duration: .3, ease: EASE });
        gsap.to(popover, {
          opacity: 0, y: 10, duration: .2, ease: EASE,
          onComplete: function () { popover.style.visibility = 'hidden'; }
        });
        if (backdrop) gsap.to(backdrop, { opacity: 0, duration: .2, onComplete: function () { backdrop.style.visibility = 'hidden'; } });
      } else {
        popover.style.opacity = '0';
        popover.style.visibility = 'hidden';
        if (backdrop) { backdrop.style.opacity = '0'; backdrop.style.visibility = 'hidden'; }
      }
      document.body.style.overflow = '';
    }

    function openMenu() {
      isOpen = true;
      var lines = menuBtn.querySelectorAll('.hamburger-line');
      if (hasGsap) {
        gsap.to(lines[0], { rotation: 45, y: 3, duration: .3, ease: EASE });
        gsap.to(lines[1], { rotation: -45, y: -3, duration: .3, ease: EASE });
        popover.style.visibility = 'visible';
        gsap.fromTo(popover, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .3, ease: EASE });
        if (backdrop) { backdrop.style.visibility = 'visible'; gsap.to(backdrop, { opacity: 1, duration: .2 }); }
      } else {
        popover.style.visibility = 'visible';
        popover.style.opacity = '1';
        if (backdrop) { backdrop.style.visibility = 'visible'; backdrop.style.opacity = '1'; }
      }
      document.body.style.overflow = 'hidden';
    }

    if (menuBtn) {
      menuBtn.addEventListener('click', function () { isOpen ? closeMenu() : openMenu(); });
    }
    if (popover) {
      popover.querySelectorAll('.mobile-menu-link').forEach(function (link) {
        link.addEventListener('click', closeMenu);
      });
    }
    if (backdrop) backdrop.addEventListener('click', closeMenu);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    window.addEventListener('resize', function () { if (window.innerWidth > 768) closeMenu(); }, { passive: true });
  }

  function init() {
    document.querySelectorAll('#pillNavRoot').forEach(build);
  }

  window.PillNav = { init: init };
  document.addEventListener('DOMContentLoaded', init);
})(window, document);
