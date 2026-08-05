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
    { n: 1, label: 'Verify Mobile', time: '1 min', short: 'Mobile' },
    { n: 2, label: 'Enter OTP', time: '1 min', short: 'OTP' },
    { n: 3, label: 'Choose Business', time: '1 min', short: 'Business' },
    { n: 4, label: 'Pick Categories', time: '1 min', short: 'Categories' },
    { n: 5, label: 'Add Products', time: '3 min', short: 'Products' },
    { n: 6, label: 'Add Variants', time: '2 min', short: 'Variants' },
    { n: 7, label: 'Delivery', time: '1 min', short: 'Delivery' },
    { n: 8, label: 'Payments', time: '1 min', short: 'Payments' },
    { n: 9, label: 'Store Settings', time: '1 min', short: 'Settings' },
    { n: 10, label: 'Store Live!', time: '1 min', short: 'Live' }
  ];

  var PHASES = [
    { id: 'account', label: 'Account', desc: 'Mobile, email & verification.', from: 1, to: 2 },
    { id: 'catalog', label: 'Catalog', desc: 'Add products & categories.', from: 3, to: 6 },
    { id: 'delivery', label: 'Delivery & Pay', desc: 'Shipping & payment methods.', from: 7, to: 8 },
    { id: 'golive', label: 'Go Live', desc: 'Review & publish your store.', from: 9, to: 10 }
  ];

  var TOTAL_STEPS = 10;

  var draft = D.loadDraft();
  var resendSeconds = 0;
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

  function bindGotoButtons(root) {
    if (!root) return;
    root.querySelectorAll('[data-goto]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var n = Number(btn.getAttribute('data-goto'));
        if (n <= draft.maxReachedStep) goToStep(n);
      });
    });
  }

  function renderSidebarProgress() {
    var current = draft.currentStep || 1;
    var pct = Math.round((current / TOTAL_STEPS) * 100);

    var progressText = document.getElementById('ob-progress-text');
    if (progressText) {
      progressText.textContent = 'Step ' + current + ' of ' + TOTAL_STEPS + ' completed';
    }

    var progressFill = document.getElementById('ob-progress-fill');
    if (progressFill) progressFill.style.width = pct + '%';

    var eyebrow = document.getElementById('ob-step-eyebrow');
    if (eyebrow) eyebrow.textContent = 'Step ' + current + ' of ' + TOTAL_STEPS;

    var phaseList = document.getElementById('ob-phase-list');
    if (phaseList) {
      phaseList.innerHTML = PHASES.map(function (phase, idx) {
        var cls = 'ob-phase';
        var reachable = draft.maxReachedStep >= phase.from;
        var done = current > phase.to;
        var active = current >= phase.from && current <= phase.to;
        if (done) cls += ' done';
        if (active) cls += ' active';
        if (reachable) cls += ' reachable';
        var icon = done ? '✓' : String(idx + 1);
        return (
          '<button type="button" class="' +
          cls +
          '" data-goto="' +
          phase.from +
          '" ' +
          (reachable ? '' : 'disabled') +
          '>' +
          '<span class="ob-phase-icon">' +
          icon +
          '</span>' +
          '<span class="ob-phase-copy">' +
          '<span class="ob-phase-title">' +
          phase.label +
          '</span>' +
          '<span class="ob-phase-desc">' +
          phase.desc +
          '</span>' +
          '</span>' +
          '</button>'
        );
      }).join('');
      bindGotoButtons(phaseList);
    }

    var stepList = document.getElementById('ob-step-list');
    if (stepList) {
      stepList.innerHTML = STEPS.map(function (s) {
        var cls = 'ob-step-item';
        if (s.n === current) cls += ' active';
        else if (s.n < current) cls += ' done';
        if (s.n <= draft.maxReachedStep) cls += ' reachable';
        var numContent = s.n < current ? '✓' : String(s.n);
        var meta = s.n < current ? '✓' : s.time;
        return (
          '<button type="button" class="' +
          cls +
          '" data-goto="' +
          s.n +
          '" ' +
          (s.n <= draft.maxReachedStep ? '' : 'disabled') +
          '>' +
          '<span class="ob-step-num">' +
          numContent +
          '</span>' +
          '<span class="ob-step-label">' +
          (s.short || s.label) +
          '</span>' +
          '<span class="ob-step-time">' +
          meta +
          '</span>' +
          '</button>'
        );
      }).join('');
      bindGotoButtons(stepList);
    }
  }

  function renderStepper() {
    var el = document.getElementById('stepper');
    if (!el) return;
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

    bindGotoButtons(el);
    renderSidebarProgress();
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
    if (step === 3) renderBusinessGrid();
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

  function renderBusinessGrid() {
    var grid = document.getElementById('business-grid');
    grid.innerHTML = D.BUSINESS_TYPES.map(function (b) {
      var sel = draft.businessType === b.id ? ' selected' : '';
      return (
        '<button type="button" class="select-card' +
        sel +
        '" data-biz="' +
        b.id +
        '">' +
        '<span class="check">✓</span>' +
        '<div class="icon-emoji">' +
        b.icon +
        '</div>' +
        '<div class="text-sm font-semibold text-gray-800">' +
        b.label +
        '</div>' +
        '</button>'
      );
    }).join('');

    grid.querySelectorAll('[data-biz]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-biz');
        var changed = draft.businessType !== id;
        draft.businessType = id;
        if (changed) {
          draft.categories = [];
          // Soft-seed default categories for pickles demo feel
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
        persist();
        renderBusinessGrid();
      });
    });
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

  function productRowHtml(p) {
    return (
      '<div class="product-row" draggable="true" data-pid="' +
      p.id +
      '" data-cat="' +
      escapeAttr(p.categoryId || '') +
      '">' +
      '<span class="drag-handle" title="Drag to reorder">⠿</span>' +
      '<div class="product-thumb" style="background:' +
      (p.color || '#ecfdf5') +
      '">' +
      (p.image ? '<img src="' + p.image + '" class="w-full h-full object-cover rounded-lg" alt="">' : '🫙') +
      '</div>' +
      '<input type="text" class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm product-name-input" data-pid="' +
      p.id +
      '" value="' +
      escapeAttr(p.name) +
      '" placeholder="Product name">' +
      '<button type="button" class="text-red-400 hover:text-red-600 p-2 btn-del-product" data-pid="' +
      p.id +
      '" aria-label="Delete">🗑</button>' +
      '</div>'
    );
  }

  function renderProductList() {
    var list = document.getElementById('product-list');
    var cats = draft.categories || [];

    if (!cats.length) {
      list.innerHTML =
        '<p class="text-sm text-amber-600 text-center py-6">Select categories in the previous step to add products.</p>';
      return;
    }

    list.innerHTML = cats
      .map(function (cat) {
        var items = productsForCategory(cat.id);
        var rows = items.length
          ? items.map(productRowHtml).join('')
          : '<p class="text-sm text-gray-400 py-2">No products in this category yet.</p>';
        return (
          '<div class="category-product-block mb-6" data-cat-block="' +
          escapeAttr(cat.id) +
          '">' +
          '<div class="flex items-center justify-between mb-3">' +
          '<h3 class="font-semibold text-gray-800 flex items-center gap-2">' +
          '<span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-sm">📦</span>' +
          escapeHtml(cat.name) +
          '<span class="text-xs font-normal text-gray-400">(' +
          items.length +
          ')</span>' +
          '</h3>' +
          '</div>' +
          '<div class="category-product-rows" data-cat="' +
          escapeAttr(cat.id) +
          '">' +
          rows +
          '</div>' +
          '<button type="button" class="btn-add-product-cat mt-2 w-full border-2 border-dashed border-emerald-200 text-emerald-700 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-50 transition" data-cat="' +
          escapeAttr(cat.id) +
          '">+ Add Product to ' +
          escapeHtml(cat.name) +
          '</button>' +
          '</div>'
        );
      })
      .join('');

    bindProductListEvents(list);
  }

  function bindProductListEvents(list) {
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
        addProduct(btn.getAttribute('data-cat'));
      });
    });

    list.querySelectorAll('.product-row').forEach(function (row) {
      row.addEventListener('dragstart', function (e) {
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
        // Rebuild products: keep other categories, replace this category's order
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
    var color = D.PRODUCT_COLORS[draft.products.length % D.PRODUCT_COLORS.length];
    draft.products.push({
      id: D.uid('prod'),
      name: '',
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
        '<div class="flex items-center justify-between mb-3">' +
        '<h3 class="font-semibold text-gray-800">' +
        escapeHtml(p.name || 'Untitled') +
        '</h3>' +
        '<button type="button" class="text-sm text-emerald-700 font-medium btn-add-sku" data-pid="' +
        p.id +
        '">+ Add SKU</button>' +
        '</div>' +
        '<div class="sku-headers">' +
        '<span>Label</span><span>Price (₹)</span><span>MRP (₹)</span><span class="sku-toggle-label">Active</span><span></span>' +
        '</div>' +
        rows +
        '</div>'
      );
    }

    if (cats.length) {
      editor.innerHTML = cats
        .map(function (cat) {
          var items = visible.filter(function (p) {
            return p.categoryId === cat.id;
          });
          if (!items.length) {
            return (
              '<div class="mb-4">' +
              '<h3 class="text-sm font-semibold text-gray-500 mb-2">' +
              escapeHtml(cat.name) +
              '</h3>' +
              '<p class="text-sm text-gray-400 mb-4">No products in this category.</p>' +
              '</div>'
            );
          }
          return (
            '<div class="mb-6">' +
            '<h3 class="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-3">' +
            escapeHtml(cat.name) +
            '</h3>' +
            items.map(skuBlockHtml).join('') +
            '</div>'
          );
        })
        .join('');
    } else {
      editor.innerHTML = visible.map(skuBlockHtml).join('');
    }

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
    var c = String(color || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(c)) {
      return ('#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toLowerCase();
    }
    return '#10b981';
  }

  function hexToRgba(hex, alpha) {
    var h = normalizeHex(hex).slice(1);
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function mixHex(hex, target, weight) {
    var h = normalizeHex(hex).slice(1);
    var t = normalizeHex(target).slice(1);
    var w = Math.max(0, Math.min(1, Number(weight) || 0));
    var channels = [0, 2, 4].map(function (i) {
      var a = parseInt(h.slice(i, i + 2), 16);
      var b = parseInt(t.slice(i, i + 2), 16);
      var v = Math.round(a * (1 - w) + b * w);
      return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
    });
    return '#' + channels.join('');
  }

  function applyThemeColor(color) {
    var hex = normalizeHex(color);
    draft.settings.themeColor = hex;
    var root = document.documentElement;
    root.style.setProperty('--store-theme', hex);
    root.style.setProperty('--store-theme-soft', hexToRgba(hex, 0.12));
    root.style.setProperty('--store-theme-soft-strong', hexToRgba(hex, 0.18));
    root.style.setProperty('--store-theme-border', hexToRgba(hex, 0.38));
    root.style.setProperty('--store-theme-dark', mixHex(hex, '#000000', 0.28));
    root.style.setProperty('--store-theme-ring', hexToRgba(hex, 0.22));
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

  function finalizeLive() {
    draft.slug = D.slugify(draft.settings.storeName);
    persist();
    if (window.StoreAPI && typeof window.StoreAPI.publishFromDraft === 'function') {
      window.StoreAPI.publishFromDraft(draft);
    }
    var displayUrl = 'mithradirect.com/store/' + draft.slug;
    document.getElementById('store-url-display').textContent = displayUrl;
    var storeHref = 'store.html?slug=' + encodeURIComponent(draft.slug);
    document.getElementById('btn-view-store').href = storeHref;

    var shareText = 'Check out my store on MithraDirect: ' + displayUrl;
    var absHint = displayUrl;
    document.getElementById('share-whatsapp').href =
      'https://wa.me/?text=' + encodeURIComponent(shareText);
    document.getElementById('share-facebook').href =
      'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent('https://' + absHint);
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
            return (
              '<div class="preview-product-card">' +
              '<div class="preview-product-img" style="background:' +
              (p.color || hexToRgba(theme, 0.12)) +
              '">🫙</div>' +
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
   */
  function processImageFile(file, aspectRatio, maxWidth, cb) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      showError('settings-error', 'Please choose an image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showError('settings-error', 'Image must be under 8 MB.');
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
        showError('settings-error', 'Could not read that image. Try another file.');
      };
      img.src = reader.result;
    };
    reader.onerror = function () {
      showError('settings-error', 'Could not read that file.');
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
      var text = document.getElementById('store-url-display').textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          document.getElementById('btn-copy-url').textContent = 'Copied!';
          setTimeout(function () {
            document.getElementById('btn-copy-url').textContent = 'Copy';
          }, 1500);
        });
      }
    });

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
