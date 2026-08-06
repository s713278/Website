/**
 * MithraDirect Store API — localStorage-backed release data layer.
 *
 * store.html is a presentation template. All store release data flows through
 * this module so a future HTTP API can replace the local adapters without
 * changing the UI.
 *
 * Contract (release payload):
 * {
 *   slug, phone, businessType, categories[], products[],
 *   delivery{}, payment{}, settings{}, addresses[],
 *   vendorId, subscription: { planCode, planName, status, activatedAt, … },
 *   meta: { source, fetchedAt, version }
 * }
 *
 * Usage:
 *   StoreAPI.getRelease({ slug }).then(render)
 *   StoreAPI.saveRelease(payload)
 *   StoreAPI.getCart() / setCart(lines)
 *   StoreAPI.getSession() / setSession(session)
 *   StoreAPI.getVendorSession() / setVendorSession() / logoutVendor()
 */
(function (global) {
  'use strict';

  var D = global.MithraDraft;
  if (!D) {
    console.error('MithraDraft required before store-api.js');
    return;
  }

  var KEYS = {
    release: 'mithra_store_release',
    cart: 'mithra_store_cart',
    session: 'mithra_store_session',
    vendorSession: 'mithra_vendor_session',
    config: 'mithra_store_api_config'
  };

  /** Default config — flip useRemote to true when backend is ready */
  var DEFAULT_CONFIG = {
    useRemote: false,
    apiBase: '/api/v1',
    /** GET {apiBase}/stores/{slug}/release */
    releasePath: '/stores/{slug}/release',
    timeoutMs: 8000
  };

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function getConfig() {
    return Object.assign({}, DEFAULT_CONFIG, readJson(KEYS.config, {}));
  }

  function setConfig(partial) {
    var next = Object.assign(getConfig(), partial || {});
    writeJson(KEYS.config, next);
    return next;
  }

  function qs(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || '';
    } catch (e) {
      return '';
    }
  }

  function normalizeRelease(raw) {
    var blank = D.emptyDraft();
    var data = raw || {};
    var draft = Object.assign({}, blank, data, {
      settings: Object.assign({}, blank.settings, data.settings || {}),
      delivery: Object.assign({}, blank.delivery, data.delivery || {}),
      payment: Object.assign({}, blank.payment, data.payment || {})
    });
    if (data.delivery) {
      Object.keys(blank.delivery).forEach(function (k) {
        draft.delivery[k] = Object.assign({}, blank.delivery[k], data.delivery[k] || {});
      });
    }
    if (data.payment) {
      Object.keys(blank.payment).forEach(function (k) {
        draft.payment[k] = Object.assign({}, blank.payment[k], data.payment[k] || {});
      });
    }
    if (!draft.settings.themeColor) draft.settings.themeColor = '#10b981';
    if (draft.settings.storeName && !draft.slug) {
      draft.slug = D.slugify(draft.settings.storeName);
    }
    (draft.products || []).forEach(function (p) {
      (p.variants || []).forEach(function (v) {
        if (v.mrp == null) v.mrp = Number(v.price) || 0;
        if (typeof v.active !== 'boolean') v.active = true;
      });
    });
    draft.meta = Object.assign(
      {
        source: 'local',
        fetchedAt: new Date().toISOString(),
        version: 1
      },
      data.meta || {}
    );
    if (!draft.subscription) {
      draft.subscription = D.defaultSubscription ? D.defaultSubscription() : null;
    } else if (D.defaultSubscription) {
      draft.subscription = Object.assign({}, D.defaultSubscription(), data.subscription || draft.subscription);
    }
    return draft;
  }

  function seedByBrand(brandOrSlug) {
    var key = String(brandOrSlug || '').toLowerCase();
    if (key === 'sai-ram' || key === 'sai-ram-home-foods') {
      return D.seedSaiRamDraft();
    }
    return D.seedStaticStorefront();
  }

  /**
   * Ensure a publishable release exists in localStorage.
   * Prefer cached release → matching onboarding draft → demo seed.
   */
  function ensureLocalRelease(opts) {
    opts = opts || {};
    var slug = opts.slug || qs('slug');
    var brand = opts.brand || qs('brand');
    var cached = readJson(KEYS.release, null);
    var onboarding = D.loadDraft();
    var onboardingSlug =
      onboarding.slug || D.slugify((onboarding.settings && onboarding.settings.storeName) || '');
    var onboardingReady =
      !!(onboarding.settings &&
        onboarding.settings.storeName &&
        (onboarding.products || []).length);

    // Explicit brand/demo seed (always refreshes demo catalog)
    if (brand || slug === 'geetas-kitchen' || slug === 'sai-ram-home-foods') {
      var seeded = normalizeRelease(seedByBrand(brand || slug));
      seeded.meta.source = 'seed';
      saveRelease(seeded);
      return seeded;
    }

    // Explicit slug matching published/onboarding store
    if (slug && onboardingReady && slug === onboardingSlug) {
      var fromOnboarding = normalizeRelease(onboarding);
      fromOnboarding.meta.source = 'onboarding';
      if (!fromOnboarding.addresses || !fromOnboarding.addresses.length) {
        fromOnboarding.addresses = [
          {
            id: 'home',
            label: 'Home',
            line: fromOnboarding.settings.address || fromOnboarding.settings.location || ''
          }
        ];
      }
      saveRelease(fromOnboarding);
      return fromOnboarding;
    }

    // Cached release for this slug (or default when no slug)
    if (cached && cached.settings && cached.settings.storeName) {
      if (!slug || slug === cached.slug) {
        // Keep demo seeds in sync with latest seed catalog / contact number
        if (cached.meta && cached.meta.source === 'seed') {
          var refreshed = normalizeRelease(seedByBrand(cached.slug || 'geetas-kitchen'));
          refreshed.meta.source = 'seed';
          if (cached.addresses && cached.addresses.length) {
            refreshed.addresses = cached.addresses;
          }
          saveRelease(refreshed);
          return refreshed;
        }
        return normalizeRelease(cached);
      }
    }

    // No slug: show vendor's published onboarding store if ready
    if (!slug && onboardingReady) {
      var live = normalizeRelease(onboarding);
      live.meta.source = 'onboarding';
      if (!live.addresses || !live.addresses.length) {
        live.addresses = [
          {
            id: 'home',
            label: 'Home',
            line: live.settings.address || live.settings.location || ''
          }
        ];
      }
      saveRelease(live);
      return live;
    }

    // Fallback demo seed persisted locally
    var demo = normalizeRelease(D.seedStaticStorefront());
    demo.meta.source = 'seed';
    saveRelease(demo);
    return demo;
  }

  function saveRelease(release, opts) {
    opts = opts || {};
    var normalized = normalizeRelease(release);
    writeJson(KEYS.release, normalized);
    // Sync into onboarding draft only when publishing vendor data (not demo seeds)
    if (
      opts.syncDraft ||
      (normalized.meta &&
        (normalized.meta.source === 'publish' || normalized.meta.source === 'onboarding'))
    ) {
      D.saveDraft(normalized);
    }
    return normalized;
  }

  function getReleaseSync(opts) {
    return ensureLocalRelease(opts || {});
  }

  /**
   * Async release loader — local today, remote when config.useRemote is true.
   * UI should always call this so swapping to API is a config change.
   */
  function getRelease(opts) {
    opts = opts || {};
    var config = getConfig();
    var slug = opts.slug || qs('slug') || 'geetas-kitchen';

    if (!config.useRemote) {
      return Promise.resolve(getReleaseSync(opts));
    }

    var path = String(config.releasePath || '').replace('{slug}', encodeURIComponent(slug));
    var url = String(config.apiBase || '').replace(/\/$/, '') + path;

    return fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout
        ? AbortSignal.timeout(config.timeoutMs || 8000)
        : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Release fetch failed: ' + res.status);
        return res.json();
      })
      .then(function (payload) {
        var release = normalizeRelease(payload.data || payload);
        release.meta.source = 'api';
        release.meta.fetchedAt = new Date().toISOString();
        saveRelease(release);
        return release;
      })
      .catch(function (err) {
        console.warn('[StoreAPI] remote release failed, using local cache', err);
        var local = getReleaseSync(opts);
        local.meta.source = local.meta.source || 'local-fallback';
        local.meta.error = String(err && err.message ? err.message : err);
        return local;
      });
  }

  /* ——— Cart / session (local only; ready to sync later) ——— */

  function getCart() {
    var cart = readJson(KEYS.cart, []);
    return Array.isArray(cart) ? cart : [];
  }

  function setCart(lines) {
    return writeJson(KEYS.cart, Array.isArray(lines) ? lines : []);
  }

  function clearCart() {
    localStorage.removeItem(KEYS.cart);
  }

  function getSession() {
    return readJson(KEYS.session, {
      phone: '',
      name: '',
      loggedIn: false,
      address: ''
    });
  }

  function setSession(session) {
    return writeJson(KEYS.session, Object.assign(getSession(), session || {}));
  }

  function clearSession() {
    localStorage.removeItem(KEYS.session);
  }

  /**
   * Vendor / admin dashboard auth (local; API tokens cleared on logout).
   * role: 'vendor' | 'admin'
   */
  function normalizeVendorRole(role) {
    var r = String(role || '')
      .trim()
      .toLowerCase();
    if (r === 'admin' || r === 'administrator') return 'admin';
    return 'vendor';
  }

  function getVendorSession() {
    return readJson(KEYS.vendorSession, {
      loggedIn: false,
      phone: '',
      name: '',
      role: 'vendor',
      vendorId: null
    });
  }

  function setVendorSession(partial) {
    var cur = getVendorSession();
    var next = Object.assign({}, cur, partial || {});
    if (partial && partial.role != null) next.role = normalizeVendorRole(partial.role);
    if (next.loggedIn == null) next.loggedIn = true;
    return writeJson(KEYS.vendorSession, next);
  }

  function clearVendorSession() {
    localStorage.removeItem(KEYS.vendorSession);
  }

  function clearAuthTokens() {
    try {
      localStorage.removeItem('mithra_access_token');
      localStorage.removeItem('mithra_refresh_token');
    } catch (e) {}
  }

  /**
   * End vendor/admin session. Keeps store draft/release data; requires re-verify.
   */
  function logoutVendor(opts) {
    opts = opts || {};
    clearVendorSession();
    clearAuthTokens();
    if (opts.clearCustomerSession) clearSession();
    if (D && typeof D.loadDraft === 'function' && typeof D.saveDraft === 'function') {
      try {
        var draft = D.loadDraft();
        draft.verified = false;
        draft.currentStep = 1;
        D.saveDraft(draft);
      } catch (e) {}
    }
    return true;
  }

  /**
   * Publish helper for onboarding → storefront handoff.
   */
  function publishFromDraft(draft) {
    var release = normalizeRelease(draft);
    release.meta.source = 'publish';
    release.meta.publishedAt = new Date().toISOString();
    return saveRelease(release, { syncDraft: true });
  }

  global.StoreAPI = {
    KEYS: KEYS,
    getConfig: getConfig,
    setConfig: setConfig,
    normalizeRelease: normalizeRelease,
    getRelease: getRelease,
    getReleaseSync: getReleaseSync,
    saveRelease: saveRelease,
    publishFromDraft: publishFromDraft,
    getCart: getCart,
    setCart: setCart,
    clearCart: clearCart,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    getVendorSession: getVendorSession,
    setVendorSession: setVendorSession,
    clearVendorSession: clearVendorSession,
    clearAuthTokens: clearAuthTokens,
    logoutVendor: logoutVendor,
    normalizeVendorRole: normalizeVendorRole
  };
})(typeof window !== 'undefined' ? window : this);
