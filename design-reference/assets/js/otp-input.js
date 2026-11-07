/**
 * Shared OTP digit boxes for storefront + onboarding.
 * Length matches API demo OTP (4 digits).
 */
(function (global) {
  'use strict';

  var OTP_LENGTH = 4;

  function digitsOnly(value, max) {
    return String(value || '')
      .replace(/\D/g, '')
      .slice(0, max || OTP_LENGTH);
  }

  /**
   * @param {HTMLElement|string} container
   * @param {{ length?: number, idPrefix?: string, onComplete?: (otp: string) => void }} [options]
   */
  function mount(container, options) {
    options = options || {};
    var el =
      typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return null;

    var length = options.length || OTP_LENGTH;
    var idPrefix = options.idPrefix || 'otp';
    el.classList.add('otp-row');
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'One-time password');
    el.innerHTML = '';

    var inputs = [];

    function getValue() {
      return inputs
        .map(function (input) {
          return input.value || '';
        })
        .join('');
    }

    function setValue(raw) {
      var text = digitsOnly(raw, length);
      for (var i = 0; i < length; i++) {
        inputs[i].value = text[i] || '';
      }
      if (text.length === length && typeof options.onComplete === 'function') {
        options.onComplete(text);
      }
    }

    function clear() {
      setValue('');
    }

    function focus() {
      var firstEmpty = inputs.find(function (input) {
        return !input.value;
      });
      (firstEmpty || inputs[0]).focus();
    }

    function onInput(e) {
      var input = e.target;
      var v = digitsOnly(input.value, 1);
      input.value = v;
      if (v) {
        var idx = Number(input.dataset.idx);
        if (idx < length - 1) inputs[idx + 1].focus();
      }
      var otp = getValue();
      if (otp.length === length && typeof options.onComplete === 'function') {
        options.onComplete(otp);
      }
    }

    function onKeydown(e) {
      var input = e.target;
      var idx = Number(input.dataset.idx);
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        inputs[idx - 1].focus();
      }
      if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault();
        inputs[idx - 1].focus();
      }
      if (e.key === 'ArrowRight' && idx < length - 1) {
        e.preventDefault();
        inputs[idx + 1].focus();
      }
    }

    function onPaste(e) {
      e.preventDefault();
      setValue((e.clipboardData || global.clipboardData).getData('text'));
      focus();
    }

    for (var i = 0; i < length; i++) {
      var input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.autocomplete = i === 0 ? 'one-time-code' : 'off';
      input.maxLength = 1;
      input.className = 'otp-input';
      input.id = idPrefix + '-digit-' + (i + 1);
      input.setAttribute('aria-label', 'Digit ' + (i + 1) + ' of ' + length);
      input.dataset.idx = String(i);
      input.addEventListener('input', onInput);
      input.addEventListener('keydown', onKeydown);
      input.addEventListener('paste', onPaste);
      el.appendChild(input);
      inputs.push(input);
    }

    return {
      length: length,
      getValue: getValue,
      setValue: setValue,
      clear: clear,
      focus: focus,
      destroy: function () {
        el.innerHTML = '';
        inputs = [];
      },
    };
  }

  global.MithraOtp = {
    LENGTH: OTP_LENGTH,
    mount: mount,
    digitsOnly: digitsOnly,
  };
})(typeof window !== 'undefined' ? window : this);
