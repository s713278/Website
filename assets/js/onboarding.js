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
    { n: 5, label: 'Add Products', time: '3 min' },
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
      if (!/^\d{6}$/.test(otp)) {
        showError('otp-error', 'Enter the 6-digit OTP.');
        return false;
      }
      draft.verified = true;
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
        showError('product-error', 'Add at least one product in your selected categories.');
        return false;
      }
      var empty = visibleProducts.some(function (p) {
        return !String(p.name || '').trim();
      });
      if (empty) {
        showError('product-error', 'Every product needs a name.');
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
          if (!String(v.label || '').trim() || !(Number(v.price) > 0)) return true;
          if (!(Number(v.mrp) > 0)) return true;
          if (Number(v.mrp) < Number(v.price)) return true;
          return false;
        });
      });
      if (bad) {
        showError('sku-error', 'Each SKU needs label, selling price, and MRP (≥ selling price).');
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
      var name = (document.getElementById('input-store-name').value || '').trim();
      var tagline = (document.getElementById('input-tagline').value || '').trim();
      var location = (document.getElementById('input-location').value || '').trim();
      var wa = (document.getElementById('input-whatsapp').value || '').replace(/\D/g, '');
      if (!name) {
        showError('settings-error', 'Store name is required.');
        return false;
      }
      if (!/^\d{10}$/.test(wa)) {
        showError('settings-error', 'Enter a valid 10-digit WhatsApp number.');
        return false;
      }
      draft.settings.storeName = name;
      draft.settings.tagline = tagline;
      draft.settings.location = location;
      draft.settings.whatsapp = wa;
      draft.settings.themeColor =
        (document.getElementById('input-theme-color') &&
          document.getElementById('input-theme-color').value) ||
        draft.settings.themeColor ||
        '#10b981';
      draft.slug = D.slugify(name);
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
      document.getElementById('input-store-name').value = draft.settings.storeName || '';
      document.getElementById('input-tagline').value = draft.settings.tagline || '';
      document.getElementById('input-location').value = draft.settings.location || '';
      document.getElementById('input-whatsapp').value = draft.settings.whatsapp || draft.phone || '';
      syncImagePreview('logo', draft.settings.logo);
      syncImagePreview('banner', draft.settings.banner);
      syncThemePanel();
    }
    if (step === 10) finalizeLive();
  }

  /* ---------- Step 1–2 OTP ---------- */

  function buildOtpInputs() {
    var row = document.getElementById('otp-inputs');
    row.innerHTML = '';
    for (var i = 0; i < 6; i++) {
      var input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.maxLength = 1;
      input.className = 'otp-input';
      input.setAttribute('aria-label', 'Digit ' + (i + 1));
      input.dataset.idx = String(i);
      input.addEventListener('input', onOtpInput);
      input.addEventListener('keydown', onOtpKeydown);
      input.addEventListener('paste', onOtpPaste);
      row.appendChild(input);
    }
  }

  function onOtpInput(e) {
    var v = e.target.value.replace(/\D/g, '').slice(0, 1);
    e.target.value = v;
    if (v && e.target.nextElementSibling) e.target.nextElementSibling.focus();
  }

  function onOtpKeydown(e) {
    if (e.key === 'Backspace' && !e.target.value && e.target.previousElementSibling) {
      e.target.previousElementSibling.focus();
    }
  }

  function onOtpPaste(e) {
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
    var inputs = document.querySelectorAll('.otp-input');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].value = text[i] || '';
    }
  }

  function getOtpValue() {
    return Array.prototype.map
      .call(document.querySelectorAll('.otp-input'), function (i) {
        return i.value;
      })
      .join('');
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
          var cats = D.categoriesForBusiness(id);
          if (cats.length) draft.categories = cats.slice(0, Math.min(2, cats.length));
          if (!draft.products.length && id === 'pickles') {
            var seed = D.seedPickleDraft();
            draft.products = seed.products;
            draft.categories = seed.categories;
            if (!draft.settings.storeName) {
              draft.settings.storeName = seed.settings.storeName;
              draft.settings.tagline = seed.settings.tagline;
              draft.settings.location = seed.settings.location;
            }
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
          draft.categories.splice(existing, 1);
        } else {
          if (draft.categories.length >= 2) {
            showError('category-error', 'Maximum 2 categories. Deselect one first.');
            return;
          }
          hideErrors();
          var cat =
            available.find(function (c) { return c.id === id; }) ||
            { id: id, name: id, image: '' };
          draft.categories.push({ id: cat.id, name: cat.name, image: cat.image || '' });
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

  function sampleProductNames(categoryName) {
    var base = String(categoryName || 'Item').replace(/\s+/g, ' ').trim();
    return [base + ' Special', 'Homemade ' + base];
  }

  function ensureSampleProducts() {
    var cats = draft.categories || [];
    var seeded = false;
    cats.forEach(function (cat) {
      var existing = productsForCategory(cat.id);
      if (existing.length) return;
      var names = sampleProductNames(cat.name);
      // One starter item per category — vendors add more as needed
      names.slice(0, 1).forEach(function (name, idx) {
        var color = D.PRODUCT_COLORS[(draft.products.length + idx) % D.PRODUCT_COLORS.length];
        draft.products.push({
          id: D.uid('prod'),
          name: name,
          image: '',
          color: color,
          order: draft.products.length,
          categoryId: cat.id,
          variants: [{ id: D.uid('sku'), label: '250g', price: 199, mrp: 249, active: true }]
        });
        seeded = true;
      });
    });
    if (seeded) {
      reindexProducts();
      persist();
    }
  }

  function productRowHtml(p) {
    var hasImg = !!p.image;
    return (
      '<div class="product-card" draggable="true" data-pid="' +
      p.id +
      '" data-cat="' +
      escapeAttr(p.categoryId || '') +
      '">' +
      '<span class="drag-handle" title="Drag to reorder" aria-hidden="true">⠿</span>' +
      '<div class="product-media">' +
      '<label class="product-thumb-upload' +
      (hasImg ? ' has-image' : '') +
      '" style="--thumb-bg:' +
      (p.color || '#ecfdf5') +
      '" title="Upload product photo">' +
      '<input type="file" class="sr-only product-image-input" data-pid="' +
      p.id +
      '" accept="image/png,image/jpeg,image/webp,image/gif">' +
      (hasImg
        ? '<img src="' +
          p.image +
          '" class="product-thumb-img" alt="' +
          escapeAttr(p.name || 'Product photo') +
          '">'
        : '<span class="product-thumb-icon" aria-hidden="true">🫙</span>') +
      '<span class="product-thumb-overlay">' +
      (hasImg ? 'Change' : 'Photo') +
      '</span>' +
      '</label>' +
      (hasImg
        ? '<button type="button" class="product-thumb-remove btn-remove-product-image" data-pid="' +
          p.id +
          '" aria-label="Remove photo">✕</button>'
        : '') +
      '</div>' +
      '<div class="product-fields">' +
      '<input type="text" class="md-field product-name-input" data-pid="' +
      p.id +
      '" value="' +
      escapeAttr(p.name) +
      '" placeholder="Product name" aria-label="Product name">' +
      '</div>' +
      '<button type="button" class="product-delete btn-del-product" data-pid="' +
      p.id +
      '" aria-label="Delete product">🗑</button>' +
      '</div>'
    );
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

  function renderProductList() {
    var list = document.getElementById('product-list');
    var cats = draft.categories || [];
    ensureSampleProducts();
    ensureExpandedProductCat(cats);

    if (!cats.length) {
      list.innerHTML =
        '<p class="text-sm text-amber-600 text-center py-6">Select categories in the previous step to add products.</p>';
      return;
    }

    list.innerHTML =
      '<div class="ob-cat-stack" role="list">' +
      cats
        .map(function (cat) {
          var items = productsForCategory(cat.id);
          var open = cat.id === expandedProductCatId;
          var withPhoto = items.filter(function (p) {
            return !!p.image;
          }).length;
          var status =
            items.length === 0
              ? 'Empty — tap to add'
              : withPhoto === items.length
                ? 'Ready'
                : withPhoto
                  ? withPhoto + '/' + items.length + ' photos'
                  : items.length + (items.length === 1 ? ' item' : ' items');
          var rows = items.length
            ? items.map(productRowHtml).join('')
            : '<p class="ob-cat-empty">No products yet — add your first item.</p>';
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
            items.length +
            '</span>' +
            '</button>' +
            '<div class="ob-cat-body"' +
            (open ? '' : ' hidden') +
            '>' +
            '<div class="category-product-rows" data-cat="' +
            escapeAttr(cat.id) +
            '">' +
            rows +
            '</div>' +
            '<button type="button" class="btn-add-product-cat" data-cat="' +
            escapeAttr(cat.id) +
            '">+ Add product</button>' +
            '</div>' +
            '</div>'
          );
        })
        .join('') +
      '</div>' +
      (!expandedProductCatId
        ? '<p class="ob-cat-nudge">Tap a category to open it and edit products.</p>'
        : '');

    bindProductListEvents(list);
  }

  function bindProductListEvents(list) {
    list.querySelectorAll('[data-cat-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-cat-toggle');
        expandedProductCatId = expandedProductCatId === id ? null : id;
        renderProductList();
      });
    });

    list.querySelectorAll('.product-name-input').forEach(function (input) {
      input.addEventListener('input', function () {
        var p = findProduct(input.dataset.pid);
        if (p) {
          p.name = input.value;
          persist();
        }
      });
    });

    list.querySelectorAll('.btn-del-product').forEach(function (btn) {
      btn.addEventListener('click', function () {
        draft.products = draft.products.filter(function (p) {
          return p.id !== btn.dataset.pid;
        });
        reindexProducts();
        persist();
        renderProductList();
      });
    });

    list.querySelectorAll('.btn-add-product-cat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var catId = btn.getAttribute('data-cat');
        expandedProductCatId = catId;
        addProduct(catId);
      });
    });

    list.querySelectorAll('.product-image-input').forEach(function (input) {
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        var pid = input.dataset.pid;
        if (!file || !pid) return;
        processImageFile(
          file,
          1,
          800,
          function (dataUrl) {
            var p = findProduct(pid);
            if (!p) return;
            p.image = dataUrl;
            if (p.categoryId) expandedProductCatId = p.categoryId;
            persist();
            renderProductList();
          },
          {
            errorId: 'product-error',
            maxBytes: 5 * 1024 * 1024
          }
        );
      });
    });

    list.querySelectorAll('.btn-remove-product-image').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var p = findProduct(btn.dataset.pid);
        if (!p) return;
        p.image = '';
        if (p.categoryId) expandedProductCatId = p.categoryId;
        persist();
        renderProductList();
      });
    });

    list.querySelectorAll('.product-card').forEach(function (row) {
      row.addEventListener('dragstart', function (e) {
        if (e.target && e.target.closest && e.target.closest('input,button,label,textarea')) {
          e.preventDefault();
          return;
        }
        dragSrcId = row.dataset.pid;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', function () {
        row.classList.remove('dragging');
        dragSrcId = null;
      });
      row.addEventListener('dragover', function (e) {
        e.preventDefault();
      });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        var targetId = row.dataset.pid;
        if (!dragSrcId || dragSrcId === targetId) return;
        var src = findProduct(dragSrcId);
        var target = findProduct(targetId);
        if (!src || !target || src.categoryId !== target.categoryId) return;
        var catId = src.categoryId;
        expandedProductCatId = catId;
        var catProducts = productsForCategory(catId);
        var from = catProducts.findIndex(function (p) {
          return p.id === dragSrcId;
        });
        var to = catProducts.findIndex(function (p) {
          return p.id === targetId;
        });
        if (from < 0 || to < 0) return;
        var ordered = catProducts.slice();
        var item = ordered.splice(from, 1)[0];
        ordered.splice(to, 0, item);
        var others = draft.products.filter(function (p) {
          return p.categoryId !== catId;
        });
        draft.products = others.concat(ordered);
        reindexProducts();
        persist();
        renderProductList();
      });
    });
  }

  function reindexProducts() {
    // Keep category-relative order stable: sort by category order then current order
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
      return p.id === id;
    });
  }

  function addProduct(categoryId) {
    var catId = categoryId || (draft.categories[0] && draft.categories[0].id) || '';
    if (!catId) {
      showError('product-error', 'Select a category first.');
      return;
    }
    var cat = (draft.categories || []).find(function (c) {
      return c.id === catId;
    });
    var color = D.PRODUCT_COLORS[draft.products.length % D.PRODUCT_COLORS.length];
    var count = productsForCategory(catId).length + 1;
    draft.products.push({
      id: D.uid('prod'),
      name: (cat && cat.name ? cat.name + ' ' : 'Product ') + count,
      image: '',
      color: color,
      order: draft.products.length,
      categoryId: catId,
      variants: [{ id: D.uid('sku'), label: '250g', price: 199, mrp: 249, active: true }]
    });
    reindexProducts();
    persist();
    renderProductList();
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
      editor.innerHTML = '<p class="text-sm text-gray-400 text-center py-6">Add products in the previous step first.</p>';
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

    function skuBlockHtml(p) {
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
            '<input type="text" class="sku-label" value="' +
            escapeAttr(v.label) +
            '" placeholder="Size">' +
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
        '<h3 class="font-semibold text-gray-800 text-sm">' +
        escapeHtml(p.name || 'Untitled') +
        '</h3>' +
        '<button type="button" class="text-sm text-emerald-700 font-medium btn-add-sku" data-pid="' +
        p.id +
        '">+ Size</button>' +
        '</div>' +
        '<div class="sku-headers">' +
        '<span>Size</span><span>Price</span><span>MRP</span><span class="sku-toggle-label">On</span><span></span>' +
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
      row.querySelector('.sku-label').addEventListener('input', function (e) {
        updateVariant(pid, vid, 'label', e.target.value);
      });
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
        p.variants.push({ id: D.uid('sku'), label: '', price: '', mrp: '', active: true });
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
    var hex = D.applyTheme
      ? D.applyTheme(color)
      : normalizeHex(color);
    draft.settings.themeColor = hex;
    var input = document.getElementById('input-theme-color');
    var hexLabel = document.getElementById('theme-color-hex');
    var chip = document.getElementById('theme-live-chip');
    if (input) input.value = hex;
    if (hexLabel) hexLabel.textContent = hex;
    if (chip) {
      chip.style.background = hex;
      chip.style.color = '#fff';
    }
    document.querySelectorAll('.theme-swatch').forEach(function (btn) {
      btn.classList.toggle('selected', normalizeHex(btn.getAttribute('data-color')) === hex);
    });
  }

  function syncThemePanel() {
    var presets = D.THEME_PRESETS || [];
    var el = document.getElementById('theme-swatches');
    if (el && !el.dataset.ready) {
      el.innerHTML = presets
        .map(function (t) {
          return (
            '<button type="button" class="theme-swatch" data-color="' +
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
          applyThemeColor(btn.getAttribute('data-color'));
          persist();
        });
      });
    }
    applyThemeColor(draft.settings.themeColor || '#10b981');
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
    draft.slug = D.slugify(draft.settings.storeName);
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

    document.getElementById('store-url-display').textContent = displayUrl;
    var viewBtn = document.getElementById('btn-view-store');
    if (viewBtn) viewBtn.href = sub.storefrontUrl || storeHref;

    renderSuccessPanel(sub);

    var storeName = (draft.settings && draft.settings.storeName) || 'my store';
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

  /* ---------- Live preview ---------- */

  function renderPreview() {
    var root = document.getElementById('phone-preview');
    var theme = normalizeHex(draft.settings.themeColor || '#10b981');
    applyThemeColor(theme);
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
              '<div class="text-[10px] text-gray-600 truncate">' +
              escapeHtml(c.name) +
              '</div></div>'
            );
          })
          .join('')
      : '<p class="text-[10px] text-gray-400 px-2">Categories will show here</p>';

    var prodHtml = products.length
      ? products
          .map(function (p) {
            var from = D.minPrice(p);
            var thumb = p.image
              ? '<img src="' +
                p.image +
                '" alt="" class="w-full h-full object-cover">'
              : '🫙';
            return (
              '<div class="preview-product-card">' +
              '<div class="preview-product-img" style="background:' +
              (p.color || hexToRgba(theme, 0.12)) +
              '">' +
              thumb +
              '</div>' +
              '<div class="p-1.5">' +
              '<div class="text-[11px] font-semibold text-gray-800 truncate">' +
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
      : '<p class="text-[10px] text-gray-400 col-span-2">Products will appear here</p>';

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
      '<div class="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-gray-700">' +
      '<span class="text-lg leading-none">☰</span>' +
      headerLogo +
      '<div class="flex gap-2 text-sm"><span>🔍</span><span>🛒<sup class="text-[9px]" style="color:' +
      theme +
      '">0</sup></span></div>' +
      '</div>' +
      '<div class="preview-hero' + (banner ? ' has-banner' : '') + '">' +
      heroBg +
      '<div class="font-bold text-sm leading-tight">' +
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
      '<div class="text-[11px] font-semibold text-gray-700 mb-1.5">Categories</div>' +
      '<div class="flex gap-2 overflow-x-auto pb-1">' +
      catHtml +
      '</div></div>' +
      '<div class="px-3 py-2">' +
      '<div class="text-[11px] font-semibold text-gray-700 mb-1.5">Our Products</div>' +
      '<div class="grid grid-cols-2 gap-2">' +
      prodHtml +
      '</div></div>' +
      '<div class="px-3 py-2 border-t border-gray-100">' +
      '<div class="text-[10px] text-gray-500"><span class="font-semibold text-gray-600">Delivery:</span> ' +
      escapeHtml(delBits.length ? delBits.join(' · ') : 'Not set') +
      '</div>' +
      '<div class="text-[10px] text-gray-500 mt-0.5"><span class="font-semibold text-gray-600">Pay:</span> ' +
      escapeHtml(payBits.length ? payBits.join(' · ') : 'Not set') +
      '</div>' +
      '</div>' +
      '<div class="px-3 py-3 border-t border-gray-100 mt-1" style="background:' +
      hexToRgba(theme, 0.06) +
      '">' +
      '<div class="grid grid-cols-2 gap-1 text-[9px] text-gray-500 text-center">' +
      '<span>🌿 100% Homemade</span><span>🚫 No Preservatives</span>' +
      '<span>🧼 Hygienically Packed</span><span>' +
      (pay.cod && pay.cod.enabled ? '💵 COD Available' : '💳 Online Pay') +
      '</span>' +
      '</div>' +
      '<p class="text-center text-[9px] text-gray-400 mt-2">Powered by MithraDirect</p>' +
      '</div>';
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
      showError(
        errorId,
        'Image must be under ' + Math.round(maxBytes / (1024 * 1024)) + ' MB.'
      );
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

  function bindImageUpload(kind, aspectRatio, maxWidth) {
    var input = document.getElementById('input-' + kind);
    var box = document.getElementById(kind + '-upload-box');
    var pickBtn = document.getElementById('btn-pick-' + kind);
    var removeBtn = document.getElementById('btn-remove-' + kind);

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
        processImageFile(file, aspectRatio, maxWidth, function (dataUrl) {
          draft.settings[kind] = dataUrl;
          syncImagePreview(kind, dataUrl);
          persist();
        });
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
      draft.categories.push({ id: D.slugify(name), name: name, image: '' });
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

    ['input-store-name', 'input-tagline', 'input-location', 'input-whatsapp'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        if (id === 'input-store-name') draft.settings.storeName = el.value;
        if (id === 'input-tagline') draft.settings.tagline = el.value;
        if (id === 'input-location') draft.settings.location = el.value;
        if (id === 'input-whatsapp') draft.settings.whatsapp = el.value.replace(/\D/g, '').slice(0, 10);
        draft.slug = D.slugify(draft.settings.storeName);
        persist();
      });
    });

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
        applyThemeColor(themeInput.value);
        persist();
      });
    }

    bindImageUpload('logo', 1, 400);
    bindImageUpload('banner', 16 / 9, 1280);

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
    applyThemeColor((draft.settings && draft.settings.themeColor) || '#10b981');
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
