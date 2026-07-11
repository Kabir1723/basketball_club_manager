/* =========================================================================
   modal.js — site-themed replacements for window.alert / confirm / prompt.

   Usage (all return Promises, matching the async style already used
   elsewhere in the app):

     PCTE.modal.alert('Message here');                 -> Promise<void>
     PCTE.modal.confirm('Are you sure?');               -> Promise<boolean>
     PCTE.modal.prompt('Team name:', 'default value');  -> Promise<string|null>

   Each opens a centered dialog styled with the app's own palette/fonts
   instead of the browser's native dialog box, and resolves once the user
   picks an option (or rejects/cancels).
   ========================================================================= */

(function (window, document) {
  'use strict';

  var overlayEl = null;
  var activeResolve = null;

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.className = 'pcte-modal-overlay';
    overlayEl.innerHTML =
      '<div class="pcte-modal" role="dialog" aria-modal="true">' +
        '<p class="pcte-modal-message"></p>' +
        '<input type="text" class="pcte-modal-input" style="display:none;" />' +
        '<div class="pcte-modal-actions"></div>' +
      '</div>';
    document.body.appendChild(overlayEl);

    overlayEl.addEventListener('mousedown', function (e) {
      if (e.target === overlayEl) close(null);
    });
    document.addEventListener('keydown', function (e) {
      if (!overlayEl.classList.contains('is-open')) return;
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter' && overlayEl.querySelector('.pcte-modal-input').style.display === 'none') {
        var confirmBtn = overlayEl.querySelector('.pcte-modal-confirm');
        if (confirmBtn) confirmBtn.click();
      }
    });
    return overlayEl;
  }

  function close(result) {
    if (!overlayEl) return;
    overlayEl.classList.remove('is-open');
    var resolve = activeResolve;
    activeResolve = null;
    if (resolve) resolve(result);
  }

  function open(opts) {
    var root = ensureOverlay();
    var messageEl = root.querySelector('.pcte-modal-message');
    var inputEl = root.querySelector('.pcte-modal-input');
    var actionsEl = root.querySelector('.pcte-modal-actions');

    messageEl.textContent = opts.message || '';
    actionsEl.innerHTML = '';

    if (opts.showInput) {
      inputEl.style.display = '';
      inputEl.value = opts.defaultValue || '';
      inputEl.placeholder = opts.placeholder || '';
    } else {
      inputEl.style.display = 'none';
    }

    opts.buttons.forEach(function (btn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = btn.label;
      if (btn.className) b.className = btn.className;
      b.addEventListener('click', function () {
        close(opts.showInput && btn.value === true ? inputEl.value.trim() : btn.value);
      });
      actionsEl.appendChild(b);
    });

    root.classList.add('is-open');
    window.requestAnimationFrame(function () {
      if (opts.showInput) {
        inputEl.focus();
        inputEl.select();
      } else {
        var primary = actionsEl.querySelector('.pcte-modal-confirm');
        if (primary) primary.focus();
      }
    });

    return new Promise(function (resolve) {
      activeResolve = resolve;
    });
  }

  var PCTEModal = {
    alert: function (message) {
      return open({
        message: message,
        buttons: [{ label: 'OK', value: true, className: 'pcte-modal-confirm' }]
      });
    },
    confirm: function (message) {
      return open({
        message: message,
        buttons: [
          { label: 'Cancel', value: false, className: 'secondary' },
          { label: 'Confirm', value: true, className: 'pcte-modal-confirm danger' }
        ]
      });
    },
    prompt: function (message, defaultValue, placeholder) {
      return open({
        message: message,
        showInput: true,
        defaultValue: defaultValue,
        placeholder: placeholder,
        buttons: [
          { label: 'Cancel', value: null, className: 'secondary' },
          { label: 'OK', value: true, className: 'pcte-modal-confirm' }
        ]
      });
    }
  };

  window.PCTE = window.PCTE || {};
  window.PCTE.modal = PCTEModal;
})(window, document);
