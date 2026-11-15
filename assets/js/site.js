(function () {
  "use strict";

  var S = window.SITE || {};
  var P = window.PRODUCTS || [];
  var C = window.CATALOGS || [];

  var FINISH_COLORS = {
    "Chrome": "#cbd3d8",
    "Matte Black": "#2b2e30",
    "Brushed Gold": "#c9a45f",
    "Brushed Nickel": "#b3b7b0"
  };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function finishColor(n) { return FINISH_COLORS[n] || "#b9bdb7"; }
  function byId(id) { for (var i = 0; i < P.length; i++) { if (P[i].id === id) return P[i]; } return null; }
  function firstImage(p, finish) {
    if (!p) return "";
    if (p.images && p.images[finish]) return p.images[finish];
    var f = (p.finishes && p.finishes[0]) || "";
    return (p.images && p.images[f]) || "";
  }
  function pic(src, alt, cls) {
    if (!src) {
      return '<div class="' + esc(cls || "") + '" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:200px;box-sizing:border-box;background:#f5f6f3;color:#a2a8a1;font-size:11px;letter-spacing:.16em;text-transform:uppercase;text-align:center;padding:20px">Image coming soon</div>';
    }
    return '<img src="' + esc(src) + '" alt="' + esc(alt) + '" class="' + (cls || "") + '" loading="lazy" onerror="this.style.opacity=.12">';
  }
  function mailto(subject, body) {
    return "mailto:" + (S.email || "") + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  /* WhatsApp: digits only, international format without + (e.g. 8613586626316) */
  function waNumber() { return String(S.whatsapp || "").replace(/[^0-9]/g, ""); }
  function waLink(message) {
    var n = waNumber();
    if (!n) return "#";
    return "https://wa.me/" + n + (message ? "?text=" + encodeURIComponent(message) : "");
  }
  function waGreeting() {
    return "Hello " + (S.brandShort || S.brand || "") + ", I found your website and would like to know more about your products. Could you send me the 2026 catalogue and a quotation?";
  }
  function waInquiryMessage(p, finish) {
    return "Hello, I would like a quotation for the following item:\n\n" +
      "Model: " + p.model + "\n" +
      "Product: " + p.name + "\n" +
      "Finish: " + (finish || "please advise") + "\n" +
      "Quantity: \n" +
      "Destination country: \n\n" +
      "Please also send the specification sheet and finish samples.";
  }
  function inquiryHref(p, finish) {
    var subject = "Inquiry: " + p.model + " " + p.name + (finish ? " (" + finish + ")" : "");
    var body = "Hello,\n\nI would like a quotation for the following item:\n\n" +
      "Model: " + p.model + "\n" +
      "Product: " + p.name + "\n" +
      "Finish: " + (finish || "please advise") + "\n" +
      "Quantity: \n" +
      "Destination country: \n" +
      "Required delivery date: \n\n" +
      "Please also send the specification sheet and finish samples.\n\n" +
      "Company: \nName: \n";
    return mailto(subject, body);
  }

  function applyBrand() {
    $$("[data-brand]").forEach(function (e) { e.textContent = S.brand || ""; });
    $$("[data-brand-short]").forEach(function (e) { e.textContent = S.brandShort || ""; });
    $$("[data-tagline]").forEach(function (e) { e.textContent = S.tagline || ""; });
    $$("[data-address]").forEach(function (e) { e.textContent = S.address || ""; });
    $$("[data-since]").forEach(function (e) { e.textContent = S.since || ""; });
    $$("a[data-email]").forEach(function (a) {
      a.href = "mailto:" + (S.email || "");
      if (a.dataset.email !== "keep") a.textContent = S.email || "";
    });
    $$("a[data-phone]").forEach(function (a) { a.href = "tel:" + String(S.phone || "").replace(/\s/g, ""); a.textContent = S.phone || ""; });
    var wa = waNumber();
    $$("[data-wa-number]").forEach(function (e) { e.textContent = S.phone || (wa ? "+" + wa : ""); });
    $$("a[data-whatsapp], a[data-wa-link]").forEach(function (a) {
      a.href = waLink(waGreeting());
      a.setAttribute("title", "Chat with us on WhatsApp");
      if (a.hasAttribute("data-wa-label")) a.textContent = "WhatsApp " + (S.phone || "");
    });
    $$("[data-wa-only]").forEach(function (e) { if (!wa) e.style.display = "none"; });
    $$("[data-footer-note]").forEach(function (e) { e.textContent = S.footerNote || ""; });
    $$("[data-year]").forEach(function (e) { e.textContent = new Date().getFullYear(); });
    var meta = document.querySelector('meta[name="description"]');
    if (meta && S.seoDescription) meta.setAttribute("content", S.seoDescription);
  }

  function setupNav() {
    var page = document.body.dataset.page;
    $$(".nav-links a[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav") === page) a.classList.add("active");
    });
    var toggle = $(".nav-toggle");
    if (toggle) toggle.addEventListener("click", function () { $(".nav-links").classList.toggle("open"); });
  }

  function swatches(p, cls) {
    return (p.finishes || []).map(function (f, i) {
      return '<button type="button" class="swatch ' + (i === 0 ? "active" : "") + '" ' +
        'style="background:' + finishColor(f) + '" data-finish="' + esc(f) + '" ' +
        'title="' + esc(f) + '" aria-label="' + esc(f) + '"></button>';
    }).join("") + '<span class="finish-name">' + esc((p.finishes || [])[0] || "") + "</span>";
  }

  function productCard(p) {
    var f0 = (p.finishes || [])[0] || "";
    return '<article class="product-card" data-card="' + esc(p.id) + '">' +
      '<div class="product-media">' + pic(firstImage(p, f0), p.model + " " + p.name) + "</div>" +
      '<div class="product-body">' +
        '<div class="product-model">' + esc(p.model) + " · " + esc(p.category) + "</div>" +
        "<h3>" + esc(p.name) + "</h3>" +
        "<p>" + esc(p.description) + "</p>" +
        '<div class="finish-row">' + swatches(p) + "</div>" +
        '<div class="product-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-detail="' + esc(p.id) + '">Details</button>' +
          '<a class="btn btn-primary btn-sm" data-inquire="' + esc(p.id) + '">Inquire</a>' +
        "</div>" +
      "</div>" +
    "</article>";
  }

  function bindCards(root) {
    $$("[data-inquire]", root).forEach(function (a) {
      var p = byId(a.getAttribute("data-inquire"));
      if (p) a.href = inquiryHref(p, (p.finishes || [])[0]);
    });
    $$("[data-wa-inquire]", root).forEach(function (a) {
      var p = byId(a.getAttribute("data-wa-inquire"));
      if (p) a.href = waLink(waInquiryMessage(p, (p.finishes || [])[0]));
    });
    $$(".swatch", root).forEach(function (b) {
      b.addEventListener("click", function () {
        var card = b.closest("[data-card]") || b.closest(".modal");
        var p = byId(card.getAttribute("data-card") || card.getAttribute("data-modal-id"));
        if (!p) return;
        var f = b.getAttribute("data-finish");
        var image = card.querySelector("img");
        if (image) image.src = firstImage(p, f);
        $$(".swatch", card).forEach(function (s) { s.classList.remove("active"); });
        b.classList.add("active");
        var label = card.querySelector(".finish-name");
        if (label) label.textContent = f;
        var q = card.querySelector("[data-inquire]");
        if (q) q.href = inquiryHref(p, f);
        var w = card.querySelector("[data-wa-inquire]");
        if (w) w.href = waLink(waInquiryMessage(p, f));
      });
    });
    $$("[data-detail]", root).forEach(function (b) {
      b.addEventListener("click", function () { openModal(b.getAttribute("data-detail")); });
    });
  }

  function openModal(id) {
    var p = byId(id);
    var modal = $("#product-modal");
    if (!p || !modal) return;
    var f0 = (p.finishes || [])[0] || "";
    modal.setAttribute("data-modal-id", id);
    $("#modal-media").innerHTML = pic(firstImage(p, f0), p.model + " " + p.name);
    var rows = Object.keys(p.specs || {}).map(function (k) {
      return "<tr><td>" + esc(k) + "</td><td>" + esc(p.specs[k]) + "</td></tr>";
    }).join("");
    var waBtn = waNumber()
      ? '<a class="btn btn-wa btn-block" style="margin-top:9px" data-wa-inquire="' + esc(p.id) + '" target="_blank" rel="noopener">Chat on WhatsApp</a>'
      : "";
    $("#modal-info").innerHTML =
      '<div class="product-model">' + esc(p.model) + " · " + esc(p.series || "") + "</div>" +
      "<h2 style=\"font-size:26px;margin:10px 0 12px\">" + esc(p.name) + "</h2>" +
      '<p class="muted" style="font-size:14px">' + esc(p.description) + "</p>" +
      '<div class="finish-row" style="margin-top:20px">' + swatches(p) + "</div>" +
      '<table class="spec-table">' + rows + "</table>" +
      '<a class="btn btn-primary btn-block" data-inquire="' + esc(p.id) + '">Request a quotation</a>' +
      waBtn +
      '<a class="btn btn-ghost btn-block" style="margin-top:9px" href="catalogs.html">View catalogs</a>';
    bindCards(modal);
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    var modal = $("#product-modal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }

  function renderHome() {
    var set = function (sel, v) { var e = $(sel); if (e) e.textContent = v || ""; };
    set("#hero-eyebrow", S.heroEyebrow);
    set("#hero-title", S.heroTitle);
    set("#hero-text", S.heroText);
    set("#hero-primary", S.heroPrimary);
    set("#hero-secondary", S.heroSecondary);
    set("#intro-title", S.introTitle);
    set("#intro-text", S.introText);

    var trio = $("#hero-trio");
    if (trio) trio.innerHTML = P.slice(0, 3).map(function (p) {
      return pic(firstImage(p, (p.finishes || [])[0]), p.name);
    }).join("");
    var caps = $("#hero-captions");
    if (caps) caps.innerHTML = "<span>" + esc(P.length + " pieces / " + (P[0] ? P[0].series : "one series")) + "</span><span>" + esc((P[0] ? P[0].finishes.length : 4) + " coordinated finishes") + "</span>";

    var stats = $("#home-stats");
    if (stats) stats.innerHTML = (S.stats || []).map(function (s) {
      return '<div class="stat"><div class="stat-value">' + esc(s.value) + '</div><div class="stat-label">' + esc(s.label) + "</div></div>";
    }).join("");

    var feat = $("#home-products");
    if (feat) { feat.innerHTML = P.filter(function (p) { return p.featured; }).map(productCard).join(""); bindCards(feat); }

    var cap = $("#home-capabilities");
    if (cap) cap.innerHTML = (S.capabilities || []).map(function (c, i) {
      return '<div class="cap-item"><div class="cap-num">0' + (i + 1) + "</div><h3>" + esc(c.title) + "</h3><p>" + esc(c.text) + "</p></div>";
    }).join("");
  }

  function renderProducts() {
    var filters = $("#filter-bar");
    var cats = ["All"];
    P.forEach(function (p) { if (cats.indexOf(p.category) === -1) cats.push(p.category); });
    if (filters) filters.innerHTML = '<span class="filter-label">Filter</span>' + cats.map(function (c, i) {
      return '<button type="button" class="chip ' + (i === 0 ? "active" : "") + '" data-cat="' + esc(c) + '">' + esc(c === "All" ? "All products" : c) + "</button>";
    }).join("");

    var grid = $("#product-grid");
    function draw(cat) {
      var list = cat === "All" ? P : P.filter(function (p) { return p.category === cat; });
      grid.innerHTML = list.map(productCard).join("");
      bindCards(grid);
    }
    draw("All");
    $$("[data-cat]", filters).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("[data-cat]", filters).forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        draw(b.getAttribute("data-cat"));
      });
    });
  }

  function renderCatalogs() {
    var list = $("#catalog-list");
    if (!list) return;
    list.innerHTML = C.map(function (c) {
      return '<article class="catalog-card">' +
        '<div class="catalog-cover">' + pic(c.cover, c.title) + "</div>" +
        "<div>" +
          '<div class="catalog-code">' + esc(c.code) + (c.featured ? " · Featured" : "") + "</div>" +
          "<h3>" + esc(c.title) + "</h3>" +
          "<p>" + esc(c.description) + "</p>" +
          '<div class="catalog-meta"><span>' + esc(c.pages) + "</span><span>" + esc(c.size) + "</span><span>Updated " + esc(c.updated) + "</span></div>" +
          '<a class="btn btn-primary btn-sm" href="' + esc(c.file) + '" download>Download PDF</a> ' +
          '<a class="btn btn-ghost btn-sm" href="' + esc(c.file) + '" target="_blank" rel="noopener">Open in browser</a>' +
        "</div>" +
      "</article>";
    }).join("");
    var request = $("#catalog-request");
    if (request) request.href = mailto("Printed catalog request", "Hello,\n\nPlease send a printed catalog and finish samples to:\n\nCompany:\nName:\nAddress:\nCountry:\n");
  }

  function renderAbout() {
    var set = function (sel, v) { var e = $(sel); if (e) e.textContent = v || ""; };
    set("#about-title", S.aboutTitle);
    set("#about-1", S.aboutText1);
    set("#about-2", S.aboutText2);
    var cap = $("#about-capabilities");
    if (cap) cap.innerHTML = (S.capabilities || []).map(function (c, i) {
      return '<div class="cap-item"><div class="cap-num">0' + (i + 1) + "</div><h3>" + esc(c.title) + "</h3><p>" + esc(c.text) + "</p></div>";
    }).join("");
    var panel = $("#about-panel");
    if (panel) panel.innerHTML =
      "<h3>At a glance</h3>" +
      '<div class="kv"><span>Business</span><span>' + esc(S.tagline) + "</span></div>" +
      '<div class="kv"><span>Experience</span><span>' + esc(S.since) + "</span></div>" +
      '<div class="kv"><span>Series</span><span>' + esc(P.length ? P[0].series : "-") + "</span></div>" +
      '<div class="kv"><span>Finishes</span><span>' + esc(P.length ? P[0].finishes.length : "-") + " options</span></div>" +
      '<div class="kv"><span>Location</span><span>' + esc(S.address) + "</span></div>";
  }

  function renderContact() {
    var sel = $("#interest");
    if (sel) {
      sel.innerHTML = '<option value="">General inquiry</option>' + P.map(function (p) {
        return '<option value="' + esc(p.model + " " + p.name) + '">' + esc(p.model + " " + p.name) + "</option>";
      }).join("") + '<option value="Catalog request">Catalog / samples</option>';
    }
    var form = $("#inquiry-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = {};
      $$("[name]", form).forEach(function (i) { d[i.name] = i.value.trim(); });
      var subject = "Website inquiry" + (d.interest ? ": " + d.interest : "");
      var body = "Hello,\n\n" + (d.message || "") + "\n\n" +
        "Name: " + (d.name || "") + "\n" +
        "Company: " + (d.company || "") + "\n" +
        "Email: " + (d.email || "") + "\n" +
        "Country: " + (d.country || "") + "\n" +
        "Interested in: " + (d.interest || "General inquiry") + "\n";
      window.location.href = mailto(subject, body);
      var note = $("#form-sent");
      if (note) { note.classList.remove("hidden"); note.textContent = "Your email app should open now. If it does not, write to " + (S.email || "") + " directly."; }
    });
    var waBtn = $("#wa-form-btn");
    if (waBtn) waBtn.addEventListener("click", function () {
      if (!waNumber()) return;
      var d = {};
      $$("[name]", form).forEach(function (i) { d[i.name] = i.value.trim(); });
      var msg = "Hello, I would like to make an inquiry.\n\n" + (d.message || "") + "\n\n" +
        "Name: " + (d.name || "") + "\n" +
        "Company: " + (d.company || "") + "\n" +
        "Country: " + (d.country || "") + "\n" +
        "Interested in: " + (d.interest || "General inquiry");
      window.open(waLink(msg), "_blank", "noopener");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyBrand();
    setupNav();
    var page = document.body.dataset.page;
    if (page === "admin") return;
    if (page === "home") renderHome();
    if (page === "products") renderProducts();
    if (page === "catalogs") renderCatalogs();
    if (page === "about") renderAbout();
    if (page === "contact") renderContact();

    var modal = $("#product-modal");
    if (modal) {
      $$("[data-close]", modal).forEach(function (b) { b.addEventListener("click", closeModal); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
    }
  });
})();
