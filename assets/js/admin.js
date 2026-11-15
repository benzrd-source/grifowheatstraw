(function () {
  "use strict";

  var site = clone(window.SITE || {});
  var products = clone(window.PRODUCTS || []);
  var series = clone(window.SERIES || []);
  var catalogs = clone(window.CATALOGS || []);
  var pending = {};
  var bulkPaths = [];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "file"; }
  function ext(n) { var m = /\.([a-z0-9]+)$/i.exec(n || ""); return m ? m[1].toLowerCase() : "bin"; }
  function safeName(n) { return String(n || "file").replace(/[^a-zA-Z0-9._-]/g, "-"); }
  function fmt(n) { return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB"; }
  function label(k) { return k.replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); }); }
  function toast(msg) {
    var t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.remove(); }, 3200);
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function wrap(name, obj, note) {
    return "/* " + note + " */\nwindow." + name + " = " + JSON.stringify(obj, null, 2) + ";\n";
  }
  function specsToText(specs) {
    return Object.keys(specs || {}).map(function (k) { return k + ": " + specs[k]; }).join("\n");
  }
  function textToSpecs(txt) {
    var out = {};
    String(txt || "").split("\n").forEach(function (line) {
      var i = line.indexOf(":");
      if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    return out;
  }

  function inputField(idx, key, val, opt) {
    opt = opt || {};
    var common = 'data-pindex="' + idx + '" data-field="' + key + '"';
    var control;
    if (opt.options) {
      var opts = opt.options.slice();
      if (val && opts.indexOf(String(val)) === -1) opts.unshift(String(val));
      control = '<select ' + common + '>' + opts.map(function (o) {
        return '<option value="' + esc(o) + '"' + (String(o) === String(val) ? " selected" : "") + ">" + esc(o) + "</option>";
      }).join("") + "</select>";
    } else if (opt.area) {
      control = "<textarea " + common + ">" + esc(val) + "</textarea>";
    } else {
      control = '<input type="text" ' + common + ' value="' + esc(val) + '">';
    }
    return '<div class="field' + (opt.full ? " full" : "") + '"><label>' + esc(opt.label || label(key)) + "</label>" + control + "</div>";
  }

  /* ---------- tabs ---------- */
  $$(".admin-tab").forEach(function (b) {
    b.addEventListener("click", function () {
      var tab = b.getAttribute("data-tab");
      $$(".admin-tab").forEach(function (x) { x.classList.remove("active"); });
      $$(".admin-panel").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      $("#panel-" + tab).classList.add("active");
      if (tab === "export") renderSummary();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  /* ---------- products ---------- */
  var TYPE_OPTIONS = [
    "Basin Mixer", "Kitchen Faucet", "Shower Mixer", "Bathtub Mixer",
    "Concealed Shower Mixer", "Shower Column Set", "Other"
  ];
  var PRODUCT_FIELDS = [
    { k: "model", label: "Model" },
    { k: "name", label: "Product name" },
    { k: "series", label: "Series (must match a name on the Series tab)" },
    { k: "type", label: "Faucet type (used by the filter)", options: TYPE_OPTIONS },
    { k: "category", label: "Category (optional sub-label)" },
    { k: "material", label: "Material" },
    { k: "description", label: "Description", area: true, full: true },
    { k: "finishes", label: "Surface finishes (one per line)", area: true, full: true, special: "finishes" },
    { k: "specs", label: "Specifications (Key: Value per line)", area: true, full: true, special: "specs" }
  ];

  function imageRow(idx, finish, current) {
    return '<div class="file-item" data-img-finish="' + esc(finish) + '">' +
      '<span class="grow"><strong>' + esc(finish) + '</strong><br><span class="muted">' + esc(current || "no image assigned") + "</span></span>" +
      '<img class="thumb" src="' + esc(current || "") + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
      '<input type="file" accept="image/*,.svg,.webp" data-pindex="' + idx + '" data-finish="' + esc(finish) + '">' +
    "</div>";
  }

  function detailRow(idx, slot, current) {
    return '<div class="file-item" data-detail-slot="' + slot + '">' +
      '<span class="grow"><strong>Detail ' + (slot + 1) + '</strong><br><span class="muted">' + esc(current || "empty (optional)") + "</span></span>" +
      '<img class="thumb" src="' + esc(current || "") + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
      '<input type="file" accept="image/*,.svg,.webp" data-pindex="' + idx + '" data-detail="' + slot + '">' +
      (current ? '<button class="btn btn-ghost btn-sm" type="button" data-del-detail="' + idx + '" data-del-src="' + esc(current) + '">Remove</button>' : "") +
    "</div>";
  }

  function renderProducts() {
    $("#products-editor").innerHTML = products.map(function (p, i) {
      var fields = PRODUCT_FIELDS.map(function (f) {
        var v = f.special === "finishes" ? (p.finishes || []).join("\n")
          : f.special === "specs" ? specsToText(p.specs)
          : (p[f.k] || "");
        return inputField(i, f.k, v, f);
      }).join("");
      var images = (p.finishes || []).map(function (f) { return imageRow(i, f, p.images && p.images[f]); }).join("");
      var details = (p.details || []).filter(Boolean).slice(0, 3);
      var detailRows = [0, 1, 2].map(function (s) { return detailRow(i, s, details[s]); }).join("");
      return '<div class="admin-row" data-row="' + i + '">' +
        '<div class="admin-row-head">' +
          '<strong>' + esc(p.model || "New product") + " — " + esc(p.name || "") + "</strong>" +
          '<div style="display:flex;gap:16px;align-items:center;white-space:nowrap">' +
            '<label style="font-size:12.5px;display:flex;gap:6px;align-items:center"><input type="checkbox" data-pindex="' + i + '" data-field="featured"' + (p.featured ? " checked" : "") + '> Featured on home</label>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-del-product="' + i + '">Delete</button>' +
          "</div>" +
        "</div>" +
        '<div class="admin-fields">' + fields + "</div>" +
        '<div class="sub-card"><h4>Images by finish — select a file to replace the picture</h4>' + images + "</div>" +
        '<div class="sub-card"><h4>Detail images — up to 3 close-up views shown under the main photo</h4>' + detailRows + "</div>" +
      "</div>";
    }).join("");
  }

  var pEditor = $("#products-editor");
  pEditor.addEventListener("input", function (e) {
    var t = e.target, i = t.getAttribute("data-pindex"), k = t.getAttribute("data-field");
    if (i === null || !k || k === "finishes" || k === "featured") return;
    if (k === "specs") { products[+i].specs = textToSpecs(t.value); return; }
    products[+i][k] = t.value;
    var head = t.closest(".admin-row").querySelector(".admin-row-head strong");
    if (head && (k === "model" || k === "name")) head.textContent = (products[+i].model || "") + " — " + (products[+i].name || "");
  });
  pEditor.addEventListener("change", function (e) {
    var t = e.target, i = t.getAttribute("data-pindex"), k = t.getAttribute("data-field");
    if (t.type === "file") {
      var file = t.files && t.files[0];
      if (!file) return;
      var p = products[+i], f = t.getAttribute("data-finish"), slot = t.getAttribute("data-detail");
      var isDetail = slot !== null;
      var path = isDetail
        ? "assets/img/details/" + slug(p.model) + "-detail-" + (+slot + 1) + "." + ext(file.name)
        : "assets/img/" + slug(p.model) + "-" + slug(f) + "." + ext(file.name);
      if (isDetail) {
        var old = (p.details || [])[+slot];
        if (old && old !== path) delete pending[old];
        var ds = (p.details || []).filter(Boolean).slice(0, 3);
        while (ds.length < 3) ds.push("");
        ds[+slot] = path;
        p.details = ds.filter(Boolean).slice(0, 3);
      } else {
        pending[path] = file;
        p.images = p.images || {};
        p.images[f] = path;
      }
      if (isDetail) pending[path] = file;
      var row = t.closest(".file-item");
      var thumb = row.querySelector("img");
      thumb.src = URL.createObjectURL(file);
      thumb.style.visibility = "visible";
      row.querySelector(".muted").textContent = path + " · " + fmt(file.size) + " · ready to export";
      if (isDetail && !row.querySelector("[data-del-detail]")) {
        var rm = document.createElement("button");
        rm.type = "button"; rm.className = "btn btn-ghost btn-sm";
        rm.setAttribute("data-del-detail", i);
        rm.setAttribute("data-del-src", path);
        rm.textContent = "Remove";
        row.appendChild(rm);
      }
      toast("Image staged: " + path);
      return;
    }
    if (i === null || !k) return;
    if (k === "featured") { products[+i].featured = t.checked; return; }
    if (k === "finishes") {
      products[+i].finishes = t.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      renderProducts();
      return;
    }
    if (k === "specs") { products[+i].specs = textToSpecs(t.value); return; }
    products[+i][k] = t.value;
  });
  pEditor.addEventListener("click", function (e) {
    var di = e.target.getAttribute && e.target.getAttribute("data-del-detail");
    if (di !== null && di !== undefined) {
      var src = e.target.getAttribute("data-del-src");
      var p = products[+di];
      if (p) {
        p.details = (p.details || []).filter(function (x) { return x !== src; }).slice(0, 3);
        if (src) delete pending[src];
        renderProducts();
        toast("Detail image removed (max 3 per product)");
      }
      return;
    }
    var d = e.target.getAttribute && e.target.getAttribute("data-del-product");
    if (d === null || d === undefined) return;
    if (!window.confirm("Delete this product from the exported data?")) return;
    products.splice(+d, 1);
    renderProducts();
  });
  $("#add-product").addEventListener("click", function () {
    products.push({
      id: "product-" + Date.now(), model: "NEW-001", name: "New product",
      category: "Basin Mixer", type: "Basin Mixer",
      series: products.length ? products[0].series : (series[0] ? series[0].name : ""),
      material: "SS304 stainless steel",
      description: "", finishes: ["Chrome"], images: {}, details: [], specs: {}, featured: false
    });
    renderProducts();
    toast("Product added. Remember to assign images.");
  });

  /* ---------- series ---------- */
  var SERIES_FIELDS = [
    { k: "name", label: "Series name (must match the product Series field)" },
    { k: "description", label: "Series description", area: true, full: true },
    { k: "cataloguePage", label: "Catalogue page number (0 = no link)" }
  ];
  function renderSeries() {
    $("#series-editor").innerHTML = series.map(function (s, i) {
      var fields = SERIES_FIELDS.map(function (f) {
        return inputField(i, f.k, s[f.k] == null ? "" : s[f.k], f);
      }).join("");
      var used = products.filter(function (p) { return p.series === s.name; }).length;
      return '<div class="admin-row" data-srow="' + i + '">' +
        '<div class="admin-row-head"><strong>' + esc(s.name || "New series") +
          ' <span class="muted" style="font-weight:400;font-size:12px">(' + used + " products)</span></strong>" +
          '<button class="btn btn-ghost btn-sm" type="button" data-del-series="' + i + '">Delete</button></div>' +
        '<div class="admin-fields">' + fields + "</div>" +
        '<div class="file-item"><span class="grow"><strong>Series cover (optional)</strong><br><span class="muted">' +
          esc(s.cover || "falls back to the first product photo") + "</span></span>" +
          '<img class="thumb" src="' + esc(s.cover || "") + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
          '<input type="file" accept="image/*,.svg,.webp" data-sindex="' + i + '"></div>' +
        "</div>";
    }).join("");
  }
  var sEditor = $("#series-editor");
  sEditor.addEventListener("input", function (e) {
    var t = e.target, i = t.getAttribute("data-pindex"), k = t.getAttribute("data-field");
    if (i === null || !k) return;
    series[+i][k] = k === "cataloguePage" ? (parseInt(t.value, 10) || 0) : t.value;
    if (k === "name") {
      var head = t.closest(".admin-row").querySelector(".admin-row-head strong");
      if (head) head.textContent = t.value + " (" + products.filter(function (p) { return p.series === t.value; }).length + " products)";
    }
  });
  sEditor.addEventListener("change", function (e) {
    var t = e.target;
    if (t.type === "file") {
      var file = t.files && t.files[0];
      if (!file) return;
      var i = +t.getAttribute("data-sindex");
      var path = "assets/img/series/" + slug(series[i].name || series[i].id || ("series-" + i)) + "." + ext(file.name);
      pending[path] = file;
      series[i].cover = path;
      var row = t.closest(".file-item");
      var thumb = row.querySelector("img");
      thumb.src = URL.createObjectURL(file);
      thumb.style.visibility = "visible";
      row.querySelector(".muted").textContent = path + " · " + fmt(file.size) + " · ready to export";
      toast("Series cover staged: " + path);
      return;
    }
    var si = t.getAttribute("data-pindex"), sk = t.getAttribute("data-field");
    if (si === null || !sk) return;
    series[+si][sk] = sk === "cataloguePage" ? (parseInt(t.value, 10) || 0) : t.value;
  });
  sEditor.addEventListener("click", function (e) {
    var d = e.target.getAttribute && e.target.getAttribute("data-del-series");
    if (d === null || d === undefined) return;
    if (!window.confirm("Delete this series entry? Products are kept and will be grouped under their Series name.")) return;
    series.splice(+d, 1);
    renderSeries();
  });
  $("#add-series").addEventListener("click", function () {
    series.push({
      id: "series-" + Date.now(), name: "New series", description: "", cover: "",
      cataloguePage: 0, catalogueFile: catalogs[0] ? catalogs[0].file : ""
    });
    renderSeries();
    toast("Series added. Use the same name in each product's Series field.");
  });

  /* ---------- catalogs ---------- */
  var CATALOG_FIELDS = [
    { k: "title", label: "Title", full: true },
    { k: "code", label: "Code" },
    { k: "updated", label: "Updated (YYYY-MM)" },
    { k: "pages", label: "Pages" },
    { k: "size", label: "File size shown to visitors" },
    { k: "description", label: "Description", area: true, full: true }
  ];
  function renderCatalogs() {
    $("#catalogs-editor").innerHTML = catalogs.map(function (c, i) {
      var fields = CATALOG_FIELDS.map(function (f) {
        return inputField(i, f.k, c[f.k] || "", { label: f.label, area: f.area, full: f.full });
      }).join("");
      return '<div class="admin-row">' +
        '<div class="admin-row-head"><strong>' + esc(c.title || "New catalog") + '</strong>' +
        '<div style="display:flex;gap:16px;align-items:center;white-space:nowrap">' +
          '<label style="font-size:12.5px;display:flex;gap:6px;align-items:center"><input type="checkbox" data-cindex="' + i + '" data-field="featured"' + (c.featured ? " checked" : "") + '> Featured</label>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-del-catalog="' + i + '">Delete</button></div></div>' +
        '<div class="admin-fields">' + fields + "</div>" +
        '<div class="file-item"><span class="grow"><strong>PDF file</strong><br><span class="muted">' + esc(c.file || "no file assigned") + "</span></span>" +
          '<input type="file" accept=".pdf" data-cindex="' + i + '"></div>' +
        '<div class="file-item"><span class="grow"><strong>Cover image</strong><br><span class="muted">' + esc(c.cover || "no cover") + "</span></span>" +
          '<input type="file" accept="image/*,.svg" data-coverindex="' + i + '"></div>' +
      "</div>";
    }).join("");
  }
  var cEditor = $("#catalogs-editor");
  cEditor.addEventListener("input", function (e) {
    var t = e.target;
    var i = t.getAttribute("data-pindex");
    if (i === null) i = t.getAttribute("data-cindex");
    var k = t.getAttribute("data-field");
    if (i === null || !k || k === "featured") return;
    catalogs[+i][k] = t.value;
  });
  cEditor.addEventListener("change", function (e) {
    var t = e.target;
    if (t.type === "checkbox") { catalogs[+t.getAttribute("data-cindex")].featured = t.checked; return; }
    if (t.type !== "file" || !t.files || !t.files[0]) return;
    var file = t.files[0];
    var ci = t.getAttribute("data-cindex");
    var vi = t.getAttribute("data-coverindex");
    var path, idx, key, row;
    if (ci !== null) {
      idx = +ci; key = "file";
      path = "assets/catalogs/" + safeName(file.name);
      row = t.closest(".file-item");
    } else {
      idx = +vi; key = "cover";
      path = "assets/img/catalog-" + slug(catalogs[idx].id || idx) + "." + ext(file.name);
      row = t.closest(".file-item");
    }
    if (isNaN(idx) || !catalogs[idx]) return;
    pending[path] = file;
    catalogs[idx][key] = path;
    catalogs[idx].size = key === "file" ? fmt(file.size) : catalogs[idx].size;
    row.querySelector(".muted").textContent = path + " · " + fmt(file.size) + " · ready to export";
    toast("File staged: " + path);
  });
  cEditor.addEventListener("click", function (e) {
    var d = e.target.getAttribute && e.target.getAttribute("data-del-catalog");
    if (d === null || d === undefined) return;
    if (!window.confirm("Delete this catalog entry?")) return;
    catalogs.splice(+d, 1);
    renderCatalogs();
  });
  $("#add-catalog").addEventListener("click", function () {
    catalogs.push({ id: "catalog-" + Date.now(), title: "New catalog", code: "CAT-NEW", description: "", file: "", cover: "", pages: "", size: "", updated: "", featured: false });
    renderCatalogs();
  });

  /* ---------- bulk upload ---------- */
  function addBulk(files) {
    Array.prototype.forEach.call(files, function (file) {
      var isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
      var path = (isPdf ? "assets/catalogs/" : "assets/img/") + safeName(file.name);
      pending[path] = file;
      if (bulkPaths.indexOf(path) === -1) bulkPaths.push(path);
    });
    renderBulk();
    toast(files.length + " file(s) staged");
  }
  function renderBulk() {
    $("#bulk-list").innerHTML = bulkPaths.map(function (path) {
      var file = pending[path];
      if (!file) return "";
      var isImg = /\.(png|jpe?g|webp|gif|svg)$/i.test(path);
      var preview = isImg
        ? '<img src="' + URL.createObjectURL(file) + '" alt="">'
        : '<div style="height:88px;display:grid;place-items:center;font-size:12px;color:#7d857f">PDF</div>';
      return '<div class="preview-item">' + preview + "<span>" + esc(path) + "<br>" + fmt(file.size) + "</span>" +
        '<button class="btn btn-ghost btn-sm" type="button" data-remove="' + esc(path) + '" style="margin-top:8px">Remove</button></div>';
    }).join("");
  }
  $("#bulk-list").addEventListener("click", function (e) {
    var p = e.target.getAttribute && e.target.getAttribute("data-remove");
    if (!p) return;
    delete pending[p];
    bulkPaths = bulkPaths.filter(function (x) { return x !== p; });
    renderBulk();
  });
  var drop = $("#bulk-drop"), bulkInput = $("#bulk-input");
  drop.addEventListener("click", function (e) { if (e.target !== bulkInput) bulkInput.click(); });
  drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", function () { drop.classList.remove("over"); });
  drop.addEventListener("drop", function (e) {
    e.preventDefault(); drop.classList.remove("over");
    if (e.dataTransfer && e.dataTransfer.files.length) addBulk(e.dataTransfer.files);
  });
  bulkInput.addEventListener("change", function () { if (bulkInput.files.length) addBulk(bulkInput.files); });

  /* ---------- company info ---------- */
  function renderSite() {
    $("#site-editor").innerHTML = '<div class="admin-row"><div class="admin-fields">' +
      Object.keys(site).map(function (k) {
        var v = site[k];
        var isComplex = typeof v === "object";
        var long = String(v).length > 90;
        var common = 'data-sitekey="' + esc(k) + '"';
        var control = isComplex
          ? "<textarea " + common + ">" + esc(JSON.stringify(v, null, 2)) + "</textarea>"
          : long
            ? "<textarea " + common + ">" + esc(v) + "</textarea>"
            : '<input type="text" ' + common + ' value="' + esc(v) + '">';
        return '<div class="field' + (isComplex || long ? " full" : "") + '"><label>' + esc(label(k)) + "</label>" + control + "</div>";
      }).join("") + "</div></div>";
  }
  $("#site-editor").addEventListener("input", function (e) {
    var k = e.target.getAttribute("data-sitekey");
    if (!k) return;
    var original = site[k];
    if (typeof original === "object") {
      try { site[k] = JSON.parse(e.target.value); e.target.style.borderColor = ""; }
      catch (err) { e.target.style.borderColor = "#c0392b"; }
    } else {
      site[k] = e.target.value;
    }
  });

  /* ---------- export ---------- */
  function renderSummary() {
    var paths = Object.keys(pending);
    var total = paths.reduce(function (n, p) { return n + (pending[p].size || 0); }, 0);
    $("#export-summary").innerHTML =
      '<div class="admin-note"><strong>Ready to export:</strong> 4 data files, ' + series.length + " series, " + products.length + " products, " + catalogs.length +
      " catalog entries, " + paths.length + " staged asset files (" + fmt(total) + ")." +
      (paths.length === 0 ? " No new images or PDFs selected — only the data files will be included." : "") + "</div>" +
      '<ul class="list-plain">' +
        "<li>data/site.js · data/series.js · data/products.js · data/catalogs.js</li>" +
        paths.slice(0, 12).map(function (p) { return "<li>" + esc(p) + " · " + fmt(pending[p].size) + "</li>"; }).join("") +
        (paths.length > 12 ? "<li>… and " + (paths.length - 12) + " more</li>" : "") +
      "</ul>";
    $("#export-steps").innerHTML = [
      "Unzip site-update.zip on your computer.",
      "Open your repository on github.com and go to the repository root.",
      "Drag the data/ folder and the assets/ folder into the file area (or click Add file → Upload files).",
      "Scroll down and click Commit changes — Cloudflare Pages rebuilds automatically.",
      "Wait about one minute, then refresh your website to confirm the update."
    ].map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
  }
  function readme() {
    return "SITE UPDATE PACKAGE\r\n" +
      "Generated by the site manager.\r\n\r\n" +
      "WHAT TO DO\r\n" +
      "1. Unzip this file.\r\n" +
      "2. Open your GitHub repository at its root.\r\n" +
      "3. Upload the data/ folder and the assets/ folder (drag and drop works in Chrome/Edge).\r\n" +
      "4. Commit changes. Cloudflare Pages rebuilds and publishes in about a minute.\r\n\r\n" +
      "FILES\r\n" +
      "data/site.js       company name, email, phone, WhatsApp number, marketing copy\r\n" +
      "data/series.js     series list: one series = one catalogue page, many faucet types\r\n" +
      "data/products.js   product list, series, type, finishes, image paths, up to 3 detail views\r\n" +
      "data/catalogs.js   PDF catalog entries\r\n" +
      "assets/img/        product images and catalog covers\r\n" +
      "assets/img/series/ optional series cover images\r\n" +
      "assets/img/details/  up to 3 close-up detail images per product\r\n" +
      "assets/catalogs/   PDF catalogs\r\n\r\n" +
      "BULK IMPORT (send folders to your assistant)\r\n" +
      "One folder per series, named after the series, e.g. inbox/VIENNA/.\r\n" +
      "Inside: MODEL_FINISH.jpg (SS504002_Chrome.jpg) or TYPE_FINISH.jpg\r\n" +
      "(Kitchen Faucet_Chrome.jpg / 厨房龙头_拉丝.jpg).\r\n" +
      "Detail views: SS504002_detail1.jpg ... detail3.jpg (up to 3 per model).\r\n" +
      "Optional series.json sets the description and catalogue page number.\r\n\r\n" +
      "Existing files with the same name are replaced. Files you did not change are not included.\r\n" +
      "Keep each PDF under 25 MB.\r\n";
  }
  function buildZip(includeAssets) {
    if (typeof JSZip === "undefined") { toast("ZIP library failed to load"); return null; }
    var zip = new JSZip();
    zip.file("data/site.js", wrap("SITE", site, "Company info — edit in admin.html or replace with an exported file."));
    zip.file("data/series.js", wrap("SERIES", series, "Series grouping — one series can hold many faucet types."));
    zip.file("data/products.js", wrap("PRODUCTS", products, "Product data — edit in admin.html or replace with an exported file."));
    zip.file("data/catalogs.js", wrap("CATALOGS", catalogs, "Catalog entries — edit in admin.html or replace with an exported file."));
    if (includeAssets) {
      Object.keys(pending).forEach(function (p) { zip.file(p, pending[p]); });
      zip.file("UPDATE-README.txt", readme());
    }
    return zip;
  }
  $("#btn-export-zip").addEventListener("click", function () {
    var zip = buildZip(true);
    if (!zip) return;
    toast("Building ZIP…");
    zip.generateAsync({ type: "blob", compression: "STORE" }).then(function (blob) {
      download(blob, "site-update.zip");
      toast("Downloaded. Upload data/ and assets/ to your repository.");
    });
  });
  $("#btn-export-data").addEventListener("click", function () {
    var zip = buildZip(false);
    if (!zip) return;
    zip.generateAsync({ type: "blob", compression: "STORE" }).then(function (blob) {
      download(blob, "site-data.zip");
      toast("Downloaded data files only.");
    });
  });

  renderProducts();
  renderSeries();
  renderCatalogs();
  renderSite();
  renderBulk();
  renderSummary();
})();
