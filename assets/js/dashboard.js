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
    settings: 'Settings'
  };

  var orderFilter = 'all';
  var state = {
    store: null,
    orders: []
  };

  function qs(id) {
    return document.getElementById(id);
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
    var sub = store.subscription || {};
    var slug = store.slug || (D ? D.slugify(settings.storeName) : 'my-store');
    var displayUrl = 'mithradirect.com/store/' + slug;
    var storeHref = 'store.html?slug=' + encodeURIComponent(slug);
    var planName = sub.planName || 'Free';

    if (qs('dash-store-name')) qs('dash-store-name').textContent = settings.storeName || 'Your store';
    if (qs('dash-store-url')) qs('dash-store-url').textContent = displayUrl;
    if (qs('dash-plan-label')) qs('dash-plan-label').textContent = planName + ' plan';
    if (qs('dash-banner-title')) qs('dash-banner-title').textContent = planName + ' plan active';

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

    if (qs('set-name')) qs('set-name').textContent = settings.storeName || '—';
    if (qs('set-whatsapp'))
      qs('set-whatsapp').textContent = settings.whatsapp ? '+91 ' + settings.whatsapp : '—';
    if (qs('set-location')) qs('set-location').textContent = settings.location || '—';
    if (qs('set-plan')) qs('set-plan').textContent = planName;
    if (qs('set-theme')) qs('set-theme').textContent = settings.themeColor || '—';

    var themeSwatch = qs('set-theme-swatch');
    if (themeSwatch && settings.themeColor) {
      themeSwatch.style.background = settings.themeColor;
      themeSwatch.hidden = false;
    }

    if (D && typeof D.applyTheme === 'function') {
      D.applyTheme(settings.themeColor || D.DEFAULT_THEME || '#10b981');
    } else if (settings.themeColor) {
      document.documentElement.style.setProperty('--store-theme', settings.themeColor);
    }
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
  }

  function init() {
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
