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
      overlay.style.background = 'linear-gradient(to top, rgba(5,150,105,0.8), rgba(16,185,129,0.35))';
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

    var products = (draft.products || []).slice().sort(function (a, b) {
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
            escapeHtml(p.color || '#ecfdf5') +
            '">🫙</div>' +
            '<div class="p-3">' +
            '<h3 class="text-sm font-semibold text-gray-800 truncate">' +
            escapeHtml(p.name || 'Product') +
            '</h3>' +
            '<p class="text-sm text-emerald-600 font-semibold mt-0.5">From ₹' +
            (from || '—') +
            '</p>' +
            (wa
              ? '<a href="' +
                D.whatsappLink(wa, 'Hi, I want to order: ' + (p.name || 'product') + ' from ' + draft.settings.storeName) +
                '" target="_blank" class="mt-2 inline-block text-xs font-medium text-emerald-700 hover:underline">Order on WhatsApp</a>'
              : '') +
            '</div></article>'
          );
        })
        .join('');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
