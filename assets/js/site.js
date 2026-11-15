(function () {
  "use strict";

  var S = window.SITE || {};
  var P = window.PRODUCTS || [];
  var C = window.CATALOGS || [];
  var SR = window.SERIES || [];

  /* 一个系列里可以有不同的龙头类型；这里定义标准类型名，供筛选、排序和批量导入使用 */
  var TYPE_KEYS = [
    "Basin Mixer", "Kitchen Faucet", "Shower Mixer", "Bathtub Mixer",
    "Concealed Shower Mixer", "Shower Column Set", "Other"
  ];

  var FINISH_COLORS = {
    "Brushed": "#b9bdb7",
    "Brushed Nickel": "#b3b7b0",
    "Chrome": "#cbd3d8",
    "Gun Metal": "#5f6366",
    "Matte Black": "#2b2e30",
    "Brushed Gold": "#c9a45f"
  };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function finishColor(n) { return FINISH_COLORS[n] || "#b9bdb7"; }
  function finishLabel(f) { return f === "Default" ? "Standard finish" : f; }
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

  /* ---------- 系列分组 ----------
     产品仍是扁平数组（一个型号一条记录），series 字段决定它属于哪个系列。
     即使 data/series.js 没有随更新包上传，也会按 series 名称自动分组，不会丢产品。 */
  function productType(p) {
    return (p && p.type) || (p && p.category) || "Other";
  }
  function typeRank(t) { var i = TYPE_KEYS.indexOf(t); return i < 0 ? 90 : i; }
  function seriesName(p) { return (p && p.series) || "Other products"; }
  function seriesSlug(n) {
    return String(n || "series").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "series";
  }
  function seriesGroups() {
    var order = [], map = {};
    SR.forEach(function (s) {
      if (!s || !s.name || map[s.name]) return;
      map[s.name] = {
        id: s.id || seriesSlug(s.name), name: s.name,
        description: s.description || "", cover: s.cover || "",
        cataloguePage: s.cataloguePage || 0, catalogueFile: s.catalogueFile || "",
        shortName: s.shortName || "", featured: !!s.featured,
        gallery: (s.gallery || []).filter(Boolean),
        products: []
      };
      order.push(s.name);
    });
    var defaultCat = (C[0] && C[0].file) || "";
    P.forEach(function (p) {
      var n = seriesName(p);
      if (!map[n]) {
        map[n] = {
          id: seriesSlug(n), name: n, description: "", cover: "",
          cataloguePage: 0, catalogueFile: defaultCat,
          shortName: "", featured: false, gallery: [], products: []
        };
        order.push(n);
      }
      map[n].products.push(p);
    });
    return order.map(function (n) { return map[n]; });
  }
  function seriesCover(g) {
    if (g.cover) return g.cover;
    for (var i = 0; i < g.products.length; i++) {
      var p = g.products[i];
      var src = firstImage(p, (p.finishes || [])[0] || "");
      if (src) return src;
    }
    return "";
  }
  function seriesTypes(g) {
    var seen = {}, out = [];
    (g.products || []).forEach(function (p) {
      var t = productType(p);
      if (!seen[t]) { seen[t] = 1; out.push(t); }
    });
    return out.sort(function (a, b) { return typeRank(a) - typeRank(b); });
  }

  /* 细节图：每个产品最多 3 张，显示在主图下方，点击可放大查看 */
  function detailImages(p) {
    return ((p && p.details) || []).filter(Boolean).slice(0, 3);
  }
  function detailStrip(p, inModal) {
    var ds = detailImages(p);
    if (!ds.length) return "";
    var mainBtn = inModal
      ? '<button type="button" class="detail-thumb detail-main" data-view-main="1" aria-label="Main view">Main</button>'
      : "";
    return '<div class="detail-strip' + (inModal ? " in-modal" : "") + '">' +
      (inModal ? "" : '<span class="detail-strip-label">Details</span>') +
      '<div class="detail-thumbs">' + mainBtn +
      ds.map(function (src, i) {
        return '<button type="button" class="detail-thumb" data-view-src="' + esc(src) +
          '" aria-label="Detail view ' + (i + 1) + '"><img src="' + esc(src) +
          '" alt="' + esc((p.model || "") + " detail view " + (i + 1)) + '" loading="lazy"></button>';
      }).join("") +
      "</div></div>";
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
    if (meta && S.seoDescription && document.body.dataset.page === "home") meta.setAttribute("content", S.seoDescription);
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
        'title="' + esc(finishLabel(f)) + '" aria-label="' + esc(finishLabel(f)) + '"></button>';
    }).join("") + '<span class="finish-name">' + esc(finishLabel((p.finishes || [])[0] || "")) + "</span>";
  }

  function productCard(p) {
    var f0 = (p.finishes || [])[0] || "";
    return '<article class="product-card" data-card="' + esc(p.id) + '">' +
      '<div class="product-media">' + pic(firstImage(p, f0), p.model + " " + p.name) +
        '<span class="type-badge">' + esc(productType(p)) + "</span></div>" +
      detailStrip(p, false) +
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
        if (card.classList.contains("modal")) {
          card.setAttribute("data-main-src", firstImage(p, f));
          $$(".detail-thumb", card).forEach(function (s) { s.classList.remove("active"); });
          var mb = $(".detail-main", card);
          if (mb) mb.classList.add("active");
        }
        $$(".swatch", card).forEach(function (s) { s.classList.remove("active"); });
        b.classList.add("active");
        var label = card.querySelector(".finish-name");
        if (label) label.textContent = finishLabel(f);
        var q = card.querySelector("[data-inquire]");
        if (q) q.href = inquiryHref(p, f);
        var w = card.querySelector("[data-wa-inquire]");
        if (w) w.href = waLink(waInquiryMessage(p, f));
      });
    });
    $$("[data-detail]", root).forEach(function (b) {
      b.addEventListener("click", function () { openModal(b.getAttribute("data-detail")); });
    });
    $$("[data-view-src], [data-view-main]", root).forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault();
        var src = b.getAttribute("data-view-src");
        var card = b.closest("[data-card]");
        if (card) { openModal(card.getAttribute("data-card"), src); return; }
        var modal = b.closest(".modal");
        if (!modal) return;
        var target = src || modal.getAttribute("data-main-src") || "";
        if (!target) return;
        var image = $("#modal-main-img img", modal);
        if (image) {
          image.src = target;
          image.style.opacity = 1;
          image.alt = src ? "Product detail view" : "Main product view";
        }
        $$(".detail-thumb", modal).forEach(function (t) { t.classList.remove("active"); });
        b.classList.add("active");
      });
    });
  }

  function openModal(id, detailSrc) {
    var p = byId(id);
    var modal = $("#product-modal");
    if (!p || !modal) return;
    var f0 = (p.finishes || [])[0] || "";
    var mainSrc = firstImage(p, f0);
    modal.setAttribute("data-modal-id", id);
    modal.setAttribute("data-main-src", mainSrc);
    $("#modal-media").innerHTML =
      '<div id="modal-main-img">' + pic(detailSrc || mainSrc, p.model + " " + p.name + (detailSrc ? " - detail view" : "")) + "</div>" +
      detailStrip(p, true);
    var rows = Object.keys(p.specs || {}).map(function (k) {
      return "<tr><td>" + esc(k) + "</td><td>" + esc(p.specs[k]) + "</td></tr>";
    }).join("");
    var waBtn = waNumber()
      ? '<a class="btn btn-wa btn-block" style="margin-top:9px" data-wa-inquire="' + esc(p.id) + '" target="_blank" rel="noopener">Chat on WhatsApp</a>'
      : "";
    $("#modal-info").innerHTML =
      '<div class="product-model">' + esc(p.model) + " · " + esc(productType(p)) + " · " + esc(p.series || "") + "</div>" +
      "<h2 style=\"font-size:26px;margin:10px 0 12px\">" + esc(p.name) + "</h2>" +
      '<p class="muted" style="font-size:14px">' + esc(p.description) + "</p>" +
      '<div class="finish-row" style="margin-top:20px">' + swatches(p) + "</div>" +
      '<table class="spec-table">' + rows + "</table>" +
      '<a class="btn btn-primary btn-block" data-inquire="' + esc(p.id) + '">Request a quotation</a>' +
      waBtn +
      '<a class="btn btn-ghost btn-block" style="margin-top:9px" href="catalogs.html">View catalogs</a>';
    bindCards(modal);
    $$(".detail-thumb", modal).forEach(function (t) {
      var hit = detailSrc ? t.getAttribute("data-view-src") === detailSrc : t.hasAttribute("data-view-main");
      if (hit) t.classList.add("active");
    });
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    var modal = $("#product-modal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }

  /* 系列完整照片墙：默认折叠，点缩略图可放大并左右浏览 */
  var lightbox = null, lbSrcs = [], lbIdx = 0, lbLabel = "";
  function ensureLightbox() {
    if (lightbox) return lightbox;
    lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.id = "gallery-lightbox";
    lightbox.innerHTML =
      '<button type="button" class="lightbox-close" data-lb-close aria-label="Close">&times;</button>' +
      '<button type="button" class="lightbox-nav prev" data-lb-step="-1" aria-label="Previous photo">&#8249;</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="lightbox-nav next" data-lb-step="1" aria-label="Next photo">&#8250;</button>';
    document.body.appendChild(lightbox);
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox || (e.target.closest && e.target.closest("[data-lb-close]"))) {
        closeLightbox(); return;
      }
      var step = e.target.closest && e.target.closest("[data-lb-step]");
      if (step) lbStep(+step.getAttribute("data-lb-step"));
    });
    return lightbox;
  }
  function lbShow() {
    if (!lbSrcs.length) return;
    var el = ensureLightbox(), img = $("figure img", el), cap = $("figcaption", el);
    img.src = lbSrcs[lbIdx];
    img.alt = lbLabel + " - photo " + (lbIdx + 1);
    cap.textContent = lbLabel + " · " + (lbIdx + 1) + " / " + lbSrcs.length + " photos";
    el.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function lbStep(d) {
    if (!lbSrcs.length) return;
    lbIdx = (lbIdx + d + lbSrcs.length) % lbSrcs.length;
    lbShow();
  }
  function closeLightbox() {
    if (lightbox) lightbox.classList.remove("open");
    document.body.style.overflow = "";
  }
  function openSeriesLightbox(btn, label) {
    var box = btn.closest(".series-gallery");
    if (!box) return;
    var thumbs = $$("[data-gallery-src]", box);
    lbSrcs = thumbs.map(function (t) { return t.getAttribute("data-gallery-src"); });
    lbIdx = thumbs.indexOf(btn);
    if (lbIdx < 0) lbIdx = 0;
    lbLabel = label || "Series gallery";
    lbShow();
  }
  function seriesGallery(g) {
    var gal = g.gallery || [];
    if (!gal.length) return "";
    return '<div class="series-gallery-wrap">' +
      '<button type="button" class="gallery-toggle" data-gallery-toggle>' +
        "Show all " + gal.length + " photos of this series <span aria-hidden=\"true\">+</span></button>" +
      '<div class="series-gallery" hidden>' + gal.map(function (src, i) {
        return '<button type="button" class="gallery-thumb" data-gallery-src="' + esc(src) +
          '" data-gallery-series="' + esc(g.name) + '" aria-label="' + esc(g.name + " photo " + (i + 1)) +
          '"><img src="' + esc(src) + '" alt="" loading="lazy"></button>';
      }).join("") + "</div></div>";
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

    /* 首屏只取主打系列里不同类型的龙头；主页不放浴室挂件 */
    var groups = seriesGroups();
    set("#hero-series-count", groups.length + " series online");
    var heroPool = S.heroSeries ? P.filter(function (p) { return p.series === S.heroSeries; }) : P;
    if (!heroPool.length) heroPool = P;
    var heroPicks = [], seenTypes = {};
    heroPool.forEach(function (p) {
      var t = productType(p);
      if (!seenTypes[t] && heroPicks.length < 3) { seenTypes[t] = 1; heroPicks.push(p); }
    });
    heroPool.forEach(function (p) { if (heroPicks.length < 3 && heroPicks.indexOf(p) === -1) heroPicks.push(p); });
    P.forEach(function (p) { if (heroPicks.length < 3 && heroPicks.indexOf(p) === -1) heroPicks.push(p); });
    var trio = $("#hero-trio");
    if (trio) trio.innerHTML = heroPicks.map(function (p, i) {
      var fs = p.finishes || [];
      var f = fs.length ? fs[i % fs.length] : "";
      return pic(firstImage(p, f), p.name + (f ? " - " + f : ""));
    }).join("");
    var caps = $("#hero-captions");
    var maxFinishes = P.reduce(function (m, p) { return Math.max(m, (p.finishes || []).length); }, 0);
    var typeCount = seriesTypes({ products: P }).length;
    if (caps) caps.innerHTML = "<span>" + esc(groups.length + " series / " + P.length + " models") + "</span><span>" +
      esc(typeCount + " faucet types · up to " + (maxFinishes || 4) + " finishes") + "</span>";

    var sNav = $("#home-series-nav");
    var homeGroups = groups.filter(function (g) { return g.featured; });
    if (!homeGroups.length) homeGroups = groups.slice(0, 6);
    if (sNav) sNav.innerHTML = homeGroups.map(function (g) {
      var ts = seriesTypes(g), cover = seriesCover(g);
      return '<a class="home-series-card" href="products.html#series-' + esc(seriesSlug(g.name)) + '">' +
        '<span class="home-series-cover">' +
          (cover ? '<img src="' + esc(cover) + '" alt="' + esc(g.name) + '" loading="lazy">' : "") +
        "</span>" +
        '<span class="home-series-copy"><strong>' + esc(g.name) + "</strong>" +
          "<small>" + esc(g.products.length + " models · " + ts.length + " faucet " + (ts.length === 1 ? "type" : "types")) + "</small>" +
          "<small>" + esc(ts.slice(0, 3).join(" / ") || "Add products") + "</small>" +
        "</span>" +
        '<span class="home-series-arrow" aria-hidden="true">&rarr;</span>' +
      "</a>";
    }).join("") +
      '<a class="home-series-card home-series-all" href="products.html">' +
        '<span class="home-series-copy"><strong>View all ' + esc(groups.length) + ' series</strong>' +
        "<small>Including every page of the 2026 catalogue</small></span>" +
        '<span class="home-series-arrow" aria-hidden="true">&rarr;</span></a>';

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

  /* 产品页：先按系列分区，每个系列内再按龙头类型排列；类型筛选会隐藏不含该类型的系列 */
  function renderProducts() {
    var groups = seriesGroups();
    var present = {}, typeList = [];
    P.forEach(function (p) {
      var t = productType(p);
      if (!present[t]) { present[t] = 1; typeList.push(t); }
    });
    typeList.sort(function (a, b) { return typeRank(a) - typeRank(b); });

    var filters = $("#filter-bar");
    if (filters) filters.innerHTML = '<span class="filter-label">Faucet type</span>' +
      '<button type="button" class="chip active" data-type="All">All types</button>' +
      typeList.map(function (t) {
        return '<button type="button" class="chip" data-type="' + esc(t) + '">' + esc(t) + "</button>";
      }).join("");

    var nav = $("#series-nav");
    var mainGroups = groups.filter(function (g) { return !g.cataloguePage; });
    var catGroups = groups.filter(function (g) { return !!g.cataloguePage; });
    if (nav) nav.innerHTML = '<span class="series-nav-label">Series</span>' +
      mainGroups.map(function (g, i) {
        return '<a class="series-chip" href="#series-' + esc(seriesSlug(g.name)) + '" title="' + esc(g.name) + '">' +
          '<span class="series-chip-num">' + esc(("0" + (i + 1)).slice(-2)) + "</span>" +
          esc(g.shortName || g.name) + '<span class="series-chip-count">' + esc(g.products.length) + "</span></a>";
      }).join("") +
      (catGroups.length ? '<div class="series-nav-catalogue"><span class="series-nav-label">Catalogue pages</span>' +
        catGroups.map(function (g) {
          return '<a class="series-chip small" href="#series-' + esc(seriesSlug(g.name)) +
            '" title="' + esc(g.name) + '">' + esc(g.shortName || "Page") + "</a>";
        }).join("") + "</div>" : "");

    var wrap = $("#series-sections");
    if (!wrap) return;
    function draw(type) {
      var html = groups.map(function (g, i) {
        var list = g.products.filter(function (p) { return type === "All" || productType(p) === type; });
        if (!list.length) return "";
        list = list.slice().sort(function (a, b) {
          var d = typeRank(productType(a)) - typeRank(productType(b));
          return d || String(a.model || "").localeCompare(String(b.model || ""));
        });
        var ts = seriesTypes({ products: list });
        var cover = seriesCover(g);
        var catLink = "";
        if (g.cataloguePage && g.catalogueFile) {
          catLink = '<a class="series-catalog-link" href="' + esc(g.catalogueFile) + "#page=" + esc(g.cataloguePage) +
            '" target="_blank" rel="noopener">See this series in the catalogue, page ' + esc(g.cataloguePage) + " &rarr;</a>";
        }
        return '<section class="series-block" id="series-' + esc(seriesSlug(g.name)) + '" data-series="' + esc(g.name) + '">' +
          '<div class="series-head">' +
            '<div class="series-head-copy">' +
              '<div class="eyebrow">Series ' + esc(("0" + (i + 1)).slice(-2)) +
                (g.cataloguePage ? " · Catalogue page " + esc(g.cataloguePage) : "") + "</div>" +
              "<h2>" + esc(g.name) + "</h2>" +
              (g.description ? '<p class="series-desc">' + esc(g.description) + "</p>" : "") +
              '<div class="series-types">' +
                '<span class="type-label">In this series</span>' +
                ts.map(function (t) { return '<span class="type-pill">' + esc(t) + "</span>"; }).join("") +
                '<span class="series-count">' + esc(list.length + " " + (list.length === 1 ? "model" : "models")) + "</span>" +
              "</div>" + catLink +
            "</div>" +
            (cover ? '<div class="series-cover"><img src="' + esc(cover) + '" alt="' + esc(g.name) + '" loading="lazy"></div>' : "") +
          "</div>" +
          '<div class="grid-3 series-grid">' + list.map(productCard).join("") + "</div>" +
          seriesGallery(g) +
        "</section>";
      }).join("");
      wrap.innerHTML = html || '<p class="empty-state">No products of this type yet. <a href="catalogs.html">Download the full catalogue</a> for the complete range.</p>';
      bindCards(wrap);
      $$("[data-gallery-toggle]", wrap).forEach(function (b) {
        b.addEventListener("click", function () {
          var box = b.nextElementSibling;
          if (!box) return;
          var opening = box.hidden;
          box.hidden = !opening;
          b.classList.toggle("open", opening);
          var mark = b.querySelector("span");
          if (mark) mark.textContent = opening ? "\u2212" : "+";
        });
      });
      $$("[data-gallery-src]", wrap).forEach(function (b) {
        b.addEventListener("click", function () {
          openSeriesLightbox(b, b.getAttribute("data-gallery-series") || "Series");
        });
      });
    }
    draw("All");
    $$("[data-type]", filters).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("[data-type]", filters).forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        draw(b.getAttribute("data-type"));
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
    var fin = {};
    P.forEach(function (p) { (p.finishes || []).forEach(function (f) { fin[f] = 1; }); });
    var panel = $("#about-panel");
    if (panel) panel.innerHTML =
      "<h3>At a glance</h3>" +
      '<div class="kv"><span>Business</span><span>' + esc(S.tagline) + "</span></div>" +
      '<div class="kv"><span>Experience</span><span>' + esc(S.since) + "</span></div>" +
      '<div class="kv"><span>Series</span><span>' + esc(seriesGroups().length + " series") + "</span></div>" +
      '<div class="kv"><span>Product models</span><span>' + esc(P.length + " models") + "</span></div>" +
      '<div class="kv"><span>Finishes</span><span>' + esc(Object.keys(fin).length + " finish options") + "</span></div>" +
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
    if (modal) $$("[data-close]", modal).forEach(function (b) { b.addEventListener("click", closeModal); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeModal(); closeLightbox(); }
      if (lightbox && lightbox.classList.contains("open")) {
        if (e.key === "ArrowLeft") lbStep(-1);
        if (e.key === "ArrowRight") lbStep(1);
      }
    });
  });
})();
