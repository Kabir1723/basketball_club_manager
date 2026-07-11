/* =========================================================================
   MagicBento — vanilla JS port (ported from the React Bits component)
   Reusable across pages: any element with class "magic-bento-card" inside a
   ".bento-section" gets spotlight + border-glow + tilt + magnetism +
   particles + click-ripple. Call MagicBento.wireCard(card) after you create
   a card dynamically (e.g. from teams.js / schedule.js).
   ========================================================================= */

(function (window, document) {
  'use strict';

  var MOBILE_BREAKPOINT = 768;

  var MagicBento = {
    spotlightRadius: 260,
    particleCount: 10,
    enableTilt: true,
    enableMagnetism: true,
    clickEffect: true,
    enableStars: true,
    enableSpotlight: true,
    disabled: false,
    _spotlightEl: null,
    _spotlightWired: false,

    init: function () {
      var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.disabled = reducedMotion || window.innerWidth <= MOBILE_BREAKPOINT || typeof gsap === 'undefined';

      // wire any cards already present in the DOM
      var self = this;
      document.querySelectorAll('.magic-bento-card').forEach(function (card) { self.wireCard(card); });

      if (this.enableSpotlight && !this.disabled) this._wireSpotlight();
    },

    _glowColor: function (card) {
      var v = getComputedStyle(card).getPropertyValue('--glow-color');
      return (v && v.trim()) || '253, 120, 16';
    },

    wireCard: function (card) {
      if (!card || card.dataset.bentoWired) return;
      card.dataset.bentoWired = '1';
      if (this.disabled) return;

      var self = this;
      var particles = [];
      var timeouts = [];
      var hovering = false;

      function color() { return self._glowColor(card); }

      function spawnParticle(x, y) {
        var p = document.createElement('div');
        p.className = 'particle';
        p.style.cssText =
          'width:4px;height:4px;border-radius:50%;left:' + x + 'px;top:' + y + 'px;' +
          'background:rgba(' + color() + ',1);box-shadow:0 0 6px rgba(' + color() + ',.6);';
        return p;
      }

      function clearParticles() {
        timeouts.forEach(clearTimeout);
        timeouts = [];
        particles.forEach(function (p) {
          gsap.to(p, { scale: 0, opacity: 0, duration: .25, ease: 'back.in(1.7)', onComplete: function () { p.remove(); } });
        });
        particles = [];
      }

      function animateParticles() {
        if (!self.enableStars) return;
        var rect = card.getBoundingClientRect();
        for (var i = 0; i < self.particleCount; i++) {
          (function (i) {
            var t = setTimeout(function () {
              if (!hovering) return;
              var p = spawnParticle(Math.random() * rect.width, Math.random() * rect.height);
              card.appendChild(p);
              particles.push(p);
              gsap.fromTo(p, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .3, ease: 'back.out(1.7)' });
              gsap.to(p, { x: (Math.random() - .5) * 80, y: (Math.random() - .5) * 80, rotation: Math.random() * 360, duration: 2 + Math.random() * 2, repeat: -1, yoyo: true, ease: 'none' });
              gsap.to(p, { opacity: .3, duration: 1.4, repeat: -1, yoyo: true, ease: 'power2.inOut' });
            }, i * 100);
            timeouts.push(t);
          })(i);
        }
      }

      card.addEventListener('mouseenter', function () {
        hovering = true;
        animateParticles();
        if (self.enableTilt) gsap.to(card, { rotateX: 4, rotateY: 4, duration: .3, ease: 'power2.out', transformPerspective: 1000 });
      });

      card.addEventListener('mousemove', function (e) {
        if (!self.enableTilt && !self.enableMagnetism) return;
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left, y = e.clientY - rect.top;
        var cx = rect.width / 2, cy = rect.height / 2;

        if (self.enableTilt) {
          gsap.to(card, { rotateX: ((y - cy) / cy) * -6, rotateY: ((x - cx) / cx) * 6, duration: .1, ease: 'power2.out', transformPerspective: 1000 });
        }
        if (self.enableMagnetism) {
          gsap.to(card, { x: (x - cx) * .03, y: (y - cy) * .03, duration: .3, ease: 'power2.out' });
        }
      });

      card.addEventListener('mouseleave', function () {
        hovering = false;
        clearParticles();
        if (self.enableTilt) gsap.to(card, { rotateX: 0, rotateY: 0, duration: .3, ease: 'power2.out' });
        if (self.enableMagnetism) gsap.to(card, { x: 0, y: 0, duration: .3, ease: 'power2.out' });
      });

      card.addEventListener('click', function (e) {
        if (!self.clickEffect) return;
        if (e.target.closest('button,a,input,select,form')) return; // don't ripple on interactive children
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left, y = e.clientY - rect.top;
        var maxD = Math.max(Math.hypot(x, y), Math.hypot(x - rect.width, y), Math.hypot(x, y - rect.height), Math.hypot(x - rect.width, y - rect.height));
        var ripple = document.createElement('div');
        ripple.style.cssText =
          'position:absolute;border-radius:50%;pointer-events:none;z-index:6;' +
          'width:' + (maxD * 2) + 'px;height:' + (maxD * 2) + 'px;left:' + (x - maxD) + 'px;top:' + (y - maxD) + 'px;' +
          'background:radial-gradient(circle, rgba(' + color() + ',.35) 0%, rgba(' + color() + ',.18) 30%, transparent 70%);';
        card.appendChild(ripple);
        gsap.fromTo(ripple, { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: .7, ease: 'power2.out', onComplete: function () { ripple.remove(); } });
      });
    },

    _wireSpotlight: function () {
      if (this._spotlightWired) return;
      this._spotlightWired = true;

      var self = this;
      var spotlight = document.createElement('div');
      spotlight.className = 'global-spotlight';
      document.body.appendChild(spotlight);
      this._spotlightEl = spotlight;

      var proximity = this.spotlightRadius * 0.5;
      var fadeDistance = this.spotlightRadius * 0.75;

      document.addEventListener('mousemove', function (e) {
        var sections = document.querySelectorAll('.bento-section');
        var activeSection = null;
        sections.forEach(function (section) {
          var rect = section.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            activeSection = section;
          }
        });

        if (!activeSection) {
          gsap.to(spotlight, { opacity: 0, duration: .3 });
          document.querySelectorAll('.magic-bento-card').forEach(function (c) { c.style.setProperty('--glow-intensity', '0'); });
          return;
        }

        var cards = activeSection.querySelectorAll('.magic-bento-card');
        var minDist = Infinity;

        cards.forEach(function (card) {
          var cRect = card.getBoundingClientRect();
          var cx = cRect.left + cRect.width / 2, cy = cRect.top + cRect.height / 2;
          var dist = Math.max(0, Math.hypot(e.clientX - cx, e.clientY - cy) - Math.max(cRect.width, cRect.height) / 2);
          minDist = Math.min(minDist, dist);

          var glow = 0;
          if (dist <= proximity) glow = 1;
          else if (dist <= fadeDistance) glow = (fadeDistance - dist) / (fadeDistance - proximity);

          var rx = ((e.clientX - cRect.left) / cRect.width) * 100;
          var ry = ((e.clientY - cRect.top) / cRect.height) * 100;
          card.style.setProperty('--glow-x', rx + '%');
          card.style.setProperty('--glow-y', ry + '%');
          card.style.setProperty('--glow-intensity', String(glow));
        });

        gsap.to(spotlight, { left: e.clientX, top: e.clientY, duration: .1, ease: 'power2.out' });
        var targetOpacity = minDist <= proximity ? .55 : (minDist <= fadeDistance ? ((fadeDistance - minDist) / (fadeDistance - proximity)) * .55 : 0);
        gsap.to(spotlight, { opacity: targetOpacity, duration: targetOpacity > 0 ? .2 : .5 });
      });

      document.addEventListener('mouseleave', function () {
        gsap.to(spotlight, { opacity: 0, duration: .3 });
      });
    }
  };

  window.MagicBento = MagicBento;
  document.addEventListener('DOMContentLoaded', function () { MagicBento.init(); });
})(window, document);