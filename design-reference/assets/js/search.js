/**
 * Neighbourhood Market — discovery UX (design-reference seed data)
 */
(function () {
  "use strict";

  var CATEGORIES = [
    { id: "all", label: "All shops", icon: "🏪" },
    { id: "home-food", label: "Home food", icon: "🍲" },
    { id: "dairy", label: "Dairy & farm", icon: "🥛" },
    { id: "pickles", label: "Pickles & preserves", icon: "🫙" },
    { id: "bakery", label: "Bakery", icon: "🍞" },
    { id: "produce", label: "Fresh produce", icon: "🥬" },
    { id: "crafts", label: "Handmade", icon: "🧶" },
  ];

  var STORES = [
    {
      id: "ammas-kitchen",
      name: "Amma's Kitchen",
      owner: "Lakshmi R.",
      category: "home-food",
      area: "Koramangala",
      distanceKm: 1.2,
      rating: 4.8,
      open: true,
      delivery: true,
      tags: ["South Indian", "Tiffin", "WhatsApp"],
      blurb: "Home-style meals from a family kitchen",
      image:
        "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",
      href: "store.html",
    },
    {
      id: "green-acre",
      name: "Green Acre Dairy",
      owner: "Prakash M.",
      category: "dairy",
      area: "Whitefield",
      distanceKm: 3.4,
      rating: 4.9,
      open: true,
      delivery: true,
      tags: ["Farm milk", "Ghee", "Same-day"],
      blurb: "Morning milk from a peri-urban farm",
      image:
        "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800&q=80",
      href: "store.html",
    },
    {
      id: "spice-jar",
      name: "The Spice Jar",
      owner: "Fatima S.",
      category: "pickles",
      area: "Indiranagar",
      distanceKm: 2.1,
      rating: 4.7,
      open: true,
      delivery: true,
      tags: ["Andhra pickles", "No preservatives"],
      blurb: "Small-batch pickles & podis",
      image:
        "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&q=80",
      href: "store.html",
    },
    {
      id: "oven-lane",
      name: "Oven Lane Bakery",
      owner: "Priya & Arun",
      category: "bakery",
      area: "HSR Layout",
      distanceKm: 0.8,
      rating: 4.6,
      open: true,
      delivery: false,
      tags: ["Sourdough", "Pickup"],
      blurb: "Neighbourhood bakery — pickup preferred",
      image:
        "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80",
      href: "store.html",
    },
    {
      id: "leaf-cart",
      name: "Leaf Cart Greens",
      owner: "Suresh K.",
      category: "produce",
      area: "Jayanagar",
      distanceKm: 4.0,
      rating: 4.5,
      open: false,
      delivery: true,
      tags: ["Seasonal", "Local farms"],
      blurb: "Leafy greens from nearby growers",
      image:
        "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80",
      href: "store.html",
    },
    {
      id: "loom-house",
      name: "Loom House Studio",
      owner: "Meera N.",
      category: "crafts",
      area: "Malleshwaram",
      distanceKm: 5.2,
      rating: 4.9,
      open: true,
      delivery: true,
      tags: ["Handloom", "Gifts"],
      blurb: "Handwoven goods from a home studio",
      image:
        "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&q=80",
      href: "store.html",
    },
    {
      id: "tiffin-box",
      name: "Sunday Tiffin Box",
      owner: "Ananya D.",
      category: "home-food",
      area: "BTM Layout",
      distanceKm: 1.9,
      rating: 4.8,
      open: true,
      delivery: true,
      tags: ["Weekly menu", "Family portions"],
      blurb: "Weekend thalis from a home cook",
      image:
        "https://images.unsplash.com/photo-1567337710282-00832b415979?w=800&q=80",
      href: "store.html",
    },
    {
      id: "honey-hill",
      name: "Honey Hill Apiary",
      owner: "Ravi T.",
      category: "produce",
      area: "Sarjapur",
      distanceKm: 6.5,
      rating: 4.7,
      open: true,
      delivery: true,
      tags: ["Raw honey", "Beeswax"],
      blurb: "Apiary on the city's edge",
      image:
        "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&q=80",
      href: "store.html",
    },
  ];

  var state = {
    category: "all",
    address: "",
    query: "",
    openOnly: true,
    deliveryOnly: true,
    sort: "near",
  };

  var els = {
    form: document.getElementById("market-search-form"),
    address: document.getElementById("market-address"),
    query: document.getElementById("market-query"),
    locate: document.getElementById("market-locate"),
    cats: document.getElementById("market-cats"),
    open: document.getElementById("filter-open"),
    delivery: document.getElementById("filter-delivery"),
    sort: document.getElementById("market-sort"),
    results: document.getElementById("market-results"),
    empty: document.getElementById("market-empty"),
    title: document.getElementById("market-results-title"),
    meta: document.getElementById("market-results-meta"),
    reset: document.getElementById("market-reset"),
    toast: document.getElementById("landing-toast"),
  };

  function toast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      els.toast.classList.remove("show");
    }, 2800);
  }

  function paramsFromUrl() {
    var p = new URLSearchParams(window.location.search);
    if (p.get("address")) state.address = p.get("address").trim();
    if (p.get("q")) state.query = p.get("q").trim();
    if (p.get("cat")) {
      var cat = p.get("cat");
      if (CATEGORIES.some(function (c) { return c.id === cat; })) {
        state.category = cat;
      }
    }
  }

  function syncUrl() {
    var p = new URLSearchParams();
    if (state.address) p.set("address", state.address);
    if (state.query) p.set("q", state.query);
    if (state.category && state.category !== "all") p.set("cat", state.category);
    var qs = p.toString();
    var next = qs ? "?" + qs : window.location.pathname;
    if (next !== window.location.pathname + window.location.search) {
      history.replaceState(null, "", next);
    }
  }

  function renderCats() {
    if (!els.cats) return;
    els.cats.innerHTML = CATEGORIES.map(function (c) {
      var active = c.id === state.category ? " is-active" : "";
      return (
        '<button type="button" class="market-cat' +
        active +
        '" data-cat="' +
        c.id +
        '" role="listitem">' +
        '<span class="market-cat-icon" aria-hidden="true">' +
        c.icon +
        "</span>" +
        c.label +
        "</button>"
      );
    }).join("");
  }

  function matchesStore(s) {
    if (state.category !== "all" && s.category !== state.category) return false;
    if (state.openOnly && !s.open) return false;
    if (state.deliveryOnly && !s.delivery) return false;

    var q = state.query.toLowerCase();
    if (q) {
      var hay = [s.name, s.owner, s.blurb, s.area]
        .concat(s.tags)
        .join(" ")
        .toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }

    var area = state.address.toLowerCase();
    if (area && area.length > 2) {
      // Soft match: highlight area in meta; don't hard-filter unless partial match fails loosely
      var areaHay = (s.area + " bangalore bengaluru").toLowerCase();
      var tokens = area.split(/[\s,]+/).filter(function (t) {
        return t.length > 2;
      });
      if (tokens.length && !tokens.some(function (t) { return areaHay.indexOf(t) !== -1; })) {
        // Still show all for design-ref demo when area unknown — prefer near-ish
        // Keep store if distance is small OR area token loosely related
        if (s.distanceKm > 8) return false;
      }
    }
    return true;
  }

  function sortStores(list) {
    var copy = list.slice();
    if (state.sort === "rating") {
      copy.sort(function (a, b) { return b.rating - a.rating; });
    } else if (state.sort === "name") {
      copy.sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
    } else {
      copy.sort(function (a, b) { return a.distanceKm - b.distanceKm; });
    }
    return copy;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cardHtml(s) {
    var statusClass = s.open ? "" : " is-closed";
    var statusText = s.open ? "Taking orders" : "Closed now";
    var tags = s.tags
      .map(function (t) {
        return '<span class="market-card-tag">' + escapeHtml(t) + "</span>";
      })
      .join("");
    var delivery = s.delivery ? "Delivers here" : "Pickup only";

    return (
      '<a class="market-card" href="' +
      escapeHtml(s.href) +
      '" data-store="' +
      escapeHtml(s.id) +
      '">' +
      '<div class="market-card-media">' +
      '<img src="' +
      escapeHtml(s.image) +
      '" alt="" loading="lazy" width="800" height="500">' +
      '<span class="market-card-badge">Local owner</span>' +
      '<span class="market-card-status' +
      statusClass +
      '">' +
      statusText +
      "</span>" +
      "</div>" +
      '<div class="market-card-body">' +
      "<h3 class=\"market-card-name\">" +
      escapeHtml(s.name) +
      "</h3>" +
      '<p class="market-card-owner">by ' +
      escapeHtml(s.owner) +
      " · " +
      escapeHtml(s.area) +
      "</p>" +
      '<p class="market-card-meta">' +
      "<span><strong>" +
      s.distanceKm.toFixed(1) +
      " km</strong></span>" +
      "<span>★ " +
      s.rating.toFixed(1) +
      "</span>" +
      "<span>" +
      delivery +
      "</span>" +
      "</p>" +
      '<div class="market-card-tags">' +
      tags +
      "</div>" +
      '<span class="market-card-cta">Open shop</span>' +
      "</div>" +
      "</a>"
    );
  }

  function renderResults() {
    var filtered = sortStores(STORES.filter(matchesStore));
    var place = state.address || "your neighbourhood";

    if (els.title) {
      els.title.textContent =
        state.category === "all"
          ? "Shops near " + place
          : CATEGORIES.find(function (c) { return c.id === state.category; }).label +
            " near " +
            place;
    }

    if (els.meta) {
      els.meta.textContent =
        filtered.length === 0
          ? "No matches — try clearing a filter"
          : filtered.length +
            " local " +
            (filtered.length === 1 ? "owner" : "owners") +
            " · they keep 100%";
    }

    if (els.results) {
      els.results.innerHTML = filtered.map(cardHtml).join("");
      els.results.hidden = filtered.length === 0;
    }
    if (els.empty) {
      els.empty.hidden = filtered.length > 0;
    }
  }

  function applyFromInputs() {
    state.address = (els.address && els.address.value.trim()) || "";
    state.query = (els.query && els.query.value.trim()) || "";
    state.openOnly = !!(els.open && els.open.checked);
    state.deliveryOnly = !!(els.delivery && els.delivery.checked);
    state.sort = (els.sort && els.sort.value) || "near";
    syncUrl();
    renderCats();
    renderResults();
  }

  function bind() {
    if (els.form) {
      els.form.addEventListener("submit", function (e) {
        e.preventDefault();
        applyFromInputs();
        toast("Updated neighbourhood results");
        var body = document.querySelector(".market-body");
        if (body) body.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    if (els.locate) {
      els.locate.addEventListener("click", function () {
        if (els.address) els.address.value = "Koramangala, Bengaluru";
        state.address = "Koramangala, Bengaluru";
        applyFromInputs();
        toast("Using Koramangala as your area (demo)");
      });
    }

    if (els.cats) {
      els.cats.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-cat]");
        if (!btn) return;
        state.category = btn.getAttribute("data-cat");
        syncUrl();
        renderCats();
        renderResults();
      });
    }

    ["change", "input"].forEach(function (evt) {
      if (els.open) els.open.addEventListener(evt, applyFromInputs);
      if (els.delivery) els.delivery.addEventListener(evt, applyFromInputs);
      if (els.sort) els.sort.addEventListener(evt, applyFromInputs);
    });

    if (els.reset) {
      els.reset.addEventListener("click", function () {
        state.category = "all";
        state.query = "";
        state.openOnly = false;
        state.deliveryOnly = false;
        if (els.query) els.query.value = "";
        if (els.open) els.open.checked = false;
        if (els.delivery) els.delivery.checked = false;
        applyFromInputs();
      });
    }
  }

  function init() {
    paramsFromUrl();
    if (els.address) els.address.value = state.address;
    if (els.query) els.query.value = state.query;
    if (els.open) els.open.checked = state.openOnly;
    if (els.delivery) els.delivery.checked = state.deliveryOnly;
    renderCats();
    renderResults();
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
