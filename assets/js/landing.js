/**
 * MithraDirect landing page interactions
 */
(function () {
  'use strict';

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function showToast(message) {
    var toast = $('#landing-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toast.classList.remove('show');
    }, 2800);
  }

  function initMobileNav() {
    var toggle = $('#mobile-menu-btn');
    var panel = $('#mobile-menu');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', function () {
      var open = panel.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    $all('a', panel).forEach(function (link) {
      link.addEventListener('click', function () {
        panel.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function initDropdown() {
    var dd = $('#nav-resources');
    if (!dd) return;
    var btn = $('button', dd);
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      dd.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!dd.contains(e.target)) dd.classList.remove('open');
    });
  }

  function initSearchForm() {
    var form = $('#store-search-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#search-address');
      var value = (input && input.value || '').trim();
      if (!value) {
        showToast('Enter a delivery address to search nearby stores');
        if (input) input.focus();
        return;
      }
      var explore = $('#explore');
      if (explore) explore.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Showing stores near “' + value + '”');
      $all('.store-card').forEach(function (card, i) {
        card.style.outline = i === 0 ? '2px solid #10b981' : '';
      });
    });

    var locBtn = $('#use-location-btn');
    if (locBtn) {
      locBtn.addEventListener('click', function () {
        if (!navigator.geolocation) {
          showToast('Location is not supported in this browser');
          return;
        }
        locBtn.disabled = true;
        locBtn.textContent = 'Detecting…';
        navigator.geolocation.getCurrentPosition(
          function () {
            var input = $('#search-address');
            if (input) input.value = 'Current location';
            locBtn.disabled = false;
            locBtn.textContent = 'Use Current Location';
            showToast('Location detected — search nearby stores');
          },
          function () {
            locBtn.disabled = false;
            locBtn.textContent = 'Use Current Location';
            showToast('Could not access location. Enter an address instead.');
          },
          { timeout: 8000 }
        );
      });
    }
  }

  function initNewsletter() {
    var form = $('#newsletter-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('#newsletter-email');
      var value = (email && email.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        showToast('Please enter a valid email address');
        if (email) email.focus();
        return;
      }
      form.reset();
      showToast('Thanks! You’re subscribed to MithraDirect updates.');
    });
  }

  function initShareDemo() {
    $all('[data-share]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        var type = el.getAttribute('data-share');
        var url = window.location.origin + '/store.html';
        var text = 'Check out this local store on MithraDirect: ' + url;
        if (type === 'whatsapp') {
          el.setAttribute('href', 'https://wa.me/?text=' + encodeURIComponent(text));
          return;
        }
        if (type === 'instagram') {
          var ig =
            (window.MithraAssets && window.MithraAssets.path('external.instagram')) ||
            'https://www.instagram.com/mithradirect/';
          el.setAttribute('href', ig);
          return;
        }
        if (type === 'copy') {
          e.preventDefault();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
              showToast('Store link copied');
            });
          } else {
            showToast(url);
          }
        }
      });
    });
  }

  function initActiveNav() {
    var links = $all('.nav-links a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      if (id) map[id] = link;
    });
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (l) {
            l.classList.remove('active');
          });
          var link = map[entry.target.id];
          if (link) link.classList.add('active');
        });
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0.01 }
    );
    Object.keys(map).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  function init() {
    initMobileNav();
    initDropdown();
    initSearchForm();
    initNewsletter();
    initShareDemo();
    initActiveNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
