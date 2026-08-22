/**
 * MithraDirect vendor onboarding wizard (frontend demo).
 * Depends on MithraDraft (store-draft.js).
 */
(function () {
  'use strict';

  var D = window.MithraDraft;
  if (!D) {
    console.error('MithraDraft missing');
    return;
  }

  var STEPS = [
    { n: 1, label: 'Verify Mobile', time: '1 min' },
    { n: 2, label: 'Enter OTP', time: '1 min' },
    { n: 3, label: 'Choose Business', time: '1 min' },
    { n: 4, label: 'Pick Categories', time: '1 min' },
    { n: 5, label: 'Pick Products', time: '2 min' },
    { n: 6, label: 'Set Prices', time: '2 min' },
    { n: 7, label: 'Delivery', time: '1 min' },
    { n: 8, label: 'Payments', time: '1 min' },
    { n: 9, label: 'Store Settings', time: '1 min' },
    { n: 10, label: 'You\'re Live', time: '1 min' }
  ];

  var TOTAL_STEPS = 10;

  var draft = D.loadDraft();
  var resendSeconds = 0;
  /** Accordion: which category is open on Products / Prices steps */
  var expandedProductCatId = null;
  var expandedSkuCatId = null;
  var resendInterval = null;
  var dragSrcId = null;
  var PRODUCT_PAGE_SIZE = D.PRODUCT_PAGE_SIZE || 6;
  var productPagers = {};
  var productSearchTimers = {};

  /* ---------- Persistence helpers ---------- */

  function persist() {
    D.saveDraft(draft);
    updateSummary();
    renderPreview();
  }

  function goToStep(step) {
    if (step < 1 || step > TOTAL_STEPS) return;
    if (step > draft.maxReachedStep) return;
    draft.currentStep = step;
    persist();
    renderStepper();
    showPanel(step);
    syncStepForm(step);
  }

  function advanceFrom(step) {
    if (!validateStep(step)) return;
    var next = step + 1;
    if (next > draft.maxReachedStep) draft.maxReachedStep = next;
    draft.currentStep = next;
    persist();
    renderStepper();
    showPanel(next);
    syncStepForm(next);
    if (next === TOTAL_STEPS) finalizeLive();
  }

  /* ---------- Stepper ---------- */

  function renderStepper() {
    var el = document.getElementById('stepper');
    el.innerHTML = STEPS.map(function (s) {
      var cls = 'stepper-item';
      if (s.n === draft.currentStep) cls += ' active';
      else if (s.n < draft.currentStep) cls += ' done';
      if (s.n <= draft.maxReachedStep) cls += ' reachable';
      var numContent = s.n < draft.currentStep ? '✓' : String(s.n);
      return (
        '<button type="button" class="' +
        cls +
        '" data-goto="' +
        s.n +
        '" ' +
        (s.n <= draft.maxReachedStep ? '' : 'disabled') +
        '>' +
        '<div class="stepper-num">' +
        numContent +
        '</div>' +
        '<div class="stepper-label">' +
        s.label +
        '</div>' +
        '<div class="stepper-time">' +
        s.time +
        '</div>' +
        '</button>'
      );
    }).join('');

    el.querySelectorAll('[data-goto]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var n = Number(btn.getAttribute('data-goto'));
        if (n <= draft.maxReachedStep) goToStep(n);
      });
    });
  }

  function showPanel(step) {
    document.querySelectorAll('.step-panel').forEach(function (p) {
      p.classList.toggle('active', Number(p.getAttribute('data-step')) === step);
    });
  }

  /* ---------- Validation ---------- */

  function validateStep(step) {
    hideErrors();
    if (step === 1) {
      var phone = (document.getElementById('input-phone').value || '').replace(/\D/g, '');
      if (!/^\d{10}$/.test(phone)) {
        showError('phone-error', 'Enter a valid 10-digit mobile number.');
        return false;
      }
      draft.phone = phone;
      if (!draft.settings.whatsapp) draft.settings.whatsapp = phone;
      return true;
    }
    if (step === 2) {
      var otp = getOtpValue();
      var otpLen = (window.MithraOtp && window.MithraOtp.LENGTH) || 4;
      if (!new RegExp('^\\d{' + otpLen + '}$').test(otp)) {
        showError('otp-error', 'Enter the ' + otpLen + '-digit OTP.');
        return false;
      }
      draft.verified = true;
      if (window.StoreAPI && typeof window.StoreAPI.setVendorSession === 'function') {
        var roleParam = '';
        try {
          roleParam = new URLSearchParams(window.location.search).get('role') || '';
        } catch (e) {}
        window.StoreAPI.setVendorSession({
          loggedIn: true,
          phone: draft.phone || '',
          name: (draft.settings && draft.settings.storeName) || '',
          role: roleParam || 'vendor',
          vendorId: draft.vendorId || null
        });
      }
      return true;
    }
    if (step === 3) {
      if (!draft.businessType) {
        showError('business-error', 'Please select a business type.');
        return false;
      }
      return true;
    }
    if (step === 4) {
      if (!draft.categories.length) {
        showError('category-error', 'Select at least one category.');
        return false;
      }
      if (draft.categories.length > 2) {
        showError('category-error', 'Maximum 2 categories.');
        return false;
      }
      return true;
    }
    if (step === 5) {
      var activeIds = selectedCategoryIds();
      var visibleProducts = (draft.products || []).filter(function (p) {
        return activeIds.indexOf(p.categoryId) >= 0;
      });
      if (!visibleProducts.length) {
        showError('product-error', 'Select at least one product.');
        return false;
      }
      return true;
    }
    if (step === 6) {
      var skuActiveIds = selectedCategoryIds();
      var skuProducts = (draft.products || []).filter(function (p) {
        return !skuActiveIds.length || skuActiveIds.indexOf(p.categoryId) >= 0;
      });
      var bad = skuProducts.some(function (p) {
        var variants = p.variants || [];
        if (!variants.length) return true;
        return variants.some(function (v) {
          if (!(Number(v.value) > 0) || !String(v.unit || '').trim()) return true;
          if (!(Number(v.price) > 0)) return true;
          if (!(Number(v.mrp) > 0)) return true;
          if (Number(v.mrp) < Number(v.price)) return true;
          return false;
        });
      });
      if (bad) {
        showError('sku-error', 'Each size needs quantity, unit, selling price, and MRP (≥ selling price).');
        return false;
      }
      var noActive = skuProducts.some(function (p) {
        return !(p.variants || []).some(function (v) {
          return v.active !== false;
        });
      });
      if (noActive) {
        showError('sku-error', 'Each product needs at least one active SKU.');
        return false;
      }
      return true;
    }
    if (step === 7) {
      readDeliveryFromForm();
      var d = draft.delivery;
      var anyDel =
        (d.storePickup && d.storePickup.enabled) ||
        (d.homeDelivery && d.homeDelivery.enabled) ||
        (d.courierDelivery && d.courierDelivery.enabled);
      if (!anyDel) {
        showError('delivery-error', 'Select at least one delivery method.');
        return false;
      }
      if (d.homeDelivery.enabled && !(Number(d.homeDelivery.charge) >= 0)) {
        showError('delivery-error', 'Enter a valid home delivery charge (0 or more).');
        return false;
      }
      if (d.courierDelivery.enabled && !(Number(d.courierDelivery.charge) >= 0)) {
        showError('delivery-error', 'Enter a valid courier charge (0 or more).');
        return false;
      }
      return true;
    }
    if (step === 8) {
      readPaymentFromForm();
      var p = draft.payment;
      var anyPay =
        (p.upi && p.upi.enabled) || (p.bank && p.bank.enabled) || (p.cod && p.cod.enabled);
      if (!anyPay) {
        showError('payment-error', 'Select at least one payment method.');
        return false;
      }
      if (p.upi.enabled) {
        if (!String(p.upi.upiId || '').trim()) {
          showError('payment-error', 'Enter your UPI ID.');
          return false;
        }
        if (!String(p.upi.payeeName || '').trim()) {
          showError('payment-error', 'Enter the UPI payee name.');
          return false;
        }
      }
      if (p.bank.enabled) {
        if (!String(p.bank.accountName || '').trim() || !String(p.bank.accountNumber || '').trim()) {
          showError('payment-error', 'Enter account holder name and account number.');
          return false;
        }
        if (!String(p.bank.ifsc || '').trim()) {
          showError('payment-error', 'Enter the IFSC code.');
          return false;
        }
      }
      return true;
    }
    if (step === 9) {
      clearSettingsFieldErrors();
      var name = (document.getElementById('input-store-name').value || '').trim();
      var tagline = (document.getElementById('input-tagline').value || '').trim();
      var location = (document.getElementById('input-location').value || '').trim();
      var wa = (document.getElementById('input-whatsapp').value || '').replace(/\D/g, '');
      var instagramRaw =
        (document.getElementById('input-instagram') &&
          document.getElementById('input-instagram').value) ||
        '';
      var instagram = normalizeInstagramInput(instagramRaw);

      var firstInvalid = null;
      if (!name) {
        markSettingsFieldInvalid('storeName', 'Store name is required.');
        firstInvalid = firstInvalid || 'input-store-name';
      } else if (name.length < 2) {
        markSettingsFieldInvalid('storeName', 'Enter at least 2 characters.');
        firstInvalid = firstInvalid || 'input-store-name';
      } else if (name.length > 80) {
        markSettingsFieldInvalid('storeName', 'Keep the name under 80 characters.');
        firstInvalid = firstInvalid || 'input-store-name';
      }

      var slugEl = document.getElementById('input-store-link');
      var slugRaw = slugEl ? slugEl.value : draft.slug || '';
      var slug = D.normalizeStoreSlug
        ? D.normalizeStoreSlug(slugRaw)
        : D.slugify(slugRaw);
      if (slugEl) slugEl.value = slug;
      var slugErr = shopLinkError(slug);
      if (slugErr) {
        markSettingsFieldInvalid('storeLink', slugErr);
        firstInvalid = firstInvalid || 'input-store-link';
      }

      if (tagline.length > 120) {
        markSettingsFieldInvalid('tagline', 'Keep the tagline under 120 characters.');
        firstInvalid = firstInvalid || 'input-tagline';
      }

      if (!location) {
        markSettingsFieldInvalid('location', 'Business location is required.');
        firstInvalid = firstInvalid || 'input-location';
      } else if (location.length < 2) {
        markSettingsFieldInvalid('location', 'Enter a valid city or area.');
        firstInvalid = firstInvalid || 'input-location';
      }

      if (!wa) {
        markSettingsFieldInvalid('whatsapp', 'WhatsApp number is required for orders.');
        firstInvalid = firstInvalid || 'input-whatsapp';
      } else if (!/^\d{10}$/.test(wa)) {
        markSettingsFieldInvalid('whatsapp', 'Enter a valid 10-digit WhatsApp number.');
        firstInvalid = firstInvalid || 'input-whatsapp';
      }

      if (instagram.error) {
        markSettingsFieldInvalid('instagramUrl', instagram.error);
        firstInvalid = firstInvalid || 'input-instagram';
      }

      if (firstInvalid) {
        showError('settings-error', 'Please fix the highlighted fields to continue.');
        var focusEl = document.getElementById(firstInvalid);
        if (focusEl && focusEl.focus) focusEl.focus();
        return false;
      }

      draft.settings.storeName = name;
      draft.settings.tagline = tagline;
      draft.settings.location = location;
      draft.settings.whatsapp = wa;
      draft.settings.instagramUrl = instagram.url || '';
      draft.settings.themeColor =
        (document.getElementById('input-theme-color') &&
          document.getElementById('input-theme-color').value) ||
        draft.settings.themeColor ||
        '#10b981';
      draft.settings.accentColor =
        (document.getElementById('input-accent-color') &&
          document.getElementById('input-accent-color').value) ||
        draft.settings.accentColor ||
        (D.DEFAULT_ACCENT || '#f97316');
      draft.settings.backgroundColor =
        (document.getElementById('input-bg-color') &&
          document.getElementById('input-bg-color').value) ||
        draft.settings.backgroundColor ||
        (D.DEFAULT_BG || '#f9fafb');
      draft.settings.fontId = draft.settings.fontId || D.DEFAULT_FONT || 'poppins';
      draft.slug = slug;
      return true;
    }
    return true;
  }

  function showError(id, msg) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function markSettingsFieldInvalid(fieldKey, message) {
    var wrap = document.querySelector('.settings-field[data-field="' + fieldKey + '"]');
    if (!wrap) return;
    wrap.classList.add('is-invalid');
    var err = wrap.querySelector('.field-error');
    if (err) err.textContent = message || '';
  }

  function clearSettingsFieldErrors() {
    document.querySelectorAll('.settings-field.is-invalid').forEach(function (wrap) {
      wrap.classList.remove('is-invalid');
      var err = wrap.querySelector('.field-error');
      if (err) err.textContent = '';
    });
  }

  /**
   * Accept @handle, username, or full Instagram URL.
   * Returns { url, handle, error }.
   */
  function normalizeInstagramInput(raw) {
    var value = String(raw || '').trim();
    if (!value) return { url: '', handle: '', error: '' };

    var handle = value
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
      .replace(/^@/, '')
      .replace(/\/.*$/, '')
      .replace(/\?.*$/, '')
      .trim();

    if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) {
      return {
        url: '',
        handle: '',
        error: 'Enter a valid Instagram username (letters, numbers, . or _).'
      };
    }
    return {
      url: 'https://www.instagram.com/' + handle + '/',
      handle: handle,
      error: ''
    };
  }

  function instagramHandleFromUrl(url) {
    var parsed = normalizeInstagramInput(url || '');
    return parsed.handle || '';
  }

  var STORE_LINK_MIN = 3;
  var STORE_LINK_MAX = D.STORE_SLUG_MAX || 40;
  var RESERVED_SHOP_LINKS = {
    store: true,
    stores: true,
    admin: true,
    vendor: true,
    dashboard: true,
    login: true,
    signup: true,
    www: true,
    api: true,
    help: true,
    support: true,
    cart: true,
    checkout: true,
    mithra: true,
    mithradirect: true,
    onboarding: true
  };

  function suggestedShopLink(name) {
    if (!String(name || '').trim()) return '';
    if (D.normalizeStoreSlug) return D.normalizeStoreSlug(name);
    var s = D.slugify(name || '');
    return s === 'my-store' && !/[a-z0-9]/i.test(name || '') ? '' : s;
  }

  function readShopLinkInput() {
    var el = document.getElementById('input-store-link');
    return el ? String(el.value || '').trim() : String(draft.slug || '').trim();
  }

  function setShopLinkInput(value) {
    var el = document.getElementById('input-store-link');
    if (el && el.value !== value) el.value = value;
  }

  function syncShopLinkResetBtn() {
    var btn = document.getElementById('btn-slug-from-name');
    if (!btn) return;
    var suggested = suggestedShopLink(draft.settings.storeName || '');
    var current = readShopLinkInput();
    btn.hidden = !(draft.slugCustom && suggested && suggested !== current);
  }

  function applySuggestedShopLink() {
    var next = suggestedShopLink(draft.settings.storeName || '');
    draft.slug = next;
    setShopLinkInput(next);
    syncShopLinkResetBtn();
  }

  function shopLinkError(slug) {
    if (!slug) return 'Add a shop link so customers can open your store.';
    if (slug.length < STORE_LINK_MIN) return 'Use at least 3 characters.';
    if (slug.length > STORE_LINK_MAX) return 'Keep the link under ' + STORE_LINK_MAX + ' characters.';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return 'Use letters, numbers, and hyphens — like anitha-pickles.';
    }
    if (RESERVED_SHOP_LINKS[slug]) return 'That link is reserved. Try your shop name plus area.';
    return '';
  }

  function hideErrors() {
    [
      'phone-error',
      'otp-error',
      'business-error',
      'category-error',
      'product-error',
      'sku-error',
      'delivery-error',
      'payment-error',
      'settings-error'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.classList.add('hidden');
        el.textContent = '';
      }
    });
  }

  /* ---------- Step sync / render ---------- */

  function syncStepForm(step) {
    if (step === 1) {
      document.getElementById('input-phone').value = draft.phone || '';
    }
    if (step === 2) {
      document.getElementById('otp-phone-display').textContent = '+91 ' + (draft.phone || '');
      buildOtpInputs();
      startResendTimer(30);
    }
    if (step === 3) {
      var searchInput = document.getElementById('input-business-search');
      if (searchInput && searchInput.value !== businessSearchQuery) {
        searchInput.value = businessSearchQuery;
      }
      renderBusinessGrid();
    }
    if (step === 4) renderCategoryGrid();
    if (step === 5) renderProductList();
    if (step === 6) renderSkuEditor();
    if (step === 7) syncDeliveryForm();
    if (step === 8) syncPaymentForm();
    if (step === 9) {
      clearSettingsFieldErrors();
      document.getElementById('input-store-name').value = draft.settings.storeName || '';
      if (!draft.slug && draft.settings.storeName && !draft.slugCustom) {
        draft.slug = suggestedShopLink(draft.settings.storeName);
      }
      setShopLinkInput(draft.slug || suggestedShopLink(draft.settings.storeName || ''));
      syncShopLinkResetBtn();
      document.getElementById('input-tagline').value = draft.settings.tagline || '';
      document.getElementById('input-location').value = draft.settings.location || '';
      document.getElementById('input-whatsapp').value = draft.settings.whatsapp || draft.phone || '';
      var ig = document.getElementById('input-instagram');
      if (ig) ig.value = instagramHandleFromUrl(draft.settings.instagramUrl || '');
      syncImagePreview('logo', draft.settings.logo);
      syncImagePreview('banner', draft.settings.banner);
      syncThemePanel();
    }
    if (step === 10) finalizeLive();
  }

  /* ---------- Step 1–2 OTP ---------- */

  var otpField = null;

  function buildOtpInputs() {
    var Otp = window.MithraOtp;
    var row = document.getElementById('otp-inputs');
    if (!row || !Otp) return;
    if (!otpField) {
      otpField = Otp.mount(row, { idPrefix: 'onboarding-otp' });
    } else {
      otpField.clear();
    }
    otpField.focus();
  }

  function getOtpValue() {
    return otpField ? otpField.getValue() : '';
  }

  function startResendTimer(sec) {
    resendSeconds = sec;
    var btn = document.getElementById('btn-resend-otp');
    btn.disabled = true;
    if (resendInterval) clearInterval(resendInterval);
    function tick() {
      if (resendSeconds <= 0) {
        clearInterval(resendInterval);
        btn.disabled = false;
        btn.textContent = 'Resend OTP';
        return;
      }
      btn.innerHTML = 'Resend OTP in <span id="resend-timer">' + resendSeconds + '</span>s';
      resendSeconds--;
    }
    tick();
    resendInterval = setInterval(tick, 1000);
  }

  /* ---------- Step 3 Business ---------- */

  var businessSearchQuery = '';
  var businessPage = 0;
  var businessTotal = 0;
  var businessHasMore = false;
  var businessLoading = false;
  var businessItems = [];
  var BUSINESS_PAGE_SIZE = (D.BUSINESS_TYPE_PAGE_SIZE || 9);

  function businessCardHtml(b) {
    var sel = draft.businessType === b.id ? ' selected' : '';
    return (
      '<button type="button" class="select-card' +
      sel +
      '" data-biz="' +
      b.id +
      '" role="option" aria-selected="' +
      (draft.businessType === b.id ? 'true' : 'false') +
      '">' +
      '<span class="check">✓</span>' +
      '<div class="icon-emoji">' +
      b.icon +
      '</div>' +
      '<div class="text-sm font-semibold text-gray-800">' +
      escapeHtml(b.label) +
      '</div>' +
      '</button>'
    );
  }

  function bindBusinessCards(scope) {
    (scope || document).querySelectorAll('#business-grid [data-biz]').forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-biz');
        var changed = draft.businessType !== id;
        draft.businessType = id;
        if (changed) {
          draft.categories = [];
          draft.products = [];
          draft.customCatalog = [];
          productPagers = {};
          var cats = D.categoriesForBusiness(id);
          if (cats.length) {
            draft.categories = cats.slice(0, Math.min(2, cats.length)).map(function (cat) {
              return {
                id: cat.id,
                name: cat.name,
                image: cat.image || '',
                measurement: cat.measurement || D.defaultMeasurementForBusiness(id)
              };
            });
          }
        }
        hideErrors();
        persist();
        renderBusinessGridSelection();
        syncBusinessPaginationUi();
      });
    });
  }

  function renderBusinessGridSelection() {
    document.querySelectorAll('#business-grid [data-biz]').forEach(function (btn) {
      var on = btn.getAttribute('data-biz') === draft.businessType;
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function syncBusinessPaginationUi() {
    var wrap = document.getElementById('business-search-wrap');
    var countEl = document.getElementById('business-search-count');
    var selectedEl = document.getElementById('business-selected-label');
    var emptyEl = document.getElementById('business-empty');
    var moreEl = document.getElementById('business-more');
    var hintEl = document.getElementById('business-more-hint');
    var loadingEl = document.getElementById('business-loading');
    var endEl = document.getElementById('business-end');
    var scrollEl = document.getElementById('business-scroll');
    var loaded = businessItems.length;

    if (wrap) wrap.classList.toggle('has-value', !!businessSearchQuery);

    if (countEl) {
      if (!businessTotal) {
        countEl.textContent = businessSearchQuery ? '0 matches' : 'No types yet';
      } else if (businessHasMore) {
        countEl.textContent =
          'Showing ' + loaded + ' of ' + businessTotal + ' types · more available';
      } else if (businessSearchQuery) {
        countEl.textContent = loaded + ' match' + (loaded === 1 ? '' : 'es');
      } else {
        countEl.textContent = 'All ' + businessTotal + ' types loaded';
      }
    }

    if (selectedEl) {
      var selected = (D.BUSINESS_TYPES || []).find(function (b) {
        return b.id === draft.businessType;
      });
      if (selected) {
        selectedEl.hidden = false;
        selectedEl.textContent = 'Selected: ' + selected.label;
      } else {
        selectedEl.hidden = true;
        selectedEl.textContent = '';
      }
    }

    if (emptyEl) {
      var showEmpty = !businessLoading && loaded === 0;
      emptyEl.hidden = !showEmpty;
      emptyEl.classList.toggle('hidden', !showEmpty);
    }

    if (moreEl) moreEl.hidden = !(businessHasMore && loaded > 0);
    if (hintEl) {
      var remaining = Math.max(0, businessTotal - loaded);
      hintEl.innerHTML =
        '<span class="ob-biz-more-chevron" aria-hidden="true">↓</span> ' +
        (remaining
          ? remaining + ' more type' + (remaining === 1 ? '' : 's') + ' — scroll to load'
          : 'Scroll to see more business types');
    }
    if (loadingEl) loadingEl.hidden = !businessLoading;
    if (endEl) endEl.hidden = !(!businessHasMore && loaded > 0 && businessTotal > BUSINESS_PAGE_SIZE);
    if (scrollEl) scrollEl.classList.toggle('has-more', !!businessHasMore);
  }

  function appendBusinessPage(pageResult, reset) {
    var grid = document.getElementById('business-grid');
    if (!grid) return;
    if (reset) {
      businessItems = [];
      grid.innerHTML = '';
    }
    businessItems = businessItems.concat(pageResult.items || []);
    businessPage = pageResult.page;
    businessTotal = pageResult.total;
    businessHasMore = !!pageResult.hasMore;
    grid.insertAdjacentHTML(
      'beforeend',
      (pageResult.items || []).map(businessCardHtml).join('')
    );
    bindBusinessCards(grid);
    syncBusinessPaginationUi();
  }

  function loadBusinessPage(opts) {
    opts = opts || {};
    if (businessLoading) return;
    var nextPage = opts.reset ? 1 : businessPage + 1;
    if (!opts.reset && !businessHasMore && businessPage > 0) return;

    businessLoading = true;
    syncBusinessPaginationUi();

    // Simulated latency — swap for fetch('/api/v1/business-types?...') 
    window.setTimeout(function () {
      var pageResult = D.fetchBusinessTypesPage
        ? D.fetchBusinessTypesPage({
            page: nextPage,
            size: BUSINESS_PAGE_SIZE,
            q: businessSearchQuery
          })
        : { items: [], page: nextPage, total: 0, hasMore: false };

      // Keep selected type visible even if it was beyond page 1
      if (opts.reset && draft.businessType) {
        var selected = (D.BUSINESS_TYPES || []).find(function (b) {
          return b.id === draft.businessType;
        });
        var already = (pageResult.items || []).some(function (b) {
          return b.id === draft.businessType;
        });
        if (selected && !already && !businessSearchQuery) {
          // leave as-is; selection can still be on later pages
        }
      }

      businessLoading = false;
      appendBusinessPage(pageResult, !!opts.reset);
    }, opts.instant ? 0 : 220);
  }

  function renderBusinessGrid() {
    businessPage = 0;
    businessHasMore = true;
    businessItems = [];
    loadBusinessPage({ reset: true, instant: true });
  }

  function onBusinessScroll() {
    var scrollEl = document.getElementById('business-scroll');
    if (!scrollEl || !businessHasMore || businessLoading) return;
    var nearBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 48;
    if (nearBottom) loadBusinessPage();
  }

  /* ---------- Step 4 Categories ---------- */

  function renderCategoryGrid() {
    var available = D.categoriesForBusiness(draft.businessType);
    // merge custom categories not in catalog
    draft.categories.forEach(function (c) {
      if (!available.some(function (a) { return a.id === c.id; })) {
        available.push(c);
      }
    });

    var grid = document.getElementById('category-grid');
    grid.innerHTML = available
      .map(function (c) {
        var sel = draft.categories.some(function (x) { return x.id === c.id; }) ? ' selected' : '';
        return (
          '<button type="button" class="select-card' +
          sel +
          '" data-cat="' +
          c.id +
          '">' +
          '<span class="check">✓</span>' +
          '<div class="preview-cat-img mx-auto mb-2" style="background:#ecfdf5">' +
          (c.image
            ? '<img src="' + c.image + '" alt="" class="w-full h-full object-cover rounded-full" onerror="this.remove()">'
            : '📦') +
          '</div>' +
          '<div class="text-sm font-semibold text-gray-800">' +
          c.name +
          '</div>' +
          '</button>'
        );
      })
      .join('');

    grid.querySelectorAll('[data-cat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-cat');
        var existing = draft.categories.findIndex(function (c) { return c.id === id; });
        if (existing >= 0) {
          var removed = draft.categories.splice(existing, 1)[0];
          draft.products = (draft.products || []).filter(function (p) {
            return p.categoryId !== removed.id;
          });
          draft.customCatalog = (draft.customCatalog || []).filter(function (p) {
            return p.categoryId !== removed.id;
          });
          delete productPagers[removed.id];
        } else {
          if (draft.categories.length >= 2) {
            showError('category-error', 'Maximum 2 categories. Deselect one first.');
            return;
          }
          hideErrors();
          var cat =
            available.find(function (c) { return c.id === id; }) ||
            { id: id, name: id, image: '' };
          draft.categories.push({
            id: cat.id,
            name: cat.name,
            image: cat.image || '',
            measurement: cat.measurement || D.defaultMeasurementForBusiness(draft.businessType)
          });
        }
        persist();
        renderCategoryGrid();
      });
    });
  }

  /* ---------- Step 5 Products ---------- */

  function selectedCategoryIds() {
    return (draft.categories || []).map(function (c) {
      return c.id;
    });
  }

  function productsForCategory(categoryId) {
    return (draft.products || [])
      .filter(function (p) {
        return p.categoryId === categoryId;
      })
      .sort(function (a, b) {
        return a.order - b.order;
      });
  }

  function findCategory(categoryId) {
    return (draft.categories || []).find(function (c) {
      return c.id === categoryId;
    });
  }

  function measurementForProduct(p) {
    var cat = findCategory(p && p.categoryId);
    return D.inferMeasurementType(p && p.name, cat, draft.businessType);
  }

  function ensureProductMeasurement(p) {
    return D.normalizeProductMeasurement(p, findCategory(p && p.categoryId), draft.businessType);
  }

  function unitChipsHtml(measurementType) {
    return D.unitsForMeasurement(measurementType)
      .map(function (u) {
        return '<span class="product-unit-chip">' + escapeHtml(u.label) + '</span>';
      })
      .join('');
  }

  function catalogProductKey(item) {
    return item && (item.catalogId || item.id);
  }

  function isCatalogProductSelected(item) {
    var key = catalogProductKey(item);
    return (draft.products || []).some(function (p) {
      return catalogProductKey(p) === key;
    });
  }

  function catalogItemsForCategory(cat) {
    if (!cat) return [];
    if (typeof D.catalogProductsFor === 'function') {
      return D.catalogProductsFor(draft.businessType, cat.id);
    }
    return [];
  }

  function pruneProductsToCatalog() {
    var allowed = {};
    var nameToId = {};
    (draft.categories || []).forEach(function (cat) {
      catalogItemsForCategory(cat).forEach(function (item) {
        allowed[item.id] = true;
        nameToId[String(item.name || '').toLowerCase()] = item.id;
      });
    });
    var next = [];
    var seen = {};
    (draft.products || []).forEach(function (p) {
      if (p.custom) {
        if (seen[p.id]) return;
        seen[p.id] = true;
        next.push(p);
        return;
      }
      var key = catalogProductKey(p);
      if (!allowed[key]) {
        key = nameToId[String(p.name || '').toLowerCase()] || '';
      }
      if (!key || !allowed[key] || seen[key]) return;
      seen[key] = true;
      p.id = key;
      p.catalogId = key;
      next.push(p);
    });
    draft.products = next;
  }

  function ensureCustomCatalog() {
    if (!Array.isArray(draft.customCatalog)) draft.customCatalog = [];
    return draft.customCatalog;
  }

  function customProductsForCategory(catId) {
    return ensureCustomCatalog().filter(function (p) {
      return p.categoryId === catId;
    });
  }

  function getProductPager(catId) {
    if (!productPagers[catId]) {
      productPagers[catId] = {
        page: 0,
        items: [],
        total: 0,
        hasMore: false,
        q: '',
        loading: false,
        loaded: false
      };
    }
    return productPagers[catId];
  }

  function measurementOptionsHtml(selectedId) {
    return (D.MEASUREMENTS || [])
      .map(function (m) {
        return (
          '<option value="' +
          m.id +
          '"' +
          (m.id === selectedId ? ' selected' : '') +
          '>' +
          escapeHtml(m.label) +
          '</option>'
        );
      })
      .join('');
  }

  function ensureExpandedProductCat(cats) {
    if (!cats.length) {
      expandedProductCatId = null;
      return;
    }
    if (
      expandedProductCatId &&
      !cats.some(function (c) {
        return c.id === expandedProductCatId;
      })
    ) {
      expandedProductCatId = null;
    }
  }

  function catalogProductCardHtml(cat, item) {
    var selected = isCatalogProductSelected(item);
    var measurementType =
      item.measurementType || D.inferMeasurementType(item.name, cat, draft.businessType);
    var measure = D.getMeasurement(measurementType);
    var measureBlock = item.custom
      ? '<label class="product-measure-label" data-stop-toggle="1"><span>Sold by</span>' +
        '<select class="product-measure-select" data-pid="' +
        escapeAttr(item.id) +
        '" aria-label="Measurement">' +
        measurementOptionsHtml(measurementType) +
        '</select></label>'
      : '<span class="product-measure-value">' + escapeHtml(measure.label) + '</span>';
    return (
      '<button type="button" class="select-card select-card--product' +
      (selected ? ' selected' : '') +
      (item.custom ? ' is-custom' : '') +
      '" data-pid="' +
      escapeAttr(item.id) +
      '" data-cat="' +
      escapeAttr(cat.id) +
      '" aria-pressed="' +
      (selected ? 'true' : 'false') +
      '">' +
      '<span class="check">✓</span>' +
      '<div class="icon-emoji" aria-hidden="true">' +
      escapeHtml(item.icon || (item.custom ? '✨' : '📦')) +
      '</div>' +
      '<div class="text-sm font-semibold text-gray-800">' +
      escapeHtml(item.name) +
      '</div>' +
      '<div class="product-measure-row">' +
      measureBlock +
      '<span class="product-unit-chips">' +
      unitChipsHtml(measurementType) +
      '</span>' +
      '</div>' +
      '</button>'
    );
  }

  function assignCatalogProduct(cat, item) {
    var measurementType =
      item.measurementType || D.inferMeasurementType(item.name, cat, draft.businessType);
    var color = D.PRODUCT_COLORS[draft.products.length % D.PRODUCT_COLORS.length];
    draft.products.push({
      id: item.id,
      catalogId: item.custom ? '' : item.id,
      name: item.name,
      icon: item.icon || '',
      image: '',
      color: color,
      order: draft.products.length,
      categoryId: cat.id,
      custom: !!item.custom,
      measurementType: measurementType,
      variants: [D.createSkuVariant({ measurementType: measurementType })]
    });
  }

  function findSelectableProduct(catId, productId) {
    var pager = getProductPager(catId);
    var fromPage = pager.items.find(function (p) {
      return p.id === productId;
    });
    if (fromPage) return fromPage;
    var fromCustom = customProductsForCategory(catId).find(function (p) {
      return p.id === productId;
    });
    if (fromCustom) return fromCustom;
    var cat = findCategory(catId);
    return catalogItemsForCategory(cat).find(function (p) {
      return p.id === productId;
    });
  }

  function updateCategoryProductMeta(catId) {
    var panel = document.querySelector('[data-cat-block="' + catId + '"]');
    if (!panel) return;
    var selectedCount = productsForCategory(catId).length;
    var pager = getProductPager(catId);
    var meta = panel.querySelector('.ob-cat-meta');
    var count = panel.querySelector('.ob-cat-count');
    var status = selectedCount ? selectedCount + ' selected' : pager.loaded ? 'Tap to select' : 'Tap to load';
    if (meta) meta.textContent = status;
    if (count) count.textContent = String(selectedCount);
  }

  function syncProductPagerUi(catId) {
    var pager = getProductPager(catId);
    var body = document.querySelector('[data-prod-body="' + catId + '"]');
    if (!body) return;
    var searchWrap = body.querySelector('[data-prod-search-wrap]');
    var countEl = body.querySelector('[data-prod-count]');
    var moreEl = body.querySelector('[data-prod-more]');
    var hintEl = body.querySelector('[data-prod-more-hint]');
    var loadingEl = body.querySelector('[data-prod-loading]');
    var emptyEl = body.querySelector('[data-prod-empty]');
    var endEl = body.querySelector('[data-prod-end]');
    var scrollEl = body.querySelector('[data-prod-scroll]');
    var loaded = pager.items.length;

    if (searchWrap) searchWrap.classList.toggle('has-value', !!pager.q);
    if (countEl) {
      if (pager.loading && !loaded) {
        countEl.textContent = 'Loading…';
      } else if (!pager.total) {
        countEl.textContent = pager.q ? 'No matches for “' + pager.q + '”' : 'No products yet';
      } else if (pager.q && pager.hasMore) {
        countEl.textContent = loaded + ' of ' + pager.total + ' matches';
      } else if (pager.hasMore) {
        countEl.textContent = 'Showing ' + loaded + ' of ' + pager.total;
      } else if (pager.q) {
        countEl.textContent = loaded + ' match' + (loaded === 1 ? '' : 'es');
      } else {
        countEl.textContent = pager.total + ' product' + (pager.total === 1 ? '' : 's');
      }
    }
    var selectedEl = body.querySelector('[data-prod-selected]');
    if (selectedEl) {
      var picked = productsForCategory(catId).length;
      selectedEl.textContent = picked ? picked + ' selected' : '';
      selectedEl.hidden = !picked;
    }
    if (moreEl) moreEl.hidden = !(pager.hasMore && loaded > 0 && !pager.loading);
    if (hintEl) {
      var remaining = Math.max(0, pager.total - loaded);
      hintEl.textContent = remaining ? remaining + ' more — load next page' : 'All products loaded';
    }
    if (loadingEl) loadingEl.hidden = !pager.loading;
    if (emptyEl) emptyEl.hidden = !(pager.loaded && !pager.loading && loaded === 0);
    if (endEl) endEl.hidden = !(!pager.hasMore && loaded > 0 && pager.total > PRODUCT_PAGE_SIZE);
    if (scrollEl) scrollEl.classList.toggle('has-more', !!pager.hasMore);
    updateCategoryProductMeta(catId);
  }

  function bindProductCards(scope, catId) {
    (scope || document)
      .querySelectorAll('[data-prod-grid="' + catId + '"] .select-card--product')
      .forEach(function (btn) {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function (e) {
          if (e.target && e.target.closest && e.target.closest('[data-stop-toggle]')) return;
          toggleCatalogProduct(btn.getAttribute('data-cat'), btn.getAttribute('data-pid'));
        });
        var measureSelect = btn.querySelector('.product-measure-select');
        if (!measureSelect) return;
        measureSelect.addEventListener('mousedown', function (e) {
          e.stopPropagation();
        });
        measureSelect.addEventListener('click', function (e) {
          e.stopPropagation();
        });
        measureSelect.addEventListener('change', function (e) {
          e.stopPropagation();
          var p = findProduct(measureSelect.dataset.pid);
          var extra = customProductsForCategory(catId).find(function (x) {
            return x.id === measureSelect.dataset.pid;
          });
          if (extra) extra.measurementType = measureSelect.value;
          if (p) D.applyMeasurementToProduct(p, measureSelect.value);
          var chips = btn.querySelector('.product-unit-chips');
          if (chips) chips.innerHTML = unitChipsHtml(measureSelect.value);
          persist();
        });
      });
  }

  function paintProductGrid(catId, reset) {
    var grid = document.querySelector('[data-prod-grid="' + catId + '"]');
    var cat = findCategory(catId);
    var pager = getProductPager(catId);
    if (!grid || !cat) return;
    var html = pager.items
      .map(function (item) {
        return catalogProductCardHtml(cat, item);
      })
      .join('');
    if (reset) grid.innerHTML = html;
    else grid.insertAdjacentHTML('beforeend', html);
    bindProductCards(grid, catId);
  }

  function loadProductPage(catId, opts) {
    opts = opts || {};
    var pager = getProductPager(catId);
    if (pager.loading) return;
    var nextPage = opts.reset ? 1 : pager.page + 1;
    if (!opts.reset && !pager.hasMore && pager.page > 0) return;
    pager.loading = true;
    if (opts.reset) {
      pager.items = [];
      pager.loaded = false;
      var grid = document.querySelector('[data-prod-grid="' + catId + '"]');
      if (grid) grid.innerHTML = '';
    }
    syncProductPagerUi(catId);
    window.setTimeout(function () {
      if (expandedProductCatId !== catId) {
        pager.loading = false;
        return;
      }
      var result = D.fetchCatalogProductsPage
        ? D.fetchCatalogProductsPage({
            businessTypeId: draft.businessType,
            categoryId: catId,
            page: nextPage,
            size: PRODUCT_PAGE_SIZE,
            q: pager.q,
            extras: customProductsForCategory(catId)
          })
        : { items: [], page: nextPage, total: 0, hasMore: false };
      pager.loading = false;
      if (opts.reset) pager.items = [];
      pager.items = pager.items.concat(result.items || []);
      pager.page = result.page;
      pager.total = result.total;
      pager.hasMore = !!result.hasMore;
      pager.loaded = true;
      paintProductGrid(catId, true);
      syncProductPagerUi(catId);
    }, opts.instant ? 0 : 220);
  }

  function toggleCatalogProduct(catId, productId) {
    var cat = findCategory(catId);
    var item = findSelectableProduct(catId, productId);
    if (!cat || !item) return;
    expandedProductCatId = catId;
    hideErrors();
    var existing = (draft.products || []).findIndex(function (p) {
      return catalogProductKey(p) === item.id || p.id === item.id;
    });
    if (existing >= 0) {
      draft.products.splice(existing, 1);
    } else {
      assignCatalogProduct(cat, item);
    }
    reindexProducts();
    persist();
    var card = document.querySelector(
      '[data-prod-grid="' +
        catId +
        '"] .select-card--product[data-pid="' +
        String(productId).replace(/\\/g, '\\\\').replace(/"/g, '\\"') +
        '"]'
    );
    if (card) {
      var on = isCatalogProductSelected(item);
      card.classList.toggle('selected', on);
      card.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    updateCategoryProductMeta(catId);
  }

  function addCustomProduct(catId) {
    var body = document.querySelector('[data-prod-body="' + catId + '"]');
    var cat = findCategory(catId);
    if (!body || !cat) return;
    var nameInput = body.querySelector('[data-prod-new-name]');
    var measureSelect = body.querySelector('[data-prod-new-measure]');
    var name = String((nameInput && nameInput.value) || '').trim();
    if (!name) {
      showError('product-error', 'Enter a product name to add.');
      if (nameInput) nameInput.focus();
      return;
    }
    hideErrors();
    var measurementType =
      (measureSelect && measureSelect.value) ||
      D.inferMeasurementType(name, cat, draft.businessType);
    var item = {
      id: D.uid('custom'),
      name: name,
      icon: '✨',
      categoryId: catId,
      custom: true,
      measurementType: measurementType
    };
    ensureCustomCatalog().push(item);
    if (!isCatalogProductSelected(item)) assignCatalogProduct(cat, item);
    reindexProducts();
    persist();
    if (nameInput) nameInput.value = '';
    getProductPager(catId).q = '';
    var searchInput = body.querySelector('[data-prod-search]');
    if (searchInput) searchInput.value = '';
    loadProductPage(catId, { reset: true, instant: true });
  }

  function categoryProductBodyHtml(cat) {
    var pager = getProductPager(cat.id);
    var defaultMeasure = cat.measurement || D.defaultMeasurementForBusiness(draft.businessType);
    var searchId = 'prod-search-' + String(cat.id).replace(/[^a-zA-Z0-9_-]/g, '-');
    var gridId = 'prod-grid-' + String(cat.id).replace(/[^a-zA-Z0-9_-]/g, '-');
    var hasQuery = !!(pager.q || '');
    return (
      '<div class="ob-prod-body" data-prod-body="' +
      escapeAttr(cat.id) +
      '">' +
      '<div class="ob-prod-toolbar">' +
      '<div class="ob-prod-search" role="search">' +
      '<label class="md-field-label" for="' +
      escapeAttr(searchId) +
      '">Search in ' +
      escapeHtml(cat.name) +
      '</label>' +
      '<div class="md-search' +
      (hasQuery ? ' has-value' : '') +
      '" data-prod-search-wrap>' +
      '<svg class="md-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<circle cx="11" cy="11" r="7"></circle>' +
      '<path stroke-linecap="round" d="M20 20l-3.5-3.5"></path>' +
      '</svg>' +
      '<input type="search" class="md-search-input" id="' +
      escapeAttr(searchId) +
      '" data-prod-search data-cat="' +
      escapeAttr(cat.id) +
      '" value="' +
      escapeAttr(pager.q || '') +
      '" placeholder="Try a name, e.g. tomato" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-controls="' +
      escapeAttr(gridId) +
      '">' +
      '<button type="button" class="md-search-clear" data-prod-search-clear data-cat="' +
      escapeAttr(cat.id) +
      '" aria-label="Clear search">✕</button>' +
      '</div>' +
      '<div class="md-search-meta ob-prod-search-meta">' +
      '<span data-prod-count aria-live="polite"></span>' +
      '<span class="ob-prod-selected" data-prod-selected></span>' +
      '</div>' +
      '</div>' +
      '<div class="ob-prod-add">' +
      '<p class="ob-prod-add-label">Can’t find it? Add your own</p>' +
      '<div class="ob-prod-add-row">' +
      '<input type="text" class="md-field" data-prod-new-name placeholder="New product name" aria-label="New product name">' +
      '<select class="product-measure-select" data-prod-new-measure aria-label="Measurement for new product">' +
      measurementOptionsHtml(defaultMeasure) +
      '</select>' +
      '<button type="button" class="btn-add-product-cat" data-prod-add data-cat="' +
      escapeAttr(cat.id) +
      '">+ Add</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="ob-prod-scroll" data-prod-scroll="' +
      escapeAttr(cat.id) +
      '">' +
      '<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 product-select-grid" id="' +
      escapeAttr(gridId) +
      '" data-prod-grid="' +
      escapeAttr(cat.id) +
      '"></div>' +
      '<p class="ob-cat-empty" data-prod-empty hidden>No products match this search. Try another name or add a new product.</p>' +
      '<div class="ob-prod-more" data-prod-more hidden>' +
      '<p class="ob-prod-more-hint" data-prod-more-hint></p>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-prod-load-more data-cat="' +
      escapeAttr(cat.id) +
      '">Load more</button>' +
      '</div>' +
      '<p class="ob-prod-loading" data-prod-loading hidden>Loading products…</p>' +
      '<p class="ob-prod-end" data-prod-end hidden>That’s every product in this category.</p>' +
      '</div>' +
      '</div>'
    );
  }

  function renderProductList() {
    var list = document.getElementById('product-list');
    var cats = draft.categories || [];
    pruneProductsToCatalog();
    (draft.products || []).forEach(ensureProductMeasurement);
    ensureExpandedProductCat(cats);
    Object.keys(productPagers).forEach(function (id) {
      if (
        !cats.some(function (c) {
          return c.id === id;
        })
      ) {
        delete productPagers[id];
      }
    });

    if (!cats.length) {
      list.innerHTML =
        '<p class="text-sm text-amber-600 text-center py-6">Select categories in the previous step to choose products.</p>';
      return;
    }

    list.innerHTML =
      '<div class="ob-cat-stack" role="list">' +
      cats
        .map(function (cat) {
          var selectedCount = productsForCategory(cat.id).length;
          var open = cat.id === expandedProductCatId;
          var status = selectedCount
            ? selectedCount + ' selected'
            : open
              ? 'Loading…'
              : 'Tap to load products';
          return (
            '<div class="ob-cat-panel' +
            (open ? ' is-open' : '') +
            '" data-cat-block="' +
            escapeAttr(cat.id) +
            '" role="listitem">' +
            '<button type="button" class="ob-cat-toggle" data-cat-toggle="' +
            escapeAttr(cat.id) +
            '" aria-expanded="' +
            (open ? 'true' : 'false') +
            '">' +
            '<span class="ob-cat-chevron" aria-hidden="true"></span>' +
            '<span class="ob-cat-toggle-main">' +
            '<span class="ob-cat-name">' +
            escapeHtml(cat.name) +
            '</span>' +
            '<span class="ob-cat-meta">' +
            escapeHtml(status) +
            '</span>' +
            '</span>' +
            '<span class="ob-cat-count">' +
            selectedCount +
            '</span>' +
            '</button>' +
            '<div class="ob-cat-body"' +
            (open ? '' : ' hidden') +
            '>' +
            categoryProductBodyHtml(cat) +
            '</div>' +
            '</div>'
          );
        })
        .join('') +
      '</div>' +
      (!expandedProductCatId
        ? '<p class="ob-cat-nudge">Tap a category to load its products, then select the ones you sell.</p>'
        : '');

    bindProductListEvents(list);
    if (expandedProductCatId) {
      var pager = getProductPager(expandedProductCatId);
      if (pager.loaded && pager.items.length) {
        paintProductGrid(expandedProductCatId, true);
        syncProductPagerUi(expandedProductCatId);
      } else {
        loadProductPage(expandedProductCatId, { reset: true });
      }
    }
  }

  function bindProductListEvents(list) {
    list.querySelectorAll('[data-cat-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-cat-toggle');
        expandedProductCatId = expandedProductCatId === id ? null : id;
        renderProductList();
      });
    });

    list.querySelectorAll('[data-prod-search]').forEach(function (input) {
      input.addEventListener('input', function () {
        var catId = input.getAttribute('data-cat');
        var pager = getProductPager(catId);
        pager.q = String(input.value || '').trim();
        var wrap = input.closest('[data-prod-search-wrap]');
        if (wrap) wrap.classList.toggle('has-value', !!pager.q);
        if (productSearchTimers[catId]) window.clearTimeout(productSearchTimers[catId]);
        productSearchTimers[catId] = window.setTimeout(function () {
          expandedProductCatId = catId;
          loadProductPage(catId, { reset: true });
        }, 250);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          input.value = '';
          getProductPager(input.getAttribute('data-cat')).q = '';
          input.dispatchEvent(new Event('input'));
        }
      });
    });

    list.querySelectorAll('[data-prod-search-clear]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var catId = btn.getAttribute('data-cat');
        var body = document.querySelector('[data-prod-body="' + catId + '"]');
        var input = body && body.querySelector('[data-prod-search]');
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input'));
          input.focus();
        }
      });
    });

    list.querySelectorAll('[data-prod-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        addCustomProduct(btn.getAttribute('data-cat'));
      });
    });

    list.querySelectorAll('[data-prod-new-name]').forEach(function (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var bodyEl = input.closest('[data-prod-body]');
          if (bodyEl) addCustomProduct(bodyEl.getAttribute('data-prod-body'));
        }
      });
    });

    list.querySelectorAll('[data-prod-load-more]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        loadProductPage(btn.getAttribute('data-cat'));
      });
    });

    list.querySelectorAll('[data-prod-scroll]').forEach(function (scrollEl) {
      scrollEl.addEventListener('scroll', function () {
        var catId = scrollEl.getAttribute('data-prod-scroll');
        var pager = getProductPager(catId);
        if (!pager.hasMore || pager.loading) return;
        var nearBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 48;
        if (nearBottom) loadProductPage(catId);
      });
    });
  }

  function reindexProducts() {
    var catOrder = selectedCategoryIds();
    draft.products.sort(function (a, b) {
      var ai = catOrder.indexOf(a.categoryId);
      var bi = catOrder.indexOf(b.categoryId);
      if (ai < 0) ai = 999;
      if (bi < 0) bi = 999;
      if (ai !== bi) return ai - bi;
      return a.order - b.order;
    });
    draft.products.forEach(function (p, i) {
      p.order = i;
    });
  }

  function findProduct(id) {
    return draft.products.find(function (p) {
      return p.id === id || p.catalogId === id;
    });
  }

  /* ---------- Step 6 SKUs ---------- */

  function renderSkuEditor() {
    var editor = document.getElementById('sku-editor');
    var cats = draft.categories || [];
    var activeIds = selectedCategoryIds();
    var visible = (draft.products || [])
      .filter(function (p) {
        return !activeIds.length || activeIds.indexOf(p.categoryId) >= 0;
      })
      .sort(function (a, b) {
        return a.order - b.order;
      });

    if (!visible.length) {
      editor.innerHTML = '<p class="text-sm text-gray-400 text-center py-6">Select products in the previous step first.</p>';
      return;
    }

    if (
      expandedSkuCatId &&
      !cats.some(function (c) {
        return c.id === expandedSkuCatId;
      })
    ) {
      expandedSkuCatId = null;
    }

    function skuUnitSelectHtml(p, v) {
      var units = D.unitsForMeasurement(p.measurementType);
      var current = v.unit || (units[0] && units[0].id) || '';
      return (
        '<select class="sku-unit" aria-label="Unit">' +
        units
          .map(function (u) {
            return (
              '<option value="' +
              escapeAttr(u.id) +
              '"' +
              (u.id === current ? ' selected' : '') +
              '>' +
              escapeHtml(u.label) +
              '</option>'
            );
          })
          .join('') +
        '</select>'
      );
    }

    function skuBlockHtml(p) {
      ensureProductMeasurement(p);
      var measure = D.getMeasurement(p.measurementType);
      var rows = (p.variants || [])
        .map(function (v) {
          var isActive = v.active !== false;
          return (
            '<div class="sku-row' +
            (isActive ? '' : ' sku-row--inactive') +
            '" data-pid="' +
            p.id +
            '" data-vid="' +
            v.id +
            '">' +
            '<input type="number" class="sku-qty" min="0" step="any" value="' +
            escapeAttr(v.value != null ? v.value : '') +
            '" placeholder="Qty" aria-label="Quantity">' +
            skuUnitSelectHtml(p, v) +
            '<input type="number" class="sku-price" min="1" value="' +
            (v.price || '') +
            '" placeholder="Price ₹">' +
            '<input type="number" class="sku-mrp" min="1" value="' +
            (v.mrp != null ? v.mrp : '') +
            '" placeholder="MRP ₹">' +
            '<label class="sku-toggle" title="Active / Inactive">' +
            '<input type="checkbox" class="sku-active"' +
            (isActive ? ' checked' : '') +
            '>' +
            '<span class="sku-toggle-slider"></span>' +
            '</label>' +
            '<button type="button" class="text-red-400 hover:text-red-600 text-sm btn-del-sku" aria-label="Remove SKU">✕</button>' +
            '</div>'
          );
        })
        .join('');
      return (
        '<div class="sku-block" data-pid="' +
        p.id +
        '">' +
        '<div class="flex items-center justify-between mb-2">' +
        '<div>' +
        '<h3 class="font-semibold text-gray-800 text-sm">' +
        escapeHtml(p.name || 'Untitled') +
        '</h3>' +
        '<p class="sku-measure-hint">' +
        escapeHtml(measure.label) +
        ' · ' +
        D.unitsForMeasurement(p.measurementType)
          .map(function (u) {
            return u.label;
          })
          .join(', ') +
        '</p>' +
        '</div>' +
        '<button type="button" class="text-sm text-emerald-700 font-medium btn-add-sku" data-pid="' +
        p.id +
        '">+ Size</button>' +
        '</div>' +
        '<div class="sku-headers">' +
        '<span>Qty</span><span>Unit</span><span>Price</span><span>MRP</span><span class="sku-toggle-label">On</span><span></span>' +
        '</div>' +
        rows +
        '</div>'
      );
    }

    if (cats.length) {
      editor.innerHTML =
        '<div class="ob-cat-stack" role="list">' +
        cats
          .map(function (cat) {
            var items = visible.filter(function (p) {
              return p.categoryId === cat.id;
            });
            var open = cat.id === expandedSkuCatId;
            var meta =
              items.length === 0
                ? 'No products'
                : items.length + (items.length === 1 ? ' product' : ' products');
            return (
              '<div class="ob-cat-panel' +
              (open ? ' is-open' : '') +
              '" role="listitem">' +
              '<button type="button" class="ob-cat-toggle" data-sku-cat-toggle="' +
              escapeAttr(cat.id) +
              '" aria-expanded="' +
              (open ? 'true' : 'false') +
              '">' +
              '<span class="ob-cat-chevron" aria-hidden="true"></span>' +
              '<span class="ob-cat-toggle-main">' +
              '<span class="ob-cat-name">' +
              escapeHtml(cat.name) +
              '</span>' +
              '<span class="ob-cat-meta">' +
              escapeHtml(meta) +
              '</span>' +
              '</span>' +
              '<span class="ob-cat-count">' +
              items.length +
              '</span>' +
              '</button>' +
              '<div class="ob-cat-body"' +
              (open ? '' : ' hidden') +
              '>' +
              (items.length
                ? items.map(skuBlockHtml).join('')
                : '<p class="ob-cat-empty">No products in this category.</p>') +
              '</div>' +
              '</div>'
            );
          })
          .join('') +
        '</div>' +
        (!expandedSkuCatId
          ? '<p class="ob-cat-nudge">Tap a category to set prices.</p>'
          : '');
    } else {
      editor.innerHTML = visible.map(skuBlockHtml).join('');
    }

    editor.querySelectorAll('[data-sku-cat-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-sku-cat-toggle');
        expandedSkuCatId = expandedSkuCatId === id ? null : id;
        renderSkuEditor();
      });
    });

    bindSkuEditorEvents(editor);
  }

  function bindSkuEditorEvents(editor) {
    editor.querySelectorAll('.sku-row').forEach(function (row) {
      var pid = row.dataset.pid;
      var vid = row.dataset.vid;
      var qtyInput = row.querySelector('.sku-qty');
      if (qtyInput) {
        qtyInput.addEventListener('input', function (e) {
          updateVariant(pid, vid, 'value', e.target.value);
        });
      }
      var unitSelect = row.querySelector('.sku-unit');
      if (unitSelect) {
        unitSelect.addEventListener('change', function (e) {
          updateVariant(pid, vid, 'unit', e.target.value);
        });
      }
      row.querySelector('.sku-price').addEventListener('input', function (e) {
        updateVariant(pid, vid, 'price', Number(e.target.value));
      });
      row.querySelector('.sku-mrp').addEventListener('input', function (e) {
        updateVariant(pid, vid, 'mrp', Number(e.target.value));
      });
      row.querySelector('.sku-active').addEventListener('change', function (e) {
        updateVariant(pid, vid, 'active', e.target.checked);
        row.classList.toggle('sku-row--inactive', !e.target.checked);
      });
      row.querySelector('.btn-del-sku').addEventListener('click', function () {
        var p = findProduct(pid);
        if (!p || p.variants.length <= 1) return;
        p.variants = p.variants.filter(function (v) {
          return v.id !== vid;
        });
        persist();
        renderSkuEditor();
      });
    });

    editor.querySelectorAll('.btn-add-sku').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = findProduct(btn.dataset.pid);
        if (!p) return;
        if (p.categoryId) expandedSkuCatId = p.categoryId;
        p.variants.push(D.nextSkuPreset(p));
        persist();
        renderSkuEditor();
      });
    });
  }

  function updateVariant(pid, vid, field, value) {
    var p = findProduct(pid);
    if (!p) return;
    var v = p.variants.find(function (x) { return x.id === vid; });
    if (!v) return;
    v[field] = value;
    if (field === 'value' || field === 'unit') {
      D.composeVariantLabel(v);
    }
    persist();
  }

  /* ---------- Step 7 Delivery ---------- */

  function ensureDelivery() {
    if (!draft.delivery) {
      draft.delivery = D.emptyDraft().delivery;
    }
    return draft.delivery;
  }

  function syncDeliveryForm() {
    var d = ensureDelivery();
    var pickup = document.getElementById('del-pickup');
    var home = document.getElementById('del-home');
    var courier = document.getElementById('del-courier');
    if (pickup) pickup.checked = !!(d.storePickup && d.storePickup.enabled);
    if (home) home.checked = !!(d.homeDelivery && d.homeDelivery.enabled);
    if (courier) courier.checked = !!(d.courierDelivery && d.courierDelivery.enabled);
    var homeCharge = document.getElementById('del-home-charge');
    var courierCharge = document.getElementById('del-courier-charge');
    if (homeCharge) homeCharge.value = d.homeDelivery && d.homeDelivery.charge != null ? d.homeDelivery.charge : 40;
    if (courierCharge)
      courierCharge.value = d.courierDelivery && d.courierDelivery.charge != null ? d.courierDelivery.charge : 80;
    updateDeliveryExtras();
  }

  function updateDeliveryExtras() {
    var homeOn = document.getElementById('del-home') && document.getElementById('del-home').checked;
    var courierOn = document.getElementById('del-courier') && document.getElementById('del-courier').checked;
    var homeExtra = document.getElementById('del-home-extra');
    var courierExtra = document.getElementById('del-courier-extra');
    if (homeExtra) homeExtra.classList.toggle('is-open', homeOn);
    if (courierExtra) courierExtra.classList.toggle('is-open', courierOn);
    document.querySelectorAll('[data-delivery]').forEach(function (card) {
      var key = card.getAttribute('data-delivery');
      var checked = false;
      if (key === 'storePickup') checked = document.getElementById('del-pickup').checked;
      if (key === 'homeDelivery') checked = document.getElementById('del-home').checked;
      if (key === 'courierDelivery') checked = document.getElementById('del-courier').checked;
      card.classList.toggle('selected', checked);
    });
  }

  function readDeliveryFromForm() {
    var d = ensureDelivery();
    d.storePickup.enabled = !!(document.getElementById('del-pickup') && document.getElementById('del-pickup').checked);
    d.homeDelivery.enabled = !!(document.getElementById('del-home') && document.getElementById('del-home').checked);
    d.courierDelivery.enabled = !!(
      document.getElementById('del-courier') && document.getElementById('del-courier').checked
    );
    d.homeDelivery.charge = Math.max(
      0,
      Number((document.getElementById('del-home-charge') || {}).value) || 0
    );
    d.courierDelivery.charge = Math.max(
      0,
      Number((document.getElementById('del-courier-charge') || {}).value) || 0
    );
  }

  /* ---------- Step 8 Payment ---------- */

  function ensurePayment() {
    if (!draft.payment) {
      draft.payment = D.emptyDraft().payment;
    }
    return draft.payment;
  }

  function syncPaymentForm() {
    var p = ensurePayment();
    var upi = document.getElementById('pay-upi');
    var bank = document.getElementById('pay-bank');
    var cod = document.getElementById('pay-cod');
    if (upi) upi.checked = !!(p.upi && p.upi.enabled);
    if (bank) bank.checked = !!(p.bank && p.bank.enabled);
    if (cod) cod.checked = !!(p.cod && p.cod.enabled);
    if (document.getElementById('pay-upi-id')) document.getElementById('pay-upi-id').value = (p.upi && p.upi.upiId) || '';
    if (document.getElementById('pay-upi-name'))
      document.getElementById('pay-upi-name').value = (p.upi && p.upi.payeeName) || '';
    if (document.getElementById('pay-bank-name'))
      document.getElementById('pay-bank-name').value = (p.bank && p.bank.accountName) || '';
    if (document.getElementById('pay-bank-number'))
      document.getElementById('pay-bank-number').value = (p.bank && p.bank.accountNumber) || '';
    if (document.getElementById('pay-bank-ifsc'))
      document.getElementById('pay-bank-ifsc').value = (p.bank && p.bank.ifsc) || '';
    if (document.getElementById('pay-bank-bank'))
      document.getElementById('pay-bank-bank').value = (p.bank && p.bank.bankName) || '';
    updatePaymentExtras();
  }

  function updatePaymentExtras() {
    var upiOn = document.getElementById('pay-upi') && document.getElementById('pay-upi').checked;
    var bankOn = document.getElementById('pay-bank') && document.getElementById('pay-bank').checked;
    var upiExtra = document.getElementById('pay-upi-extra');
    var bankExtra = document.getElementById('pay-bank-extra');
    if (upiExtra) upiExtra.classList.toggle('is-open', upiOn);
    if (bankExtra) bankExtra.classList.toggle('is-open', bankOn);
    document.querySelectorAll('[data-payment]').forEach(function (card) {
      var key = card.getAttribute('data-payment');
      var checked = false;
      if (key === 'upi') checked = document.getElementById('pay-upi').checked;
      if (key === 'bank') checked = document.getElementById('pay-bank').checked;
      if (key === 'cod') checked = document.getElementById('pay-cod').checked;
      card.classList.toggle('selected', checked);
    });
  }

  function readPaymentFromForm() {
    var p = ensurePayment();
    p.upi.enabled = !!(document.getElementById('pay-upi') && document.getElementById('pay-upi').checked);
    p.bank.enabled = !!(document.getElementById('pay-bank') && document.getElementById('pay-bank').checked);
    p.cod.enabled = !!(document.getElementById('pay-cod') && document.getElementById('pay-cod').checked);
    p.upi.upiId = ((document.getElementById('pay-upi-id') || {}).value || '').trim();
    p.upi.payeeName = ((document.getElementById('pay-upi-name') || {}).value || '').trim();
    p.bank.accountName = ((document.getElementById('pay-bank-name') || {}).value || '').trim();
    p.bank.accountNumber = ((document.getElementById('pay-bank-number') || {}).value || '').trim();
    p.bank.ifsc = ((document.getElementById('pay-bank-ifsc') || {}).value || '').trim().toUpperCase();
    p.bank.bankName = ((document.getElementById('pay-bank-bank') || {}).value || '').trim();
  }

  /* ---------- Step 9 Theme ---------- */

  function normalizeHex(color) {
    return D.normalizeHex ? D.normalizeHex(color) : String(color || '#10b981').toLowerCase();
  }

  function hexToRgba(hex, alpha) {
    if (D.hexToRgba) return D.hexToRgba(hex, alpha);
    var h = normalizeHex(hex).slice(1);
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function applyThemeColor(color) {
    applyBrandSettings({ themeColor: color });
  }

  function applyBrandSettings(partial) {
    partial = partial || {};
    if (partial.themeColor != null) {
      draft.settings.themeColor = normalizeHex(partial.themeColor);
    }
    if (partial.accentColor != null) {
      var accentRaw = String(partial.accentColor || '').trim();
      draft.settings.accentColor = /^#[0-9a-fA-F]{3,6}$/.test(accentRaw)
        ? normalizeHex(accentRaw)
        : D.DEFAULT_ACCENT || '#f97316';
    }
    if (partial.backgroundColor != null) {
      var bgRaw = String(partial.backgroundColor || '').trim();
      draft.settings.backgroundColor = /^#[0-9a-fA-F]{3,6}$/.test(bgRaw)
        ? normalizeHex(bgRaw)
        : D.DEFAULT_BG || '#f9fafb';
    }
    if (partial.fontId != null) {
      draft.settings.fontId = String(partial.fontId || D.DEFAULT_FONT || 'poppins');
    }

    if (!draft.settings.accentColor) draft.settings.accentColor = D.DEFAULT_ACCENT || '#f97316';
    if (!draft.settings.backgroundColor) draft.settings.backgroundColor = D.DEFAULT_BG || '#f9fafb';
    if (!draft.settings.fontId) draft.settings.fontId = D.DEFAULT_FONT || 'poppins';

    var applied = D.applyStoreBrand
      ? D.applyStoreBrand(draft.settings)
      : {
          themeColor: D.applyTheme
            ? D.applyTheme(draft.settings.themeColor)
            : normalizeHex(draft.settings.themeColor),
          accentColor: draft.settings.accentColor,
          backgroundColor: draft.settings.backgroundColor,
          fontId: draft.settings.fontId
        };

    draft.settings.themeColor = applied.themeColor || draft.settings.themeColor;
    draft.settings.accentColor = applied.accentColor || draft.settings.accentColor;
    draft.settings.backgroundColor = applied.backgroundColor || draft.settings.backgroundColor;
    draft.settings.fontId = applied.fontId || draft.settings.fontId;

    syncBrandControls();
    return draft.settings.themeColor;
  }

  function syncBrandControls() {
    var theme = normalizeHex(draft.settings.themeColor || '#10b981');
    var accent = draft.settings.accentColor || D.DEFAULT_ACCENT || '#f97316';
    var bg = draft.settings.backgroundColor || D.DEFAULT_BG || '#f9fafb';
    var fontId = draft.settings.fontId || D.DEFAULT_FONT || 'poppins';

    var themeInput = document.getElementById('input-theme-color');
    var themeHex = document.getElementById('theme-color-hex');
    var themeChip = document.getElementById('theme-live-chip');
    if (themeInput) themeInput.value = theme;
    if (themeHex) themeHex.textContent = theme;
    if (themeChip) {
      themeChip.style.background = theme;
      themeChip.style.color = '#fff';
    }

    var accentInput = document.getElementById('input-accent-color');
    var accentHex = document.getElementById('accent-color-hex');
    var accentChip = document.getElementById('accent-live-chip');
    if (accentInput) accentInput.value = accent;
    if (accentHex) accentHex.textContent = accent;
    if (accentChip) {
      accentChip.style.background = accent;
      accentChip.style.color = '#fff';
    }

    var bgInput = document.getElementById('input-bg-color');
    var bgHex = document.getElementById('bg-color-hex');
    if (bgInput) bgInput.value = bg;
    if (bgHex) bgHex.textContent = bg;

    document.querySelectorAll('#theme-swatches .theme-swatch').forEach(function (btn) {
      btn.classList.toggle('selected', normalizeHex(btn.getAttribute('data-color')) === theme);
    });
    document.querySelectorAll('#accent-swatches .theme-swatch').forEach(function (btn) {
      btn.classList.toggle('selected', normalizeHex(btn.getAttribute('data-color')) === normalizeHex(accent));
    });
    document.querySelectorAll('#bg-swatches .theme-swatch').forEach(function (btn) {
      btn.classList.toggle('selected', normalizeHex(btn.getAttribute('data-color')) === normalizeHex(bg));
    });
    document.querySelectorAll('#font-swatches .font-swatch').forEach(function (btn) {
      btn.classList.toggle('selected', btn.getAttribute('data-font') === fontId);
    });
  }

  function renderSwatchButtons(containerId, presets, onPick, options) {
    options = options || {};
    var el = document.getElementById(containerId);
    if (!el || el.dataset.ready) return;
    var isLight = D.isLightHex || function (hex) {
      return String(hex).toLowerCase() === '#ffffff' || String(hex).toLowerCase() === '#f9fafb';
    };
    el.innerHTML = (presets || [])
      .map(function (t) {
        var lightClass = isLight(t.color) ? ' theme-swatch--light' : '';
        return (
          '<button type="button" class="theme-swatch' +
          lightClass +
          '" data-color="' +
          t.color +
          '" title="' +
          escapeAttr(t.label) +
          '" aria-label="' +
          escapeAttr(t.label) +
          '" style="--swatch:' +
          t.color +
          '"><span class="theme-swatch-check">✓</span></button>'
        );
      })
      .join('');
    el.dataset.ready = '1';
    el.querySelectorAll('.theme-swatch').forEach(function (btn) {
      btn.addEventListener('click', function () {
        onPick(btn.getAttribute('data-color'));
        persist();
      });
    });
  }

  function renderFontButtons() {
    var el = document.getElementById('font-swatches');
    if (!el || el.dataset.ready) return;
    var presets = D.FONT_PRESETS || [];
    el.innerHTML = presets
      .map(function (f) {
        return (
          '<button type="button" class="font-swatch" data-font="' +
          escapeAttr(f.id) +
          '" title="' +
          escapeAttr(f.label) +
          '" aria-label="' +
          escapeAttr(f.label) +
          '">' +
          '<span class="font-swatch-sample" style="font-family:' +
          escapeAttr(f.display) +
          '">Aa</span>' +
          '<span class="font-swatch-label">' +
          escapeHtml(f.label) +
          '</span>' +
          (f.hint
            ? '<span class="font-swatch-hint">' + escapeHtml(f.hint) + '</span>'
            : '') +
          '</button>'
        );
      })
      .join('');
    el.dataset.ready = '1';
    el.querySelectorAll('.font-swatch').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyBrandSettings({ fontId: btn.getAttribute('data-font') });
        persist();
        renderPreview();
      });
    });
  }

  function syncThemePanel() {
    renderSwatchButtons('theme-swatches', D.THEME_PRESETS || [], function (color) {
      applyBrandSettings({ themeColor: color });
      renderPreview();
    });
    renderSwatchButtons('accent-swatches', D.ACCENT_PRESETS || [], function (color) {
      applyBrandSettings({ accentColor: color });
      renderPreview();
    });
    renderSwatchButtons('bg-swatches', D.BG_PRESETS || [], function (color) {
      applyBrandSettings({ backgroundColor: color });
      renderPreview();
    });
    renderFontButtons();
    applyBrandSettings({});
  }

  /* ---------- Tagline examples popup ---------- */

  var taglineModalBizId = '';

  function openTaglineExamplesModal() {
    var modal = document.getElementById('tagline-examples-modal');
    if (!modal) return;
    taglineModalBizId = draft.businessType || 'others';
    renderTaglineBizTabs();
    renderTaglineSamples(taglineModalBizId);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    var closeBtn = modal.querySelector('.ob-modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeTaglineExamplesModal() {
    var modal = document.getElementById('tagline-examples-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    var hint = document.getElementById('tagline-modal-hint');
    if (hint) {
      hint.hidden = true;
      hint.textContent = '';
    }
  }

  function renderTaglineBizTabs() {
    var tabs = document.getElementById('tagline-biz-tabs');
    if (!tabs) return;
    var types = D.BUSINESS_TYPES || [];
    // Prefer selected business type first
    var ordered = types.slice().sort(function (a, b) {
      if (a.id === draft.businessType) return -1;
      if (b.id === draft.businessType) return 1;
      return 0;
    });
    tabs.innerHTML = ordered
      .map(function (b) {
        var active = b.id === taglineModalBizId ? ' is-active' : '';
        return (
          '<button type="button" class="ob-modal-biz-btn' +
          active +
          '" role="tab" aria-selected="' +
          (b.id === taglineModalBizId ? 'true' : 'false') +
          '" data-biz="' +
          escapeAttr(b.id) +
          '">' +
          (b.icon ? b.icon + ' ' : '') +
          escapeHtml(b.label) +
          '</button>'
        );
      })
      .join('');
    tabs.querySelectorAll('.ob-modal-biz-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        taglineModalBizId = btn.getAttribute('data-biz') || 'others';
        renderTaglineBizTabs();
        renderTaglineSamples(taglineModalBizId);
      });
    });
  }

  function renderTaglineSamples(bizId) {
    var panel = document.getElementById('tagline-samples');
    if (!panel) return;
    var samples = D.taglinesForBusiness
      ? D.taglinesForBusiness(bizId)
      : (D.TAGLINE_EXAMPLES && D.TAGLINE_EXAMPLES[bizId]) ||
        (D.TAGLINE_EXAMPLES && D.TAGLINE_EXAMPLES.others) ||
        [];
    if (!samples.length) {
      panel.innerHTML = '<p class="text-sm text-gray-500">No samples for this type yet.</p>';
      return;
    }
    panel.innerHTML = samples
      .map(function (text, idx) {
        return (
          '<div class="ob-tagline-card">' +
          '<div class="ob-tagline-text">' +
          escapeHtml(text) +
          '</div>' +
          '<div class="ob-tagline-actions">' +
          '<button type="button" class="ob-copy" data-idx="' +
          idx +
          '">Copy</button>' +
          '<button type="button" class="ob-use" data-idx="' +
          idx +
          '">Use</button>' +
          '</div></div>'
        );
      })
      .join('');

    panel.querySelectorAll('.ob-use').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = Number(btn.getAttribute('data-idx'));
        applyTaglineSample(samples[i], false);
      });
    });
    panel.querySelectorAll('.ob-copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = Number(btn.getAttribute('data-idx'));
        applyTaglineSample(samples[i], true);
      });
    });
  }

  function applyTaglineSample(text, copyOnly) {
    text = String(text || '');
    var input = document.getElementById('input-tagline');
    var hint = document.getElementById('tagline-modal-hint');
    function showHint(msg) {
      if (!hint) return;
      hint.hidden = false;
      hint.textContent = msg;
    }
    if (copyOnly) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () {
            showHint('Copied — paste into Tagline anytime.');
          },
          function () {
            showHint('Copy failed — use the Use button instead.');
          }
        );
      } else {
        if (input) {
          input.value = text;
          input.select();
          try {
            document.execCommand('copy');
            showHint('Copied to clipboard.');
          } catch (e) {
            showHint('Select the text and copy manually.');
          }
        }
      }
      return;
    }
    if (input) {
      input.value = text;
      draft.settings.tagline = text;
      persist();
      renderPreview();
      var wrap = input.closest('.settings-field');
      if (wrap) wrap.classList.remove('is-invalid');
    }
    showHint('Tagline applied.');
    setTimeout(closeTaglineExamplesModal, 450);
  }

  function bindTaglineModal() {
    var openBtn = document.getElementById('btn-tagline-examples');
    if (openBtn) {
      openBtn.addEventListener('click', openTaglineExamplesModal);
    }
    document.querySelectorAll('[data-close-tagline-modal]').forEach(function (el) {
      el.addEventListener('click', closeTaglineExamplesModal);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var modal = document.getElementById('tagline-examples-modal');
      if (modal && !modal.hidden) closeTaglineExamplesModal();
    });
  }

  /* ---------- Step 10 ---------- */

  /**
   * Build / merge Free-tier entitlement after publish.
   * Replace `apiSubscription` with the real API payload when wiring
   * POST publish + GET/POST vendor subscription endpoints.
   *
   * Expected API shape (illustrative):
   * {
   *   planCode, planName, status, activatedAt, endsAt,
   *   vendorId, subscriptionId, features[],
   *   dashboardUrl, storefrontUrl, upgradeUrl
   * }
   */
  function activateFreeSubscription(apiSubscription) {
    var defaults = D.defaultSubscription ? D.defaultSubscription() : {};
    var existing = draft.subscription || {};
    var fromApi = apiSubscription || {};
    var now = new Date().toISOString();
    var assetsExt =
      (window.MithraAssets && window.MithraAssets.paths && window.MithraAssets.paths.external) || {};

    draft.subscription = Object.assign({}, defaults, existing, fromApi, {
      planCode: fromApi.planCode || existing.planCode || 'FREE',
      planName: fromApi.planName || existing.planName || 'Free',
      status: fromApi.status || existing.status || 'ACTIVE',
      activatedAt: fromApi.activatedAt || existing.activatedAt || now,
      endsAt: fromApi.endsAt != null ? fromApi.endsAt : existing.endsAt != null ? existing.endsAt : null,
      vendorId: fromApi.vendorId || draft.vendorId || existing.vendorId || null,
      subscriptionId: fromApi.subscriptionId || existing.subscriptionId || null,
      features:
        fromApi.features && fromApi.features.length
          ? fromApi.features
          : existing.features && existing.features.length
            ? existing.features
            : defaults.features,
      dashboardUrl:
        fromApi.dashboardUrl ||
        existing.dashboardUrl ||
        assetsExt.dashboardUrl ||
        '',
      storefrontUrl: fromApi.storefrontUrl || existing.storefrontUrl || '',
      upgradeUrl:
        fromApi.upgradeUrl ||
        existing.upgradeUrl ||
        assetsExt.pricingUrl ||
        'index.html#pricing'
    });

    if (draft.subscription.vendorId) {
      draft.vendorId = draft.subscription.vendorId;
    }
    return draft.subscription;
  }

  function formatActivatedLabel(iso) {
    if (!iso) return 'Just now';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return 'Just now';
      var sameDay = new Date().toDateString() === d.toDateString();
      if (sameDay) {
        return (
          'Activated today · ' +
          d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        );
      }
      return (
        'Activated ' +
        d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
      );
    } catch (e) {
      return 'Just now';
    }
  }

  function renderPlanFeatures(features) {
    var list = document.getElementById('plan-features');
    if (!list || !features || !features.length) return;
    var wasHidden = list.hidden;
    var icons = {
      storefront: '🏪',
      whatsapp_orders: '💬',
      products: '📦',
      delivery: '🚚',
      payments: '💳',
      branding: '🎨'
    };
    list.innerHTML = features
      .map(function (f) {
        var code = f.code || f.id || '';
        var label = f.label || f.name || code;
        var icon = f.icon || icons[code] || '✓';
        return (
          '<li class="ob-feature" data-feature="' +
          escapeAttr(code) +
          '">' +
          '<span class="ob-feature-icon" aria-hidden="true">' +
          icon +
          '</span>' +
          '<span>' +
          escapeHtml(label) +
          '</span></li>'
        );
      })
      .join('');
    list.hidden = wasHidden;
    list.classList.toggle('is-collapsed', wasHidden);
  }

  function markShareTipDone(tip) {
    if (!tip) return;
    var step = document.querySelector('.ob-share-step[data-tip="' + tip + '"]');
    if (step) step.classList.add('is-done');
    if (!draft.onboardingTips) draft.onboardingTips = {};
    draft.onboardingTips[tip] = true;
    persist();
  }

  function restoreShareTips() {
    var tips = (draft.onboardingTips) || {};
    Object.keys(tips).forEach(function (tip) {
      if (tips[tip]) {
        var step = document.querySelector('.ob-share-step[data-tip="' + tip + '"]');
        if (step) step.classList.add('is-done');
      }
    });
  }

  function copyStoreLink(opts) {
    opts = opts || {};
    var text = (document.getElementById('store-url-display') || {}).textContent || '';
    var btn = opts.button || document.getElementById('btn-copy-url');
    var feedback = document.getElementById('copy-feedback');
    function onCopied() {
      if (btn) {
        var prev = btn.textContent;
        btn.textContent = opts.doneLabel || 'Copied!';
        setTimeout(function () {
          btn.textContent = prev;
        }, 1600);
      }
      if (feedback) {
        feedback.hidden = false;
        feedback.textContent =
          opts.hint || 'Link copied — paste it in WhatsApp or your Instagram bio.';
      }
      if (opts.tip) markShareTipDone(opts.tip);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onCopied).catch(function () {
        window.prompt('Copy your shop link:', text);
      });
    } else {
      window.prompt('Copy your shop link:', text);
      onCopied();
    }
  }

  function renderSuccessPanel(sub) {
    var storeName = (draft.settings && draft.settings.storeName) || 'Your store';
    var eyebrow = document.getElementById('success-store-name');
    if (eyebrow) eyebrow.textContent = storeName + ' is live';

    var panel = document.getElementById('panel-10');
    var card = document.getElementById('plan-status-card');
    if (panel) {
      panel.setAttribute('data-plan-code', sub.planCode || 'FREE');
      panel.setAttribute('data-plan-status', sub.status || 'ACTIVE');
    }
    if (card) {
      card.setAttribute('data-plan-code', sub.planCode || 'FREE');
      card.setAttribute('data-plan-status', sub.status || 'ACTIVE');
      card.setAttribute('data-vendor-id', sub.vendorId != null ? String(sub.vendorId) : '');
      card.setAttribute(
        'data-subscription-id',
        sub.subscriptionId != null ? String(sub.subscriptionId) : ''
      );
    }

    var badge = document.getElementById('plan-badge');
    if (badge) badge.textContent = (sub.planName || 'Free') + ' plan';

    var statusLabel = document.getElementById('plan-status-label');
    if (statusLabel) {
      var statusText =
        String(sub.status || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'Activated' : String(sub.status);
      statusLabel.innerHTML =
        '<span class="ob-plan-dot" aria-hidden="true"></span>' + escapeHtml(statusText);
    }

    var headline = document.getElementById('plan-headline');
    if (headline) {
      headline.textContent =
        (sub.planCode || 'FREE') === 'FREE'
          ? 'Free tier is active on your store'
          : (sub.planName || 'Plan') + ' is active on your store';
    }

    var activatedEl = document.getElementById('plan-activated-at');
    if (activatedEl) activatedEl.textContent = formatActivatedLabel(sub.activatedAt);

    var subtitle = document.getElementById('success-subtitle');
    if (subtitle) {
      subtitle.textContent =
        'Your ' +
        (sub.planName || 'Free') +
        ' plan is on. Next: share your shop link so customers can browse and order on WhatsApp.';
    }

    var featuresEl = document.getElementById('plan-features');
    var featuresWereOpen = featuresEl && !featuresEl.hidden;
    renderPlanFeatures(sub.features);
    if (featuresEl && !featuresWereOpen) {
      featuresEl.hidden = true;
      featuresEl.classList.add('is-collapsed');
    }

    var upgrade = document.getElementById('btn-view-plans');
    if (upgrade && sub.upgradeUrl) upgrade.href = sub.upgradeUrl;

    var dashBtn = document.getElementById('btn-go-dashboard');
    if (dashBtn) {
      var dashUrl = String(sub.dashboardUrl || '').trim();
      dashBtn.hidden = false;
      if (dashUrl) {
        dashBtn.href = dashUrl;
        dashBtn.removeAttribute('data-pending');
        dashBtn.removeAttribute('aria-disabled');
      } else {
        dashBtn.href = '#';
        dashBtn.setAttribute('data-pending', 'true');
        dashBtn.setAttribute(
          'title',
          'Dashboard URL pending — set subscription.dashboardUrl from API'
        );
      }
    }

    restoreShareTips();
  }

  function finalizeLive(apiResult) {
    var liveSlug = D.normalizeStoreSlug
      ? D.normalizeStoreSlug(draft.slug || draft.settings.storeName)
      : D.slugify(draft.slug || draft.settings.storeName);
    draft.slug = liveSlug || D.slugify(draft.settings.storeName);
    var sub = activateFreeSubscription(
      apiResult && (apiResult.subscription || apiResult.plan || apiResult)
    );
    var displayUrl = 'mithradirect.com/store/' + draft.slug;
    var storeHref = 'store.html?slug=' + encodeURIComponent(draft.slug);
    if (draft.vendorId) {
      storeHref += '&vendor_id=' + encodeURIComponent(String(draft.vendorId));
    }
    sub.storefrontUrl = sub.storefrontUrl || storeHref;
    draft.subscription = sub;
    persist();

    if (window.StoreAPI && typeof window.StoreAPI.publishFromDraft === 'function') {
      window.StoreAPI.publishFromDraft(draft);
    }

    if (window.StoreAPI && typeof window.StoreAPI.setVendorSession === 'function') {
      window.StoreAPI.setVendorSession({
        loggedIn: true,
        phone: draft.phone || (draft.settings && draft.settings.whatsapp) || '',
        name: (draft.settings && draft.settings.storeName) || '',
        role: (window.StoreAPI.getVendorSession() || {}).role || 'vendor',
        vendorId: draft.vendorId || null
      });
    }

    document.getElementById('store-url-display').textContent = displayUrl;
    var viewBtn = document.getElementById('btn-view-store');
    if (viewBtn) viewBtn.href = sub.storefrontUrl || storeHref;

    renderSuccessPanel(sub);

    var storeName = (draft.settings && draft.settings.storeName) || 'my store';
    renderSuccessQr(sub.storefrontUrl || storeHref, storeName);

    var shareText =
      'Hi! Order from ' +
      storeName +
      ' online 🛍️\nBrowse the menu & message me on WhatsApp:\nhttps://' +
      displayUrl;
    var absHint = 'https://' + displayUrl;
    var wa = document.getElementById('share-whatsapp');
    var fb = document.getElementById('share-facebook');
    if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(shareText);
    if (fb)
      fb.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(absHint);
  }

  function renderSuccessQr(storeHref, storeName) {
    var img = document.getElementById('ob-qr-img');
    var placeholder = document.getElementById('ob-qr-placeholder');
    if (!img || !D || typeof D.qrImageUrl !== 'function') return;
    var src = D.qrImageUrl(storeHref, 200);
    window.__obQrSrc = src;
    window.__obQrName = storeName || 'shop';
    img.onload = function () {
      img.hidden = false;
      if (placeholder) placeholder.hidden = true;
    };
    img.onerror = function () {
      img.hidden = true;
      if (placeholder) {
        placeholder.hidden = false;
        placeholder.textContent = 'QR';
      }
    };
    img.src = src;
    img.alt = 'QR code for ' + (storeName || 'your shop');
  }

  /* ---------- Live preview ---------- */

  function renderPreview() {
    var root = document.getElementById('phone-preview');
    var theme = normalizeHex(draft.settings.themeColor || '#10b981');
    var accent = draft.settings.accentColor || D.DEFAULT_ACCENT || '#f97316';
    var bg = draft.settings.backgroundColor || D.DEFAULT_BG || '#f9fafb';
    var font = D.getFontPreset
      ? D.getFontPreset(draft.settings.fontId)
      : { display: "var(--font-display)", body: "var(--font-body)" };
    applyBrandSettings({});
    var name = draft.settings.storeName || 'Your Store Name';
    var tagline = draft.settings.tagline || 'Your tagline appears here';
    var wa = draft.settings.whatsapp || draft.phone;
    var logo = draft.settings.logo || '';
    var banner = draft.settings.banner || '';
    var cats = draft.categories || [];
    var activeIds = selectedCategoryIds();
    var products = (draft.products || [])
      .filter(function (p) {
        return !activeIds.length || activeIds.indexOf(p.categoryId) >= 0;
      })
      .slice()
      .sort(function (a, b) {
        return a.order - b.order;
      });

    var defaultLogo =
      (window.MithraAssets && window.MithraAssets.logo && window.MithraAssets.logo()) ||
      'assets/img/logos/logo_dark_md.png';
    var defaultFresh =
      (window.MithraAssets && window.MithraAssets.path && window.MithraAssets.path('fallbacks.fresh')) ||
      'assets/img/fresh.png';

    var ink = D.isDarkHex && D.isDarkHex(bg) ? '#f9fafb' : '#111827';
    var muted = D.isDarkHex && D.isDarkHex(bg) ? '#9ca3af' : '#6b7280';

    var headerLogo = logo
      ? '<img src="' + logo + '" alt="" class="preview-store-logo">'
      : '<img src="' + defaultLogo + '" alt="" class="h-5" onerror="this.style.display=\'none\'">';

    var heroBg = banner
      ? '<img class="preview-hero-bg" src="' + banner + '" alt="">' +
        '<div class="preview-hero-overlay"></div>'
      : '<img class="preview-hero-bg" src="' + defaultFresh + '" alt="" style="opacity:0.25">' +
        '<div class="preview-hero-overlay" style="background:linear-gradient(to top,' +
        hexToRgba(theme, 0.75) +
        ',' +
        hexToRgba(theme, 0.35) +
        ')"></div>';

    var catHtml = cats.length
      ? cats
          .map(function (c) {
            return (
              '<div class="preview-cat">' +
              '<div class="preview-cat-img" style="border-color:' +
              hexToRgba(theme, 0.35) +
              ';background:' +
              hexToRgba(theme, 0.12) +
              '">' +
              (c.image
                ? '<img src="' + c.image + '" class="w-full h-full object-cover rounded-full" alt="" onerror="this.parentNode.textContent=\'📦\'">'
                : '📦') +
              '</div>' +
              '<div class="text-[10px] truncate" style="color:' +
              muted +
              '">' +
              escapeHtml(c.name) +
              '</div></div>'
            );
          })
          .join('')
      : '<p class="text-[10px] px-2" style="color:' + muted + '">Categories will show here</p>';

    var prodHtml = products.length
      ? products
          .map(function (p) {
            var from = D.minPrice(p);
            var thumb = p.image
              ? '<img src="' +
                p.image +
                '" alt="" class="w-full h-full object-cover">'
              : escapeHtml(p.icon || '🫙');
            return (
              '<div class="preview-product-card" style="background:#fff;border-radius:0.5rem;overflow:hidden">' +
              '<div class="preview-product-img" style="background:' +
              (p.color || hexToRgba(theme, 0.12)) +
              ';position:relative">' +
              (p === products[0]
                ? '<span style="position:absolute;top:4px;left:4px;background:' +
                  accent +
                  ';color:#fff;font-size:8px;font-weight:700;padding:1px 5px;border-radius:9999px">Sale</span>'
                : '') +
              thumb +
              '</div>' +
              '<div class="p-1.5">' +
              '<div class="text-[11px] font-semibold truncate" style="color:' +
              ink +
              ';font-family:' +
              escapeAttr(font.display) +
              '">' +
              escapeHtml(p.name || 'Product') +
              '</div>' +
              '<div class="text-[10px] font-medium" style="color:' +
              theme +
              '">From ₹' +
              (from || '—') +
              '</div></div></div>'
            );
          })
          .join('')
      : '<p class="text-[10px] col-span-2" style="color:' + muted + '">Products will appear here</p>';

    var d = ensureDelivery();
    var pay = ensurePayment();
    var delBits = [];
    if (d.storePickup && d.storePickup.enabled) delBits.push('Pickup');
    if (d.homeDelivery && d.homeDelivery.enabled)
      delBits.push('Home ₹' + (Number(d.homeDelivery.charge) || 0));
    if (d.courierDelivery && d.courierDelivery.enabled)
      delBits.push('Courier ₹' + (Number(d.courierDelivery.charge) || 0));
    var payBits = [];
    if (pay.upi && pay.upi.enabled) payBits.push('UPI');
    if (pay.bank && pay.bank.enabled) payBits.push('Bank');
    if (pay.cod && pay.cod.enabled) payBits.push('COD');

    root.innerHTML =
      '<div style="background:' +
      bg +
      ';color:' +
      ink +
      ';font-family:' +
      escapeAttr(font.body) +
      ';min-height:100%">' +
      '<div class="flex items-center justify-between px-3 py-2 border-b text-gray-700" style="border-color:' +
      hexToRgba(theme, 0.15) +
      ';color:' +
      ink +
      '">' +
      '<span class="text-lg leading-none">☰</span>' +
      headerLogo +
      '<div class="flex gap-2 text-sm"><span>🔍</span><span>🛒<sup class="text-[9px]" style="color:' +
      theme +
      '">0</sup></span></div>' +
      '</div>' +
      '<div class="preview-hero' + (banner ? ' has-banner' : '') + '">' +
      heroBg +
      '<div class="font-bold text-sm leading-tight" style="font-family:' +
      escapeAttr(font.display) +
      '">' +
      escapeHtml(name) +
      '</div>' +
      '<div class="text-[10px] opacity-90 mt-0.5">' +
      escapeHtml(tagline) +
      '</div>' +
      (wa
        ? '<a href="' +
          D.whatsappLink(wa, 'Hi, I want to order from ' + name) +
          '" target="_blank" class="mt-2 inline-block bg-white text-[10px] font-bold px-3 py-1.5 rounded-full" style="color:' +
          theme +
          '">WhatsApp Order</a>'
        : '') +
      '</div>' +
      '<div class="px-3 py-2">' +
      '<div class="text-[11px] font-semibold mb-1.5" style="color:' +
      ink +
      ';font-family:' +
      escapeAttr(font.display) +
      '">Categories</div>' +
      '<div class="flex gap-2 overflow-x-auto pb-1">' +
      catHtml +
      '</div></div>' +
      '<div class="px-3 py-2">' +
      '<div class="flex items-center justify-between mb-1.5">' +
      '<div class="text-[11px] font-semibold" style="color:' +
      ink +
      ';font-family:' +
      escapeAttr(font.display) +
      '">Our Products</div>' +
      '<span class="text-[9px] font-bold" style="color:' +
      accent +
      '">Offers</span>' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-2">' +
      prodHtml +
      '</div></div>' +
      '<div class="px-3 py-2 border-t" style="border-color:' +
      hexToRgba(theme, 0.12) +
      '">' +
      '<div class="text-[10px]" style="color:' +
      muted +
      '"><span class="font-semibold" style="color:' +
      ink +
      '">Delivery:</span> ' +
      escapeHtml(delBits.length ? delBits.join(' · ') : 'Not set') +
      '</div>' +
      '<div class="text-[10px] mt-0.5" style="color:' +
      muted +
      '"><span class="font-semibold" style="color:' +
      ink +
      '">Pay:</span> ' +
      escapeHtml(payBits.length ? payBits.join(' · ') : 'Not set') +
      '</div>' +
      '</div>' +
      '<div class="px-3 py-3 border-t mt-1" style="background:' +
      hexToRgba(theme, 0.06) +
      ';border-color:' +
      hexToRgba(theme, 0.12) +
      '">' +
      '<div class="grid grid-cols-2 gap-1 text-[9px] text-center" style="color:' +
      muted +
      '">' +
      '<span>🌿 100% Homemade</span><span>🚫 No Preservatives</span>' +
      '<span>🧼 Hygienically Packed</span><span>' +
      (pay.cod && pay.cod.enabled ? '💵 COD Available' : '💳 Online Pay') +
      '</span>' +
      '</div>' +
      '<p class="text-center text-[9px] mt-2" style="color:' +
      muted +
      '">Powered by MithraDirect</p>' +
      '</div></div>';
  }

  function updateSummary() {
    var activeIds = selectedCategoryIds();
    var visibleProducts = (draft.products || []).filter(function (p) {
      return !activeIds.length || activeIds.indexOf(p.categoryId) >= 0;
    });
    document.getElementById('stat-categories').textContent = String((draft.categories || []).length);
    document.getElementById('stat-products').textContent = String(visibleProducts.length);
    document.getElementById('stat-skus').textContent = String(
      visibleProducts.reduce(function (n, p) {
        return n + ((p.variants && p.variants.length) || 0);
      }, 0)
    );
    var wa = draft.settings.whatsapp || (draft.verified ? draft.phone : '');
    document.getElementById('stat-whatsapp').textContent = wa ? 'Start Receiving' : 'Pending';
  }

  /* ---------- Utils ---------- */

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  /** MVP image upload caps (MithraDirect Image Specification). */
  var IMAGE_SPECS = {
    logo: { aspectRatio: 1, maxWidth: 512, maxBytes: 500 * 1024 },
    product: { aspectRatio: 1, maxWidth: 1200, maxBytes: 1 * 1024 * 1024 },
    category: { aspectRatio: 1, maxWidth: 600, maxBytes: 500 * 1024 },
    banner: { aspectRatio: 16 / 9, maxWidth: 1600, maxBytes: 1 * 1024 * 1024 },
    marketingBanner: { aspectRatio: 16 / 9, maxWidth: 1600, maxBytes: 1 * 1024 * 1024 }
  };

  function formatMaxUploadLabel(maxBytes) {
    if (maxBytes < 1024 * 1024) {
      return Math.round(maxBytes / 1024) + ' KB';
    }
    var mb = maxBytes / (1024 * 1024);
    return (Number.isInteger(mb) ? mb : mb.toFixed(1)) + ' MB';
  }

  /**
   * Center-crop to aspectRatio (w/h), then scale to maxWidth.
   * Returns a JPEG data URL for localStorage.
   * opts: { errorId, maxBytes }
   */
  function processImageFile(file, aspectRatio, maxWidth, cb, opts) {
    opts = opts || {};
    var errorId = opts.errorId || 'settings-error';
    var maxBytes = opts.maxBytes || 8 * 1024 * 1024;
    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      showError(errorId, 'Please choose an image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > maxBytes) {
      showError(errorId, 'Image must be under ' + formatMaxUploadLabel(maxBytes) + '.');
      return;
    }
    hideErrors();
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var srcW = img.naturalWidth;
        var srcH = img.naturalHeight;
        var srcAspect = srcW / srcH;
        var cropW;
        var cropH;
        var sx;
        var sy;
        if (srcAspect > aspectRatio) {
          cropH = srcH;
          cropW = srcH * aspectRatio;
          sx = (srcW - cropW) / 2;
          sy = 0;
        } else {
          cropW = srcW;
          cropH = srcW / aspectRatio;
          sx = 0;
          sy = (srcH - cropH) / 2;
        }
        var outW = Math.min(maxWidth, Math.round(cropW));
        var outH = Math.round(outW / aspectRatio);
        var canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        cb(dataUrl);
      };
      img.onerror = function () {
        showError(errorId, 'Could not read that image. Try another file.');
      };
      img.src = reader.result;
    };
    reader.onerror = function () {
      showError(errorId, 'Could not read that file.');
    };
    reader.readAsDataURL(file);
  }

  function syncImagePreview(kind, dataUrl) {
    var preview = document.getElementById(kind + '-preview');
    var placeholder = document.getElementById(kind + '-placeholder');
    var removeBtn = document.getElementById('btn-remove-' + kind);
    if (!preview) return;
    if (dataUrl) {
      preview.src = dataUrl;
      preview.classList.remove('hidden');
      if (placeholder) placeholder.classList.add('hidden');
      if (removeBtn) removeBtn.classList.remove('hidden');
    } else {
      preview.removeAttribute('src');
      preview.classList.add('hidden');
      if (placeholder) placeholder.classList.remove('hidden');
      if (removeBtn) removeBtn.classList.add('hidden');
    }
  }

  function clearImage(kind) {
    draft.settings[kind] = '';
    var input = document.getElementById('input-' + kind);
    if (input) input.value = '';
    syncImagePreview(kind, '');
    persist();
  }

  function bindImageUpload(kind, aspectRatio, maxWidth, maxBytes) {
    var input = document.getElementById('input-' + kind);
    var box = document.getElementById(kind + '-upload-box');
    var pickBtn = document.getElementById('btn-pick-' + kind);
    var removeBtn = document.getElementById('btn-remove-' + kind);
    var spec = IMAGE_SPECS[kind] || {};
    var ratio = aspectRatio != null ? aspectRatio : spec.aspectRatio || 1;
    var width = maxWidth != null ? maxWidth : spec.maxWidth || 1200;
    var bytes = maxBytes != null ? maxBytes : spec.maxBytes || 1 * 1024 * 1024;

    function openPicker() {
      input.click();
    }

    if (box) {
      box.addEventListener('click', function (e) {
        if (e.target === removeBtn || (removeBtn && removeBtn.contains(e.target))) return;
        openPicker();
      });
    }
    if (pickBtn) pickBtn.addEventListener('click', openPicker);
    if (removeBtn) {
      removeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        clearImage(kind);
      });
    }
    if (input) {
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        processImageFile(
          file,
          ratio,
          width,
          function (dataUrl) {
            draft.settings[kind] = dataUrl;
            syncImagePreview(kind, dataUrl);
            persist();
          },
          { errorId: 'settings-error', maxBytes: bytes }
        );
      });
    }
  }

  /* ---------- Events ---------- */

  function bindEvents() {
    document.getElementById('btn-send-otp').addEventListener('click', function () {
      if (!validateStep(1)) return;
      persist();
      advanceFrom(1);
    });

    document.getElementById('btn-verify-otp').addEventListener('click', function () {
      if (!validateStep(2)) return;
      persist();
      advanceFrom(2);
    });

    document.getElementById('btn-resend-otp').addEventListener('click', function () {
      if (resendSeconds > 0) return;
      startResendTimer(30);
    });

    document.querySelectorAll('[data-next]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        advanceFrom(draft.currentStep);
      });
    });

    document.querySelectorAll('[data-back]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (draft.currentStep > 1) goToStep(draft.currentStep - 1);
      });
    });

    document.getElementById('btn-add-category').addEventListener('click', function () {
      var input = document.getElementById('input-new-category');
      var name = (input.value || '').trim();
      if (!name) return;
      if (draft.categories.length >= 2) {
        showError('category-error', 'Maximum 2 categories.');
        return;
      }
      hideErrors();
      draft.categories.push({
        id: D.slugify(name),
        name: name,
        image: '',
        measurement: D.defaultMeasurementForBusiness(draft.businessType)
      });
      input.value = '';
      persist();
      renderCategoryGrid();
    });

    var bizSearch = document.getElementById('input-business-search');
    if (bizSearch) {
      bizSearch.addEventListener('input', function () {
        businessSearchQuery = (bizSearch.value || '').trim();
        renderBusinessGrid();
      });
      bizSearch.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          bizSearch.value = '';
          businessSearchQuery = '';
          renderBusinessGrid();
          bizSearch.blur();
        }
      });
    }
    var clearBizSearch = document.getElementById('btn-clear-business-search');
    if (clearBizSearch) {
      clearBizSearch.addEventListener('click', function () {
        if (bizSearch) bizSearch.value = '';
        businessSearchQuery = '';
        renderBusinessGrid();
        if (bizSearch) bizSearch.focus();
      });
    }
    var bizScroll = document.getElementById('business-scroll');
    if (bizScroll) {
      bizScroll.addEventListener('scroll', onBusinessScroll, { passive: true });
    }
    var loadMoreBiz = document.getElementById('btn-load-more-business');
    if (loadMoreBiz) {
      loadMoreBiz.addEventListener('click', function () {
        loadBusinessPage();
      });
    }

    ['input-store-name', 'input-tagline', 'input-location', 'input-whatsapp', 'input-instagram'].forEach(
      function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function () {
          var wrap = el.closest('.settings-field');
          if (wrap) {
            wrap.classList.remove('is-invalid');
            var err = wrap.querySelector('.field-error');
            if (err) err.textContent = '';
          }
          if (id === 'input-store-name') {
            draft.settings.storeName = el.value;
            if (!draft.slugCustom) applySuggestedShopLink();
            else syncShopLinkResetBtn();
          }
          if (id === 'input-tagline') draft.settings.tagline = el.value;
          if (id === 'input-location') draft.settings.location = el.value;
          if (id === 'input-whatsapp') {
            el.value = el.value.replace(/\D/g, '').slice(0, 10);
            draft.settings.whatsapp = el.value;
          }
          if (id === 'input-instagram') {
            var parsed = normalizeInstagramInput(el.value);
            draft.settings.instagramUrl = parsed.error ? '' : parsed.url;
          }
          persist();
          if (id === 'input-store-name' || id === 'input-tagline') renderPreview();
        });
        el.addEventListener('blur', function () {
          if (id === 'input-instagram' && el.value.trim()) {
            var parsed = normalizeInstagramInput(el.value);
            if (!parsed.error && parsed.handle) el.value = parsed.handle;
          }
        });
      }
    );

    var slugInput = document.getElementById('input-store-link');
    if (slugInput) {
      slugInput.addEventListener('input', function () {
        var wrap = slugInput.closest('.settings-field');
        if (wrap) {
          wrap.classList.remove('is-invalid');
          var err = wrap.querySelector('.field-error');
          if (err) err.textContent = '';
        }
        var next = D.normalizeStoreSlug
          ? D.normalizeStoreSlug(slugInput.value, { keepTrailing: true })
          : slugInput.value.toLowerCase();
        if (slugInput.value !== next) {
          var start = slugInput.selectionStart;
          slugInput.value = next;
          if (typeof start === 'number') {
            slugInput.setSelectionRange(Math.min(start, next.length), Math.min(start, next.length));
          }
        }
        draft.slugCustom = true;
        draft.slug = D.normalizeStoreSlug ? D.normalizeStoreSlug(next) : D.slugify(next);
        syncShopLinkResetBtn();
        persist();
      });
      slugInput.addEventListener('blur', function () {
        var cleaned = D.normalizeStoreSlug
          ? D.normalizeStoreSlug(slugInput.value)
          : D.slugify(slugInput.value);
        slugInput.value = cleaned;
        draft.slug = cleaned;
        persist();
      });
    }

    var slugReset = document.getElementById('btn-slug-from-name');
    if (slugReset) {
      slugReset.addEventListener('click', function () {
        draft.slugCustom = false;
        applySuggestedShopLink();
        persist();
        if (slugInput) slugInput.focus();
      });
    }

    bindTaglineModal();

    ['del-pickup', 'del-home', 'del-courier'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () {
        readDeliveryFromForm();
        updateDeliveryExtras();
        persist();
      });
    });
    ['del-home-charge', 'del-courier-charge'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        readDeliveryFromForm();
        persist();
      });
    });

    ['pay-upi', 'pay-bank', 'pay-cod'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () {
        readPaymentFromForm();
        updatePaymentExtras();
        persist();
      });
    });
    [
      'pay-upi-id',
      'pay-upi-name',
      'pay-bank-name',
      'pay-bank-number',
      'pay-bank-ifsc',
      'pay-bank-bank'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        readPaymentFromForm();
        persist();
      });
    });

    var themeInput = document.getElementById('input-theme-color');
    if (themeInput) {
      themeInput.addEventListener('input', function () {
        applyBrandSettings({ themeColor: themeInput.value });
        persist();
        renderPreview();
      });
    }

    var accentInput = document.getElementById('input-accent-color');
    if (accentInput) {
      accentInput.addEventListener('input', function () {
        applyBrandSettings({ accentColor: accentInput.value });
        persist();
        renderPreview();
      });
    }

    var bgInput = document.getElementById('input-bg-color');
    if (bgInput) {
      bgInput.addEventListener('input', function () {
        applyBrandSettings({ backgroundColor: bgInput.value });
        persist();
        renderPreview();
      });
    }

    bindImageUpload('logo');
    bindImageUpload('banner');

    document.getElementById('input-phone').addEventListener('input', function (e) {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    });

    document.getElementById('btn-copy-url').addEventListener('click', function () {
      copyStoreLink({
        button: document.getElementById('btn-copy-url'),
        hint: 'Link copied — paste it in WhatsApp or your Instagram bio.'
      });
    });

    var bioBtn = document.getElementById('btn-copy-for-bio');
    if (bioBtn) {
      bioBtn.addEventListener('click', function () {
        copyStoreLink({
          button: bioBtn,
          tip: 'instagram',
          doneLabel: 'Copied for bio!',
          hint: 'Paste this in Instagram → Edit profile → Website / Bio.'
        });
      });
    }

    var previewBtn = document.getElementById('btn-view-store');
    if (previewBtn) {
      previewBtn.addEventListener('click', function () {
        markShareTipDone('preview');
      });
    }

    var waShare = document.getElementById('share-whatsapp');
    if (waShare) {
      waShare.addEventListener('click', function () {
        markShareTipDone('whatsapp');
      });
    }

    var qrBtn = document.getElementById('btn-download-qr');
    if (qrBtn) {
      qrBtn.addEventListener('click', function () {
        var src = window.__obQrSrc;
        if (!src && D && typeof D.qrImageUrl === 'function') {
          var view = document.getElementById('btn-view-store');
          src = D.qrImageUrl((view && view.getAttribute('href')) || 'store.html', 200);
          window.__obQrSrc = src;
        }
        if (!src || !D || typeof D.downloadQrImage !== 'function') return;
        var safe = String(window.__obQrName || 'shop')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        D.downloadQrImage(src, (safe || 'shop') + '-qr.png');
        markShareTipDone('instagram');
      });
    }

    var featToggle = document.getElementById('btn-toggle-features');
    var featList = document.getElementById('plan-features');
    if (featToggle && featList) {
      featToggle.addEventListener('click', function () {
        var open = featList.hidden;
        featList.hidden = !open;
        featList.classList.toggle('is-collapsed', !open);
        featToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        featToggle.textContent = open ? 'Hide included' : 'What’s included';
      });
    }

    var dashBtn = document.getElementById('btn-go-dashboard');
    if (dashBtn && !dashBtn.dataset.bound) {
      dashBtn.dataset.bound = '1';
      dashBtn.addEventListener('click', function (e) {
        if (dashBtn.getAttribute('data-pending') === 'true' || dashBtn.getAttribute('href') === '#') {
          e.preventDefault();
          dashBtn.classList.add('is-pending-hint');
          var note = document.getElementById('success-note');
          if (note) {
            note.textContent =
              'Dashboard opens here once the vendor app URL is returned by the publish API. Share your shop link anytime — Free plan stays active.';
          }
        }
      });
    }

    function loadDemoData() {
      draft = D.seedPickleDraft();
      draft.currentStep = 1;
      draft.maxReachedStep = TOTAL_STEPS;
      persist();
      renderStepper();
      showPanel(1);
      syncStepForm(1);
    }

    ['btn-load-demo', 'btn-load-demo-mobile'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', loadDemoData);
    });
  }

  /* ---------- Init ---------- */

  function init() {
    if (!draft.currentStep) draft.currentStep = 1;
    if (!draft.maxReachedStep) draft.maxReachedStep = 1;
    // Migrate drafts saved against the previous 8-step flow
    if (draft.maxReachedStep === 8 && draft.settings && draft.settings.storeName) {
      if (draft.currentStep === 7) draft.currentStep = 9;
      else if (draft.currentStep === 8) draft.currentStep = 10;
      draft.maxReachedStep = TOTAL_STEPS;
    }
    if (draft.currentStep > TOTAL_STEPS) draft.currentStep = TOTAL_STEPS;
    if (draft.maxReachedStep > TOTAL_STEPS) draft.maxReachedStep = TOTAL_STEPS;
    bindEvents();
    applyBrandSettings({});
    renderStepper();
    showPanel(draft.currentStep);
    syncStepForm(draft.currentStep);
    updateSummary();
    renderPreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
