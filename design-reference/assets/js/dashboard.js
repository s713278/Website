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
  var PLAN_PRICE = 399;

  var orderFilter = 'all';
  var orderPage = 0;
  var ORDERS_PAGE_SIZE = 5;
  var expandedOrders = {};
  var openOrderId = null;
  var openProductId = null;
  var confirmingCancel = false;
  var FEATURE_SAMPLES = [
    { label: 'Brand', value: 'Your brand name' },
    { label: 'Easily Digestible', value: 'Light on the stomach' },
    { label: 'Health Benefits', value: 'Rich in vitamins' },
    { label: 'How to Use', value: 'Best within 3 days of opening' },
    { label: 'Ingredients', value: 'List the main ingredients' }
  ];
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
          historyItem('paid', 'Paid ₹399', 'Shop open until ' + formatDayLabel(isoFromDays(22)), 'Today')
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
          historyItem('paid', 'Paid ₹399', 'Shop open until ' + formatDayLabel(isoFromDays(8)), 'Last week'),
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
          historyItem('paid', 'Paid ₹399', 'One month', 'Last month'),
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

  function productName(products, index, fallback) {
    var product = products[index];
    return product && product.name ? product.name : fallback;
  }

  function productPrice(products, index, fallback) {
    var product = products[index];
    if (product && D && typeof D.minPrice === 'function') {
      var priced = Number(D.minPrice(product));
      if (priced) return priced;
    }
    if (product && product.variants && product.variants[0]) {
      var variantPrice = Number(product.variants[0].price);
      if (variantPrice) return variantPrice;
    }
    return fallback;
  }

  function orderLine(name, qty, unit) {
    return { name: name, qty: qty, amount: unit * qty };
  }

  function orderAmount(lines) {
    return lines.reduce(function (sum, line) {
      return sum + line.amount;
    }, 0);
  }

  function sampleOrders(store) {
    var products = (store && store.products) || [];
    var first = productName(products, 0, 'Combo pack');
    var second = productName(products, 1, 'Filter coffee');
    var third = productName(products, 2, 'Banana chips');
    var firstPrice = productPrice(products, 0, 249);
    var secondPrice = productPrice(products, 1, 80);
    var thirdPrice = productPrice(products, 2, 120);
    var single = [orderLine(first, 1, firstPrice)];
    var basket = [
      orderLine(first, 1, firstPrice),
      orderLine(second, 2, secondPrice),
      orderLine(third, 1, thirdPrice)
    ];
    var pair = [orderLine(first, 2, firstPrice), orderLine(second, 1, secondPrice)];

    return [
      {
        id: 'ORD-1042',
        customer: 'Ananya R.',
        phone: '98XXXX3210',
        lines: single,
        amount: orderAmount(single),
        status: 'new',
        when: 'Just now'
      },
      {
        id: 'ORD-1041',
        customer: 'Ravi K.',
        phone: '99XXXX8844',
        lines: basket,
        amount: orderAmount(basket),
        status: 'confirmed',
        when: '25 min ago'
      },
      {
        id: 'ORD-1038',
        customer: 'Sneha M.',
        phone: '97XXXX1122',
        lines: pair,
        amount: orderAmount(pair),
        status: 'out',
        when: 'Today'
      },
      {
        id: 'ORD-1031',
        customer: 'Karthik P.',
        phone: '96XXXX5566',
        lines: [orderLine('Gift pack', 1, Math.round(firstPrice * 1.2))],
        amount: Math.round(firstPrice * 1.2),
        status: 'delivered',
        when: 'Yesterday'
      }
    ].concat(
      [
        ['ORD-1028', 'Meera S.', '95XXXX2201', 'new', '1 hr ago', 'single'],
        ['ORD-1024', 'Arun V.', '94XXXX7781', 'confirmed', '2 hr ago', 'basket'],
        ['ORD-1019', 'Divya T.', '93XXXX4410', 'out', 'Today', 'pair'],
        ['ORD-1015', 'Vikram J.', '92XXXX9033', 'delivered', 'Yesterday', 'single'],
        ['ORD-1011', 'Priya N.', '91XXXX6620', 'cancelled', 'Yesterday', 'single'],
        ['ORD-1008', 'Kiran D.', '90XXXX1188', 'new', 'Today', 'pair'],
        ['ORD-1004', 'Lakshmi A.', '89XXXX3344', 'confirmed', 'Yesterday', 'basket'],
        ['ORD-0998', 'Naveen B.', '88XXXX7755', 'new', '2 days ago', 'single'],
        ['ORD-0994', 'Farah Q.', '87XXXX2290', 'delivered', '2 days ago', 'pair'],
        ['ORD-0990', 'Imran H.', '86XXXX6612', 'out', '3 days ago', 'single'],
        ['ORD-0986', 'Swathi C.', '85XXXX4409', 'new', '3 days ago', 'basket'],
        ['ORD-0982', 'Rohit G.', '84XXXX1177', 'new', '3 days ago', 'single']
      ].map(function (row) {
        var lines = row[5] === 'basket' ? basket : row[5] === 'pair' ? pair : single;
        return {
          id: row[0],
          customer: row[1],
          phone: row[2],
          lines: lines,
          amount: orderAmount(lines),
          status: row[3],
          when: row[4]
        };
      })
    );
  }

  function statusClass(status) {
    if (status === 'new') return 'dash-status--new';
    if (status === 'confirmed') return 'dash-status--confirmed';
    if (status === 'out') return 'dash-status--out';
    if (status === 'cancelled') return 'dash-status--cancelled';
    return 'dash-status--delivered';
  }

  function statusLabel(status) {
    if (status === 'new') return 'New';
    if (status === 'confirmed') return 'Confirmed';
    if (status === 'out') return 'Out for delivery';
    if (status === 'delivered') return 'Delivered';
    if (status === 'cancelled') return 'Cancelled';
    return status;
  }

  function nextStep(status) {
    if (status === 'new') return { status: 'confirmed', label: 'Confirm' };
    if (status === 'confirmed') return { status: 'out', label: 'Out for delivery' };
    if (status === 'out') return { status: 'delivered', label: 'Mark delivered' };
    return null;
  }

  function canCancel(status) {
    return status !== 'delivered' && status !== 'cancelled';
  }

  function lineLabel(line) {
    return line.name + ' × ' + line.qty;
  }

  function formatInr(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  function findOrder(id) {
    var found = null;
    state.orders.forEach(function (order) {
      if (order.id === id) found = order;
    });
    return found;
  }

  function itemsSummaryHtml(order, expandable) {
    var lines = order.lines || [];
    if (!lines.length) return '';
    if (lines.length === 1) {
      return (
        '<div class="dash-order-items"><div class="dash-order-item">' +
        escapeHtml(lineLabel(lines[0])) +
        '</div></div>'
      );
    }
    if (!expandable) {
      return '<div class="dash-order-items"><div class="dash-muted">' + lines.length + ' items</div></div>';
    }
    var open = !!expandedOrders[order.id];
    var html = '<div class="dash-order-items">';
    var visible = open ? lines : lines.slice(0, 1);
    visible.forEach(function (line) {
      html += '<div class="dash-order-item">' + escapeHtml(lineLabel(line)) + '</div>';
    });
    html +=
      '<button type="button" class="dash-order-more" data-toggle-items="' +
      escapeHtml(order.id) +
      '" aria-expanded="' +
      (open ? 'true' : 'false') +
      '">' +
      (open ? 'Show less' : '+ ' + (lines.length - 1) + ' more') +
      '</button></div>';
    return html;
  }

  function orderRowHtml(o, withAction) {
    var step = nextStep(o.status);
    return (
      '<tr data-order-id="' +
      escapeHtml(o.id) +
      '">' +
      '<td><button type="button" class="dash-order-id" data-open-order="' +
      escapeHtml(o.id) +
      '">' +
      escapeHtml(o.id) +
      '</button><div class="dash-muted">' +
      escapeHtml(o.when) +
      '</div>' +
      itemsSummaryHtml(o, withAction) +
      '</td>' +
      '<td>' +
      escapeHtml(o.customer) +
      '<div class="dash-muted">' +
      escapeHtml(o.phone) +
      '</div></td>' +
      '<td>' +
      escapeHtml(formatInr(o.amount)) +
      '</td>' +
      '<td><span class="dash-status ' +
      statusClass(o.status) +
      '">' +
      escapeHtml(statusLabel(o.status)) +
      '</span></td>' +
      (withAction
        ? '<td>' +
          (step
            ? '<button type="button" class="btn btn-secondary btn-sm dash-order-next" data-advance-order="' +
              escapeHtml(o.id) +
              '">' +
              escapeHtml(step.label) +
              '</button>'
            : '<span class="dash-muted">—</span>') +
          '</td>'
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

  function orderPageCount(list) {
    if (!list.length) return 0;
    return Math.ceil(list.length / ORDERS_PAGE_SIZE);
  }

  function ordersOnPage(list) {
    var pages = orderPageCount(list);
    if (pages === 0) {
      orderPage = 0;
      return [];
    }
    if (orderPage > pages - 1) orderPage = pages - 1;
    if (orderPage < 0) orderPage = 0;
    var start = orderPage * ORDERS_PAGE_SIZE;
    return list.slice(start, start + ORDERS_PAGE_SIZE);
  }

  function renderOrderPager(list) {
    var pager = qs('orders-pager');
    var status = qs('orders-page-status');
    var prev = qs('orders-page-prev');
    var next = qs('orders-page-next');
    if (!pager) return;
    var pages = orderPageCount(list);
    if (pages <= 1) {
      pager.hidden = true;
      if (status) status.textContent = '';
      return;
    }
    pager.hidden = false;
    if (status) status.textContent = 'Page ' + (orderPage + 1) + ' of ' + pages;
    if (prev) prev.disabled = orderPage === 0;
    if (next) next.disabled = orderPage >= pages - 1;
  }

  function goToOrderPage(nextPage) {
    orderPage = nextPage;
    renderOrders();
    var table = qs('orders-table');
    if (table && table.scrollIntoView) table.scrollIntoView({ block: 'nearest' });
  }

  function renderOrders() {
    var list = filteredOrders();
    var page = ordersOnPage(list);
    var body = qs('orders-body');
    var empty = qs('orders-empty');
    var overviewBody = qs('overview-orders-body');
    var overviewEmpty = qs('overview-orders-empty');

    if (body) {
      body.innerHTML = page.map(function (o) {
        return orderRowHtml(o, true);
      }).join('');
    }
    if (empty) empty.hidden = list.length > 0;
    renderOrderPager(list);

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

    bindOrderControls(body);
    bindOrderControls(overviewBody);
    renderOrderSheet();
  }

  function bindOrderControls(root) {
    if (!root) return;
    root.querySelectorAll('[data-advance-order]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        advanceOrder(btn.getAttribute('data-advance-order'));
      });
    });
    root.querySelectorAll('[data-toggle-items]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-toggle-items');
        expandedOrders[id] = !expandedOrders[id];
        renderOrders();
      });
    });
    root.querySelectorAll('[data-open-order]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openOrderSheet(btn.getAttribute('data-open-order'));
      });
    });
  }

  function advanceOrder(id) {
    var order = findOrder(id);
    var step = order && nextStep(order.status);
    if (!step) return;
    order.status = step.status;
    confirmingCancel = false;
    renderOrders();
  }

  function cancelOrder(id) {
    var order = findOrder(id);
    if (!order || !canCancel(order.status)) return;
    order.status = 'cancelled';
    confirmingCancel = false;
    renderOrders();
  }

  function openOrderSheet(id) {
    if (openOrderId !== id) confirmingCancel = false;
    openOrderId = id;
    var sheet = qs('dash-order-sheet');
    if (sheet) sheet.hidden = false;
    document.body.classList.add('dash-order-open');
    renderOrderSheet();
    var closeBtn = qs('dash-order-sheet-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeOrderSheet() {
    openOrderId = null;
    confirmingCancel = false;
    var sheet = qs('dash-order-sheet');
    if (sheet) sheet.hidden = true;
    document.body.classList.remove('dash-order-open');
  }

  function renderOrderSheet() {
    if (!openOrderId) return;
    var order = findOrder(openOrderId);
    if (!order) {
      closeOrderSheet();
      return;
    }
    var kicker = qs('dash-order-sheet-kicker');
    var title = qs('dash-order-sheet-title');
    var body = qs('dash-order-sheet-body');
    if (kicker) kicker.textContent = order.when;
    if (title) title.textContent = order.id;
    if (!body) return;

    var step = nextStep(order.status);
    var lines = (order.lines || [])
      .map(function (line) {
        return (
          '<li><strong>' +
          escapeHtml(lineLabel(line)) +
          '</strong><span class="dash-order-line-price">' +
          escapeHtml(formatInr(line.amount)) +
          '</span></li>'
        );
      })
      .join('');

    var actions = '<div class="dash-order-sheet-actions">';
    if (step) {
      actions +=
        '<button type="button" class="btn btn-primary" data-advance-order="' +
        escapeHtml(order.id) +
        '">' +
        escapeHtml(step.label) +
        '</button>';
    }
    if (canCancel(order.status)) {
      if (confirmingCancel) {
        actions +=
          '<p class="dash-order-cancel-note">Cancel this order? The customer is told it was cancelled. This cannot be undone.</p>' +
          '<button type="button" class="btn btn-secondary dash-order-cancel-confirm" data-confirm-cancel="' +
          escapeHtml(order.id) +
          '">Cancel order</button>' +
          '<button type="button" class="btn btn-secondary" data-keep-order="true">Keep order</button>';
      } else {
        actions +=
          '<button type="button" class="dash-order-cancel" data-ask-cancel="true">Cancel order</button>';
      }
    }
    actions += '</div>';

    body.innerHTML =
      '<p class="dash-order-sheet-customer"><strong>' +
      escapeHtml(order.customer) +
      '</strong><span class="dash-muted"> · ' +
      escapeHtml(order.phone) +
      '</span></p>' +
      '<p class="dash-order-sheet-status"><span class="dash-status ' +
      statusClass(order.status) +
      '">' +
      escapeHtml(statusLabel(order.status)) +
      '</span></p>' +
      '<ul class="dash-order-lines">' +
      lines +
      '</ul>' +
      '<p class="dash-order-total"><span>Total</span><strong>' +
      escapeHtml(formatInr(order.amount)) +
      '</strong></p>' +
      actions;

    bindOrderControls(body);
    body.querySelectorAll('[data-ask-cancel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        confirmingCancel = true;
        renderOrderSheet();
      });
    });
    body.querySelectorAll('[data-keep-order]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        confirmingCancel = false;
        renderOrderSheet();
      });
    });
    body.querySelectorAll('[data-confirm-cancel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        cancelOrder(btn.getAttribute('data-confirm-cancel'));
      });
    });
  }

  function productFeatureList(product) {
    if (Array.isArray(product.features) && product.features.length) {
      return product.features
        .filter(function (f) {
          return f && (f.label || f.value);
        })
        .map(function (f) {
          return { label: String(f.label || ''), value: String(f.value || '') };
        });
    }
    return [{ label: '', value: '' }];
  }

  function productImages(product) {
    var list = [];
    if (Array.isArray(product.images)) {
      product.images.forEach(function (src) {
        if (typeof src === 'string' && src && list.indexOf(src) === -1) list.push(src);
      });
    }
    if (product.image && list.indexOf(product.image) === -1) list.unshift(product.image);
    return list;
  }

  function syncProductCover(product) {
    var images = productImages(product);
    product.images = images;
    product.image = images[0] || '';
    return images;
  }

  function productThumbHtml(product) {
    var cover = productImages(product)[0];
    if (cover) {
      return '<img class="dash-product-thumb" src="' + escapeHtml(cover) + '" alt="">';
    }
    return (
      '<span class="dash-product-thumb dash-product-thumb-fallback" aria-hidden="true">' +
      escapeHtml(product.icon || '▦') +
      '</span>'
    );
  }

  function photoManualHtml() {
    return (
      '<details class="dash-photo-manual">' +
      '<summary>Where do my photos show? (quick guide)</summary>' +
      '<div class="dash-photo-manual-body">' +
      '<ol class="dash-photo-manual-steps">' +
      '<li><strong>Add photos</strong> — choose several at once, or add one by one. Up to 6 square photos.</li>' +
      '<li><strong>Cover photo</strong> — the first one (badge “Card”) is the shop listing thumbnail.</li>' +
      '<li><strong>Details gallery</strong> — big photo on the left; thumbnails underneath for every image.</li>' +
      '<li><strong>Highlights</strong> — short feature labels (e.g. Easily Digestible) show as chips under the photo.</li>' +
      '<li><strong>Size</strong> — square only. Card: <strong>1000 × 1000 px</strong>. Details: <strong>1600 × 1600 px</strong>.</li>' +
      '</ol>' +
      '<div class="dash-photo-map" aria-hidden="true">' +
      '<div class="dash-photo-map-card">' +
      '<span class="dash-photo-map-label">Shop card</span>' +
      '<div class="dash-photo-map-frame is-card"><span>1</span></div>' +
      '<p>Cover only<br>1000 × 1000</p>' +
      '</div>' +
      '<div class="dash-photo-map-arrow">→</div>' +
      '<div class="dash-photo-map-card">' +
      '<span class="dash-photo-map-label">Details page</span>' +
      '<div class="dash-photo-map-frame is-detail"><span>1</span><span>2</span><span>3</span></div>' +
      '<p>Main + thumbs<br>1600 × 1600</p>' +
      '</div>' +
      '</div>' +
      '<p class="dash-product-hint">Tip: photo 1 = hero shot customers see first. Photos 2–3 = packing, size, or serving.</p>' +
      '</div></details>'
    );
  }

  function photoStripHtml(images) {
    if (!images.length) {
      return '<p class="dash-product-hint" data-photo-empty>No photos yet — add your first square photo below.</p>';
    }
    return (
      '<ul class="dash-photo-strip" data-photo-strip>' +
      images
        .map(function (src, index) {
          return (
            '<li class="dash-photo-chip' +
            (index === 0 ? ' is-cover' : '') +
            '">' +
            '<img src="' +
            escapeHtml(src) +
            '" alt="Photo ' +
            (index + 1) +
            '">' +
            '<span class="dash-photo-chip-badge">' +
            (index === 0 ? 'Card' : 'Gallery') +
            '</span>' +
            '<div class="dash-photo-chip-actions">' +
            (index === 0
              ? ''
              : '<button type="button" class="btn btn-secondary btn-sm" data-photo-cover="' +
                index +
                '">Make card photo</button>') +
            '<button type="button" class="btn btn-secondary btn-sm" data-photo-save="' +
            index +
            '">Save image</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-photo-remove="' +
            index +
            '">Remove</button>' +
            '</div></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function guessImageExt(src) {
    if (/^data:image\/jpeg/i.test(src) || /^data:image\/jpg/i.test(src)) return 'jpg';
    if (/^data:image\/webp/i.test(src)) return 'webp';
    if (/\.jpe?g(\?|$)/i.test(src)) return 'jpg';
    if (/\.webp(\?|$)/i.test(src)) return 'webp';
    return 'png';
  }

  /** Download one product photo to the device (works for data URLs and http images). */
  function saveProductImage(src, product, index) {
    if (!src) return;
    var base =
      ((product && product.name) || 'product')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'product';
    var filename = base + '-photo-' + (index + 1) + '.' + guessImageExt(src);

    if (src.indexOf('data:') === 0) {
      var link = document.createElement('a');
      link.href = src;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    if (D && typeof D.downloadQrImage === 'function') {
      D.downloadQrImage(src, filename);
      return;
    }

    fetch(src)
      .then(function (res) {
        return res.blob();
      })
      .then(function (blob) {
        var objectUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
      })
      .catch(function () {
        window.open(src, '_blank', 'noopener');
      });
  }

  function featureRowsHtml(features) {
    return features
      .map(function (f, index) {
        return (
          '<li class="dash-feature-row">' +
          '<div class="dash-product-field">' +
          (index === 0 ? '<label>Label</label>' : '') +
          '<input type="text" data-feature-label="' +
          index +
          '" value="' +
          escapeHtml(f.label) +
          '" placeholder="e.g. Brand" aria-label="Feature label ' +
          (index + 1) +
          '">' +
          '</div>' +
          '<div class="dash-product-field">' +
          (index === 0 ? '<label>Detail</label>' : '') +
          '<input type="text" data-feature-value="' +
          index +
          '" value="' +
          escapeHtml(f.value) +
          '" placeholder="e.g. Your brand name" aria-label="Feature detail ' +
          (index + 1) +
          '">' +
          '</div>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-feature-remove="' +
          index +
          '" aria-label="Remove feature ' +
          (index + 1) +
          '">Remove</button>' +
          '</li>'
        );
      })
      .join('');
  }

  function productEditorHtml(product) {
    var features = productFeatureList(product);
    var images = syncProductCover(product);
    var samples = FEATURE_SAMPLES.map(function (sample) {
      return (
        '<button type="button" class="dash-feature-sample" data-feature-sample="' +
        escapeHtml(sample.label) +
        '">+ ' +
        escapeHtml(sample.label) +
        '</button>'
      );
    }).join('');

    return (
      '<div class="dash-product-editor" data-product-editor="' +
      escapeHtml(product.id) +
      '">' +
      photoManualHtml() +
      '<div class="dash-product-photos">' +
      '<div class="dash-product-field">' +
      '<label>Product photos</label>' +
      '<p class="dash-product-hint">Pick <strong>multiple files together</strong>, or add them one by one. First photo = shop card; rest = details gallery.</p>' +
      '</div>' +
      photoStripHtml(images) +
      '<div class="dash-product-photo-row">' +
      '<div class="dash-product-field" style="flex:1;min-width:12rem">' +
      '<label class="sr-only" for="dash-photo-' +
      escapeHtml(product.id) +
      '">Add product photos</label>' +
      '<input id="dash-photo-' +
      escapeHtml(product.id) +
      '" type="file" accept="image/png,image/jpeg,image/webp" multiple data-product-photo aria-label="Add photos for ' +
      escapeHtml(product.name || 'product') +
      '">' +
      '<p class="dash-product-hint">Square photos · Card <strong>1000 × 1000</strong> · Details <strong>1600 × 1600</strong> · PNG, JPEG, or WebP · max 6</p>' +
      '</div></div></div>' +
      '<div class="dash-product-field">' +
      '<label for="dash-desc-' +
      escapeHtml(product.id) +
      '">Short description</label>' +
      '<textarea id="dash-desc-' +
      escapeHtml(product.id) +
      '" data-product-description placeholder="What makes this product special?">' +
      escapeHtml(product.description || '') +
      '</textarea>' +
      '</div>' +
      '<div>' +
      '<div class="dash-product-field"><label>Product features</label></div>' +
      '<p class="dash-product-hint">Tap a sample, then edit the words for your product.</p>' +
      '<div class="dash-feature-samples">' +
      samples +
      '</div>' +
      '<ul class="dash-feature-rows" data-feature-rows>' +
      featureRowsHtml(features) +
      '</ul>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-feature-add style="margin-top:0.5rem">Add row</button>' +
      '</div>' +
      '<div class="dash-product-field">' +
      '<label for="dash-ig-' +
      escapeHtml(product.id) +
      '">Instagram (optional)</label>' +
      '<input id="dash-ig-' +
      escapeHtml(product.id) +
      '" type="text" data-product-instagram value="' +
      escapeHtml(product.instagramUrl || '') +
      '" placeholder="@yourshop or https://instagram.com/p/…">' +
      '<p class="dash-product-hint">Link a reel or profile so customers can see how you make or use this product.</p>' +
      '</div>' +
      '<div class="dash-product-editor-actions">' +
      '<button type="button" class="btn btn-primary btn-sm" data-product-save>Save details</button>' +
      '<a class="btn btn-secondary btn-sm" href="store.html?view=product&amp;product=' +
      encodeURIComponent(product.id) +
      '" target="_blank" rel="noopener">Preview on shop</a>' +
      '<span class="dash-product-saved" data-product-saved hidden>Saved — opens on your shop</span>' +
      '</div>' +
      '</div>'
    );
  }

  function persistStore() {
    if (!state.store) return;
    if (D && typeof D.saveDraft === 'function') D.saveDraft(state.store);
    if (API && typeof API.saveRelease === 'function') {
      try {
        API.saveRelease(state.store);
      } catch (e) {
        /* prototype: draft save is enough */
      }
    }
  }

  function findStoreProduct(productId) {
    return ((state.store && state.store.products) || []).find(function (p) {
      return String(p.id) === String(productId);
    });
  }

  function readFeatureRows(editor) {
    var labels = editor.querySelectorAll('[data-feature-label]');
    var rows = [];
    labels.forEach(function (input) {
      var index = input.getAttribute('data-feature-label');
      var valueInput = editor.querySelector('[data-feature-value="' + index + '"]');
      rows.push({
        label: (input.value || '').trim(),
        value: valueInput ? (valueInput.value || '').trim() : ''
      });
    });
    return rows.filter(function (row) {
      return row.label || row.value;
    });
  }

  function bindProductEditor(editor, product) {
    var rowsEl = editor.querySelector('[data-feature-rows]');

    function rerenderRows(features) {
      if (!rowsEl) return;
      rowsEl.innerHTML = featureRowsHtml(features.length ? features : [{ label: '', value: '' }]);
    }

    editor.querySelectorAll('[data-feature-sample]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var label = btn.getAttribute('data-feature-sample');
        var sample = FEATURE_SAMPLES.find(function (item) {
          return item.label === label;
        });
        if (!sample) return;
        var rows = readFeatureRows(editor);
        var existing = rows.find(function (row) {
          return row.label.toLowerCase() === sample.label.toLowerCase();
        });
        if (existing) {
          if (!existing.value) existing.value = sample.value;
        } else {
          rows.push({ label: sample.label, value: sample.value });
        }
        rerenderRows(rows);
      });
    });

    var MAX_PRODUCT_PHOTOS = 6;

    editor.addEventListener('click', function (event) {
      var add = event.target.closest('[data-feature-add]');
      var remove = event.target.closest('[data-feature-remove]');
      var coverBtn = event.target.closest('[data-photo-cover]');
      var savePhoto = event.target.closest('[data-photo-save]');
      var removePhoto = event.target.closest('[data-photo-remove]');
      if (add) {
        var rows = readFeatureRows(editor);
        rows.push({ label: '', value: '' });
        rerenderRows(rows);
      }
      if (remove) {
        var idx = Number(remove.getAttribute('data-feature-remove'));
        var next = readFeatureRows(editor).filter(function (_row, i) {
          return i !== idx;
        });
        rerenderRows(next);
      }
      if (coverBtn) {
        var coverIdx = Number(coverBtn.getAttribute('data-photo-cover'));
        var coverList = productImages(product);
        if (coverIdx > 0 && coverIdx < coverList.length) {
          var moved = coverList.splice(coverIdx, 1)[0];
          coverList.unshift(moved);
          product.images = coverList;
          syncProductCover(product);
          persistStore();
          renderProducts();
        }
      }
      if (savePhoto) {
        var saveIdx = Number(savePhoto.getAttribute('data-photo-save'));
        var saveList = productImages(product);
        if (saveIdx >= 0 && saveIdx < saveList.length) {
          saveProductImage(saveList[saveIdx], product, saveIdx);
        }
      }
      if (removePhoto) {
        var removeIdx = Number(removePhoto.getAttribute('data-photo-remove'));
        var nextImages = productImages(product).filter(function (_src, i) {
          return i !== removeIdx;
        });
        product.images = nextImages;
        syncProductCover(product);
        persistStore();
        renderProducts();
      }
    });

    var photoInput = editor.querySelector('[data-product-photo]');
    if (photoInput) {
      photoInput.addEventListener('change', function () {
        var files = photoInput.files ? Array.prototype.slice.call(photoInput.files) : [];
        photoInput.value = '';
        if (!files.length) return;
        var current = productImages(product);
        var room = Math.max(0, MAX_PRODUCT_PHOTOS - current.length);
        if (!room) {
          window.alert('You can add up to ' + MAX_PRODUCT_PHOTOS + ' photos per product.');
          return;
        }
        var batch = files.slice(0, room);
        var pending = batch.length;
        batch.forEach(function (file) {
          if (!file.type || file.type.indexOf('image/') !== 0) {
            pending -= 1;
            return;
          }
          var reader = new FileReader();
          reader.onload = function () {
            var src = String(reader.result || '');
            if (src) current.push(src);
            pending -= 1;
            if (pending <= 0) {
              product.images = current.slice(0, MAX_PRODUCT_PHOTOS);
              syncProductCover(product);
              persistStore();
              renderProducts();
            }
          };
          reader.onerror = function () {
            pending -= 1;
            if (pending <= 0) {
              product.images = current.slice(0, MAX_PRODUCT_PHOTOS);
              syncProductCover(product);
              persistStore();
              renderProducts();
            }
          };
          reader.readAsDataURL(file);
        });
      });
    }

    var saveBtn = editor.querySelector('[data-product-save]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var desc = editor.querySelector('[data-product-description]');
        var ig = editor.querySelector('[data-product-instagram]');
        product.description = desc ? desc.value.trim() : '';
        product.features = readFeatureRows(editor).filter(function (row) {
          return row.label && row.value;
        });
        product.instagramUrl = ig ? ig.value.trim() : '';
        persistStore();
        var saved = editor.querySelector('[data-product-saved]');
        if (saved) {
          saved.hidden = false;
          window.setTimeout(function () {
            saved.hidden = true;
          }, 2200);
        }
      });
    }
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
        var open = String(openProductId) === String(p.id);
        return (
          '<li class="dash-product-item' +
          (open ? ' is-open' : '') +
          '" data-product-id="' +
          escapeHtml(p.id) +
          '">' +
          '<button type="button" class="dash-product-summary" data-product-toggle="' +
          escapeHtml(p.id) +
          '" aria-expanded="' +
          (open ? 'true' : 'false') +
          '">' +
          '<span class="dash-product-summary-main">' +
          productThumbHtml(p) +
          '<span><span class="dash-product-name">' +
          escapeHtml(p.name || 'Untitled') +
          '</span><span class="dash-product-meta">' +
          skuCount +
          ' size' +
          (skuCount === 1 ? '' : 's') +
          (productImages(p).length ? '' : ' · Add photos') +
          '</span></span></span>' +
          '<span style="display:flex;align-items:center;gap:0.65rem">' +
          '<span class="dash-product-price">From ₹' +
          escapeHtml(String(from)) +
          '</span>' +
          '<span class="dash-product-chevron" aria-hidden="true">▾</span>' +
          '</span></button>' +
          (open ? productEditorHtml(p) : '') +
          '</li>'
        );
      })
      .join('');

    list.querySelectorAll('[data-product-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-product-toggle');
        openProductId = String(openProductId) === String(id) ? null : id;
        renderProducts();
      });
    });

    var openEditor = list.querySelector('[data-product-editor]');
    if (openEditor && openProductId) {
      var product = findStoreProduct(openProductId);
      if (product) bindProductEditor(openEditor, product);
    }
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
    var bannerCta = 'Pay ₹399';
    var kicker = 'Shop plan';
    var daysHtml = 'Shop is open';
    var copy = 'Mithra Social Starter is ₹399 each month. Pay with UPI, card or netbanking.';
    var payLabel = 'Pay ₹399';
    var showPay = true;
    var showIfUnpaid = needsPay;
    var showStop = billing.status === 'paid';
    var stopCopy = 'Stop any time. The shop stays open until the days you already paid for are over.';

    if (billing.status === 'trial') {
      chipLabel = days + (days === 1 ? ' day left' : ' days left');
      bannerTitle = days + ' free ' + (days === 1 ? 'day' : 'days') + ' left';
      bannerText =
        days <= 3
          ? ' — pay ₹399 with Razorpay now so customers can still open your shop.'
          : ' — after that, subscribe with Razorpay (₹399 / month) to keep the shop open.';
      bannerCta = 'Pay ₹399';
      kicker = 'Free days';
      daysHtml = days + ' <span>' + (days === 1 ? 'day left' : 'days left') + '</span>';
      copy =
        days <= 3
          ? 'Pay ₹399 with Razorpay now so customers can still open your shop when free days end.'
          : 'Your shop is live for 14 free days. After that, subscribe with Razorpay — ₹399 each month — to keep it open.';
      payLabel = 'Pay ₹399 with Razorpay';
    } else if (billing.status === 'paid') {
      chipLabel = 'Social Starter';
      bannerTitle = '';
      kicker = 'Paid';
      daysHtml = 'Shop is open';
      copy = 'You paid ₹399 via Razorpay. Shop stays open until ' + dateLabel + '. Next month is another ₹399.';
      showPay = false;
    } else if (billing.status === 'due') {
      chipLabel = 'Shop closed';
      bannerTitle = 'Shop is hidden from customers';
      bannerText = ' — last Razorpay payment did not go through. Pay ₹399 to open the shop again.';
      bannerCta = 'Pay ₹399';
      kicker = 'Payment failed';
      daysHtml = 'Shop is hidden';
      copy = 'Customers cannot see your shop. Pay ₹399 with Razorpay to open it again. Old orders are still here.';
      payLabel = 'Pay ₹399 with Razorpay';
    } else if (billing.status === 'stopping') {
      chipLabel = dateLabel ? 'Open until ' + dateLabel : 'Plan stopped';
      bannerTitle = dateLabel ? 'Shop stays open until ' + dateLabel : 'Plan stopped';
      bannerText = ' — then customers cannot see it. You can pay again any time with Razorpay.';
      bannerCta = 'Keep open · ₹399';
      kicker = 'Plan stopped';
      daysHtml = days + ' <span>' + (days === 1 ? 'day left' : 'days left') + '</span>';
      copy =
        'You stopped the plan. Shop stays open until ' +
        dateLabel +
        '. Pay ₹399 with Razorpay if you want to keep it after that.';
      payLabel = 'Keep shop open · ₹399';
      showIfUnpaid = true;
      showStop = false;
      stopCopy = 'Plan already stopped. Shop stays open until paid days end.';
    } else if (billing.status === 'closed') {
      chipLabel = 'Shop closed';
      bannerTitle = 'Shop is hidden from customers';
      bannerText = ' — pay ₹399 with Razorpay to open it again.';
      bannerCta = 'Pay ₹399';
      kicker = 'Shop closed';
      daysHtml = 'Shop is hidden';
      copy = 'Paid days are over. Customers cannot see your shop. Pay ₹399 with Razorpay to open it again.';
      payLabel = 'Pay ₹399 with Razorpay';
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
      payCta.textContent = needsPay ? 'Pay ₹399' : 'Shop plan';
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
        ? 'Shop closed — pay ₹399 with Razorpay'
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
            ' left. Share your shop link, then pay ₹399 with Razorpay so customers can still open it.'
          : 'Customers can order now. Share your shop link. Before free days end, pay ₹399 with Razorpay to keep the shop open.';
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
          historyItem('paid', 'Paid ₹399 via Razorpay', 'Shop open until ' + formatDayLabel(billing.periodEnd), 'Just now')
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
    var orderSheetClose = qs('dash-order-sheet-close');
    var orderSheetBackdrop = qs('dash-order-sheet-backdrop');
    if (orderSheetClose) orderSheetClose.addEventListener('click', closeOrderSheet);
    if (orderSheetBackdrop) orderSheetBackdrop.addEventListener('click', closeOrderSheet);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (openOrderId) {
        closeOrderSheet();
        return;
      }
      closePaySheet();
    });
    document.querySelectorAll('[data-order-filter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        orderFilter = chip.getAttribute('data-order-filter') || 'all';
        orderPage = 0;
        document.querySelectorAll('[data-order-filter]').forEach(function (c) {
          c.classList.toggle('is-active', c === chip);
        });
        renderOrders();
      });
    });
    var orderPagePrev = qs('orders-page-prev');
    var orderPageNext = qs('orders-page-next');
    if (orderPagePrev) {
      orderPagePrev.addEventListener('click', function () {
        if (orderPage > 0) goToOrderPage(orderPage - 1);
      });
    }
    if (orderPageNext) {
      orderPageNext.addEventListener('click', function () {
        var pages = orderPageCount(filteredOrders());
        if (orderPage < pages - 1) goToOrderPage(orderPage + 1);
      });
    }

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
