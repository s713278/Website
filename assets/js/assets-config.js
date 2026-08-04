/**
 * MithraDirect — shared asset paths (mirrors assets/css/global.css)
 * Use this from JS / HTML instead of hardcoding image URLs.
 *
 * HTML: <img data-md-src="logos.dark" data-md-fallback="fallbacks.banner" alt="...">
 * JS:   MithraAssets.path('vendors.geeta')  or  MithraAssets.paths.logos.dark
 */
(function (global) {
  'use strict';

  var BASE = 'assets/img';

  var ASSETS = {
    base: BASE,
    logos: {
      dark: BASE + '/logos/logo_dark_md.png',
      light: BASE + '/logos/logo_light_md.png'
    },
    fallbacks: {
      banner: BASE + '/banner_md.png',
      fresh: BASE + '/fresh.png',
      cup: BASE + '/cup.png',
      flower: BASE + '/flower.png',
      batch: BASE + '/batch.png'
    },
    vendors: {
      geeta: BASE + '/vendors/geetas-kitchen.jpg',
      geetaLogo: BASE + '/vendors/geetas-kitchen-logo.png',
      geetaBanner: BASE + '/vendors/geetas-kitchen-banner.png',
      saiLogo: BASE + '/vendors/sai-ram-home-foods-logo.png',
      saiBanner: BASE + '/vendors/sai-ram-home-foods-banner.png',
      farm: BASE + '/vendors/straight-from-farm.jpg',
      svada: BASE + '/vendors/svada-traditional.jpg'
    },
    testimonials: {
      a1: BASE + '/testimonial/testia1.png',
      a2: BASE + '/testimonial/testia2.png',
      a3: BASE + '/testimonial/testia3.png',
      fallback1: BASE + '/testimonial/dm_testi_people1.png',
      fallback2: BASE + '/testimonial/dm_testi_people2.png',
      fallback3: BASE + '/testimonial/dm_testi_people3.png'
    },
    external: {
      fonts: 'https://fonts.googleapis.com',
      fontsStatic: 'https://fonts.gstatic.com',
      tailwind: 'https://cdn.tailwindcss.com',
      instagram: 'https://www.instagram.com/mithradirect/',
      youtube: 'https://www.youtube.com/@MithraDirect',
      whatsapp: 'https://wa.me/919912149049',
      whatsappPhone: '9912149049',
      demoContactName: 'Swamy Kunta',
      /** Vendor dashboard base — override when wiring to vendor-app / API */
      dashboardUrl: '',
      pricingUrl: 'index.html#pricing'
    }
  };

  function path(key) {
    if (!key) return '';
    var parts = String(key).split('.');
    var cur = ASSETS;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return '';
      cur = cur[parts[i]];
    }
    return typeof cur === 'string' ? cur : '';
  }

  function logo(preferLight) {
    return preferLight ? ASSETS.logos.light : ASSETS.logos.dark;
  }

  function bannerOr(fallbackSrc) {
    return fallbackSrc || ASSETS.fallbacks.banner;
  }

  function onImgError(img, fallback) {
    if (!img) return;
    var src = typeof fallback === 'string' && fallback.indexOf('/') === -1
      ? path(fallback) || ASSETS.fallbacks.banner
      : fallback || ASSETS.fallbacks.banner;
    img.onerror = function () {
      img.onerror = null;
      img.src = src;
    };
  }

  function applyAssets(root) {
    var scope = root || document;
    if (!scope || !scope.querySelectorAll) return;

    scope.querySelectorAll('[data-md-src]').forEach(function (el) {
      var src = path(el.getAttribute('data-md-src'));
      if (!src) return;
      if (el.tagName === 'IMG' || el.tagName === 'SOURCE') {
        el.setAttribute('src', src);
      } else {
        el.style.backgroundImage = 'url("' + src + '")';
      }

      var fbKey = el.getAttribute('data-md-fallback');
      if (fbKey && el.tagName === 'IMG') {
        onImgError(el, fbKey);
      }
    });
  }

  function boot() {
    applyAssets(document);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  global.MithraAssets = {
    paths: ASSETS,
    path: path,
    logo: logo,
    bannerOr: bannerOr,
    onImgError: onImgError,
    applyAssets: applyAssets
  };
})(typeof window !== 'undefined' ? window : this);
