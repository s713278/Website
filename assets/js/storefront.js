/**
 * MithraDirect public storefront — renders draft from localStorage by slug.
 */
(function () {
  'use strict';

  var D = window.MithraDraft;
  if (!D) return;

  function qs(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name) || '';
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
    return '#10b981';
  }

  function hexToRgba(hex, alpha) {
    var h = normalizeHex(hex).slice(1);
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function applyTheme(color) {
    var hex = normalizeHex(color);
    document.documentElement.style.setProperty('--store-theme', hex);
    document.documentElement.style.setProperty('--store-theme-soft', hexToRgba(hex, 0.12));
  }

  function renderDelivery(draft) {
    var el = document.getElementById('store-delivery');
    var d = draft.delivery || {};
    var rows = [];
    if (d.storePickup && d.storePickup.enabled) {
      rows.push({ title: 'Store Pickup', detail: 'Collect from store · Free' });
    }
    if (d.homeDelivery && d.homeDelivery.enabled) {
      rows.push({
        title: 'Home Delivery',
        detail: 'Local drop-off · ₹' + (Number(d.homeDelivery.charge) || 0)
      });
    }
    if (d.courierDelivery && d.courierDelivery.enabled) {
      rows.push({
        title: 'Courier Delivery',
        detail: 'Courier shipping · ₹' + (Number(d.courierDelivery.charge) || 0)
      });
    }
    if (!rows.length) {
      el.innerHTML = '<p class="text-sm text-gray-400">Delivery options will appear here.</p>';
      return;
    }
    el.innerHTML = rows
      .map(function (r) {
        return (
          '<div class="store-info-card">' +
          '<div class="store-info-label">' +
          escapeHtml(r.title) +
          '</div>' +
          '<div class="store-info-value">' +
          escapeHtml(r.detail) +
          '</div></div>'
        );
      })
      .join('');
  }

  function renderPayment(draft) {
    var el = document.getElementById('store-payment');
    var p = draft.payment || {};
    var rows = [];
    if (p.upi && p.upi.enabled) {
      rows.push({
        title: 'UPI Payment',
        detail:
          (p.upi.payeeName ? p.upi.payeeName + ' · ' : '') + (p.upi.upiId || 'UPI ID on request')
      });
    }
    if (p.bank && p.bank.enabled) {
      var bankBits = [];
      if (p.bank.accountName) bankBits.push(p.bank.accountName);
      if (p.bank.bankName) bankBits.push(p.bank.bankName);
      if (p.bank.accountNumber) bankBits.push('A/C ' + p.bank.accountNumber);
      if (p.bank.ifsc) bankBits.push('IFSC ' + p.bank.ifsc);
      rows.push({
        title: 'Bank Transfer',
        detail: bankBits.join(' · ') || 'Bank details on request'
      });
    }
    if (p.cod && p.cod.enabled) {
      rows.push({ title: 'Cash on Delivery', detail: 'Pay in cash when you receive the order' });
    }
    if (!rows.length) {
      el.innerHTML = '<p class="text-sm text-gray-400">Payment options will appear here.</p>';
      return;
    }
    el.innerHTML = rows
      .map(function (r) {
        return (
          '<div class="store-info-card">' +
          '<div class="store-info-label">' +
          escapeHtml(r.title) +
          '</div>' +
          '<div class="store-info-value">' +
          escapeHtml(r.detail) +
          '</div></div>'
        );
      })
      .join('');

    var trustPay = document.getElementById('store-trust-pay');
    if (trustPay) {
      trustPay.textContent = p.cod && p.cod.enabled ? '💵 COD Available' : '💳 Online Pay';
    }
  }

  function init() {
    var draft = D.loadDraft();
    var slug = qs('slug') || draft.slug;
    var empty = document.getElementById('store-empty');
    var app = document.getElementById('store-app');
    var draftSlug = draft.slug || D.slugify((draft.settings && draft.settings.storeName) || '');

    if (!draft.settings || !draft.settings.storeName) {
      empty.classList.remove('hidden');
      return;
    }
    if (slug && draftSlug && slug !== draftSlug) {
      empty.classList.remove('hidden');
      return;
    }

    var theme = (draft.settings && draft.settings.themeColor) || '#10b981';
    applyTheme(theme);

    app.classList.remove('hidden');
    document.title = draft.settings.storeName + ' — MithraDirect';

    document.getElementById('store-name').textContent = draft.settings.storeName;
    document.getElementById('store-tagline').textContent = draft.settings.tagline || '';
    document.getElementById('store-location').textContent = draft.settings.location || '';

    var headerLogo = document.getElementById('store-header-logo');
    if (draft.settings.logo) {
      headerLogo.src = draft.settings.logo;
      headerLogo.alt = draft.settings.storeName;
      headerLogo.className = 'store-header-logo';
    } else {
      headerLogo.src = 'assets/img/logos/logo_dark_md.png';
      headerLogo.alt = 'MithraDirect';
      headerLogo.className = 'h-8';
    }

    var bannerImg = document.getElementById('store-banner-img');
    var overlay = document.getElementById('store-hero-overlay');
    if (draft.settings.banner) {
      bannerImg.src = draft.settings.banner;
      bannerImg.classList.remove('hidden');
      overlay.style.background = 'linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.2))';
    } else {
      bannerImg.src = 'assets/img/fresh.png';
      bannerImg.classList.remove('hidden');
      bannerImg.style.opacity = '0.35';
      overlay.style.background =
        'linear-gradient(to top,' + hexToRgba(theme, 0.85) + ',' + hexToRgba(theme, 0.35) + ')';
    }

    var wa = draft.settings.whatsapp || draft.phone;
    var waBtn = document.getElementById('store-wa-btn');
    if (wa) {
      waBtn.href = D.whatsappLink(wa, 'Hi, I would like to order from ' + draft.settings.storeName);
    } else {
      waBtn.style.display = 'none';
    }

    var catsEl = document.getElementById('store-categories');
    if (!draft.categories || !draft.categories.length) {
      catsEl.innerHTML = '<p class="text-sm text-gray-400">No categories</p>';
    } else {
      catsEl.innerHTML = draft.categories
        .map(function (c) {
          return (
            '<div class="flex-shrink-0 w-20 text-center">' +
            '<div class="store-cat-img">' +
            (c.image
              ? '<img src="' +
                escapeHtml(c.image) +
                '" alt="" class="w-full h-full object-cover" onerror="this.remove(); this.parentNode.insertAdjacentText(\'beforeend\',\'📦\');">'
              : '📦') +
            '</div>' +
            '<div class="text-xs font-medium text-gray-700 truncate">' +
            escapeHtml(c.name) +
            '</div></div>'
          );
        })
        .join('');
    }

    var products = (draft.products || [])
      .filter(function (p) {
        var ids = (draft.categories || []).map(function (c) {
          return c.id;
        });
        return !ids.length || ids.indexOf(p.categoryId) >= 0;
      })
      .slice()
      .sort(function (a, b) {
        return a.order - b.order;
      });
    var prodEl = document.getElementById('store-products');
    if (!products.length) {
      prodEl.innerHTML = '<p class="col-span-2 text-sm text-gray-400">No products yet.</p>';
    } else {
      prodEl.innerHTML = products
        .map(function (p) {
          var from = D.minPrice(p);
          return (
            '<article class="rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm">' +
            '<div class="store-product-img" style="background:' +
            escapeHtml(p.color || hexToRgba(theme, 0.12)) +
            '">🫙</div>' +
            '<div class="p-3">' +
            '<h3 class="text-sm font-semibold text-gray-800 truncate">' +
            escapeHtml(p.name || 'Product') +
            '</h3>' +
            '<p class="text-sm font-semibold mt-0.5 store-accent">From ₹' +
            (from || '—') +
            '</p>' +
            (wa
              ? '<a href="' +
                D.whatsappLink(
                  wa,
                  'Hi, I want to order: ' + (p.name || 'product') + ' from ' + draft.settings.storeName
                ) +
                '" target="_blank" class="mt-2 inline-block text-xs font-medium store-accent hover:underline">Order on WhatsApp</a>'
              : '') +
            '</div></article>'
          );
        })
        .join('');
    }

    renderDelivery(draft);
    renderPayment(draft);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
