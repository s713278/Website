/**
 * MithraDirect vendor dashboard demo (minimum features).
 * Reads published store draft / release for products & settings.
 * Orders use local demo samples until Orders API is wired.
 */
(function () {
  'use strict';

  var D = window.MithraDraft;
  var API = window.StoreAPI;
  var TITLES = {
    overview: 'Overview',
    orders: 'Orders',
    products: 'Products',
    store: 'Store & Share',
    plan: 'Shop plan',
    settings: 'Settings'
  };

  var PLAN_STORAGE_KEY = 'md-demo-shop-plan';
  var WELCOME_STORAGE_KEY = 'md-demo-welcome-dismissed';
  var PLAN_PRICE = 299;

  var orderFilter = 'all';
  var state = {
    store: null,
    orders: [],
    qrSrc: '',
    qrHref: '',
    qrName: ''
  };
  var billing = null;

  function qs(id) {
    return document.getElementById(id);
  }

  function isoFromDays(n) {
    return new Date(Date.now() + n * 86400000).toISOString();
  }

  function formatDayLabel(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  }

  function historyItem(kind, title, detail, when) {
    return { kind: kind, title: title, detail: detail, when: when || 'Today' };
  }

  function defaultBilling() {
    return {
      demo: 'trial',
      status: 'trial',
      daysLeft: 12,
      periodEnd: isoFromDays(12),
      history: [historyItem('trial', 'Free days started', '14 free days', 'Today')]
    };
  }

  function billingPreset(id) {
    if (id === 'soon') {
      return {
        demo: 'soon',
        status: 'trial',
        daysLeft: 3,
        periodEnd: isoFromDays(3),
        history: [historyItem('trial', 'Free days started', '14 free days', '11 days ago')]
      };
    }
    if (id === 'paid') {
      return {
        demo: 'paid',
        status: 'paid',
        daysLeft: 22,
        periodEnd: isoFromDays(22),
        history: [
          historyItem('trial', 'Free days started', '14 free days', 'Last month'),
          historyItem('paid', 'Paid ₹299', 'Shop open until ' + formatDayLabel(isoFromDays(22)), 'Today')
        ]
      };
    }
    if (id === 'due') {
      return {
        demo: 'due',
        status: 'due',
        daysLeft: 0,
        periodEnd: isoFromDays(-1),
        history: [
          historyItem('trial', 'Free days started', '14 free days', '15 days ago'),
          historyItem('failed', 'Payment did not go through', 'Shop hidden from customers', 'Today')
        ]
      };
    }
    if (id === 'stopping') {
      return {
        demo: 'stopping',
        status: 'stopping',
        daysLeft: 8,
        periodEnd: isoFromDays(8),
        history: [
          historyItem('paid', 'Paid ₹299', 'Shop open until ' + formatDayLabel(isoFromDays(8)), 'Last week'),
          historyItem('stopped', 'Plan stopped', 'Shop stays open until paid days end', 'Today')
        ]
      };
    }
    if (id === 'closed') {
      return {
        demo: 'closed',
        status: 'closed',
        daysLeft: 0,
        periodEnd: isoFromDays(-2),
        history: [
          historyItem('paid', 'Paid ₹299', 'One month', 'Last month'),
          historyItem('stopped', 'Plan stopped', 'Paid days ended', '2 days ago')
        ]
      };
    }
    return defaultBilling();
  }

  function loadBilling() {
    try {
      var raw = sessionStorage.getItem(PLAN_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.status) return parsed;
      }
    } catch (e) {}
    return defaultBilling();
  }

  function saveBilling() {
    try {
      sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(billing));
    } catch (e) {}
  }

  function shopIsClosed() {
    return billing && (billing.status === 'due' || billing.status === 'closed');
  }

  function shopNeedsPay() {
    return !billing || billing.status !== 'paid';
  }

  function billingTone() {
    if (!billing || billing.status === 'paid') return '';
    if (billing.status === 'due' || billing.status === 'closed') return 'danger';
    if (billing.status === 'stopping') return 'warn';
    if (Number(billing.daysLeft) <= 3) return 'danger';
    if (Number(billing.daysLeft) <= 7) return 'warn';
    return '';
  }

  function applyDemoPreset(id) {
    billing = billingPreset(id);
    saveBilling();
    renderBilling();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function loadStore() {
    var release = null;
    if (API && typeof API.getReleaseSync === 'function') {
      try {
        release = API.getReleaseSync({});
      } catch (e) {
        release = null;
      }
    }
    if (!release && D) release = D.loadDraft();
    if (!release) release = { settings: {}, products: [], subscription: { planName: 'Free', planCode: 'FREE' } };
    if (!release.settings) release.settings = {};
    if (!release.subscription && D && D.defaultSubscription) {
      release.subscription = D.defaultSubscription();
    }
    if (!release.slug && release.settings.storeName && D) {
      release.slug = D.slugify(release.settings.storeName);
    }
    return release;
  }

  function sampleOrders(store) {
    var name = (store.settings && store.settings.storeName) || 'Store';
    var products = store.products || [];
    var first = products[0];
    var itemLabel = first && first.name ? first.name : 'Combo pack';
    var price =
      first && D && typeof D.minPrice === 'function'
        ? D.minPrice(first)
        : first && first.variants && first.variants[0]
          ? Number(first.variants[0].price) || 249
          : 249;

    return [
      {
        id: 'ORD-1042',
        customer: 'Ananya R.',
        phone: '98XXXX3210',
        items: itemLabel + ' × 1',
        amount: price,
        status: 'new',
        when: 'Just now'
      },
      {
        id: 'ORD-1041',
        customer: 'Ravi K.',
        phone: '99XXXX8844',
        items: '2 items',
        amount: Math.round(price * 1.6),
        status: 'confirmed',
        when: '25 min ago'
      },
      {
        id: 'ORD-1038',
        customer: 'Sneha M.',
        phone: '97XXXX1122',
        items: itemLabel + ' × 2',
        amount: Math.round(price * 2),
        status: 'out',
        when: 'Today'
      },
      {
        id: 'ORD-1031',
        customer: 'Karthik P.',
        phone: '96XXXX5566',
        items: 'Gift pack',
        amount: Math.round(price * 1.2),
        status: 'delivered',
        when: 'Yesterday'
      }
    ];
  }

  function statusClass(status) {
    if (status === 'new') return 'dash-status--new';
    if (status === 'confirmed') return 'dash-status--confirmed';
    if (status === 'out') return 'dash-status--out';
    return 'dash-status--delivered';
  }

  function statusLabel(status) {
    if (status === 'out') return 'Out for delivery';
    return status;
  }

  function orderRowHtml(o, withAction) {
    return (
      '<tr data-order-id="' +
      escapeHtml(o.id) +
      '">' +
      '<td><strong>' +
      escapeHtml(o.id) +
      '</strong><div class="dash-muted">' +
      escapeHtml(o.when) +
      '</div></td>' +
      '<td>' +
      escapeHtml(o.customer) +
      '<div class="dash-muted">' +
      escapeHtml(o.phone) +
      '</div></td>' +
      (withAction
        ? '<td>' + escapeHtml(o.items) + '</td>'
        : '') +
      '<td>₹' +
      escapeHtml(String(o.amount)) +
      '</td>' +
      '<td><span class="dash-status ' +
      statusClass(o.status) +
      '">' +
      escapeHtml(statusLabel(o.status)) +
      '</span></td>' +
      (withAction
        ? '<td><button type="button" class="dash-order-action" data-advance-order="' +
          escapeHtml(o.id) +
          '">Update</button></td>'
        : '') +
      '</tr>'
    );
  }

  function filteredOrders() {
    if (orderFilter === 'all') return state.orders;
    return state.orders.filter(function (o) {
      return o.status === orderFilter;
    });
  }

  function renderOrders() {
    var list = filteredOrders();
    var body = qs('orders-body');
    var empty = qs('orders-empty');
    var overviewBody = qs('overview-orders-body');
    var overviewEmpty = qs('overview-orders-empty');

    if (body) {
      body.innerHTML = list.map(function (o) {
        return orderRowHtml(o, true);
      }).join('');
    }
    if (empty) empty.hidden = list.length > 0;

    if (overviewBody) {
      var recent = state.orders.slice(0, 3);
      overviewBody.innerHTML = recent
        .map(function (o) {
          return orderRowHtml(o, false);
        })
        .join('');
    }
    if (overviewEmpty) overviewEmpty.hidden = state.orders.length > 0;

    var pending = state.orders.filter(function (o) {
      return o.status === 'new' || o.status === 'confirmed';
    }).length;
    var countEl = qs('nav-orders-count');
    if (countEl) countEl.textContent = String(pending);

    var today = state.orders.filter(function (o) {
      return o.when === 'Just now' || o.when.indexOf('min') >= 0 || o.when === 'Today';
    }).length;
    var sales = state.orders.reduce(function (n, o) {
      return n + (Number(o.amount) || 0);
    }, 0);

    if (qs('metric-orders-today')) qs('metric-orders-today').textContent = String(today);
    if (qs('metric-sales')) qs('metric-sales').textContent = '₹' + sales.toLocaleString('en-IN');
    if (qs('metric-pending')) qs('metric-pending').textContent = String(pending);

    body &&
      body.querySelectorAll('[data-advance-order]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          advanceOrder(btn.getAttribute('data-advance-order'));
        });
      });
  }

  function advanceOrder(id) {
    var flow = ['new', 'confirmed', 'out', 'delivered'];
    state.orders.forEach(function (o) {
      if (o.id !== id) return;
      var i = flow.indexOf(o.status);
      if (i >= 0 && i < flow.length - 1) o.status = flow[i + 1];
    });
    renderOrders();
  }

  function renderProducts() {
    var products = state.store.products || [];
    var list = qs('products-list');
    var empty = qs('products-empty');
    if (qs('metric-products')) qs('metric-products').textContent = String(products.length);

    if (!products.length) {
      if (list) list.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    if (!list) return;

    list.innerHTML = products
      .slice()
      .sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
      })
      .map(function (p) {
        var from =
          D && typeof D.minPrice === 'function'
            ? D.minPrice(p)
            : (p.variants && p.variants[0] && p.variants[0].price) || '—';
        var skuCount = (p.variants && p.variants.length) || 0;
        return (
          '<li class="dash-product-item">' +
          '<div><div class="dash-product-name">' +
          escapeHtml(p.name || 'Untitled') +
          '</div><div class="dash-product-meta">' +
          skuCount +
          ' SKU' +
          (skuCount === 1 ? '' : 's') +
          '</div></div>' +
          '<div class="dash-product-price">From ₹' +
          escapeHtml(String(from)) +
          '</div></li>'
        );
      })
      .join('');
  }

  function renderStore() {
    var store = state.store;
    var settings = store.settings || {};
    var slug = store.slug || (D ? D.slugify(settings.storeName) : 'my-store');
    var displayUrl = 'mithradirect.com/store/' + slug;
    var storeHref = 'store.html?slug=' + encodeURIComponent(slug);

    if (qs('dash-store-name')) qs('dash-store-name').textContent = settings.storeName || 'Your store';
    if (qs('dash-store-url')) qs('dash-store-url').textContent = displayUrl;

    ['dash-view-storefront', 'dash-open-store', 'quick-view-store'].forEach(function (id) {
      var el = qs(id);
      if (el) el.href = storeHref;
    });

    var shareText =
      'Hi! Order from ' +
      (settings.storeName || 'my store') +
      ' online 🛍️\nhttps://' +
      displayUrl;
    var wa = qs('dash-share-wa');
    if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(shareText);

    renderStoreQr(storeHref, settings.storeName || slug);

    if (qs('set-name')) qs('set-name').textContent = settings.storeName || '—';
    if (qs('set-whatsapp'))
      qs('set-whatsapp').textContent = settings.whatsapp ? '+91 ' + settings.whatsapp : '—';
    if (qs('set-location')) qs('set-location').textContent = settings.location || '—';
    if (qs('set-instagram')) {
      var igUrl = settings.instagramUrl || '';
      var igEl = qs('set-instagram');
      if (igUrl) {
        igEl.innerHTML =
          '<a href="' +
          igUrl.replace(/"/g, '') +
          '" target="_blank" rel="noopener">' +
          igUrl.replace(/^https?:\/\/(www\.)?/i, '') +
          '</a>';
      } else {
        igEl.textContent = '—';
      }
    }
    renderBilling();
    if (qs('set-theme')) qs('set-theme').textContent = settings.themeColor || '—';
    if (qs('set-accent')) qs('set-accent').textContent = settings.accentColor || '—';
    if (qs('set-bg')) qs('set-bg').textContent = settings.backgroundColor || '—';
    if (qs('set-font')) {
      var fontPreset =
        D && typeof D.getFontPreset === 'function'
          ? D.getFontPreset(settings.fontId)
          : null;
      qs('set-font').textContent = (fontPreset && fontPreset.label) || settings.fontId || '—';
    }

    var themeSwatch = qs('set-theme-swatch');
    if (themeSwatch && settings.themeColor) {
      themeSwatch.style.background = settings.themeColor;
      themeSwatch.hidden = false;
    }
    var accentSwatch = qs('set-accent-swatch');
    if (accentSwatch && settings.accentColor) {
      accentSwatch.style.background = settings.accentColor;
      accentSwatch.hidden = false;
    }
    var bgSwatch = qs('set-bg-swatch');
    if (bgSwatch && settings.backgroundColor) {
      bgSwatch.style.background = settings.backgroundColor;
      bgSwatch.hidden = false;
    }

    if (D && typeof D.applyStoreBrand === 'function') {
      D.applyStoreBrand(settings);
    } else if (D && typeof D.applyTheme === 'function') {
      D.applyTheme(settings.themeColor || D.DEFAULT_THEME || '#10b981');
    } else if (settings.themeColor) {
      document.documentElement.style.setProperty('--store-theme', settings.themeColor);
    }

    renderAccount(store);
  }

  function renderBilling() {
    if (!billing) billing = defaultBilling();
    var tone = billingTone();
    var closed = shopIsClosed();
    var needsPay = shopNeedsPay();
    var dateLabel = formatDayLabel(billing.periodEnd);
    var days = Number(billing.daysLeft) || 0;
    var chipLabel = 'Social Starter';
    var bannerTitle = '';
    var bannerText = '';
    var bannerCta = 'Pay ₹299';
    var kicker = 'Shop plan';
    var daysHtml = 'Shop is open';
    var copy = 'Mithra Social Starter is ₹299 each month. Pay with UPI, card or netbanking.';
    var payLabel = 'Pay ₹299';
    var showPay = true;
    var showIfUnpaid = needsPay;
    var showStop = billing.status === 'paid';
    var stopCopy = 'Stop any time. The shop stays open until the days you already paid for are over.';

    if (billing.status === 'trial') {
      chipLabel = days + (days === 1 ? ' day left' : ' days left');
      bannerTitle = days + ' free ' + (days === 1 ? 'day' : 'days') + ' left';
      bannerText =
        days <= 3
          ? ' — pay ₹299 with Razorpay now so customers can still open your shop.'
          : ' — after that, subscribe with Razorpay (₹299 / month) to keep the shop open.';
      bannerCta = 'Pay ₹299';
      kicker = 'Free days';
      daysHtml = days + ' <span>' + (days === 1 ? 'day left' : 'days left') + '</span>';
      copy =
        days <= 3
          ? 'Pay ₹299 with Razorpay now so customers can still open your shop when free days end.'
          : 'Your shop is live for 14 free days. After that, subscribe with Razorpay — ₹299 each month — to keep it open.';
      payLabel = 'Pay ₹299 with Razorpay';
    } else if (billing.status === 'paid') {
      chipLabel = 'Social Starter';
      bannerTitle = '';
      kicker = 'Paid';
      daysHtml = 'Shop is open';
      copy = 'You paid ₹299 via Razorpay. Shop stays open until ' + dateLabel + '. Next month is another ₹299.';
      showPay = false;
    } else if (billing.status === 'due') {
      chipLabel = 'Shop closed';
      bannerTitle = 'Shop is hidden from customers';
      bannerText = ' — last Razorpay payment did not go through. Pay ₹299 to open the shop again.';
      bannerCta = 'Pay ₹299';
      kicker = 'Payment failed';
      daysHtml = 'Shop is hidden';
      copy = 'Customers cannot see your shop. Pay ₹299 with Razorpay to open it again. Old orders are still here.';
      payLabel = 'Pay ₹299 with Razorpay';
    } else if (billing.status === 'stopping') {
      chipLabel = dateLabel ? 'Open until ' + dateLabel : 'Plan stopped';
      bannerTitle = dateLabel ? 'Shop stays open until ' + dateLabel : 'Plan stopped';
      bannerText = ' — then customers cannot see it. You can pay again any time with Razorpay.';
      bannerCta = 'Keep open · ₹299';
      kicker = 'Plan stopped';
      daysHtml = days + ' <span>' + (days === 1 ? 'day left' : 'days left') + '</span>';
      copy =
        'You stopped the plan. Shop stays open until ' +
        dateLabel +
        '. Pay ₹299 with Razorpay if you want to keep it after that.';
      payLabel = 'Keep shop open · ₹299';
      showIfUnpaid = true;
      showStop = false;
      stopCopy = 'Plan already stopped. Shop stays open until paid days end.';
    } else if (billing.status === 'closed') {
      chipLabel = 'Shop closed';
      bannerTitle = 'Shop is hidden from customers';
      bannerText = ' — pay ₹299 with Razorpay to open it again.';
      bannerCta = 'Pay ₹299';
      kicker = 'Shop closed';
      daysHtml = 'Shop is hidden';
      copy = 'Paid days are over. Customers cannot see your shop. Pay ₹299 with Razorpay to open it again.';
      payLabel = 'Pay ₹299 with Razorpay';
    }

    var chip = qs('dash-plan-chip');
    if (qs('dash-plan-label')) qs('dash-plan-label').textContent = chipLabel;
    if (chip) {
      chip.classList.toggle('is-warn', tone === 'warn');
      chip.classList.toggle('is-danger', tone === 'danger');
    }

    var banner = qs('dash-plan-banner');
    if (banner) {
      banner.hidden = billing.status === 'paid';
      banner.classList.toggle('is-warn', tone === 'warn');
      banner.classList.toggle('is-danger', tone === 'danger');
    }
    if (qs('dash-banner-title')) qs('dash-banner-title').textContent = bannerTitle;
    if (qs('dash-banner-text')) qs('dash-banner-text').textContent = bannerText;
    if (qs('dash-banner-cta')) qs('dash-banner-cta').textContent = bannerCta;

    var payCta = qs('dash-pay-cta');
    if (payCta) {
      payCta.textContent = needsPay ? 'Pay ₹299' : 'Shop plan';
      payCta.classList.toggle('btn-primary', needsPay);
      payCta.classList.toggle('btn-secondary', !needsPay);
    }

    var hero = qs('dash-plan-hero');
    if (hero) {
      hero.classList.toggle('is-warn', tone === 'warn');
      hero.classList.toggle('is-danger', tone === 'danger');
    }
    if (qs('dash-plan-kicker')) qs('dash-plan-kicker').textContent = kicker;
    if (qs('dash-plan-days')) qs('dash-plan-days').innerHTML = daysHtml;
    if (qs('dash-plan-copy')) qs('dash-plan-copy').textContent = copy;
    var payBtn = qs('dash-plan-pay');
    var payHint = document.querySelector('.dash-plan-pay-hint');
    if (payBtn) {
      payBtn.hidden = !showPay;
      payBtn.textContent = payLabel;
    }
    if (payHint) payHint.hidden = !showPay;
    if (qs('dash-plan-error')) qs('dash-plan-error').hidden = true;
    if (qs('dash-plan-if-unpaid')) qs('dash-plan-if-unpaid').hidden = !showIfUnpaid;

    var stopPanel = qs('dash-plan-stop-panel');
    var stopBtn = qs('dash-plan-stop');
    var stopConfirm = qs('dash-plan-stop-confirm');
    if (stopPanel) stopPanel.hidden = billing.status !== 'paid' && billing.status !== 'stopping';
    if (qs('dash-plan-stop-copy')) qs('dash-plan-stop-copy').textContent = stopCopy;
    if (stopBtn) stopBtn.hidden = !showStop;
    if (stopConfirm) stopConfirm.hidden = true;

    var history = billing.history || [];
    var list = qs('dash-plan-history');
    var empty = qs('dash-plan-history-empty');
    if (list) {
      list.innerHTML = history
        .slice()
        .reverse()
        .map(function (item) {
          return (
            '<li><strong>' +
            escapeHtml(item.title || '') +
            '</strong><span>' +
            escapeHtml(item.detail || '') +
            (item.when ? ' · ' + item.when : '') +
            '</span></li>'
          );
        })
        .join('');
    }
    if (empty) empty.hidden = history.length > 0;

    document.querySelectorAll('[data-plan-demo]').forEach(function (chipBtn) {
      chipBtn.classList.toggle('is-active', chipBtn.getAttribute('data-plan-demo') === billing.demo);
    });

    var closedPanel = qs('dash-store-closed');
    var shareBlock = qs('dash-store-share');
    if (closedPanel) closedPanel.hidden = !closed;
    if (shareBlock) shareBlock.hidden = closed;
    var viewStorefront = qs('dash-view-storefront');
    if (viewStorefront) viewStorefront.hidden = closed;

    if (qs('set-plan')) {
      qs('set-plan').textContent = closed
        ? 'Shop closed — pay ₹299 with Razorpay'
        : billing.status === 'trial'
          ? days + ' free days left'
          : billing.status === 'stopping'
            ? 'Stopped · open until ' + dateLabel
            : 'Social Starter · ₹' + PLAN_PRICE + ' / month';
    }

    renderWelcome();
  }

  function welcomeWasDismissed() {
    try {
      return sessionStorage.getItem(WELCOME_STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function dismissWelcome() {
    try {
      sessionStorage.setItem(WELCOME_STORAGE_KEY, '1');
    } catch (e) {}
    renderWelcome();
  }

  function renderWelcome() {
    var el = qs('dash-welcome');
    if (!el || !billing) return;
    var show = billing.status === 'trial' && !welcomeWasDismissed();
    el.hidden = !show;
    var copyEl = qs('dash-welcome-copy');
    if (copyEl && show) {
      var days = Number(billing.daysLeft) || 0;
      copyEl.textContent =
        days <= 3
          ? 'Only ' +
            days +
            (days === 1 ? ' free day' : ' free days') +
            ' left. Share your shop link, then pay ₹299 with Razorpay so customers can still open it.'
          : 'Customers can order now. Share your shop link. Before free days end, pay ₹299 with Razorpay to keep the shop open.';
    }
  }

  function setPaySheetBusy(busy) {
    var continueBtn = qs('dash-pay-continue');
    if (continueBtn) continueBtn.disabled = busy;
    var fail = qs('dash-pay-fail');
    var cancel = qs('dash-pay-cancel');
    if (fail) fail.hidden = busy;
    if (cancel) cancel.disabled = busy;
  }

  function openPaySheet() {
    var sheet = qs('dash-pay-sheet');
    var status = qs('dash-pay-status');
    if (!sheet) return;
    if (status) {
      status.hidden = true;
      status.textContent = 'Opening Razorpay…';
    }
    setPaySheetBusy(false);
    sheet.hidden = false;
    document.body.classList.add('dash-pay-open');
  }

  function closePaySheet() {
    var sheet = qs('dash-pay-sheet');
    if (sheet) sheet.hidden = true;
    document.body.classList.remove('dash-pay-open');
    setPaySheetBusy(false);
  }

  function completePayment(ok) {
    var status = qs('dash-pay-status');
    var err = qs('dash-plan-error');
    setPaySheetBusy(true);
    if (status) {
      status.hidden = false;
      status.textContent = ok ? 'Opening Razorpay…' : 'Confirming payment…';
    }
    window.setTimeout(function () {
      if (ok) {
        billing.status = 'paid';
        billing.demo = 'paid';
        billing.daysLeft = 30;
        billing.periodEnd = isoFromDays(30);
        billing.history = (billing.history || []).concat([
          historyItem('paid', 'Paid ₹299 via Razorpay', 'Shop open until ' + formatDayLabel(billing.periodEnd), 'Just now')
        ]);
        saveBilling();
        try {
          sessionStorage.setItem(WELCOME_STORAGE_KEY, '1');
        } catch (e) {}
        closePaySheet();
        renderBilling();
        setView('plan');
      } else {
        billing.status = 'due';
        billing.demo = 'due';
        billing.daysLeft = 0;
        billing.periodEnd = isoFromDays(-1);
        billing.history = (billing.history || []).concat([
          historyItem('failed', 'Razorpay payment did not go through', 'Shop hidden from customers', 'Just now')
        ]);
        saveBilling();
        closePaySheet();
        renderBilling();
        if (err) {
          err.hidden = false;
          err.textContent = 'Payment did not go through. Try Razorpay again.';
        }
        setView('plan');
      }
    }, 800);
  }

  function stopPlan() {
    billing.status = 'stopping';
    billing.demo = 'stopping';
    billing.history = (billing.history || []).concat([
      historyItem('stopped', 'Plan stopped', 'Shop stays open until paid days end', 'Just now')
    ]);
    saveBilling();
    renderBilling();
  }

  function renderStoreQr(storeHref, storeName) {
    if (!D || typeof D.qrImageUrl !== 'function') return;
    var img = qs('dash-qr-img');
    var placeholder = qs('dash-qr-placeholder');
    var src = D.qrImageUrl(storeHref, 280);
    state.qrSrc = src;
    state.qrHref = storeHref;
    state.qrName = storeName || 'shop';
    if (img) {
      img.onload = function () {
        img.hidden = false;
        if (placeholder) placeholder.hidden = true;
      };
      img.onerror = function () {
        img.hidden = true;
        if (placeholder) {
          placeholder.hidden = false;
          placeholder.textContent = 'QR unavailable';
        }
      };
      img.src = src;
      img.alt = 'QR code for ' + (storeName || 'your shop');
    }
    var shareBtn = qs('dash-qr-share');
    if (shareBtn) shareBtn.hidden = !navigator.share;
  }

  function roleLabel(role) {
    return role === 'admin' ? 'Admin' : 'Vendor';
  }

  function ensureVendorSession(store) {
    if (!API || typeof API.getVendorSession !== 'function') return null;
    var vs = API.getVendorSession();
    if (vs && vs.loggedIn) return vs;
    // Bootstrap demo session from verified onboarding draft
    if (store && store.verified && typeof API.setVendorSession === 'function') {
      var roleParam = '';
      try {
        roleParam = new URLSearchParams(window.location.search).get('role') || '';
      } catch (e) {}
      return API.setVendorSession({
        loggedIn: true,
        phone: store.phone || (store.settings && store.settings.whatsapp) || '',
        name: (store.settings && store.settings.storeName) || '',
        role: roleParam || 'vendor',
        vendorId: store.vendorId || null
      });
    }
    return vs;
  }

  function renderAccount(store) {
    var vs = ensureVendorSession(store) || { loggedIn: true, phone: '', role: 'vendor' };
    var role =
      API && typeof API.normalizeVendorRole === 'function'
        ? API.normalizeVendorRole(vs.role)
        : vs.role === 'admin'
          ? 'admin'
          : 'vendor';
    var phone =
      vs.phone ||
      (store && store.phone) ||
      (store && store.settings && store.settings.whatsapp) ||
      '';

    if (qs('dash-account-phone')) {
      qs('dash-account-phone').textContent = phone ? '+91 ' + phone : 'This device';
    }
    if (qs('dash-account-role')) qs('dash-account-role').textContent = roleLabel(role);

    var badge = qs('dash-role-badge');
    if (badge) {
      badge.textContent = roleLabel(role);
      badge.classList.toggle('dash-role-badge--admin', role === 'admin');
    }

    var panel = qs('dash-account-panel');
    if (panel) panel.hidden = false;
    var logoutBtn = qs('btn-dash-logout');
    if (logoutBtn) logoutBtn.hidden = false;
  }

  function handleLogout() {
    var ok = window.confirm('Log out of your vendor account on this device?');
    if (!ok) return;
    if (API && typeof API.logoutVendor === 'function') {
      API.logoutVendor();
    } else {
      try {
        localStorage.removeItem('mithra_vendor_session');
        localStorage.removeItem('mithra_access_token');
        localStorage.removeItem('mithra_refresh_token');
      } catch (e) {}
    }
    window.location.href = 'onboarding.html';
  }

  function setView(view) {
    if (!TITLES[view]) view = 'overview';
    document.querySelectorAll('[data-view-panel]').forEach(function (panel) {
      var on = panel.getAttribute('data-view-panel') === view;
      panel.hidden = !on;
      panel.classList.toggle('is-active', on);
    });
    document.querySelectorAll('[data-view]').forEach(function (btn) {
      var on = btn.getAttribute('data-view') === view;
      btn.classList.toggle('is-active', on);
      if (btn.tagName === 'BUTTON') {
        if (on) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
      }
    });
    if (qs('dash-page-title')) qs('dash-page-title').textContent = TITLES[view];
    try {
      history.replaceState(null, '', '#' + view);
    } catch (e) {}
    closeMobileNav();
  }

  function openMobileNav() {
    var shell = qs('dash-shell');
    var btn = qs('dash-menu-btn');
    var backdrop = qs('dash-backdrop');
    if (shell) shell.classList.add('is-nav-open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (backdrop) backdrop.hidden = false;
  }

  function closeMobileNav() {
    var shell = qs('dash-shell');
    var btn = qs('dash-menu-btn');
    var backdrop = qs('dash-backdrop');
    if (shell) shell.classList.remove('is-nav-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (backdrop) backdrop.hidden = true;
  }

  function bind() {
    document.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setView(btn.getAttribute('data-view'));
      });
    });
    document.querySelectorAll('[data-view-jump]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setView(btn.getAttribute('data-view-jump'));
      });
    });
    document.querySelectorAll('[data-open-pay]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openPaySheet();
      });
    });
    var payHero = qs('dash-plan-pay');
    if (payHero) {
      payHero.addEventListener('click', function () {
        openPaySheet();
      });
    }
    var welcomeDismiss = qs('dash-welcome-dismiss');
    if (welcomeDismiss) {
      welcomeDismiss.addEventListener('click', dismissWelcome);
    }
    var payContinue = qs('dash-pay-continue');
    if (payContinue) {
      payContinue.addEventListener('click', function () {
        completePayment(true);
      });
    }
    var payCta = qs('dash-pay-cta');
    if (payCta) {
      payCta.addEventListener('click', function () {
        if (shopNeedsPay()) openPaySheet();
      });
    }
    var bannerCta = qs('dash-banner-cta');
    if (bannerCta) {
      bannerCta.addEventListener('click', function () {
        if (shopNeedsPay()) openPaySheet();
      });
    }
    document.querySelectorAll('[data-plan-demo]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        applyDemoPreset(chip.getAttribute('data-plan-demo') || 'trial');
      });
    });
    var stopBtn = qs('dash-plan-stop');
    var stopYes = qs('dash-plan-stop-yes');
    var stopNo = qs('dash-plan-stop-no');
    var stopConfirm = qs('dash-plan-stop-confirm');
    if (stopBtn && stopConfirm) {
      stopBtn.addEventListener('click', function () {
        stopConfirm.hidden = false;
      });
    }
    if (stopNo && stopConfirm) {
      stopNo.addEventListener('click', function () {
        stopConfirm.hidden = true;
      });
    }
    if (stopYes) {
      stopYes.addEventListener('click', function () {
        stopPlan();
      });
    }
    var payFail = qs('dash-pay-fail');
    if (payFail) {
      payFail.addEventListener('click', function () {
        completePayment(false);
      });
    }
    var payCancel = qs('dash-pay-cancel');
    var payBackdrop = qs('dash-pay-backdrop');
    if (payCancel) payCancel.addEventListener('click', closePaySheet);
    if (payBackdrop) payBackdrop.addEventListener('click', closePaySheet);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePaySheet();
    });
    document.querySelectorAll('[data-order-filter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        orderFilter = chip.getAttribute('data-order-filter') || 'all';
        document.querySelectorAll('[data-order-filter]').forEach(function (c) {
          c.classList.toggle('is-active', c === chip);
        });
        renderOrders();
      });
    });

    var menuBtn = qs('dash-menu-btn');
    if (menuBtn) menuBtn.addEventListener('click', openMobileNav);
    var backdrop = qs('dash-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeMobileNav);

    var copyBtn = qs('dash-copy-url');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = (qs('dash-store-url') || {}).textContent || '';
        var hint = qs('dash-copy-hint');
        function done() {
          copyBtn.textContent = 'Copied!';
          if (hint) hint.hidden = false;
          setTimeout(function () {
            copyBtn.textContent = 'Copy';
          }, 1500);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(function () {
            window.prompt('Copy shop link:', text);
            done();
          });
        } else {
          window.prompt('Copy shop link:', text);
          done();
        }
      });
    }

    var logoutBtn = qs('btn-dash-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    var qrDownload = qs('dash-qr-download');
    if (qrDownload) {
      qrDownload.addEventListener('click', function () {
        var src = state.qrSrc;
        var hint = qs('dash-qr-hint');
        if (!src || !D || typeof D.downloadQrImage !== 'function') {
          if (hint) {
            hint.hidden = false;
            hint.textContent = 'QR not ready yet — open Store & Share again.';
          }
          return;
        }
        var safe = String(state.qrName || 'shop')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        D.downloadQrImage(src, (safe || 'shop') + '-qr.png');
        if (hint) {
          hint.hidden = false;
          hint.textContent = 'Saving… Print it or set as WhatsApp status.';
          setTimeout(function () {
            hint.hidden = true;
          }, 3500);
        }
      });
    }

    var qrShare = qs('dash-qr-share');
    if (qrShare) {
      qrShare.addEventListener('click', function () {
        var src = state.qrSrc;
        if (!src || !navigator.share) return;
        fetch(src, { mode: 'cors' })
          .then(function (r) {
            return r.blob();
          })
          .then(function (blob) {
            var file = new File([blob], 'shop-qr.png', { type: blob.type || 'image/png' });
            var data = {
              title: (state.qrName || 'My shop') + ' — scan to order',
              text: 'Scan to order from ' + (state.qrName || 'my shop'),
              files: [file]
            };
            if (navigator.canShare && navigator.canShare(data)) {
              return navigator.share(data);
            }
            return navigator.share({
              title: data.title,
              text: data.text,
              url: D && D.absoluteUrl ? D.absoluteUrl(state.qrHref) : state.qrHref
            });
          })
          .catch(function () {});
      });
    }
  }

  function init() {
    billing = loadBilling();
    state.store = loadStore();
    state.orders = sampleOrders(state.store);
    bind();
    renderStore();
    renderProducts();
    renderOrders();

    var hash = (location.hash || '').replace('#', '');
    setView(TITLES[hash] ? hash : 'overview');

    if (window.MithraAssets && typeof window.MithraAssets.applyAssets === 'function') {
      window.MithraAssets.applyAssets(document);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
