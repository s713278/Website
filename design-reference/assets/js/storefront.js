/**
 * MithraDirect public storefront — template UI driven by StoreAPI release data.
 * Data: localStorage today (StoreAPI); remote API when StoreAPI.setConfig({ useRemote: true }).
 */
(function () {
  'use strict';

  var D = window.MithraDraft;
  var API = window.StoreAPI;
  if (!D || !API) {
    console.error('MithraDraft / StoreAPI missing');
    return;
  }

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
    addressDetails: null,
    addressMapPinned: false,
    addressId: 'home',
    deliveryMethod: 'homeDelivery',
    orderId: '',
    orderMessage: '',
    selectedOrderId: '',
    history: [],
    pendingAdd: null,
    loginReturn: null,
    addressGateOpen: false
  };

  var WA_ICON =
    '<svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

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
    return D.normalizeHex ? D.normalizeHex(color) : String(color || D.DEFAULT_THEME || '#10b981').toLowerCase();
  }

  function hexToRgba(hex, alpha) {
    if (D.hexToRgba) return D.hexToRgba(hex, alpha);
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
    if (D.applyTheme) return D.applyTheme(color);
    var hex = normalizeHex(color);
    document.documentElement.style.setProperty('--store-theme', hex);
    document.documentElement.style.setProperty('--store-theme-soft', hexToRgba(hex, 0.14));
    return hex;
  }

  function loadCart() {
    state.cart = API.getCart();
  }

  function saveCart() {
    API.setCart(state.cart);
  }

  function loadSession() {
    var s = API.getSession();
    if (s && s.phone) {
      state.customer = {
        phone: s.phone,
        name: s.name || 'Guest',
        loggedIn: !!s.loggedIn
      };
    }
    if (s && s.address) state.address = s.address;
    if (s && s.addressDetails) state.addressDetails = s.addressDetails;
  }

  function saveSession() {
    API.setSession({
      phone: state.customer.phone,
      name: state.customer.name,
      loggedIn: state.customer.loggedIn,
      address: state.address,
      addressDetails: state.addressDetails
    });
  }

  /** Persist release mutations (addresses, etc.) back to local store */
  function persistRelease() {
    if (state.draft) API.saveRelease(state.draft);
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
    var method = state.deliveryMethod || 'homeDelivery';
    if (method === 'storePickup') return 0;
    if (method === 'courierDelivery' && d.courierDelivery && d.courierDelivery.enabled) {
      return Number(d.courierDelivery.charge) || 0;
    }
    if (d.homeDelivery && d.homeDelivery.enabled) {
      return Number(d.homeDelivery.charge) || 0;
    }
    if (d.courierDelivery && d.courierDelivery.enabled) {
      return Number(d.courierDelivery.charge) || 0;
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
  function hasDeliveryAddress() {
    return String(state.address || '').trim().length >= 8;
  }

  function isLoggedIn() {
    return !!(state.customer && state.customer.loggedIn && state.customer.phone);
  }

  function pendingFromAdd(productId, skuId, qty) {
    var product = findProduct(productId);
    var variant = findVariant(product, skuId);
    return {
      productId: productId,
      skuId: skuId,
      qty: qty || 1,
      name: (product && product.name) || 'Item',
      label: (variant && variant.label) || ''
    };
  }

  var storeOtpField = null;

  function ensureStoreOtp() {
    if (storeOtpField || !window.MithraOtp) return storeOtpField;
    var row = document.getElementById('login-otp-inputs');
    if (!row) return null;
    storeOtpField = window.MithraOtp.mount(row, { idPrefix: 'store-otp' });
    return storeOtpField;
  }

  function showLoginOtpError(message) {
    var el = document.getElementById('login-otp-error');
    if (!el) {
      alert(message);
      return;
    }
    el.textContent = message || '';
    el.classList.remove('hidden');
  }

  function hideLoginOtpError() {
    var el = document.getElementById('login-otp-error');
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
  }

  function requireLogin(returnTo, pending) {
    if (isLoggedIn()) return true;
    state.loginReturn = returnTo || 'cart';
    state.pendingAdd = pending || null;
    openLogin();
    return false;
  }

  function openLogin() {
    showView('login');
    document.getElementById('login-phone-step').classList.remove('hidden');
    document.getElementById('login-otp-step').classList.add('hidden');
    var phoneInput = document.getElementById('login-phone');
    if (phoneInput) {
      phoneInput.value = state.customer.phone || '';
      phoneInput.focus();
    }
    ensureStoreOtp();
    if (storeOtpField) storeOtpField.clear();
    hideLoginOtpError();
    syncLoginCopy();
  }

  function syncLoginCopy() {
    var title = document.getElementById('login-title');
    var sub = document.getElementById('login-sub');
    var chip = document.getElementById('login-intent');
    var verify = document.getElementById('btn-verify-otp');
    var pending = state.pendingAdd;
    var goingToCart = state.loginReturn !== 'checkout';

    if (pending && pending.name) {
      if (title) title.textContent = 'Sign in to add this';
      if (sub)
        sub.textContent = 'A quick OTP so this home kitchen can reach you on WhatsApp.';
      if (chip) {
        chip.hidden = false;
        chip.textContent = pending.label
          ? pending.name + ' · ' + pending.label
          : pending.name;
      }
    } else {
      if (title) title.textContent = 'Sign in to continue';
      if (sub) sub.textContent = "We'll send a one-time password to your phone.";
      if (chip) {
        chip.hidden = true;
        chip.textContent = '';
      }
    }
    if (verify) {
      verify.textContent = goingToCart ? 'Verify & go to cart' : 'Verify & continue';
    }
  }

  function finishLogin() {
    var pending = state.pendingAdd;
    var dest = state.loginReturn || 'cart';
    state.pendingAdd = null;
    state.loginReturn = null;
    if (pending && pending.productId && pending.skuId) {
      addToCart(pending.productId, pending.skuId, pending.qty || 1, { trusted: true });
    }
    if (dest === 'checkout') {
      showView('checkout', { replace: true });
      renderCheckout();
      if (!hasDeliveryAddress()) setAddressEditMode(true);
      return;
    }
    showView('cart', { replace: true });
    renderCart();
  }

  function addToCart(productId, skuId, qty, opts) {
    opts = opts || {};
    qty = qty || 1;
    if (!opts.trusted && !requireLogin('cart', pendingFromAdd(productId, skuId, qty))) {
      return;
    }
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
        icon: product.icon || '🫙',
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
    if (qty > line.qty && !requireLogin('cart', null)) return;
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

  function proceedToCheckout() {
    if (!state.cart.length) return;
    if (!requireLogin('checkout', null)) return;
    showView('checkout');
    renderCheckout();
    if (!hasDeliveryAddress()) setAddressEditMode(true);
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
    if (state.view === 'login') {
      state.pendingAdd = null;
      state.loginReturn = null;
    }
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
  function cssPlaceholder(label, icon, color) {
    return (
      '<div class="img-ph" style="--ph-bg:' +
      escapeHtml(color || '#ecfdf5') +
      '">' +
      '<span class="img-ph-icon" aria-hidden="true">' +
      escapeHtml(icon || '🫙') +
      '</span>' +
      (label ? '<span class="img-ph-label">' + escapeHtml(label) + '</span>' : '') +
      '</div>'
    );
  }

  function productThumb(p) {
    var color =
      (p && p.color) || hexToRgba(normalizeHex(state.draft.settings.themeColor), 0.12);
    var icon = (p && p.icon) || '🫙';
    var label = (p && p.name) || 'Product';
    var ph = cssPlaceholder(label, icon, color);
    if (p && p.image) {
      return (
        '<div class="media-slot">' +
        '<img src="' +
        escapeHtml(p.image) +
        '" alt="' +
        escapeHtml(label) +
        '" loading="lazy" onerror="this.classList.add(\'is-broken\')">' +
        ph +
        '</div>'
      );
    }
    return '<div class="media-slot is-placeholder">' + ph + '</div>';
  }

  function categoryThumb(c) {
    if (c.image) {
      return (
        '<div class="media-slot is-round">' +
        '<img src="' +
        escapeHtml(c.image) +
        '" alt="" loading="lazy" onerror="this.classList.add(\'is-broken\')">' +
        '<div class="img-ph is-round"><span class="img-ph-icon">' +
        escapeHtml(c.icon || '📦') +
        '</span></div></div>'
      );
    }
    return (
      '<div class="media-slot is-round is-placeholder">' +
      '<div class="img-ph is-round"><span class="img-ph-icon">' +
      escapeHtml(c.icon || '📦') +
      '</span></div></div>'
    );
  }

  function ratingStars(r, reviews) {
    var n = Number(r) || 0;
    var rev = Number(reviews) || 0;
    return '★ ' + n.toFixed(1) + (rev ? ' (' + rev + ')' : '');
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

  function mapsHref(address) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
  }

  function socialIcon(id) {
    if (id === 'facebook') {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z"/></svg>';
    }
    if (id === 'youtube') {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 12.2s0-3.2-.4-4.6c-.2-.9-.9-1.6-1.8-1.8C19.2 5.4 12 5.4 12 5.4s-7.2 0-8.8.4c-.9.2-1.6.9-1.8 1.8C1 9 1 12.2 1 12.2s0 3.2.4 4.6c.2.9.9 1.6 1.8 1.8 1.6.4 8.8.4 8.8.4s7.2 0 8.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.4.4-4.6.4-4.6zM9.8 15.5v-6.6l6.2 3.3-6.2 3.3z"/></svg>';
    }
    if (id === 'google') {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 11.2v2.9h4.6c-.2 1.2-1.4 3.5-4.6 3.5A5.4 5.4 0 1112 7.4c1.5 0 2.6.6 3.2 1.2l2.2-2.1A8.7 8.7 0 0012 3.4 8.6 8.6 0 103.4 12 8.6 8.6 0 0012 20.6c5 0 8.3-3.5 8.3-8.4 0-.6 0-1-.1-1.4H12z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
  }

  function renderContact(draft) {
    var section = document.getElementById('store-contact');
    var grid = document.getElementById('store-contact-grid');
    var social = document.getElementById('store-social');
    var socialLinks = document.getElementById('store-social-links');
    if (!section || !grid) return;

    var settings = draft.settings || {};
    var address = String(settings.address || settings.location || '').trim();
    var support = String(settings.supportWhatsapp || settings.whatsapp || draft.phone || '').trim();
    var name = settings.storeName || 'this shop';
    var cards = '';

    if (address) {
      cards +=
        '<a class="store-contact-card" id="store-contact-address" href="' +
        escapeHtml(mapsHref(address)) +
        '" target="_blank" rel="noopener">' +
        '<span class="store-contact-kicker">Find us</span>' +
        '<strong>' +
        escapeHtml(address) +
        '</strong>' +
        '<span class="store-contact-action">Open in Maps</span></a>';
    }

    if (support && D && D.whatsappLink) {
      cards +=
        '<a class="store-contact-card" id="store-contact-wa" href="' +
        escapeHtml(D.whatsappLink(support, 'Hi, I need help from ' + name)) +
        '" target="_blank" rel="noopener">' +
        '<span class="store-contact-kicker">Support</span>' +
        '<strong>WhatsApp us</strong>' +
        '<span class="store-contact-action">Message for help</span></a>';
    }

    grid.innerHTML = cards;

    var links = [
      { id: 'instagram', label: 'Instagram', href: settings.instagramUrl },
      { id: 'facebook', label: 'Facebook', href: settings.facebookUrl },
      { id: 'youtube', label: 'YouTube', href: settings.youtubeUrl },
      { id: 'google', label: 'Google reviews', href: settings.googleUrl }
    ].filter(function (item) {
      return String(item.href || '').trim();
    });

    if (social && socialLinks) {
      social.classList.toggle('hidden', links.length === 0);
      socialLinks.innerHTML = links
        .map(function (item) {
          return (
            '<a class="store-social-link" href="' +
            escapeHtml(item.href) +
            '" target="_blank" rel="noopener">' +
            socialIcon(item.id) +
            '<span>' +
            escapeHtml(item.label) +
            '</span></a>'
          );
        })
        .join('');
    }

    var visible = !!(cards || links.length);
    section.classList.toggle('hidden', !visible);
    var topContact = document.querySelector('.demo-topbar [data-nav="contact"]');
    if (topContact) topContact.hidden = !visible;
    var heroContact = document.getElementById('store-location');
    if (heroContact) {
      var place = String(settings.location || '').trim();
      heroContact.textContent = place;
      heroContact.hidden = !visible || !place;
    }
  }

  function renderHome() {
    var draft = state.draft;
    var hero = document.getElementById('store-hero');

    document.getElementById('store-name').textContent = draft.settings.storeName;
    document.getElementById('store-tagline').textContent =
      draft.settings.tagline || 'Made with love, delivered to your home';
    renderContact(draft);
    syncHomeAddressUI();

    var bannerImg = document.getElementById('store-banner-img');
    if (hero) {
      hero.classList.remove('is-rich-banner');
      hero.classList.remove('is-ph-banner');
      hero.classList.remove('has-designed-banner');
    }
    if (draft.settings.banner) {
      bannerImg.src = draft.settings.banner;
      bannerImg.alt = draft.settings.storeName + ' banner';
      bannerImg.classList.remove('is-broken');
      if (hero && draft.settings.richBanner) {
        hero.classList.add('is-rich-banner');
        hero.classList.add('has-designed-banner');
      }
      bannerImg.onerror = function () {
        bannerImg.classList.add('is-broken');
        if (hero) {
          hero.classList.add('is-ph-banner');
          hero.classList.remove('has-designed-banner');
        }
      };
    } else {
      bannerImg.removeAttribute('src');
      bannerImg.classList.add('is-broken');
      if (hero) hero.classList.add('is-ph-banner');
    }

    var catsEl = document.getElementById('store-categories');
    catsEl.innerHTML = (draft.categories || [])
      .map(function (c) {
        return (
          '<button type="button" class="store-cat-btn" data-cat="' +
          escapeHtml(c.id) +
          '">' +
          '<div class="store-cat-img">' +
          categoryThumb(c) +
          '</div>' +
          '<div class="store-cat-name">' +
          escapeHtml(c.name) +
          '</div></button>'
        );
      })
      .join('');

    var windowEl = document.getElementById('delivery-window');
    if (windowEl) {
      var win = draft.settings.deliveryWindow || '6 PM – 9 PM';
      windowEl.textContent = hasDeliveryAddress()
        ? 'We can deliver here · Today ' + win
        : 'Homemade · Fresh · Delivered around ' + win;
    }

    var popular = (draft.products || []).filter(function (p) {
      return p.popular;
    });
    if (!popular.length) popular = (draft.products || []).slice(0, 4);
    renderProductGrid(document.getElementById('store-products'), popular);
  }

  function syncHomeAddressUI() {
    var ready = hasDeliveryAddress();
    var panel = document.getElementById('address-panel');
    var value = document.getElementById('home-address');
    var label = document.getElementById('home-address-label');
    var hint = document.getElementById('home-address-hint');
    var btn = document.getElementById('btn-change-address');
    if (panel) panel.classList.toggle('needs-address', !ready);
    if (value) {
      value.textContent = ready ? state.address : 'Add your delivery address';
    }
    if (label) label.textContent = ready ? 'Delivering to' : 'Where should we deliver?';
    if (hint) {
      hint.hidden = ready;
      hint.textContent = 'Optional now — we’ll confirm it at checkout before WhatsApp.';
    }
    if (btn) btn.textContent = ready ? 'Change' : 'Add address';
  }

  function openAddressGate(reason, pending) {
    var gate = document.getElementById('addr-gate');
    if (!gate) return;
    state.addressGateOpen = true;
    gate.hidden = false;
    gate.setAttribute('aria-hidden', 'false');
    document.body.classList.add('addr-gate-open');

    var title = document.getElementById('addr-gate-title');
    var lead = document.getElementById('addr-gate-lead');
    var eyebrow = document.getElementById('addr-gate-eyebrow');
    var saveBtn = document.getElementById('addr-gate-save');
    var storeName = (state.draft && state.draft.settings && state.draft.settings.storeName) || 'this home kitchen';

    if (reason === 'change') {
      if (eyebrow) eyebrow.textContent = 'Update delivery';
      if (title) title.textContent = 'Change delivery address';
      if (lead) lead.textContent = 'We’ll send your ' + storeName + ' order here.';
      if (saveBtn) saveBtn.textContent = 'Save address';
    } else if (reason === 'checkout') {
      if (eyebrow) eyebrow.textContent = 'Last step before WhatsApp';
      if (title) title.textContent = 'Where should we deliver?';
      if (lead)
        lead.textContent =
          'Add your address so ' + storeName + ' can send this order without back-and-forth.';
      if (saveBtn) saveBtn.textContent = 'Save & review order';
    } else {
      if (eyebrow) eyebrow.textContent = 'Optional';
      if (title) title.textContent = 'Where should we deliver?';
      if (lead)
        lead.textContent =
          'Save it now, or add it at checkout before your WhatsApp order.';
      if (saveBtn) saveBtn.textContent = 'Save address';
    }

    var skip = document.getElementById('addr-gate-skip');
    if (skip) skip.hidden = reason === 'checkout';

    var input = document.getElementById('addr-gate-input');
    var err = document.getElementById('addr-gate-error');
    if (err) err.hidden = true;
    if (input) {
      input.value = state.address || '';
      setTimeout(function () {
        input.focus();
      }, 180);
    }
  }

  function closeAddressGate() {
    var gate = document.getElementById('addr-gate');
    if (!gate) return;
    state.addressGateOpen = false;
    gate.hidden = true;
    gate.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('addr-gate-open');
  }

  function commitDeliveryAddress(line) {
    var text = String(line || '').trim();
    if (text.length < 8) {
      var err = document.getElementById('addr-gate-error');
      if (err) {
        err.hidden = false;
        err.textContent = 'Add a bit more detail (area + city) so this home kitchen can find you.';
      }
      return false;
    }
    state.address = text;
    state.addressId = state.addressId || 'home';
    if (!state.draft.addresses) state.draft.addresses = [];
    var current = state.draft.addresses.find(function (a) {
      return a.id === state.addressId;
    });
    if (current) {
      current.line = text;
    } else {
      state.draft.addresses = [{ id: 'home', label: 'Home', line: text }];
      state.addressId = 'home';
    }
    saveSession();
    persistRelease();
    syncHomeAddressUI();
    closeAddressGate();
    if (state.view === 'checkout') {
      setAddressEditMode(false);
      renderCheckout();
    }
    return true;
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
          '<div class="store-product-img">' +
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
          ratingStars(p.rating, p.reviews) +
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
          categoryThumb(c) +
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
          '<div class="menu-thumb">' +
          productThumb(p) +
          '</div>' +
          '<div class="menu-product-meta">' +
          '<h3>' +
          escapeHtml(p.name) +
          '</h3>' +
          '<p class="product-rating">' +
          ratingStars(p.rating, p.reviews) +
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
      '<div class="product-detail-hero">' +
      '<div class="store-product-img is-large">' +
      productThumb(p) +
      '</div>' +
      '<div class="product-detail-actions">' +
      '<button type="button" class="icon-chip" id="btn-share-product" aria-label="Share">↗ Share</button>' +
      '</div></div>' +
      '<div class="product-detail-body">' +
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
      '<h1 class="store-brand-font">' +
      escapeHtml(p.name) +
      '</h1>' +
      '<p class="product-rating">' +
      ratingStars(p.rating, p.reviews) +
      '</p>' +
      '<p class="product-detail-desc">' +
      escapeHtml(p.description || '') +
      '</p>' +
      '<div class="usp-pills">' +
      '<span>🌿 100% Natural</span><span>🚫 No Preservatives</span><span>🧼 Hygienic &amp; Safe</span>' +
      '</div>' +
      accordion('Ingredients', p.ingredients) +
      accordion('Nutritional Information', p.nutrition) +
      accordion('Storage Instructions', p.storage) +
      accordion('Delivery Information', p.deliveryInfo) +
      '<h3 class="variant-title">Choose variant</h3>' +
      renderSkuList(p) +
      '</div>';

    var shareBtn = document.getElementById('btn-share-product');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        var text =
          'Check out ' +
          p.name +
          ' from ' +
          state.draft.settings.storeName +
          ' on MithraDirect';
        if (navigator.share) {
          navigator.share({ title: p.name, text: text }).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(text);
          alert('Product link text copied');
        }
      });
    }
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
    var proceed = document.getElementById('btn-proceed-checkout');
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
          '<div class="cart-line-thumb">' +
          productThumb({
            name: line.name,
            image: line.image,
            icon: line.icon || '🫙',
            color: line.color || '#ecfdf5'
          }) +
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

  function ensureAddress() {
    if (!state.draft.addresses || !state.draft.addresses.length) {
      state.draft.addresses = [{ id: 'home', label: 'Home', line: state.address || '' }];
    }
    if (!state.addressId) state.addressId = state.draft.addresses[0].id;
    var selected =
      state.draft.addresses.find(function (a) {
        return a.id === state.addressId;
      }) || state.draft.addresses[0];
    // Prefer customer session address; never invent from vendor shop location
    if (!state.address && selected && String(selected.line || '').trim().length >= 8) {
      state.address = selected.line;
    }
    return selected;
  }

  function emptyAddressDetails() {
    return {
      name: '',
      contactNumber: '',
      address1: '',
      address2: '',
      city: '',
      district: '',
      state: '',
      zipCode: ''
    };
  }

  function usableCustomerName(name) {
    var text = String(name || '').trim();
    if (!text || text === 'Guest' || text === 'User' || text === 'Vendor') return '';
    return text;
  }

  function contactDigits(value) {
    var raw = String(value || '').replace(/\D/g, '');
    if (raw.length >= 10) return raw.slice(-10);
    return raw;
  }

  function formatAddressDetails(form) {
    var street = [form.address1, form.address2]
      .map(function (value) {
        return String(value || '')
          .replace(/\s*\n+\s*/g, ', ')
          .replace(/\s+/g, ' ')
          .trim();
      })
      .filter(Boolean)
      .join(', ');
    var area = [form.city, form.district, form.state]
      .map(function (value) {
        return String(value || '').trim();
      })
      .filter(Boolean)
      .join(', ');
    var pin = String(form.zipCode || '').trim();
    return [street, [area, pin].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  }

  function addressFormFromState() {
    var saved = state.addressDetails || emptyAddressDetails();
    var form = {
      name: usableCustomerName(saved.name) || usableCustomerName(state.customer.name),
      contactNumber: contactDigits(saved.contactNumber) || contactDigits(state.customer.phone),
      address1: String(saved.address1 || '').trim(),
      address2: String(saved.address2 || '').trim(),
      city: String(saved.city || '').trim(),
      district: String(saved.district || '').trim(),
      state: String(saved.state || '').trim(),
      zipCode: String(saved.zipCode || '').replace(/\D/g, '').slice(0, 6)
    };
    if (!form.address1 && !form.address2 && !form.city && state.address) {
      form.address1 = state.address;
    }
    return form;
  }

  var ADDRESS_EDIT_FIELDS = [
    ['checkout-addr-name', 'name'],
    ['checkout-addr-contact', 'contactNumber'],
    ['checkout-addr-city', 'city'],
    ['checkout-addr-district', 'district'],
    ['checkout-addr-state', 'state'],
    ['checkout-addr-zip', 'zipCode']
  ];

  function savedAddressText(form) {
    return [form.address1, form.address2]
      .map(function (value) {
        return String(value || '').trim();
      })
      .filter(Boolean)
      .join(', ');
  }

  function readAddressEditForm() {
    var form = emptyAddressDetails();
    ADDRESS_EDIT_FIELDS.forEach(function (pair) {
      var input = document.getElementById(pair[0]);
      form[pair[1]] = input ? String(input.value || '').trim() : '';
    });
    var address = document.getElementById('checkout-addr-text');
    form.address1 = address ? String(address.value || '').trim() : '';
    form.address2 = '';
    form.contactNumber = contactDigits(form.contactNumber);
    form.zipCode = form.zipCode.replace(/\D/g, '').slice(0, 6);
    return form;
  }

  function mapEnabled() {
    var edit = document.getElementById('checkout-address-edit');
    return !!(edit && edit.getAttribute('data-map-enabled') === 'true');
  }

  function addressEditError(form) {
    if (!form.name) return 'Enter the name for this delivery.';
    if (!/^\d{10}$/.test(form.contactNumber)) return 'Enter a 10-digit phone number.';
    if (!String(form.address1 || '').replace(/\s+/g, '')) return 'Enter the address.';
    if (!form.city) return 'Enter the city.';
    if (!form.district) return 'Enter the district.';
    if (!form.state) return 'Enter the state.';
    if (!/^\d{6}$/.test(form.zipCode)) return 'Enter a 6-digit ZIP code.';
    if (mapEnabled() && !state.addressMapPinned) return 'Pin this address on Google Map.';
    return '';
  }

  function showAddressEditError(message) {
    var err = document.getElementById('checkout-addr-error');
    if (!err) return;
    err.textContent = message || '';
    err.classList.toggle('hidden', !message);
  }

  function fillAddressEditForm() {
    var form = addressFormFromState();
    ADDRESS_EDIT_FIELDS.forEach(function (pair) {
      var input = document.getElementById(pair[0]);
      if (input) input.value = form[pair[1]] || '';
    });
    var address = document.getElementById('checkout-addr-text');
    if (address) address.value = savedAddressText(form);
    state.addressMapPinned = !!(state.addressDetails && state.addressDetails.mapPinned);
    syncAddressMap();
    showAddressEditError('');
  }

  function syncAddressMap() {
    var map = document.getElementById('checkout-addr-map');
    var status = document.getElementById('checkout-addr-map-status');
    var enabled = mapEnabled();
    if (map) map.hidden = !enabled;
    if (status) status.hidden = !(enabled && state.addressMapPinned);
  }

  function setAddressEditMode(on) {
    var card = document.getElementById('checkout-addresses');
    var edit = document.getElementById('checkout-address-edit');
    var editBtn = document.getElementById('btn-edit-address');
    if (card) card.classList.toggle('hidden', !!on);
    if (edit) edit.classList.toggle('hidden', !on);
    if (editBtn) editBtn.classList.toggle('hidden', !!on);
    if (on) {
      fillAddressEditForm();
      var nameInput = document.getElementById('checkout-addr-name');
      if (nameInput) nameInput.focus();
    } else {
      showAddressEditError('');
    }
  }

  function saveEditedAddress() {
    var form = readAddressEditForm();
    var message = addressEditError(form);
    if (message) {
      showAddressEditError(message);
      return false;
    }
    form.mapPinned = mapEnabled() && !!state.addressMapPinned;
    state.addressDetails = form;
    state.customer.name = form.name;
    state.customer.phone = form.contactNumber;
    if (!commitDeliveryAddress(formatAddressDetails(form))) return false;
    setAddressEditMode(false);
    renderCheckout();
    return true;
  }

  function renderCheckout() {
    var selected = ensureAddress();
    state.address = state.address || selected.line || '';

    var labelEl = document.getElementById('checkout-addr-label');
    var nameEl = document.getElementById('checkout-addr-recipient');
    var lineEl = document.getElementById('checkout-addr-line');
    var phoneEl = document.getElementById('checkout-addr-phone');
    var recipient = usableCustomerName(
      (state.addressDetails && state.addressDetails.name) || state.customer.name
    );
    var contact = contactDigits(
      (state.addressDetails && state.addressDetails.contactNumber) || state.customer.phone
    );
    if (labelEl) labelEl.textContent = selected.label || 'Delivery';
    if (nameEl) {
      nameEl.textContent = recipient;
      nameEl.hidden = !recipient;
    }
    if (lineEl) lineEl.textContent = state.address || 'No address yet — tap Edit to add one.';
    if (phoneEl) {
      phoneEl.textContent = contact ? '+91 ' + contact : '';
      phoneEl.hidden = !contact;
    }
    var note = document.querySelector('#view-checkout .checkout-confirm-note');
    if (note) {
      note.textContent = hasDeliveryAddress()
        ? 'Check address and items — delivery will be done here.'
        : 'Add the address — delivery will be done here.';
    }
    setAddressEditMode(false);

    renderDeliveryOptions();
    renderPaymentOptions();

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

  function renderDeliveryOptions() {
    var el = document.getElementById('delivery-options');
    if (!el) return;
    var d = state.draft.delivery || {};
    var options = [];
    if (d.storePickup && d.storePickup.enabled) {
      options.push({
        id: 'storePickup',
        label: 'Store Pickup',
        hint: 'Free · Collect from store'
      });
    }
    if (d.homeDelivery && d.homeDelivery.enabled) {
      options.push({
        id: 'homeDelivery',
        label: 'Home Delivery',
        hint: '₹' + (Number(d.homeDelivery.charge) || 0) + ' charge'
      });
    }
    if (d.courierDelivery && d.courierDelivery.enabled) {
      options.push({
        id: 'courierDelivery',
        label: 'Courier Delivery',
        hint: '₹' + (Number(d.courierDelivery.charge) || 0) + ' charge'
      });
    }
    if (!options.length) {
      options.push({ id: 'homeDelivery', label: 'Home Delivery', hint: 'As per store' });
    }
    if (!options.some(function (o) { return o.id === state.deliveryMethod; })) {
      state.deliveryMethod = options[0].id;
    }
    el.innerHTML = options
      .map(function (o) {
        var checked = o.id === state.deliveryMethod ? ' checked' : '';
        return (
          '<label class="pay-option">' +
          '<input type="radio" name="delivery-method" value="' +
          escapeHtml(o.id) +
          '"' +
          checked +
          '> <span><strong>' +
          escapeHtml(o.label) +
          '</strong><br><span class="addr-line">' +
          escapeHtml(o.hint) +
          '</span></span></label>'
        );
      })
      .join('');
  }

  function renderPaymentOptions() {
    var el = document.getElementById('payment-options');
    if (!el) return;
    var pay = state.draft.payment || {};
    var options = [];
    if (!pay.cod || pay.cod.enabled !== false) {
      options.push({ id: 'cod', label: 'Pay on Delivery (Cash)' });
    }
    if (pay.upi && pay.upi.enabled) {
      options.push({
        id: 'upi',
        label: 'UPI / Card' + (pay.upi.upiId ? ' · ' + pay.upi.upiId : '')
      });
    }
    if (pay.bank && pay.bank.enabled) {
      options.push({ id: 'bank', label: 'Bank Transfer' });
    }
    options.push({ id: 'other', label: 'Other' });
    el.innerHTML = options
      .map(function (o, i) {
        var checked = i === 0 ? ' checked' : '';
        return (
          '<label class="pay-option"><input type="radio" name="pay" value="' +
          escapeHtml(o.id) +
          '"' +
          checked +
          '> <span>' +
          escapeHtml(o.label) +
          '</span></label>'
        );
      })
      .join('');
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
        : pay && pay.value === 'bank'
          ? 'Bank Transfer'
          : pay && pay.value === 'other'
            ? 'Other'
            : 'Pay on Delivery (Cash)';

    var delLabel =
      state.deliveryMethod === 'storePickup'
        ? 'Store Pickup'
        : state.deliveryMethod === 'courierDelivery'
          ? 'Courier Delivery'
          : 'Home Delivery';

    var lines = [
      '🛒 *New Order — ' + state.draft.settings.storeName + '*',
      '',
      '*Order ID:* ' + state.orderId,
      '*Customer:* ' + (state.customer.name || 'Guest'),
      '*Phone:* +91 ' + state.customer.phone,
      '*Address:* ' + (state.address || state.draft.settings.address || ''),
      '*Delivery:* ' + delLabel,
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
    if (!isLoggedIn()) {
      requireLogin('checkout', null);
      return;
    }
    if (!hasDeliveryAddress()) {
      openAddressGate('checkout');
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

  /* ——— Order History (sample design reference) ——— */
  function formatInr(n) {
    var num = Math.round(Number(n) || 0);
    return '₹' + num.toLocaleString('en-IN');
  }

  function ownerWhatsApp() {
    var draft = state.draft || {};
    return (draft.settings && draft.settings.whatsapp) || draft.phone || '';
  }

  function ownerChatHref(order) {
    var wa = ownerWhatsApp();
    if (!wa || !D.whatsappLink) return '#';
    var storeName =
      (state.draft && state.draft.settings && state.draft.settings.storeName) || 'your shop';
    var msg =
      'Hi! This is about Order #' +
      (order && order.id ? order.id : '') +
      ' from ' +
      storeName +
      '.';
    return D.whatsappLink(wa, msg);
  }

  function sampleOrders() {
    var products = (state.draft && state.draft.products) || [];
    function pick(i, fallbackName, fallbackIcon) {
      var p = products[i] || products[0];
      if (!p) {
        return {
          name: fallbackName,
          icon: fallbackIcon,
          image: '',
          unit: '1 pcs',
          price: 210,
          mrp: 220
        };
      }
      var sku = (p.skus && p.skus[0]) || {};
      return {
        name: p.name || fallbackName,
        icon: p.icon || fallbackIcon,
        image: p.image || '',
        unit: sku.label || sku.unit || '1 pcs',
        price: Number(sku.price) || 210,
        mrp: Number(sku.mrp || sku.price) || 220
      };
    }

    var a = pick(0, 'Biryani Masala', '🧂');
    var b = pick(1, 'Amla Pickle', '🫙');
    var c = pick(2, 'Mixed Vegetable Pickle', '🥗');
    var d = pick(3, 'Gongura Pickle', '🌿');

    return [
      {
        id: '1983',
        status: 'Scheduled',
        statusTone: 'scheduled',
        items: [
          { name: a.name, icon: a.icon, image: a.image, unit: a.unit, qty: 2, price: a.price, mrp: a.mrp },
          { name: b.name, icon: b.icon, image: b.image, unit: b.unit, qty: 1, price: b.price, mrp: b.mrp }
        ],
        itemTotalMrp: 250,
        discount: 10,
        delivery: 100,
        payment: 'Cash on delivery',
        paymentLabel: 'Payment due',
        address: 'Mayuri Nagar, Road o-27F, Hyderabad, Rangareddy, Telangana 500049',
        recipient: 'Swamy Kunta',
        phone: '+91 9912149049'
      },
      {
        id: '1982',
        status: 'Scheduled',
        statusTone: 'scheduled',
        items: [
          { name: b.name, icon: b.icon, image: b.image, unit: '2 KG', qty: 6, price: 180, mrp: 195 },
          { name: c.name, icon: c.icon, image: c.image, unit: '500 gr', qty: 2, price: 210, mrp: 220 },
          { name: d.name, icon: d.icon, image: d.image, unit: '250 gr', qty: 1, price: 120, mrp: 130 },
          { name: a.name, icon: a.icon, image: a.image, unit: a.unit, qty: 1, price: a.price, mrp: a.mrp }
        ],
        itemTotalMrp: 1315,
        discount: 105,
        delivery: 0,
        payment: 'Cash on delivery',
        paymentLabel: 'Payment due',
        address: 'Mayuri Nagar, Road o-27F, Hyderabad, Rangareddy, Telangana 500049',
        recipient: 'Swamy Kunta',
        phone: '+91 9912149049'
      },
      {
        id: '1971',
        status: 'Delivered',
        statusTone: 'delivered',
        items: [
          { name: c.name, icon: c.icon, image: c.image, unit: '500 gr', qty: 1, price: 210, mrp: 220 }
        ],
        itemTotalMrp: 220,
        discount: 10,
        delivery: 40,
        payment: 'Paid on delivery',
        paymentLabel: 'Payment',
        address: 'Mayuri Nagar, Road o-27F, Hyderabad, Rangareddy, Telangana 500049',
        recipient: 'Swamy Kunta',
        phone: '+91 9912149049'
      }
    ];
  }

  function orderPayable(order) {
    return Math.max(0, (order.itemTotalMrp || 0) - (order.discount || 0) + (order.delivery || 0));
  }

  function orderWasTotal(order) {
    var was = (order.itemTotalMrp || 0) + (order.delivery || 0);
    var pay = orderPayable(order);
    return was > pay ? was : 0;
  }

  function orderThumbHtml(item) {
    var icon = (item && item.icon) || '🫙';
    if (item && item.image) {
      return (
        '<img src="' +
        escapeHtml(item.image) +
        '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.hidden=false">' +
        '<span hidden aria-hidden="true">' +
        escapeHtml(icon) +
        '</span>'
      );
    }
    return '<span aria-hidden="true">' + escapeHtml(icon) + '</span>';
  }

  function renderOrders() {
    var root = document.getElementById('orders-list');
    if (!root) return;
    var orders = sampleOrders();
    if (!orders.length) {
      root.innerHTML =
        '<div class="orders-empty">' +
        '<p>No orders yet. Browse the menu and place your first WhatsApp order.</p>' +
        '<button type="button" class="btn-primary-store is-inline" data-nav="menu">Browse menu</button>' +
        '</div>';
      return;
    }

    root.innerHTML = orders
      .map(function (order) {
        var lead = order.items[0] || {};
        var extra = Math.max(0, order.items.length - 1);
        var meta =
          escapeHtml(lead.unit || '') +
          ' · Qty ' +
          escapeHtml(String(lead.qty || 1)) +
          (extra ? ' · +' + extra + ' more' : '');
        var pay = orderPayable(order);
        var was = orderWasTotal(order);
        var statusClass =
          order.statusTone === 'delivered'
            ? ' is-delivered'
            : order.statusTone === 'cancelled'
              ? ' is-cancelled'
              : '';
        return (
          '<article class="order-card" data-order-card="' +
          escapeHtml(order.id) +
          '">' +
          '<div class="order-card-top">' +
          '<p class="order-card-id">Order #' +
          escapeHtml(order.id) +
          '</p>' +
          '<span class="order-status' +
          statusClass +
          '"><span class="order-status-dot" aria-hidden="true"></span>' +
          escapeHtml(order.status) +
          '</span>' +
          '</div>' +
          '<div class="order-card-body">' +
          '<div class="order-card-thumb">' +
          orderThumbHtml(lead) +
          '</div>' +
          '<div class="order-card-main">' +
          '<h3>' +
          escapeHtml(lead.name || 'Order') +
          '</h3>' +
          '<p class="order-card-meta">' +
          meta +
          '</p>' +
          '<p class="order-card-price">' +
          escapeHtml(formatInr(pay)) +
          (was
            ? '<span class="was">' + escapeHtml(formatInr(was)) + '</span>'
            : '') +
          '</p>' +
          '</div>' +
          '</div>' +
          '<div class="order-card-actions">' +
          '<button type="button" class="link-btn" data-order="' +
          escapeHtml(order.id) +
          '">View details</button>' +
          '<a class="order-chat-btn" href="' +
          escapeHtml(ownerChatHref(order)) +
          '" target="_blank" rel="noopener" aria-label="Chat with Owner on WhatsApp about order ' +
          escapeHtml(order.id) +
          '">' +
          WA_ICON +
          ' Chat with Owner</a>' +
          '</div>' +
          '</article>'
        );
      })
      .join('');
  }

  function openOrderDetail(orderId) {
    state.selectedOrderId = String(orderId || '');
    renderOrderDetail();
    showView('order-detail');
  }

  function renderOrderDetail() {
    var root = document.getElementById('order-detail');
    var footer = document.getElementById('order-detail-footer');
    if (!root || !footer) return;

    var orders = sampleOrders();
    var order = orders.find(function (o) {
      return o.id === state.selectedOrderId;
    });
    if (!order) order = orders[0];
    if (!order) {
      root.innerHTML = '<p class="orders-lead">Order not found.</p>';
      footer.innerHTML = '';
      return;
    }
    state.selectedOrderId = order.id;

    var statusClass =
      order.statusTone === 'delivered'
        ? ' is-delivered'
        : order.statusTone === 'cancelled'
          ? ' is-cancelled'
          : '';
    var pay = orderPayable(order);

    var linesHtml = (order.items || [])
      .map(function (item) {
        var lineTotal = (Number(item.price) || 0) * (Number(item.qty) || 1);
        return (
          '<div class="order-line">' +
          '<div class="order-line-thumb">' +
          orderThumbHtml(item) +
          '</div>' +
          '<div class="order-line-body">' +
          '<h3>' +
          escapeHtml(item.name) +
          '</h3>' +
          '<p class="order-line-meta">' +
          escapeHtml(item.unit || '') +
          ' · Qty ' +
          escapeHtml(String(item.qty || 1)) +
          ' x ' +
          escapeHtml(formatInr(item.price)) +
          (item.mrp && item.mrp > item.price
            ? '<span class="was">' + escapeHtml(formatInr(item.mrp)) + '</span>'
            : '') +
          '</p>' +
          '</div>' +
          '<div class="order-line-total">' +
          escapeHtml(formatInr(lineTotal)) +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    root.innerHTML =
      '<div class="order-detail-banner">' +
      '<h2 class="store-brand-font">Order #' +
      escapeHtml(order.id) +
      '</h2>' +
      '<span class="order-status' +
      statusClass +
      '"><span class="order-status-dot" aria-hidden="true"></span>' +
      escapeHtml(order.status) +
      '</span>' +
      '</div>' +
      '<div class="order-detail-card">' +
      linesHtml +
      '</div>' +
      '<div class="order-detail-card">' +
      '<h3 class="order-detail-card-title">' +
      '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>' +
      'Bill details</h3>' +
      '<div class="order-bill-row"><span>Item total (MRP)</span><span>' +
      escapeHtml(formatInr(order.itemTotalMrp)) +
      '</span></div>' +
      (order.discount
        ? '<div class="order-bill-row is-discount"><span>Discount</span><span>- ' +
          escapeHtml(formatInr(order.discount)) +
          '</span></div>'
        : '') +
      '<div class="order-bill-row"><span>Delivery</span><span>' +
      escapeHtml(order.delivery ? formatInr(order.delivery) : 'Free') +
      '</span></div>' +
      '<div class="order-bill-row is-total"><span>To pay</span><span>' +
      escapeHtml(formatInr(pay)) +
      '</span></div>' +
      '</div>' +
      '<div class="order-detail-card">' +
      '<h3 class="order-detail-card-title">' +
      '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' +
      'Delivery details</h3>' +
      '<p class="order-detail-text">' +
      escapeHtml(order.address) +
      '</p>' +
      '<p class="order-detail-text order-detail-muted">' +
      escapeHtml(order.recipient) +
      ' · ' +
      escapeHtml(order.phone) +
      '</p>' +
      '</div>' +
      '<div class="order-detail-card">' +
      '<h3 class="order-detail-card-title">' +
      '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>' +
      escapeHtml(order.paymentLabel || 'Payment') +
      '</h3>' +
      '<p class="order-detail-text">Payment: ' +
      escapeHtml(order.payment) +
      '</p>' +
      '</div>';

    footer.innerHTML =
      '<a class="order-chat-btn is-block" href="' +
      escapeHtml(ownerChatHref(order)) +
      '" target="_blank" rel="noopener">' +
      WA_ICON +
      ' Chat with Owner</a>' +
      '<button type="button" class="btn-outline" data-nav="home">Continue shopping →</button>';
  }

  var eventsBound = false;

  /* ——— Events ——— */
  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;

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

    function navigateByAttr(btn, e) {
      if (!btn) return false;
      openDrawer(false);
      var v = btn.getAttribute('data-nav');
      if (!v) return false;
      if (v === 'contact' && e) e.preventDefault();
      if (v === 'menu') {
        state.activeCategory = 'all';
        showView('menu');
        renderMenuRail();
        renderMenuProducts();
      } else if (v === 'cart') {
        showView('cart');
        renderCart();
      } else if (v === 'orders') {
        showView('orders');
        renderOrders();
      } else if (v === 'contact') {
        showView('home');
        var contact = document.getElementById('store-contact');
        if (contact) contact.scrollIntoView({ behavior: 'smooth', block: 'start' });
        try {
          history.replaceState(null, '', '#store-contact');
        } catch (err) {}
      } else if (v === 'home') {
        showView('home');
      } else {
        return false;
      }
      return true;
    }

    var topbar = document.querySelector('.demo-topbar');
    if (topbar) {
      topbar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-nav]');
        if (btn) navigateByAttr(btn, e);
      });
    }

    document.getElementById('store-app').addEventListener('click', function (e) {
      var navBtn = e.target.closest('[data-nav]');
      if (navBtn && navigateByAttr(navBtn, e)) return;

      var t = e.target.closest('[data-order]');
      if (t && t.getAttribute('data-order')) {
        openOrderDetail(t.getAttribute('data-order'));
        return;
      }
      t = e.target.closest('[data-cat]');
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

    document.getElementById('btn-proceed-checkout').addEventListener('click', proceedToCheckout);

    document.getElementById('btn-send-otp').addEventListener('click', function () {
      var phone = (document.getElementById('login-phone').value || '').replace(/\D/g, '');
      if (phone.length !== 10) {
        alert('Please enter a valid 10-digit mobile number.');
        return;
      }
      state.customer.phone = phone;
      document.getElementById('login-phone-step').classList.add('hidden');
      document.getElementById('login-otp-step').classList.remove('hidden');
      ensureStoreOtp();
      if (storeOtpField) {
        storeOtpField.clear();
        storeOtpField.focus();
      }
      hideLoginOtpError();
    });

    document.getElementById('btn-verify-otp').addEventListener('click', function () {
      ensureStoreOtp();
      var otpLen = (window.MithraOtp && window.MithraOtp.LENGTH) || 4;
      var otp = storeOtpField ? storeOtpField.getValue() : '';
      if (otp.length !== otpLen) {
        showLoginOtpError('Enter the ' + otpLen + '-digit OTP (demo: any ' + otpLen + ' digits).');
        return;
      }
      hideLoginOtpError();
      state.customer.loggedIn = true;
      state.customer.name =
        (window.MithraAssets &&
          window.MithraAssets.paths &&
          window.MithraAssets.paths.external &&
          window.MithraAssets.paths.external.demoContactName) ||
        'Swamy Kunta';
      ensureAddress();
      saveSession();
      finishLogin();
    });

    document.getElementById('btn-resend-otp').addEventListener('click', function () {
      ensureStoreOtp();
      if (storeOtpField) {
        storeOtpField.clear();
        storeOtpField.focus();
      }
      hideLoginOtpError();
      alert('OTP resent (demo).');
    });

    document.getElementById('btn-create-order').addEventListener('click', createOrder);

    document.getElementById('btn-view-order').addEventListener('click', function () {
      var samples = sampleOrders();
      openOrderDetail((samples[0] && samples[0].id) || '1983');
    });

    var editAddrBtn = document.getElementById('btn-edit-address');
    if (editAddrBtn) {
      editAddrBtn.addEventListener('click', function () {
        setAddressEditMode(true);
      });
    }
    var saveAddrBtn = document.getElementById('btn-save-address');
    if (saveAddrBtn) {
      saveAddrBtn.addEventListener('click', function () {
        saveEditedAddress();
      });
    }
    var pinMapBtn = document.getElementById('btn-pin-map');
    if (pinMapBtn) {
      pinMapBtn.addEventListener('click', function () {
        state.addressMapPinned = true;
        syncAddressMap();
        showAddressEditError('');
      });
    }
    var cancelAddrBtn = document.getElementById('btn-cancel-address');
    if (cancelAddrBtn) {
      cancelAddrBtn.addEventListener('click', function () {
        setAddressEditMode(false);
      });
    }

    document.getElementById('btn-change-address').addEventListener('click', function () {
      openAddressGate(hasDeliveryAddress() ? 'change' : 'start', null);
    });

    var gateSave = document.getElementById('addr-gate-save');
    if (gateSave) {
      gateSave.addEventListener('click', function () {
        var input = document.getElementById('addr-gate-input');
        commitDeliveryAddress(input ? input.value : '');
      });
    }

    var gateBackdrop = document.getElementById('addr-gate-backdrop');
    if (gateBackdrop) {
      gateBackdrop.addEventListener('click', function () {
        closeAddressGate();
      });
    }

    var gateSkip = document.getElementById('addr-gate-skip');
    if (gateSkip) {
      gateSkip.addEventListener('click', function () {
        closeAddressGate();
      });
    }

    document.querySelectorAll('[data-addr-chip]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var input = document.getElementById('addr-gate-input');
        if (!input) return;
        var starter = chip.getAttribute('data-addr-chip') || '';
        if (!String(input.value || '').trim()) input.value = starter;
        input.focus();
      });
    });

    var nearMe = document.getElementById('addr-gate-near-me');
    if (nearMe) {
      nearMe.addEventListener('click', function () {
        var input = document.getElementById('addr-gate-input');
        var area =
          (state.draft && state.draft.settings && state.draft.settings.location) || 'my area';
        if (input) {
          input.value = 'Near ' + area + ' (please add flat / street)';
          input.focus();
        }
      });
    }

    document.getElementById('store-app').addEventListener('change', function (e) {
      if (e.target && e.target.name === 'delivery-method') {
        state.deliveryMethod = e.target.value;
        renderCheckout();
        updateCartUI();
      }
    });
  }

  function initHeader(draft) {
    document.title = draft.settings.storeName + ' — MithraDirect';
    document.getElementById('store-header-name').textContent = draft.settings.storeName;
    document.getElementById('drawer-name').textContent = draft.settings.storeName;
    document.getElementById('drawer-tagline').textContent = draft.settings.tagline || '';

    var logo =
      draft.settings.logo ||
      (window.MithraAssets && window.MithraAssets.logo && window.MithraAssets.logo()) ||
      'assets/img/logos/logo_dark_md.png';
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

  function mountStore(draft) {
    var empty = document.getElementById('store-empty');
    var app = document.getElementById('store-app');

    if (!draft || !draft.settings || !draft.settings.storeName) {
      empty.classList.remove('hidden');
      var stage = document.getElementById('demo-stage');
      if (stage) stage.classList.add('hidden');
      return;
    }

    state.draft = draft;
    state.address = '';
    state.addressDetails = null;
    state.activeCategory = 'all';

    if (D.applyStoreBrand) {
      D.applyStoreBrand(draft.settings || {});
    } else {
      applyTheme((draft.settings && draft.settings.themeColor) || D.DEFAULT_THEME || '#10b981');
    }
    loadCart();
    loadSession();
    // Customer delivery address only — never default to vendor shop location

    empty.classList.add('hidden');
    app.classList.remove('hidden');
    initHeader(draft);
    bindEvents();
    renderHome();
    showView('home', { replace: true });
    updateCartUI();

    var view = qs('view');
    if (view === 'menu') {
      showView('menu', { replace: true });
      renderMenuRail();
      renderMenuProducts();
    } else if (view === 'orders') {
      showView('orders', { replace: true });
      renderOrders();
    } else if (view === 'order-detail') {
      openOrderDetail(qs('order') || '1983');
    }
    if ((location.hash || '') === '#store-contact') {
      showView('home', { replace: true });
      var contact = document.getElementById('store-contact');
      if (contact) contact.scrollIntoView({ block: 'start' });
    }

    // Expose for debugging / future integrations
    app.dataset.storeSlug = draft.slug || '';
    app.dataset.dataSource = (draft.meta && draft.meta.source) || 'local';
  }

  function init() {
    var loading = document.getElementById('store-loading');
    if (loading) loading.classList.remove('hidden');

    API.getRelease({
      slug: qs('slug'),
      brand: qs('brand')
    })
      .then(function (release) {
        if (loading) loading.classList.add('hidden');
        mountStore(release);
      })
      .catch(function (err) {
        console.error(err);
        if (loading) loading.classList.add('hidden');
        mountStore(null);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
