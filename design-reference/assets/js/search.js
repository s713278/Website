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
      zip: "560034",
      zips: ["560034", "560102"],
      latitude: 12.9352,
      longitude: 77.6245,
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
      zip: "560066",
      zips: ["560066"],
      latitude: 12.9698,
      longitude: 77.75,
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
      zip: "560038",
      zips: ["560038"],
      latitude: 12.9784,
      longitude: 77.6408,
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
      zip: "560102",
      zips: ["560102", "560034"],
      latitude: 12.9121,
      longitude: 77.6446,
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
      zip: "560041",
      zips: ["560041"],
      latitude: 12.9308,
      longitude: 77.5838,
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
      zip: "560003",
      zips: ["560003"],
      latitude: 13.0035,
      longitude: 77.5647,
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
      zip: "560076",
      zips: ["560076", "560034"],
      latitude: 12.9166,
      longitude: 77.6101,
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
      zip: "562125",
      zips: ["562125"],
      latitude: 12.86,
      longitude: 77.786,
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

  var ADDRESSES = [
    { id: "kora-80", label: "80 Feet Road", detail: "Koramangala, Bengaluru, Karnataka 560034", area: "Koramangala, Bengaluru", match: "80 feet road koramangala bengaluru karnataka 560034", zip: "560034", latitude: 12.9352, longitude: 77.6245 },
    { id: "kora-1st", label: "1st Block, Koramangala", detail: "Bengaluru, Karnataka 560034", area: "Koramangala, Bengaluru", match: "1st block koramangala bengaluru karnataka 560034", zip: "560034", latitude: 12.9275, longitude: 77.6272 },
    { id: "hsr-27", label: "27th Main Road", detail: "HSR Layout, Bengaluru, Karnataka 560102", area: "HSR Layout, Bengaluru", match: "27th main road hsr layout bengaluru karnataka 560102", zip: "560102", latitude: 12.9121, longitude: 77.6446 },
    { id: "btm-16", label: "16th Main Road", detail: "BTM Layout, Bengaluru, Karnataka 560076", area: "BTM Layout, Bengaluru", match: "16th main road btm layout bengaluru karnataka 560076", zip: "560076", latitude: 12.9166, longitude: 77.6101 },
    { id: "whitefield-main", label: "Whitefield Main Road", detail: "Bengaluru, Karnataka 560066", area: "Whitefield, Bengaluru", match: "whitefield main road bengaluru karnataka 560066", zip: "560066", latitude: 12.9698, longitude: 77.75 },
    { id: "indira-100", label: "100 Feet Road", detail: "Indiranagar, Bengaluru, Karnataka 560038", area: "Indiranagar, Bengaluru", match: "100 feet road indiranagar indira nagar bengaluru karnataka 560038", zip: "560038", latitude: 12.9784, longitude: 77.6408 },
    { id: "jayanagar-4", label: "4th Block", detail: "Jayanagar, Bengaluru, Karnataka 560041", area: "Jayanagar, Bengaluru", match: "4th block jayanagar jaya nagar bengaluru karnataka 560041", zip: "560041", latitude: 12.9308, longitude: 77.5838 },
    { id: "malleshwaram-margosa", label: "Margosa Road", detail: "Malleshwaram, Bengaluru, Karnataka 560003", area: "Malleshwaram, Bengaluru", match: "margosa road malleshwaram malleswaram bengaluru karnataka 560003", zip: "560003", latitude: 13.0035, longitude: 77.5647 },
    { id: "sarjapur-road", label: "Sarjapur Road", detail: "Bengaluru, Karnataka 562125", area: "Sarjapur, Bengaluru", match: "sarjapur road bengaluru karnataka 562125", zip: "562125", latitude: 12.86, longitude: 77.786 },
  ];

  var state = {
    category: "all",
    address: "",
    query: "",
    place: null,
    suggestions: [],
    activeSuggestion: -1,
    addressError: "",
    openOnly: true,
    deliveryOnly: true,
    sort: "near",
  };

  var els = {
    form: document.getElementById("market-search-form"),
    address: document.getElementById("market-address"),
    suggestions: document.getElementById("market-address-suggestions"),
    query: document.getElementById("market-query"),
    addressError: document.getElementById("market-address-error"),
    cats: document.getElementById("market-cats"),
    open: document.getElementById("filter-open"),
    delivery: document.getElementById("filter-delivery"),
    sort: document.getElementById("market-sort"),
    results: document.getElementById("market-results"),
    empty: document.getElementById("market-empty"),
    emptyTitle: document.getElementById("market-empty-title"),
    emptyCopy: document.getElementById("market-empty-copy"),
    emptyActions: document.getElementById("market-empty-actions"),
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

  function categoryById(id) {
    return CATEGORIES.find(function (c) { return c.id === id; });
  }

  function displayAddress(place) {
    return place.detail ? place.label + ", " + place.detail : place.label;
  }

  function matchingAddresses(raw) {
    var text = String(raw || "").trim().toLowerCase();
    if (text.length < 2) return [];
    if (state.place && text === displayAddress(state.place).toLowerCase()) return [];
    var tokens = text.split(/[\s,]+/).filter(function (token) { return token.length > 1; });
    return ADDRESSES.filter(function (place) {
      return tokens.every(function (token) { return place.match.indexOf(token) !== -1; });
    }).slice(0, 6);
  }

  function placeFromUrl(params) {
    var address = params.get("address");
    var zip = params.get("zip");
    var lat = Number(params.get("lat"));
    var lng = Number(params.get("lng"));
    if (!address || !zip || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    var known = ADDRESSES.find(function (place) { return displayAddress(place) === address; });
    if (known) return known;
    return {
      id: "saved",
      label: address,
      detail: "",
      area: address,
      match: "",
      zip: zip,
      latitude: lat,
      longitude: lng,
    };
  }

  function distanceKm(from, to) {
    var earth = 6371;
    var latDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
    var lngDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
    var fromLat = (from.latitude * Math.PI) / 180;
    var toLat = (to.latitude * Math.PI) / 180;
    var h =
      Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
      Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);
    return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
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
    state.place = placeFromUrl(p);
    state.addressError = "";
  }

  function syncUrl() {
    var p = new URLSearchParams();
    if (state.address) p.set("address", state.address);
    if (state.place) {
      p.set("zip", state.place.zip);
      p.set("lat", String(state.place.latitude));
      p.set("lng", String(state.place.longitude));
    }
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

  function searchTextMatches(store) {
    var q = state.query.toLowerCase();
    if (!q) return true;
    var category = categoryById(store.category);
    var hay = [store.name, category ? category.label : ""].join(" ").toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function matchesStore(s) {
    if (!state.place) return false;
    if (s.zips.indexOf(state.place.zip) === -1) return false;
    if (state.category !== "all" && s.category !== state.category) return false;
    if (state.openOnly && !s.open) return false;
    if (state.deliveryOnly && !s.delivery) return false;
    return searchTextMatches(s);
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

  function showEmpty(title, copy, withActions) {
    if (els.emptyTitle) els.emptyTitle.textContent = title;
    if (els.emptyCopy) els.emptyCopy.textContent = copy;
    if (els.emptyActions) els.emptyActions.hidden = !withActions;
    if (els.empty) els.empty.hidden = false;
    if (els.results) {
      els.results.innerHTML = "";
      els.results.hidden = true;
    }
  }

  function renderSuggestions() {
    if (!els.suggestions || !els.address) return;
    if (!state.suggestions.length) {
      els.suggestions.hidden = true;
      els.suggestions.innerHTML = "";
      els.address.setAttribute("aria-expanded", "false");
      els.address.removeAttribute("aria-activedescendant");
      return;
    }
    els.suggestions.hidden = false;
    els.address.setAttribute("aria-expanded", "true");
    els.suggestions.innerHTML = state.suggestions.map(function (place, index) {
      var active = index === state.activeSuggestion;
      return (
        '<li role="presentation"><button type="button" class="market-suggestion' +
        (active ? " is-active" : "") +
        '" role="option" id="market-address-option-' +
        index +
        '" data-address-id="' +
        escapeHtml(place.id) +
        '" aria-selected="' +
        active +
        '"><span class="market-suggestion-label">' +
        escapeHtml(place.label) +
        '</span><span class="market-suggestion-detail">' +
        escapeHtml(place.detail) +
        "</span></button></li>"
      );
    }).join("");
    if (state.activeSuggestion >= 0) {
      els.address.setAttribute("aria-activedescendant", "market-address-option-" + state.activeSuggestion);
    }
  }

  function refreshSuggestions() {
    state.suggestions = matchingAddresses(els.address ? els.address.value : "");
    state.activeSuggestion = state.suggestions.length ? 0 : -1;
    renderSuggestions();
  }

  function selectPlace(place) {
    state.place = place;
    state.address = displayAddress(place);
    state.addressError = "";
    state.suggestions = [];
    state.activeSuggestion = -1;
    if (els.address) els.address.value = state.address;
    renderSuggestions();
    renderAddressError();
    if (els.query) els.query.focus();
  }

  function renderAddressError() {
    if (!els.addressError) return;
    if (!state.addressError) {
      els.addressError.hidden = true;
      els.addressError.textContent = "";
      return;
    }
    els.addressError.hidden = false;
    els.addressError.textContent = state.addressError;
  }

  function renderResults() {
    renderAddressError();

    if (!state.place) {
      if (els.title) els.title.textContent = "Shops for this address";
      if (els.meta) {
        els.meta.textContent = state.address
          ? "Choose your address from the suggestions."
          : "Choose your address to see shops.";
      }
      showEmpty(
        state.address ? "Choose an address" : "Enter your address",
        state.address
          ? "Pick the matching address from the list so we can find shops there."
          : "Start typing and choose your address from the suggestions. Add a category or shop name only if you want a shorter list.",
        false
      );
      return;
    }

    var located = STORES.filter(matchesStore).map(function (store) {
      return Object.assign({}, store, { distanceKm: distanceKm(state.place, store) });
    });
    var filtered = sortStores(located);
    var category = categoryById(state.category);
    var heading = state.category === "all" ? "Shops" : category.label;
    if (state.query) heading += " matching “" + state.query + "”";
    heading += " in " + state.place.area;

    if (els.title) els.title.textContent = heading;
    if (els.meta) {
      els.meta.textContent =
        filtered.length === 0
          ? "No shops for " + state.place.area
          : filtered.length +
            " neighbourhood " +
            (filtered.length === 1 ? "shop" : "shops");
    }

    if (filtered.length === 0) {
      showEmpty(
        "No shops match that yet",
        "Try another address, or clear the shop name and category.",
        true
      );
      return;
    }

    if (els.results) {
      els.results.innerHTML = filtered.map(cardHtml).join("");
      els.results.hidden = false;
    }
    if (els.empty) els.empty.hidden = true;
  }

  function applyFromInputs() {
    state.address = (els.address && els.address.value.trim()) || "";
    state.query = (els.query && els.query.value.trim()) || "";
    if (state.place && displayAddress(state.place) !== state.address) state.place = null;
    state.addressError = state.address && !state.place
      ? "Choose your address from the suggestions."
      : "";
    state.suggestions = [];
    state.activeSuggestion = -1;
    state.openOnly = !!(els.open && els.open.checked);
    state.deliveryOnly = !!(els.delivery && els.delivery.checked);
    state.sort = (els.sort && els.sort.value) || "near";
    renderSuggestions();
    syncUrl();
    renderCats();
    renderResults();
  }

  function bind() {
    if (els.form) {
      els.form.addEventListener("submit", function (e) {
        e.preventDefault();
        applyFromInputs();
        if (!state.address) {
          toast("Enter your address");
          if (els.address) els.address.focus();
          return;
        }
        if (!state.place) {
          toast("Choose your address from the suggestions");
          if (els.address) els.address.focus();
          refreshSuggestions();
          return;
        }
        toast("Showing shops in " + state.place.area);
        var body = document.querySelector(".market-body");
        if (body) body.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    if (els.address) {
      els.address.addEventListener("input", function () {
        state.address = els.address.value.trim();
        if (state.place && displayAddress(state.place) !== state.address) state.place = null;
        state.addressError = "";
        renderAddressError();
        refreshSuggestions();
      });
      els.address.addEventListener("keydown", function (e) {
        if (!state.suggestions.length) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          state.activeSuggestion = (state.activeSuggestion + 1) % state.suggestions.length;
          renderSuggestions();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          state.activeSuggestion = state.activeSuggestion <= 0
            ? state.suggestions.length - 1
            : state.activeSuggestion - 1;
          renderSuggestions();
        } else if (e.key === "Enter") {
          e.preventDefault();
          selectPlace(state.suggestions[Math.max(state.activeSuggestion, 0)]);
        } else if (e.key === "Escape") {
          state.suggestions = [];
          state.activeSuggestion = -1;
          renderSuggestions();
        }
      });
      els.address.addEventListener("focus", refreshSuggestions);
    }

    if (els.suggestions) {
      els.suggestions.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });
      els.suggestions.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-address-id]");
        if (!btn) return;
        var place = ADDRESSES.find(function (item) {
          return item.id === btn.getAttribute("data-address-id");
        });
        if (place) selectPlace(place);
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
