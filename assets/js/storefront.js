/**
 * MithraDirect public storefront — sample checkout experience + draft stores.
 */
(function () {
  'use strict';

  var D = window.MithraDraft;
  if (!D) return;

  var CART_KEY = 'mithra_store_cart';
  var SESSION_KEY = 'mithra_store_session';

  var state = {
    draft: null,
    view: 'home',
    activeCategory: 'all',
    productId: null,
    cart: [],
    discount: 0,
    coupon: '',
    customer: { phone: '', name: '', loggedIn: false },
    address: '',
    addressId: 'home',
    orderId: '',
    orderMessage: '',
    history: []
  };

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name) || '';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeHex(color) {
    var c = String(color || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(c)) {
      return ('#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toLowerCase();
    }
    return '#128c7e';
  }

  function hexToRgba(hex, alpha) {
    var h = normalizeHex(hex).slice(1);
    return (
      'rgba(' +
      parseInt(h.slice(0, 2), 16) +
      ',' +
      parseInt(h.slice(2, 4), 16) +
      ',' +
      parseInt(h.slice(4, 6), 16) +
      ',' +
      alpha +
      ')'
    );
  }

  function applyTheme(color) {
    var hex = normalizeHex(color);
    document.documentElement.style.setProperty('--store-theme', hex);
    document.documentElement.style.setProperty('--store-theme-soft', hexToRgba(hex, 0.12));
  }

  function loadCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      state.cart = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(state.cart)) state.cart = [];
    } catch (e) {
      state.cart = [];
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s && s.phone) {
        state.customer = {
          phone: s.phone,
          name: s.name || 'Guest',
          loggedIn: !!s.loggedIn
        };
      }
      if (s && s.address) state.address = s.address;
    } catch (e) {}
  }

  function saveSession() {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        phone: state.customer.phone,
        name: state.customer.name,
        loggedIn: state.customer.loggedIn,
        address: state.address
      })
    );
  }

  function resolveDraft() {
    var slug = qs('slug');
    var brand = qs('brand');
    var saved = D.loadDraft();
    var savedSlug = saved.slug || D.slugify((saved.settings && saved.settings.storeName) || '');

    // Optional brand overrides for demos
    if (brand === 'sai-ram' || slug === 'sai-ram-home-foods') {
      return D.seedSaiRamDraft();
    }

    // Explicit onboarding draft via ?slug= matching localStorage
    if (slug && saved.settings && saved.settings.storeName && slug === savedSlug) {
      return saved;
    }

    // Default: full static Geeta's Kitchen storefront (store.html)
    return D.seedStaticStorefront();
  }

  function findProduct(id) {
    return (state.draft.products || []).find(function (p) {
      return p.id === id;
    });
  }

  function findVariant(product, skuId) {
    return ((product && product.variants) || []).find(function (v) {
      return v.id === skuId;
    });
  }

  function cartCount() {
    return state.cart.reduce(function (n, line) {
      return n + (line.qty || 0);
    }, 0);
  }

  function cartSubtotal() {
    return state.cart.reduce(function (n, line) {
      return n + (Number(line.price) || 0) * (line.qty || 0);
    }, 0);
  }

  function deliveryCharge() {
    var d = state.draft.delivery || {};
    if (d.homeDelivery && d.homeDelivery.enabled) {
      return Number(d.homeDelivery.charge) || 0;
    }
    return 0;
  }

  function grandTotal() {
    return Math.max(0, cartSubtotal() + deliveryCharge() - (state.discount || 0));
  }

  function formatMoney(n) {
    return '₹' + Math.round(n);
  }

  /* ——— Cart mutations ——— */
  function addToCart(productId, skuId, qty) {
    qty = qty || 1;
    var product = findProduct(productId);
    var variant = findVariant(product, skuId);
    if (!product || !variant || variant.active === false) return;

    var existing = state.cart.find(function (l) {
      return l.skuId === skuId;
    });
    if (existing) {
      existing.qty += qty;
    } else {
      state.cart.push({
        productId: product.id,
        skuId: variant.id,
        name: product.name,
        label: variant.label,
        price: Number(variant.price) || 0,
        image: product.image || '',
        color: product.color || '',
        qty: qty
      });
    }
    saveCart();
    updateCartUI();
  }

  function setQty(skuId, qty) {
    var line = state.cart.find(function (l) {
      return l.skuId === skuId;
    });
    if (!line) return;
    if (qty <= 0) {
      state.cart = state.cart.filter(function (l) {
        return l.skuId !== skuId;
      });
    } else {
      line.qty = qty;
    }
    saveCart();
    updateCartUI();
    if (state.view === 'cart') renderCart();
    if (state.view === 'menu') renderMenuProducts();
    if (state.view === 'product') renderProductDetail(state.productId);
    if (state.view === 'checkout') renderCheckout();
  }

  function lineQty(skuId) {
    var line = state.cart.find(function (l) {
      return l.skuId === skuId;
    });
    return line ? line.qty : 0;
  }

  /* ——— Navigation ——— */
  function showView(name, opts) {
    opts = opts || {};
    if (!opts.replace && state.view && state.view !== name) {
      state.history.push(state.view);
      if (state.history.length > 20) state.history.shift();
    }
    state.view = name;
    document.querySelectorAll('.store-view').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-view') === name);
    });
    var back = document.getElementById('btn-back');
    var menu = document.getElementById('btn-menu');
    if (name === 'home') {
      back.hidden = true;
      menu.hidden = false;
    } else {
      back.hidden = false;
      menu.hidden = name !== 'menu';
    }
    updateCartUI();
    window.scrollTo(0, 0);
  }

  function goBack() {
    var prev = state.history.pop();
    if (prev) showView(prev, { replace: true });
    else showView('home', { replace: true });
  }

  function openDrawer(open) {
    document.getElementById('drawer').classList.toggle('open', open);
    document.getElementById('drawer-backdrop').classList.toggle('open', open);
    document.getElementById('drawer').setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  /* ——— Render helpers ——— */
  function productThumb(p, extraClass) {
    if (p.image) {
      return (
        '<img src="' +
        escapeHtml(p.image) +
        '" alt="" class="' +
        (extraClass || '') +
        '" onerror="this.style.display=\'none\'">'
      );
    }
    return '🫙';
  }

  function ratingStars(r) {
    var n = Number(r) || 0;
    return '★ ' + n.toFixed(1);
  }

  function skuControls(product, variant) {
    var qty = lineQty(variant.id);
    if (qty > 0) {
      return (
        '<div class="qty-stepper" data-sku="' +
        escapeHtml(variant.id) +
        '">' +
        '<button type="button" data-action="dec" aria-label="Decrease">−</button>' +
        '<span>' +
        qty +
        '</span>' +
        '<button type="button" data-action="inc" aria-label="Increase">+</button>' +
        '</div>'
      );
    }
    return (
      '<button type="button" class="btn-add" data-add="' +
      escapeHtml(product.id) +
      '" data-sku="' +
      escapeHtml(variant.id) +
      '">Add</button>'
    );
  }

  function renderSkuList(product) {
    var variants = (product.variants || []).filter(function (v) {
      return v.active !== false;
    });
    if (!variants.length) {
      return '<p class="muted-note">No variants available</p>';
    }
    return variants
      .map(function (v) {
        return (
          '<div class="sku-row">' +
          '<div>' +
          '<div class="sku-label">' +
          escapeHtml(v.label) +
          '</div>' +
          '<div class="sku-stock">In Stock</div>' +
          '<div class="sku-price">' +
          formatMoney(v.price) +
          (v.mrp && Number(v.mrp) > Number(v.price)
            ? ' <span class="sku-mrp">' + formatMoney(v.mrp) + '</span>'
            : '') +
          '</div>' +
          '</div>' +
          skuControls(product, v) +
          '</div>'
        );
      })
      .join('');
  }

  function renderHome() {
    var draft = state.draft;
    var hero = document.getElementById('store-hero');
    var rich = !!(draft.settings && draft.settings.richBanner && draft.settings.banner);

    document.getElementById('store-name').textContent = draft.settings.storeName;
    document.getElementById('store-tagline').textContent =
      draft.settings.tagline || 'Made with love, delivered to your home';
    document.getElementById('store-location').textContent = draft.settings.location || '';
    document.getElementById('home-address').textContent =
      state.address || draft.settings.address || draft.settings.location || 'Select address';

    var bannerImg = document.getElementById('store-banner-img');
    bannerImg.src = draft.settings.banner || 'assets/img/fresh.png';
    bannerImg.alt = draft.settings.storeName + ' banner';

    if (hero) {
      hero.classList.toggle('is-rich-banner', rich);
    }

    var catsEl = document.getElementById('store-categories');
    catsEl.innerHTML = (draft.categories || [])
      .map(function (c) {
        return (
          '<button type="button" class="store-cat-btn" data-cat="' +
          escapeHtml(c.id) +
          '">' +
          '<div class="store-cat-img">' +
          (c.image
            ? '<img src="' + escapeHtml(c.image) + '" alt="" onerror="this.remove()">'
            : escapeHtml(c.icon || '📦')) +
          '</div>' +
          '<div class="store-cat-name">' +
          escapeHtml(c.name) +
          '</div></button>'
        );
      })
      .join('');

    var popular = (draft.products || []).filter(function (p) {
      return p.popular;
    });
    if (!popular.length) popular = (draft.products || []).slice(0, 4);
    renderProductGrid(document.getElementById('store-products'), popular);
  }

  function renderProductGrid(el, products) {
    if (!products.length) {
      el.innerHTML = '<p class="muted-note">No products yet.</p>';
      return;
    }
    el.innerHTML = products
      .map(function (p) {
        var from = D.minPrice(p);
        return (
          '<article class="product-card" data-product="' +
          escapeHtml(p.id) +
          '">' +
          '<div class="store-product-img" style="background:' +
          escapeHtml(p.color || hexToRgba(normalizeHex(state.draft.settings.themeColor), 0.12)) +
          '">' +
          productThumb(p) +
          '</div>' +
          '<div class="product-card-body">' +
          '<h3>' +
          escapeHtml(p.name || 'Product') +
          '</h3>' +
          '<p class="product-price">From ' +
          formatMoney(from || 0) +
          '</p>' +
          '<p class="product-rating">' +
          ratingStars(p.rating) +
          '</p>' +
          '</div></article>'
        );
      })
      .join('');
  }

  function renderMenuRail() {
    var cats = [{ id: 'all', name: 'All', icon: '🍽️' }].concat(state.draft.categories || []);
    document.getElementById('menu-rail').innerHTML = cats
      .map(function (c) {
        var active = state.activeCategory === c.id ? ' active' : '';
        return (
          '<button type="button" class="menu-rail-item' +
          active +
          '" data-cat="' +
          escapeHtml(c.id) +
          '">' +
          '<span class="menu-rail-icon">' +
          (c.image
            ? '<img src="' + escapeHtml(c.image) + '" alt="">'
            : escapeHtml(c.icon || '📦')) +
          '</span>' +
          '<span>' +
          escapeHtml(c.name) +
          '</span></button>'
        );
      })
      .join('');
  }

  function renderMenuProducts() {
    var q = (document.getElementById('menu-search').value || '').toLowerCase().trim();
    var list = (state.draft.products || [])
      .filter(function (p) {
        if (state.activeCategory !== 'all' && p.categoryId !== state.activeCategory) return false;
        if (q && String(p.name || '').toLowerCase().indexOf(q) < 0) return false;
        return true;
      })
      .slice()
      .sort(function (a, b) {
        return a.order - b.order;
      });

    var el = document.getElementById('menu-products');
    if (!list.length) {
      el.innerHTML = '<p class="muted-note">No products in this category.</p>';
      return;
    }

    el.innerHTML = list
      .map(function (p) {
        return (
          '<article class="menu-product">' +
          '<button type="button" class="menu-product-head" data-product="' +
          escapeHtml(p.id) +
          '">' +
          '<div class="menu-thumb" style="background:' +
          escapeHtml(p.color || '#ecfdf5') +
          '">' +
          productThumb(p) +
          '</div>' +
          '<div class="menu-product-meta">' +
          '<h3>' +
          escapeHtml(p.name) +
          '</h3>' +
          '<p class="product-rating">' +
          ratingStars(p.rating) +
          '</p>' +
          '<p class="menu-product-desc">' +
          escapeHtml(p.description || '') +
          '</p>' +
          '</div></button>' +
          '<div class="menu-product-skus">' +
          renderSkuList(p) +
          '</div></article>'
        );
      })
      .join('');
  }

  function renderProductDetail(id) {
    var p = findProduct(id);
    if (!p) {
      showView('menu');
      return;
    }
    state.productId = id;
    var cat = (state.draft.categories || []).find(function (c) {
      return c.id === p.categoryId;
    });
    var el = document.getElementById('product-detail');
    el.innerHTML =
      '<div class="breadcrumb">' +
      '<button type="button" data-nav="home">Home</button> › ' +
      '<button type="button" data-cat="' +
      escapeHtml(p.categoryId) +
      '">' +
      escapeHtml((cat && cat.name) || 'Menu') +
      '</button> › ' +
      '<span class="breadcrumb-current">' +
      escapeHtml(p.name) +
      '</span></div>' +
      '<div class="store-product-img is-large" style="background:' +
      escapeHtml(p.color || '#ecfdf5') +
      '">' +
      productThumb(p) +
      '</div>' +
      '<div class="product-detail-body">' +
      '<h1 class="store-brand-font">' +
      escapeHtml(p.name) +
      '</h1>' +
      '<p class="product-rating">' +
      ratingStars(p.rating) +
      '</p>' +
      '<p class="product-detail-desc">' +
      escapeHtml(p.description || '') +
      '</p>' +
      accordion('Ingredients', p.ingredients) +
      accordion('Nutritional Information', p.nutrition) +
      accordion('Storage Instructions', p.storage) +
      accordion('Delivery Information', p.deliveryInfo) +
      '<h3 class="variant-title">Choose variant</h3>' +
      renderSkuList(p) +
      '</div>';
  }

  function accordion(title, body) {
    if (!body) return '';
    return (
      '<div class="accordion">' +
      '<button type="button" class="accordion-btn" data-acc>' +
      escapeHtml(title) +
      '<span>+</span></button>' +
      '<div class="accordion-panel"><p>' +
      escapeHtml(body) +
      '</p></div></div>'
    );
  }

  function renderCart() {
    var el = document.getElementById('cart-items');
    var proceed = document.getElementById('btn-proceed-login');
    if (!state.cart.length) {
      el.innerHTML =
        '<div class="cart-empty">' +
        '<p class="cart-empty-icon">🛒</p>' +
        '<p>Your cart is empty</p>' +
        '<button type="button" class="btn-primary-store is-inline" data-nav="menu">Browse Menu</button>' +
        '</div>';
      document.getElementById('cart-summary').innerHTML = '';
      proceed.classList.add('hidden');
      return;
    }
    proceed.classList.remove('hidden');
    el.innerHTML = state.cart
      .map(function (line) {
        return (
          '<div class="cart-line">' +
          '<div class="cart-line-thumb" style="background:' +
          escapeHtml(line.color || '#ecfdf5') +
          '">' +
          (line.image
            ? '<img src="' + escapeHtml(line.image) + '" alt="">'
            : '🫙') +
          '</div>' +
          '<div class="cart-line-body">' +
          '<div class="cart-line-top">' +
          '<div>' +
          '<h3>' +
          escapeHtml(line.name) +
          '</h3>' +
          '<p>' +
          escapeHtml(line.label) +
          '</p>' +
          '</div>' +
          '<button type="button" class="cart-remove" data-remove="' +
          escapeHtml(line.skuId) +
          '" aria-label="Remove">🗑</button>' +
          '</div>' +
          '<div class="cart-line-bottom">' +
          '<div class="qty-stepper" data-sku="' +
          escapeHtml(line.skuId) +
          '">' +
          '<button type="button" data-action="dec">−</button>' +
          '<span>' +
          line.qty +
          '</span>' +
          '<button type="button" data-action="inc">+</button>' +
          '</div>' +
          '<div class="cart-line-price">' +
          formatMoney(line.price * line.qty) +
          '</div>' +
          '</div></div></div>'
        );
      })
      .join('');

    renderBillSummary(document.getElementById('cart-summary'));
  }

  function renderBillSummary(el) {
    var sub = cartSubtotal();
    var del = deliveryCharge();
    var disc = state.discount || 0;
    el.innerHTML =
      '<div class="bill-row"><span>Subtotal</span><span>' +
      formatMoney(sub) +
      '</span></div>' +
      '<div class="bill-row"><span>Delivery Charge</span><span>' +
      formatMoney(del) +
      '</span></div>' +
      (disc
        ? '<div class="bill-row is-discount"><span>Discount</span><span>−' +
          formatMoney(disc) +
          '</span></div>'
        : '') +
      '<div class="bill-row is-total"><span>Grand Total</span><span>' +
      formatMoney(grandTotal()) +
      '</span></div>';
  }

  function renderCheckout() {
    var addrs = state.draft.addresses || [
      {
        id: 'home',
        label: 'Home',
        line: state.draft.settings.address || state.draft.settings.location || ''
      }
    ];
    if (!state.addressId) state.addressId = addrs[0].id;

    var selected = addrs.find(function (a) {
      return a.id === state.addressId;
    }) || addrs[0];
    state.address = selected.line;

    var addrEl = document.getElementById('checkout-addresses');
    if (addrEl) {
      addrEl.innerHTML = addrs
        .map(function (a) {
          var checked = a.id === state.addressId ? ' checked' : '';
          return (
            '<label class="pay-option address-option">' +
            '<input type="radio" name="delivery-addr" value="' +
            escapeHtml(a.id) +
            '"' +
            checked +
            '>' +
            '<span><strong class="addr-label">' +
            escapeHtml(a.label) +
            '</strong><br><span class="addr-line">' +
            escapeHtml(a.line) +
            '</span></span></label>'
          );
        })
        .join('');
    }

    var sum = document.getElementById('checkout-summary');
    var itemsHtml = state.cart
      .map(function (l) {
        return (
          '<div class="checkout-item">' +
          '<span>' +
          escapeHtml(l.name) +
          ' (' +
          escapeHtml(l.label) +
          ') × ' +
          l.qty +
          '</span>' +
          '<span>' +
          formatMoney(l.price * l.qty) +
          '</span></div>'
        );
      })
      .join('');
    sum.innerHTML =
      itemsHtml +
      '<div class="bill-lines">' +
      '<div class="bill-row"><span>Subtotal</span><span>' +
      formatMoney(cartSubtotal()) +
      '</span></div>' +
      '<div class="bill-row"><span>Delivery Charge</span><span>' +
      formatMoney(deliveryCharge()) +
      '</span></div>' +
      (state.discount
        ? '<div class="bill-row is-discount"><span>Discount</span><span>−' +
          formatMoney(state.discount) +
          '</span></div>'
        : '') +
      '<div class="bill-row is-total"><span>Grand Total</span><span>' +
      formatMoney(grandTotal()) +
      '</span></div></div>';
  }

  function updateCartUI() {
    var count = cartCount();
    var badge = document.getElementById('store-cart-badge');
    badge.textContent = String(count);
    badge.style.display = count ? '' : 'none';

    var bar = document.getElementById('cart-bar');
    var hideBar =
      state.view === 'cart' ||
      state.view === 'login' ||
      state.view === 'checkout' ||
      state.view === 'success';
    if (bar) {
      bar.classList.toggle('visible', count > 0 && !hideBar);
    }
    var countEl = document.getElementById('cart-bar-count');
    var totalEl = document.getElementById('cart-bar-total');
    if (countEl) {
      countEl.textContent = count + (count === 1 ? ' Item' : ' Items');
    }
    if (totalEl) {
      totalEl.textContent = formatMoney(grandTotal());
    }
  }

  function generateOrderId() {
    var d = new Date();
    var yy = String(d.getFullYear()).slice(2);
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    var rand = String(Math.floor(1000 + Math.random() * 9000));
    return 'MD' + yy + mm + dd + rand;
  }

  function buildWhatsAppMessage() {
    var pay = document.querySelector('input[name="pay"]:checked');
    var payLabel =
      pay && pay.value === 'upi'
        ? 'UPI / Card'
        : pay && pay.value === 'other'
          ? 'Other'
          : 'Pay on Delivery (Cash)';

    var lines = [
      '🛒 *New Order — ' + state.draft.settings.storeName + '*',
      '',
      '*Order ID:* ' + state.orderId,
      '*Customer:* ' + (state.customer.name || 'Guest'),
      '*Phone:* +91 ' + state.customer.phone,
      '*Address:* ' + (state.address || state.draft.settings.address || ''),
      '*Payment:* ' + payLabel,
      '',
      '*Items:*'
    ];
    state.cart.forEach(function (l, i) {
      lines.push(
        i +
          1 +
          '. ' +
          l.name +
          ' (' +
          l.label +
          ') × ' +
          l.qty +
          ' — ' +
          formatMoney(l.price * l.qty)
      );
    });
    lines.push('');
    lines.push('Subtotal: ' + formatMoney(cartSubtotal()));
    lines.push('Delivery: ' + formatMoney(deliveryCharge()));
    if (state.discount) lines.push('Discount: −' + formatMoney(state.discount));
    lines.push('*Total Amount: ' + formatMoney(grandTotal()) + '*');
    lines.push('');
    lines.push('Please confirm my order. Thank you!');
    return lines.join('\n');
  }

  function createOrder() {
    if (!document.getElementById('terms-check').checked) {
      alert('Please agree to the Terms & Conditions.');
      return;
    }
    if (!state.cart.length) {
      showView('menu');
      return;
    }
    state.orderId = generateOrderId();
    state.orderMessage = buildWhatsAppMessage();
    document.getElementById('order-id-display').textContent = state.orderId;
    var wa = state.draft.settings.whatsapp || state.draft.phone;
    var link = D.whatsappLink(wa, state.orderMessage);
    document.getElementById('btn-send-whatsapp').href = link;
    showView('success');
    // Clear cart after order
    state.cart = [];
    saveCart();
    updateCartUI();
    // Auto-open WhatsApp shortly after
    setTimeout(function () {
      window.open(link, '_blank', 'noopener');
    }, 400);
  }

  /* ——— Events ——— */
  function bindEvents() {
    document.getElementById('btn-menu').addEventListener('click', function () {
      openDrawer(true);
    });
    document.getElementById('drawer-backdrop').addEventListener('click', function () {
      openDrawer(false);
    });
    document.getElementById('btn-back').addEventListener('click', goBack);
    document.getElementById('btn-brand').addEventListener('click', function () {
      showView('home');
    });
    document.getElementById('btn-cart').addEventListener('click', function () {
      showView('cart');
      renderCart();
    });
    document.getElementById('btn-go-cart').addEventListener('click', function () {
      showView('cart');
      renderCart();
    });
    document.getElementById('btn-search').addEventListener('click', function () {
      showView('menu');
      renderMenuRail();
      renderMenuProducts();
      document.getElementById('menu-search').focus();
    });

    document.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openDrawer(false);
        var v = btn.getAttribute('data-nav');
        if (v === 'menu') {
          state.activeCategory = 'all';
          showView('menu');
          renderMenuRail();
          renderMenuProducts();
        } else if (v === 'cart') {
          showView('cart');
          renderCart();
        } else if (v === 'home') {
          showView('home');
        }
      });
    });

    document.getElementById('store-app').addEventListener('click', function (e) {
      var t = e.target.closest('[data-cat]');
      if (t && t.getAttribute('data-cat')) {
        state.activeCategory = t.getAttribute('data-cat');
        showView('menu');
        renderMenuRail();
        renderMenuProducts();
        return;
      }
      t = e.target.closest('[data-product]');
      if (t) {
        showView('product');
        renderProductDetail(t.getAttribute('data-product'));
        return;
      }
      t = e.target.closest('[data-add]');
      if (t) {
        addToCart(t.getAttribute('data-add'), t.getAttribute('data-sku'), 1);
        if (state.view === 'menu') renderMenuProducts();
        if (state.view === 'product') renderProductDetail(state.productId);
        return;
      }
      t = e.target.closest('.qty-stepper [data-action]');
      if (t) {
        var stepper = t.closest('.qty-stepper');
        var sku = stepper.getAttribute('data-sku');
        var qty = lineQty(sku);
        setQty(sku, t.getAttribute('data-action') === 'inc' ? qty + 1 : qty - 1);
        return;
      }
      t = e.target.closest('[data-remove]');
      if (t) {
        setQty(t.getAttribute('data-remove'), 0);
        return;
      }
      t = e.target.closest('[data-acc]');
      if (t) {
        var panel = t.nextElementSibling;
        var open = panel.classList.toggle('open');
        t.querySelector('span').textContent = open ? '−' : '+';
        return;
      }
    });

    document.getElementById('menu-search').addEventListener('input', renderMenuProducts);

    document.getElementById('btn-apply-coupon').addEventListener('click', function () {
      var code = (document.getElementById('coupon-input').value || '').trim().toUpperCase();
      var msg = document.getElementById('coupon-msg');
      if (code === 'MITHRA50' || code === 'HOME50') {
        state.discount = Math.min(50, cartSubtotal());
        state.coupon = code;
        msg.textContent = 'Coupon applied! ₹' + state.discount + ' off';
        msg.classList.remove('hidden', 'is-error');
      } else if (!code) {
        state.discount = 0;
        msg.classList.add('hidden');
      } else {
        state.discount = 0;
        msg.textContent = 'Invalid coupon. Try MITHRA50';
        msg.classList.remove('hidden');
        msg.classList.add('is-error');
      }
      renderCart();
      updateCartUI();
    });

    document.getElementById('btn-proceed-login').addEventListener('click', function () {
      if (!state.cart.length) return;
      if (state.customer.loggedIn) {
        showView('checkout');
        renderCheckout();
      } else {
        showView('login');
        document.getElementById('login-phone-step').classList.remove('hidden');
        document.getElementById('login-otp-step').classList.add('hidden');
      }
    });

    document.getElementById('btn-send-otp').addEventListener('click', function () {
      var phone = (document.getElementById('login-phone').value || '').replace(/\D/g, '');
      if (phone.length !== 10) {
        alert('Please enter a valid 10-digit mobile number.');
        return;
      }
      state.customer.phone = phone;
      document.getElementById('login-phone-step').classList.add('hidden');
      document.getElementById('login-otp-step').classList.remove('hidden');
    });

    document.getElementById('btn-verify-otp').addEventListener('click', function () {
      var otp = (document.getElementById('login-otp').value || '').replace(/\D/g, '');
      if (otp.length !== 6) {
        alert('Enter the 6-digit OTP (demo: any 6 digits).');
        return;
      }
      state.customer.loggedIn = true;
      state.customer.name = 'Customer';
      saveSession();
      showView('checkout');
      renderCheckout();
    });

    document.getElementById('btn-resend-otp').addEventListener('click', function () {
      alert('OTP resent (demo).');
    });

    document.getElementById('btn-create-order').addEventListener('click', createOrder);

    document.getElementById('btn-view-order').addEventListener('click', function () {
      alert(
        'Order ' +
          state.orderId +
          '\n\n' +
          (state.orderMessage || 'Order details sent on WhatsApp.')
      );
    });

    function promptAddress() {
      var next = window.prompt(
        'Enter delivery address',
        state.address || state.draft.settings.address || ''
      );
      if (next != null && next.trim()) {
        state.address = next.trim();
        state.addressId = 'custom';
        if (!state.draft.addresses) state.draft.addresses = [];
        var existing = state.draft.addresses.find(function (a) {
          return a.id === 'custom';
        });
        if (existing) {
          existing.line = state.address;
        } else {
          state.draft.addresses.push({
            id: 'custom',
            label: 'Other',
            line: state.address
          });
        }
        saveSession();
        document.getElementById('home-address').textContent = state.address;
        if (state.view === 'checkout') renderCheckout();
      }
    }
    document.getElementById('btn-change-address').addEventListener('click', promptAddress);
    var addAddrBtn = document.getElementById('btn-add-address');
    if (addAddrBtn) addAddrBtn.addEventListener('click', promptAddress);
    document.getElementById('btn-use-location').addEventListener('click', function () {
      state.address = state.draft.settings.address || 'Current location, Hyderabad';
      state.addressId = 'home';
      saveSession();
      document.getElementById('home-address').textContent = state.address;
    });

    document.getElementById('store-app').addEventListener('change', function (e) {
      if (e.target && e.target.name === 'delivery-addr') {
        state.addressId = e.target.value;
        saveSession();
        renderCheckout();
      }
    });
  }

  function initHeader(draft) {
    document.title = draft.settings.storeName + ' — MithraDirect';
    document.getElementById('store-header-name').textContent = draft.settings.storeName;
    document.getElementById('drawer-name').textContent = draft.settings.storeName;
    document.getElementById('drawer-tagline').textContent = draft.settings.tagline || '';

    var logo = draft.settings.logo || 'assets/img/logos/logo_dark_md.png';
    ['store-header-logo', 'drawer-logo'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.src = logo;
      el.alt = draft.settings.storeName;
    });

    var wa = draft.settings.whatsapp || draft.phone;
    var waBtn = document.getElementById('btn-header-wa');
    if (waBtn && wa) {
      waBtn.href = D.whatsappLink(
        wa,
        'Hi, I would like to order from ' + draft.settings.storeName
      );
    }

    if (draft.isSample) {
      var ribbon = document.getElementById('demo-ribbon');
      if (ribbon) ribbon.classList.remove('hidden');
    }
  }

  function init() {
    var draft = resolveDraft();
    var empty = document.getElementById('store-empty');
    var app = document.getElementById('store-app');

    if (!draft) {
      empty.classList.remove('hidden');
      var stage = document.getElementById('demo-stage');
      if (stage) stage.classList.add('hidden');
      return;
    }

    state.draft = draft;
    state.address = draft.settings.address || draft.settings.location || '';
    if (!state.activeCategory || state.activeCategory === 'all') {
      state.activeCategory = 'all';
    }

    applyTheme((draft.settings && draft.settings.themeColor) || '#128C7E');
    loadCart();
    loadSession();
    if (state.customer.loggedIn && !state.address) {
      state.address = draft.settings.address || '';
    }

    app.classList.remove('hidden');
    initHeader(draft);
    bindEvents();
    renderHome();
    updateCartUI();

    // Deep-link: ?view=menu
    var view = qs('view');
    if (view === 'menu') {
      showView('menu', { replace: true });
      renderMenuRail();
      renderMenuProducts();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
