(function () {
  "use strict";

  var state = { catalog: null, categoryId: null, error: null, search: "" };

  var APP_VERSION = "1.0.0";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtBytes(n) {
    if (!n || n <= 0) return "-";
    var units = ["B", "KB", "MB", "GB", "TB"];
    var i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return n.toFixed(n >= 100 ? 0 : 1) + " " + units[i];
  }

  function fmtDate(iso) {
    if (!iso) return "-";
    var d = new Date(iso);
    if (isNaN(d)) return "-";
    return d.toLocaleDateString("tr-TR", { year: "numeric", month: "short", day: "numeric" });
  }

  function img(url, cls, alt) {
    if (!url) return '<div class="placeholder">🎮</div>';
    return '<img class="' + (cls || "") + '" src="' + esc(url) + '" alt="' + esc(alt || "") + '" loading="lazy" />';
  }

  /* ---------- Catalog data ---------- */

  function fetchCatalog() {
    return fetch("catalog.json", { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("Katalog alınamadı (HTTP " + r.status + ")");
        return r.json();
      })
      .then(function (data) {
        state.catalog = data;
        fillCategoryFilter(data.categories || []);
        return data;
      });
  }

  function fillCategoryFilter(categories) {
    var sel = $("#catFilter");
    if (!sel) return;
    var opts = '<option value="">Tüm Kategoriler</option>';
    (categories || []).forEach(function (c) { opts += '<option value="' + esc(c.id) + '">' + esc(c.name) + "</option>"; });
    sel.innerHTML = opts;
  }

  function currentCategoryId() {
    return (state.catalog && state.catalog.categories || []).length ? state.categoryId : null;
  }

  function filteredGames() {
    var games = (state.catalog && state.catalog.games) || [];
    if (state.categoryId) games = games.filter(function (g) { return g.categoryId === state.categoryId; });
    if (state.search) {
      var q = state.search.toLowerCase();
      games = games.filter(function (g) {
        return (g.title || "").toLowerCase().indexOf(q) !== -1 ||
          (g.description || "").toLowerCase().indexOf(q) !== -1 ||
          (g.genre || "").toLowerCase().indexOf(q) !== -1;
      });
    }
    return games;
  }

  /* ---------- App update banner ---------- */

  function renderUpdateBanner(latest) {
    var el = $("#updateBanner");
    if (!el) return;
    if (!latest || !latest.version) { el.hidden = true; el.innerHTML = ""; return; }
    var notes = latest.notes ? "<span>" + esc(latest.notes) + "</span>" : "";
    var btn = latest.downloadUrl
      ? '<a class="btn btn-primary btn-sm" href="' + esc(latest.downloadUrl) + '" target="_blank" rel="noopener">Güncelle</a>'
      : '<span class="dim" style="font-size:.82rem">İndirme bağlantısı yakında eklenecek.</span>';
    el.innerHTML =
      '<div class="update-banner-inner">' +
        '<span style="font-size:1.1rem">🆕</span>' +
        '<div class="update-text"><strong>PcHTML v' + esc(latest.version) + " yayınlandı.</strong>" + notes + "</div>" +
        '<div class="update-actions">' + btn + "</div>" +
      "</div>";
    el.hidden = false;
  }

  function fetchAppUpdate() {
    fetch("app-update.json", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.updateAvailable) renderUpdateBanner(d.latest);
      })
      .catch(function () {});
  }

  /* ---------- Actions ---------- */

  function primaryAction(g) {
    var file = Array.isArray(g.latestFiles) && g.latestFiles.length ? g.latestFiles[0] : null;
    var isExternal = file ? file.source === "external" : !!(g.externalUrl && !g.downloadUrl);
    var url = isExternal
      ? ((file && file.downloadUrl) || g.externalUrl)
      : ((file && file.downloadUrl) || g.downloadUrl);
    return { isExternal: isExternal, url: url || "" };
  }

  function actionButtons(g, sizeClass) {
    var a = primaryAction(g);
    var cls = sizeClass || "";
    var detail = '<a class="btn btn-ghost ' + cls + '" href="#/oyun/' + g.id + '">İncele</a>';
    if (!a.url) return detail;
    if (a.isExternal) {
      return '<a class="btn btn-primary ' + cls + '" href="' + esc(a.url) + '" target="_blank" rel="noopener nofollow">🌐 Sayfaya Git</a>' + detail;
    }
    return '<a class="btn btn-primary ' + cls + '" href="' + esc(a.url) + '" download>⬇ İndir</a>' + detail;
  }

  /* ---------- Rendering ---------- */

  function categoryName(id) {
    var cats = (state.catalog && state.catalog.categories) || [];
    for (var i = 0; i < cats.length; i++) if (cats[i].id === id) return cats[i].name;
    return null;
  }

  function coverWithFallback(g) {
    if (g.coverUrl) return '<img class="gcard-cover-img" src="' + esc(g.coverUrl) + '" alt="' + esc(g.title) + '" loading="lazy" />';
    return '<div class="placeholder">🎮</div>';
  }

  function card(g) {
    var a = primaryAction(g);
    var cat = categoryName(g.categoryId);
    var file = Array.isArray(g.latestFiles) && g.latestFiles.length ? g.latestFiles[0] : null;
    var size = file ? fmtBytes(file.fileSize) : "-";
    var version = g.latestVersion ? g.latestVersion.version : (g.version || null);
    var featuredBadge = g.isFeatured ? '<span class="gcard-featured">★ Öne Çıkan</span>' : "";
    var developer = g.developer ? g.developer : (g.publisher || "");
    var fileBadge = a.isExternal ? "🌐 Harici" : "";
    var urlLabel = a.isExternal ? "Sayfaya Git" : "İndir";
    var urlIcon = a.isExternal ? "🌐" : "⬇";
    return (
      '<article class="gcard">' +
        '<a class="gcard-cover" href="#/oyun/' + g.id + '" aria-label="' + esc(g.title) + '">' +
          coverWithFallback(g) +
          '<span class="gcard-overlay"></span>' +
          (cat ? '<span class="gcard-cat">' + esc(cat) + "</span>" : "") +
          featuredBadge +
          '<span class="gcard-play">' +
            '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z"/></svg>' +
          "</span>" +
        "</a>" +
        '<div class="gcard-body">' +
          '<a class="gcard-title" href="#/oyun/' + g.id + '">' + esc(g.title) + "</a>" +
          (developer ? '<div class="gcard-dev">' + esc(developer) + "</div>" : "") +
          '<div class="gcard-meta">' +
            '<span class="gcard-size">' + size + "</span>" +
            (version ? '<span class="gcard-ver">v' + esc(version) + "</span>" : "") +
            (fileBadge ? '<span class="gcard-ext">' + fileBadge + "</span>" : "") +
          "</div>" +
          '<div class="gcard-actions">' +
            (a.url
              ? '<a class="btn btn-primary btn-sm" href="' + esc(a.url) + '" target="_blank" rel="noopener nofollow">' + urlIcon + " " + urlLabel + "</a>"
              : '<span class="btn btn-ghost btn-sm" style="cursor:default">Yakında</span>') +
            '<a class="btn btn-ghost btn-sm" href="#/oyun/' + g.id + '">İncele</a>' +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function renderCatalog() {
    var grid = $("#catalogGrid");
    var count = $("#catalogCount");
    var games = filteredGames();
    count.textContent = (state.catalog ? state.catalog.games.length : 0) + " oyun listeleniyor";
    if (!games.length) {
      grid.innerHTML = '<div class="empty">Bu kategoride oyun bulunamadı.</div>';
      return;
    }
    grid.innerHTML = games.map(card).join("");
  }

  function renderRequirements(requirements) {
    if (!requirements) return "";
    var min = requirements.minimum;
    var rec = requirements.recommended;
    function reqTable(title, obj) {
      if (!obj) return "";
      var keys = Object.keys(obj);
      if (!keys.length) return "";
      var rows = keys.map(function (k) {
        return '<div class="req-row"><span class="k">' + esc(k) + "</span><span class='v'>" + esc(obj[k]) + "</span></div>";
      }).join("");
      return '<div class="req-col"><div class="req-title">' + esc(title) + "</div>" + rows + "</div>";
    }
    var cols = reqTable("Minimum", min) + reqTable("Önerilen", rec);
    if (!cols) return "";
    return '<div class="require"><h4>Sistem Gereksinimleri</h4><div class="req-grid">' + cols + "</div></div>";
  }

  function renderGame(id) {
    var el = $("#gameDetail");
    var g = state.catalog && state.catalog.games.find(function (x) { return Number(x.id) === Number(id); });
    if (!g) {
      el.innerHTML = '<div class="empty">Oyun bulunamadı. <a href="#/katalog" style="color:var(--accent)">Kataloğa dön</a></div>';
      return;
    }
    var a = primaryAction(g);
    var file = Array.isArray(g.latestFiles) && g.latestFiles.length ? g.latestFiles[0] : null;
    var cat = categoryName(g.categoryId);
    var version = g.latestVersion ? g.latestVersion.version : (g.version || null);
    var releaseDate = g.releaseDate || (g.latestVersion && g.latestVersion.releasedAt);
    var tags = [];
    if (cat) tags.push(cat);
    if (g.genre) tags.push(g.genre);
    if (version) tags.push("v" + version);
    if (g.membersOnly) tags.push("Üyelere Özel");

    var actionHtml = "";
    if (!a.url) {
      actionHtml = '<span class="dim" style="font-size:.9rem;text-align:center">Yakında</span>';
    } else if (a.isExternal) {
      actionHtml = '<a class="btn btn-primary btn-lg btn-block" href="' + esc(a.url) + '" target="_blank" rel="noopener nofollow">🌐 Sayfaya Git</a>' +
        '<span class="dim" style="font-size:.82rem;text-align:center">Oyun tarayıcıda açılır; dosyayı oradan indirebilirsin.</span>';
    } else {
      actionHtml = '<a class="btn btn-primary btn-lg btn-block" href="' + esc(a.url) + '" download>⬇ İndir</a>' +
        '<span class="dim" style="font-size:.82rem;text-align:center">Dosyayı indir; uygulamada "Oyun Ekle" bölümünden kur.</span>';
    }
    var screens = Array.isArray(g.screenshots) && g.screenshots.length
      ? '<div class="screens"><div class="screens-title">Ekran Görüntüleri</div><div class="screens-grid">' +
        g.screenshots.map(function (s) { return '<img class="shot" src="' + esc(s) + '" alt="' + esc(g.title) + ' görüntüsü" loading="lazy" />'; }).join("") + "</div></div>"
      : "";

    var infoRows =
      (g.developer ? infoRow("Geliştirici", g.developer) : "") +
      (g.publisher ? infoRow("Yayıncı", g.publisher) : "") +
      infoRow("Kategori", cat || "—") +
      infoRow("Sürüm", version || "—") +
      infoRow("Boyut", fmtBytes(file && file.fileSize)) +
      infoRow("Yayın Tarihi", fmtDate(releaseDate)) +
      (file && file.fileName ? infoRow("Dosya", file.fileName) : "");

    el.innerHTML =
      '<div class="detail-head">' +
          (g.bannerUrl && !g.coverUrl ? '<div class="detail-hero-bg"><img src="' + esc(g.bannerUrl) + '" alt="" /></div>' : "") +
          '<div class="detail-cover-wrap">' + coverWithFallback(g) + (g.isFeatured ? '<span class="gcard-featured">★ Öne Çıkan</span>' : "") + "</div>" +
          '<div class="detail-titleblock">' +
            '<h1>' + esc(g.title) + "</h1>" +
            (g.developer ? '<div class="detail-dev">' + esc(g.developer) + "</div>" : "") +
            '<div class="detail-tags">' + tags.map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("") + "</div>" +
            '<div class="detail-cta">' + actionHtml + "</div>" +
          "</div>" +
      "</div>" +
      '<div class="wrap detail-body">' +
        "<div class='detail-main'>" +
          (g.shortDescription ? '<p class="detail-short">' + esc(g.shortDescription) + "</p>" : "") +
          '<div class="detail-desc-title">Hakkında</div>' +
          '<p class="detail-desc">' + esc(g.description || "Açıklama eklenmemiş.") + "</p>" +
          screens +
        "</div>" +
        '<aside class="detail-panel">' +
          '<div class="detail-panel-title">Oyun Bilgileri</div>' +
          '<div class="info-list">' + infoRows + "</div>" +
          renderRequirements(g.requirements) +
        "</aside>" +
      "</div>";
  }

  function infoRow(k, v) {
    return '<div class="info-row"><span class="k">' + esc(k) + "</span><span class='v'>" + esc(v) + "</span></div>";
  }

  /* ---------- Router ---------- */

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, "");
    if (!h) return { view: "home" };
    var parts = h.split("/");
    if (parts[0] === "oyun") return { view: "game", id: Number(parts[1]) };
    return { view: parts[0] };
  }

  var VIEWS = ["home", "katalog", "game", "indir", "kurulum", "sss"];

  function route() {
    var r = parseHash();
    if (VIEWS.indexOf(r.view) === -1) { location.hash = "#/"; return; }
    var activeView = r.view;
    $$("[data-view]").forEach(function (el) {
      el.hidden = el.getAttribute("data-view") !== activeView;
    });
    if (r.view === "katalog" || r.view === "game") {
      if (state.catalog) {
        render(r);
      } else if (!state.loading) {
        state.loading = true;
        fetchCatalog()
          .then(function () { render(r); })
          .catch(function (err) {
            state.error = err.message;
            $("#catalogGrid").innerHTML = '<div class="empty">Katalog yüklenemedi: ' + esc(err.message) + '.<br/>Sunucunun çalıştığından emin ol.</div>';
            $("#catalogCount").textContent = "";
          })
          .finally(function () { state.loading = false; });
      }
    } else {
      window.scrollTo(0, 0);
    }
  }

  function render(r) {
    if (r.view === "game") renderGame(r.id);
    else renderCatalog();
    window.scrollTo(0, 0);
  }

  /* ---------- Public ---------- */

  window.app = {
    applyFilter: function (v) {
      state.categoryId = v ? Number(v) : null;
      renderCatalog();
    },
    applySearch: function (v) {
      state.search = (v || "").trim();
      renderCatalog();
    }
  };

  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", function () {
    fetchAppUpdate();
    route();
  });
  if (document.readyState !== "loading") route();

  /* Simple lightbox for screenshots */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.classList.contains("screens-grid") === false) return;
    if (t && t.parentElement && t.parentElement.classList.contains("screens-grid")) {
      var src = t.src;
      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:100;cursor:zoom-out;";
      var im = new Image();
      im.style.cssText = "max-width:90vw;max-height:90vh;border-radius:10px;";
      im.src = src;
      ov.appendChild(im);
      ov.addEventListener("click", function () { ov.remove(); });
      document.body.appendChild(ov);
    }
  });
})();
