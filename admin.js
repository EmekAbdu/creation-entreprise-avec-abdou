/* ------------------------------------------------------------------
   Espace administrateur — liste des dossiers reçus, badge non lus,
   consultation des photos par liens signés, suivi et export.
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var TOK = null, REF = null, ROWS = [], FILTER = "tous", QUERY = "", CUR = null;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(m) { var e = $("toast"); e.textContent = m; e.classList.add("on"); clearTimeout(e._t); e._t = setTimeout(function () { e.classList.remove("on"); }, 2800); }
  function slug(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "dossier"; }

  function fmtDate(iso) {
    var d = new Date(iso);
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear() +
      " à " + String(d.getHours()).padStart(2, "0") + "h" + String(d.getMinutes()).padStart(2, "0");
  }
  function fmtShort(iso) {
    var d = new Date(iso), now = new Date();
    var sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return String(d.getHours()).padStart(2, "0") + "h" + String(d.getMinutes()).padStart(2, "0");
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getFullYear()).slice(2);
  }

  /* ---------------- session ---------------- */

  function storeSession(s) {
    TOK = s.access_token; REF = s.refresh_token;
    try { localStorage.setItem("cr_admin", JSON.stringify({ a: TOK, r: REF, t: Date.now() })); } catch (e) {}
  }
  function clearSession() {
    TOK = REF = null;
    try { localStorage.removeItem("cr_admin"); } catch (e) {}
  }

  function login() {
    var em = $("em").value.trim(), pw = $("pw").value;
    var err = $("lerr");
    err.classList.remove("on");
    if (!window.CRDB || !CRDB.configured()) {
      err.textContent = "Le fichier config.js n'est pas encore renseigné (URL et clé Supabase).";
      err.classList.add("on"); return;
    }
    if (!em || !pw) { err.textContent = "Renseignez l'e-mail et le mot de passe."; err.classList.add("on"); return; }
    var b = $("go"); b.disabled = true; b.textContent = "Connexion…";
    CRDB.signIn(em, pw).then(function (s) {
      storeSession(s); openApp();
    }).catch(function (e) {
      b.disabled = false; b.textContent = "Se connecter";
      err.textContent = /invalid/i.test(e.message || "") ? "E-mail ou mot de passe incorrect." : ("Connexion impossible : " + (e.message || ""));
      err.classList.add("on");
    });
  }

  function openApp() {
    $("login-view").hidden = true;
    $("app-view").hidden = false;
    reload();
  }

  function onAuthLost() {
    clearSession();
    $("app-view").hidden = true;
    $("login-view").hidden = false;
    var b = $("go"); b.disabled = false; b.textContent = "Se connecter";
    toast("Session expirée, reconnectez-vous.");
  }

  /* ---------------- liste ---------------- */

  function reload() {
    CRDB.listDossiers(TOK, {}).then(function (rows) {
      ROWS = rows || [];
      render();
    }).catch(function (e) {
      if (e.status === 401 && REF) {
        return CRDB.refresh(REF).then(function (s) { storeSession(s); reload(); }).catch(onAuthLost);
      }
      if (e.status === 401) return onAuthLost();
      toast("Chargement impossible : " + (e.message || ""));
    });
  }

  function visible() {
    var q = QUERY.toLowerCase();
    return ROWS.filter(function (r) {
      if (FILTER === "nonlus" && r.lu) return false;
      if (FILTER !== "tous" && FILTER !== "nonlus" && r.statut !== FILTER) return false;
      if (!q) return true;
      return [r.denomination, r.dirigeant_nom, r.reference, r.dirigeant_email, r.forme]
        .some(function (v) { return String(v || "").toLowerCase().indexOf(q) >= 0; });
    });
  }

  function render() {
    var unread = ROWS.filter(function (r) { return !r.lu; }).length;
    var b = $("badge");
    b.textContent = unread === 0 ? "Aucun dossier non lu" : (unread + (unread > 1 ? " dossiers non lus" : " dossier non lu"));
    b.className = "badge" + (unread === 0 ? " zero" : "");
    document.title = (unread ? "(" + unread + ") " : "") + "Dossiers reçus — Comptarapide";

    var host = $("list"); host.innerHTML = "";
    var rows = visible();
    if (!rows.length) {
      host.appendChild(el("div", "empty", ROWS.length ? "Aucun dossier ne correspond à ce filtre." : "Aucun dossier reçu pour l'instant."));
      return;
    }
    var tbl = el("div", "dtable");
    var hdr = el("div", "drow hdr");
    hdr.appendChild(el("div"));
    hdr.appendChild(el("div", "head", "Société"));
    hdr.appendChild(el("div", "head hide-s", "Dirigeant"));
    hdr.appendChild(el("div", "head hide-s", "Forme"));
    hdr.appendChild(el("div", "head hide-s", "Photos"));
    hdr.appendChild(el("div", "head hide-s", "Statut"));
    hdr.appendChild(el("div", "head", "Reçu"));
    tbl.appendChild(hdr);

    rows.forEach(function (r) {
      var row = el("button", "drow" + (r.lu ? " read" : "")); row.type = "button";
      row.appendChild(el("div", "unread"));
      var c1 = el("div");
      c1.appendChild(el("div", "t1", r.denomination || "(sans dénomination)"));
      c1.appendChild(el("div", "t2", r.reference + " · Formule " + (r.formule || "?")));
      row.appendChild(c1);
      row.appendChild(el("div", "cel hide-s", r.dirigeant_nom || "—"));
      row.appendChild(el("div", "cel hide-s", r.forme || "—"));
      row.appendChild(el("div", "cel hide-s", String(r.nb_photos || 0)));
      var c5 = el("div", "hide-s");
      c5.appendChild(el("span", "stat " + (r.statut || "nouveau"), ({ nouveau: "Nouveau", en_cours: "En cours", traite: "Traité" })[r.statut] || r.statut));
      row.appendChild(c5);
      row.appendChild(el("div", "cel", fmtShort(r.created_at)));
      row.addEventListener("click", function () { openSheet(r.id); });
      tbl.appendChild(row);
    });
    host.appendChild(tbl);
  }

  /* ---------------- fiche détail ---------------- */

  function openSheet(id) {
    var sh = $("sheet");
    sh.classList.add("on");
    $("sh-title").textContent = "Chargement…";
    $("sh-ref").textContent = "";
    $("sh-body").innerHTML = "";
    CRDB.getDossier(TOK, id).then(function (d) {
      if (!d) { toast("Dossier introuvable"); closeSheet(); return; }
      CUR = d;
      renderSheet(d);
      if (!d.lu) {
        CRDB.patchDossier(TOK, d.id, { lu: true }).then(function () {
          var r = ROWS.filter(function (x) { return x.id === d.id; })[0];
          if (r) { r.lu = true; render(); }
        }).catch(function () {});
      }
    }).catch(function (e) {
      if (e.status === 401) return onAuthLost();
      toast("Ouverture impossible : " + (e.message || ""));
    });
  }
  function closeSheet() { $("sheet").classList.remove("on"); CUR = null; }

  function renderSheet(d) {
    $("sh-title").textContent = d.denomination || "(sans dénomination)";
    $("sh-ref").textContent = d.reference;
    var b = $("sh-body"); b.innerHTML = "";

    // en-tête
    var head = el("div", "note info");
    head.innerHTML =
      "<b>Reçu le " + esc(fmtDate(d.created_at)) + "</b> — " + esc(d.forme || "?") +
      " · Formule <b>" + esc(d.formule || "?") + "</b>" +
      (d.dirigeant_nom ? " · " + esc(d.dirigeant_nom) : "") +
      (d.dirigeant_tel ? " · " + esc(d.dirigeant_tel) : "") +
      (d.dirigeant_email ? " · " + esc(d.dirigeant_email) : "") +
      "<br>Mentions manuscrites : <b>" + (d.autorisation ? "autorisation accordée" : "le client écrit lui-même") +
      "</b>" + (d.autorisation ? " · conditions d'utilisation " + (d.usage_textes ? "acceptées" : "NON acceptées") : "");
    b.appendChild(head);

    // suivi
    var sc = el("div", "card"); sc.style.marginTop = "14px";
    var sh2 = el("div", "sect-h"); sh2.appendChild(el("h3", null, "Suivi")); sc.appendChild(sh2);
    var acts = el("div", "acts");
    [["nouveau", "Nouveau"], ["en_cours", "En cours"], ["traite", "Traité"]].forEach(function (o) {
      var bt = el("button", "btn " + (d.statut === o[0] ? "prim" : "sec"), o[1]); bt.type = "button";
      bt.addEventListener("click", function () {
        CRDB.patchDossier(TOK, d.id, { statut: o[0] }).then(function () {
          d.statut = o[0];
          var r = ROWS.filter(function (x) { return x.id === d.id; })[0]; if (r) r.statut = o[0];
          render(); renderSheet(d); toast("Statut mis à jour");
        }).catch(function (e) { toast("Échec : " + (e.message || "")); });
      });
      acts.appendChild(bt);
    });
    var bU = el("button", "btn sec", "Marquer non lu"); bU.type = "button";
    bU.addEventListener("click", function () {
      CRDB.patchDossier(TOK, d.id, { lu: false }).then(function () {
        var r = ROWS.filter(function (x) { return x.id === d.id; })[0]; if (r) r.lu = false;
        render(); toast("Marqué non lu"); closeSheet();
      }).catch(function (e) { toast("Échec : " + (e.message || "")); });
    });
    acts.appendChild(bU);
    sc.appendChild(acts);

    var nt = el("textarea", "notes"); nt.id = "notes_" + d.id; nt.placeholder = "Notes internes (visibles de vous seul)…";
    nt.value = d.notes || ""; nt.style.marginTop = "12px";
    var saveT;
    nt.addEventListener("input", function () {
      clearTimeout(saveT);
      saveT = setTimeout(function () {
        CRDB.patchDossier(TOK, d.id, { notes: nt.value }).then(function () { d.notes = nt.value; }).catch(function () {});
      }, 900);
    });
    sc.appendChild(nt);
    b.appendChild(sc);

    // réponses
    var secs = (d.reponses && d.reponses._sections) || [];
    secs.forEach(function (s) {
      var c = el("div", "card recap"); c.style.marginTop = "14px";
      var h = el("div", "sect-h"); h.appendChild(el("h3", null, s.titre)); c.appendChild(h);
      var dl = document.createElement("dl");
      (s.lignes || []).forEach(function (L) {
        dl.appendChild(el("dt", null, L.label));
        dl.appendChild(el("dd", null, L.valeur));
      });
      c.appendChild(dl); b.appendChild(c);
    });

    // photos
    var photos = d.photos || [];
    var pc = el("div", "card"); pc.style.marginTop = "14px";
    var ph = el("div", "sect-h");
    ph.appendChild(el("h3", null, "Pièces photographiées (" + photos.length + ")"));
    pc.appendChild(ph);
    if (!photos.length) {
      pc.appendChild(el("div", "note warn", "Aucune photo transmise avec ce dossier."));
    } else {
      var g = el("div", "phgrid");
      photos.forEach(function (p) {
        var card = el("div", "ph");
        var a = document.createElement("a"); a.target = "_blank"; a.rel = "noopener";
        var ld = el("div", "ld", "Chargement…"); a.appendChild(ld);
        card.appendChild(a);
        card.appendChild(el("div", "cap2", p.label || p.slot));
        g.appendChild(card);
        CRDB.signedUrl(TOK, p.path, 3600).then(function (u) {
          a.href = u; a.innerHTML = "";
          var im = document.createElement("img"); im.src = u; im.alt = p.label || ""; im.loading = "lazy";
          a.appendChild(im);
        }).catch(function () { ld.textContent = "Indisponible"; });
      });
      pc.appendChild(g);
    }
    b.appendChild(pc);

    // export / suppression
    var ec = el("div", "card"); ec.style.marginTop = "14px";
    var ea = el("div", "acts");
    var bz = el("button", "btn prim", "Télécharger le dossier complet (.zip)"); bz.type = "button";
    bz.addEventListener("click", function () { exportZip(d, bz); });
    ea.appendChild(bz);
    if (d.dirigeant_tel) {
      var wa = document.createElement("a"); wa.className = "btn sec"; wa.target = "_blank"; wa.rel = "noopener";
      wa.style.textDecoration = "none";
      wa.href = "https://wa.me/" + String(d.dirigeant_tel).replace(/[^0-9]/g, "").replace(/^0/, "33");
      wa.textContent = "WhatsApp au client";
      ea.appendChild(wa);
    }
    var bd = el("button", "btn-x", "Supprimer définitivement"); bd.type = "button"; bd.style.marginLeft = "auto";
    bd.addEventListener("click", function () {
      if (!confirm("Supprimer définitivement le dossier " + d.reference + " et toutes ses photos ?")) return;
      var paths = (d.photos || []).map(function (p) { return p.path; });
      (paths.length ? CRDB.removePhotos(TOK, paths).catch(function () {}) : Promise.resolve())
        .then(function () { return CRDB.deleteDossier(TOK, d.id); })
        .then(function () {
          ROWS = ROWS.filter(function (x) { return x.id !== d.id; });
          render(); closeSheet(); toast("Dossier supprimé");
        }).catch(function (e) { toast("Suppression impossible : " + (e.message || "")); });
    });
    ea.appendChild(bd);
    ec.appendChild(ea);
    b.appendChild(ec);
  }

  /* ---------------- export ---------------- */

  function dossierHTML(d) {
    var h = [];
    h.push('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>' + esc(d.reference) + ' — ' + esc(d.denomination || "") + '</title>');
    h.push('<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#17110F;max-width:820px;margin:32px auto;padding:0 18px;line-height:1.5}h1{font-size:24px;margin:0 0 4px}h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:#D81A10;margin:26px 0 6px;border-bottom:2px solid #F5C4BF;padding-bottom:4px}dl{display:grid;grid-template-columns:38% 1fr;margin:0}dt{color:#857673;font-size:12px;padding:6px 0;border-top:1px solid #E7DEDB}dd{margin:0;font-size:13.5px;padding:6px 0;border-top:1px solid #E7DEDB}.meta{color:#857673;font-size:12.5px}figure{margin:0 0 18px}figcaption{font-size:12px;color:#857673;font-weight:700;margin-bottom:4px}img{max-width:100%;border:1px solid #E7DEDB;border-radius:6px}@media print{h2{break-after:avoid}figure{break-inside:avoid}}</style></head><body>');
    h.push('<h1>' + esc(d.denomination || "Dossier de création") + '</h1>');
    h.push('<div class="meta">' + esc(d.reference) + ' — ' + esc(d.forme || "") + ' — reçu le ' + esc(fmtDate(d.created_at)) + '</div>');
    ((d.reponses && d.reponses._sections) || []).forEach(function (s) {
      h.push('<h2>' + esc(s.titre) + '</h2><dl>');
      (s.lignes || []).forEach(function (L) { h.push('<dt>' + esc(L.label) + '</dt><dd>' + esc(L.valeur) + '</dd>'); });
      h.push('</dl>');
    });
    if ((d.photos || []).length) {
      h.push('<h2>Pièces photographiées</h2>');
      (d.photos || []).forEach(function (p, i) {
        h.push('<figure><figcaption>' + esc(p.label || p.slot) + '</figcaption><img src="PHOTOS/' + esc(String(i + 1).padStart(2, "0") + "_" + slug(p.label || p.slot) + ".jpg") + '" alt=""></figure>');
      });
    }
    h.push('</body></html>');
    return h.join("");
  }

  function exportZip(d, btn) {
    if (typeof JSZip === "undefined") { toast("Module d'archivage indisponible"); return; }
    var old = btn.textContent; btn.disabled = true; btn.textContent = "Préparation…";
    var zip = new JSZip();
    zip.file("DOSSIER.html", dossierHTML(d));
    zip.file("reponses.json", JSON.stringify(d, null, 2));
    var folder = zip.folder("PHOTOS");
    var photos = d.photos || [];

    function grab(i) {
      if (i >= photos.length) return Promise.resolve();
      btn.textContent = "Photos " + (i + 1) + " / " + photos.length;
      return CRDB.signedUrl(TOK, photos[i].path, 600)
        .then(function (u) { return fetch(u).then(function (r) { return r.blob(); }); })
        .then(function (bl) {
          folder.file(String(i + 1).padStart(2, "0") + "_" + slug(photos[i].label || photos[i].slot) + ".jpg", bl);
          return grab(i + 1);
        })
        .catch(function () { return grab(i + 1); });
    }

    grab(0).then(function () {
      btn.textContent = "Compression…";
      return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 4 } });
    }).then(function (blob) {
      var u = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = u; a.download = d.reference + "_" + slug(d.denomination || "dossier") + ".zip";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
      btn.disabled = false; btn.textContent = old;
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = old;
      toast("Export impossible : " + (e.message || ""));
    });
  }

  /* ---------------- événements ---------------- */

  $("go").addEventListener("click", login);
  $("pw").addEventListener("keydown", function (e) { if (e.key === "Enter") login(); });
  $("em").addEventListener("keydown", function (e) { if (e.key === "Enter") $("pw").focus(); });
  $("reload").addEventListener("click", reload);
  $("out").addEventListener("click", function () { clearSession(); location.reload(); });
  $("sheetbg").addEventListener("click", closeSheet);
  $("sh-close").addEventListener("click", closeSheet);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  $("q").addEventListener("input", function () { QUERY = this.value; render(); });
  Array.prototype.forEach.call(document.querySelectorAll(".filt"), function (f) {
    f.addEventListener("click", function () {
      FILTER = f.dataset.f;
      Array.prototype.forEach.call(document.querySelectorAll(".filt"), function (o) { o.setAttribute("aria-pressed", o === f); });
      render();
    });
  });

  // reprise de session
  (function boot() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem("cr_admin") || "null"); } catch (e) {}
    if (raw && raw.r && window.CRDB && CRDB.configured()) {
      CRDB.refresh(raw.r).then(function (s) { storeSession(s); openApp(); }).catch(function () { clearSession(); });
    }
    // rafraîchissement discret du badge toutes les 3 minutes
    setInterval(function () { if (TOK && !$("app-view").hidden) reload(); }, 180000);
  })();
})();
