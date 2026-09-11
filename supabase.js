/* ------------------------------------------------------------------
   Petite couche d'accès à Supabase, en fetch pur : aucune dépendance,
   aucun build. Utilisée par le formulaire (clé anon) et par l'espace
   admin (jeton de session).
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var C = window.CR_CONFIG || {};
  var URL_ = String(C.SUPABASE_URL || "").replace(/\/+$/, "");
  var KEY = C.SUPABASE_ANON_KEY || "";

  function configured() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(URL_) && KEY.length > 20;
  }

  // La clé publiable va toujours dans `apikey`. L'en-tête Authorization
  // ne porte QUE le jeton de session administrateur, jamais la clé :
  // c'est la forme attendue par le nouveau système de clés Supabase.
  function headers(token, extra) {
    var h = { apikey: KEY };
    if (token) h.Authorization = "Bearer " + token;
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  function fail(res, body) {
    var msg = "";
    try { msg = (JSON.parse(body).message || JSON.parse(body).error_description || JSON.parse(body).msg || ""); } catch (e) { msg = body; }
    var e2 = new Error(msg || ("HTTP " + res.status));
    e2.status = res.status;
    return e2;
  }

  function req(method, path, opts) {
    opts = opts || {};
    return fetch(URL_ + path, {
      method: method,
      headers: headers(opts.token, opts.headers),
      body: opts.body
    }).then(function (res) {
      return res.text().then(function (txt) {
        if (!res.ok) throw fail(res, txt);
        if (!txt) return null;
        try { return JSON.parse(txt); } catch (e) { return txt; }
      });
    });
  }

  /* ---------- dépôt d'un dossier (clé anon) ---------- */

  // Envoie une photo. `path` = "<uuid>/01_piece.jpg"
  function uploadPhoto(path, blob, contentType) {
    return fetch(URL_ + "/storage/v1/object/dossiers/" + path, {
      method: "POST",
      // Pas de x-upsert : écraser exigerait un droit UPDATE que le rôle
      // anonyme n'a pas. Chaque dossier ayant son propre identifiant,
      // aucune collision n'est possible.
      headers: headers(null, { "Content-Type": contentType || "image/jpeg" }),
      body: blob
    }).then(function (res) {
      return res.text().then(function (txt) { if (!res.ok) throw fail(res, txt); return true; });
    });
  }

  function insertDossier(row) {
    return req("POST", "/rest/v1/dossiers", {
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row)
    });
  }

  /* ---------- espace admin (session authentifiée) ---------- */

  function signIn(email, password) {
    return fetch(URL_ + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (res) {
      return res.text().then(function (txt) {
        if (!res.ok) throw fail(res, txt);
        return JSON.parse(txt);
      });
    });
  }

  function refresh(refreshToken) {
    return fetch(URL_ + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    }).then(function (res) {
      return res.text().then(function (txt) {
        if (!res.ok) throw fail(res, txt);
        return JSON.parse(txt);
      });
    });
  }

  function listDossiers(token, opts) {
    opts = opts || {};
    var cols = "id,created_at,reference,denomination,forme,formule,dirigeant_nom,dirigeant_email,dirigeant_tel,nb_photos,lu,statut,lang";
    var q = "/rest/v1/dossiers?select=" + cols + "&order=created_at.desc&limit=" + (opts.limit || 200);
    if (opts.statut) q += "&statut=eq." + encodeURIComponent(opts.statut);
    if (opts.nonLus) q += "&lu=is.false";
    return req("GET", q, { token: token });
  }

  function getDossier(token, id) {
    return req("GET", "/rest/v1/dossiers?select=*&id=eq." + encodeURIComponent(id), { token: token })
      .then(function (r) { return r && r[0]; });
  }

  function patchDossier(token, id, patch) {
    return req("PATCH", "/rest/v1/dossiers?id=eq." + encodeURIComponent(id), {
      token: token,
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(patch)
    });
  }

  function deleteDossier(token, id) {
    return req("DELETE", "/rest/v1/dossiers?id=eq." + encodeURIComponent(id), { token: token });
  }

  // Lien temporaire vers une photo du bucket privé (1 h par défaut).
  function signedUrl(token, path, seconds) {
    return req("POST", "/storage/v1/object/sign/dossiers/" + path, {
      token: token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: seconds || 3600 })
    }).then(function (r) {
      if (!r || !r.signedURL) throw new Error("Lien indisponible");
      return URL_ + "/storage/v1" + r.signedURL;
    });
  }

  function removePhotos(token, paths) {
    return req("DELETE", "/storage/v1/object/dossiers", {
      token: token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: paths })
    });
  }

  window.CRDB = {
    configured: configured,
    url: URL_,
    uploadPhoto: uploadPhoto,
    insertDossier: insertDossier,
    signIn: signIn,
    refresh: refresh,
    listDossiers: listDossiers,
    getDossier: getDossier,
    patchDossier: patchDossier,
    deleteDossier: deleteDossier,
    signedUrl: signedUrl,
    removePhotos: removePhotos
  };
})();
