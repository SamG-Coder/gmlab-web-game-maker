/**
 * Share-link client. Default path is the ASP.NET /api/share store.
 * Optional Google Drive upload if an OAuth access token is supplied.
 */
(function (root) {
  "use strict";

  var G = (root.Gmlab = root.Gmlab || {});

  function defaultFetch(url, init) {
    if (typeof fetch === "function") return fetch(url, init);
    throw new Error("fetch is not available");
  }

  function joinUrl(base, path) {
    if (!base) return path;
    if (/^https?:/i.test(path)) return path;
    return String(base).replace(/\/$/, "") + path;
  }

  var Share = {
    defaultEndpoint: "/api/share",

    publish: function (html, options) {
      options = options || {};
      var endpoint = options.endpoint || Share.defaultEndpoint;
      var doFetch = options.fetchImpl || defaultFetch;
      return Promise.resolve()
        .then(function () {
          return doFetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "text/html; charset=utf-8" },
            body: html
          });
        })
        .then(function (res) {
          if (!res || typeof res.json !== "function") {
            return { error: "share: unexpected response" };
          }
          return res.json().then(function (data) {
            if (!res.ok) {
              return { error: (data && data.error) || ("share http " + res.status) };
            }
            var url = data.url || data.webViewLink || "";
            if (options.origin && url && url.charAt(0) === "/") {
              url = joinUrl(options.origin, url);
            }
            return { id: data.id, url: url, raw: data };
          });
        })
        .catch(function (err) {
          return { error: "share: " + (err && err.message ? err.message : String(err)) };
        });
    },

    /**
     * Google Drive shared-link path. Drive often downloads HTML instead of
     * executing it; the host /s/{id} store is the playable share system.
     */
    publishGoogleDrive: function (html, options) {
      options = options || {};
      var token = options.accessToken || options.credential;
      if (!token) {
        return Promise.resolve({ error: "auth: missing Google access token" });
      }
      var doFetch = options.fetchImpl || defaultFetch;
      var boundary = "gmlab" + Date.now();
      var meta = JSON.stringify({
        name: (options.name || "gmlab-game") + ".html",
        mimeType: "text/html"
      });
      var body =
        "--" + boundary + "\r\n" +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        meta + "\r\n" +
        "--" + boundary + "\r\n" +
        "Content-Type: text/html; charset=UTF-8\r\n\r\n" +
        html + "\r\n" +
        "--" + boundary + "--";
      return Promise.resolve()
        .then(function () {
          return doFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + token,
              "Content-Type": "multipart/related; boundary=" + boundary
            },
            body: body
          });
        })
        .then(function (res) {
          return res.json().then(function (data) {
            if (res.status === 401 || res.status === 403) {
              return { error: "auth: invalid credential" };
            }
            if (!res.ok) {
              return { error: (data && data.error && data.error.message) || ("drive http " + res.status) };
            }
            return {
              id: data.id,
              url: data.webViewLink || data.webContentLink,
              raw: data,
              note: "Google Drive often downloads HTML instead of running it. Use the host share link to play in the browser."
            };
          });
        })
        .catch(function (err) {
          return { error: "drive: " + (err && err.message ? err.message : String(err)) };
        });
    }
  };

  G.Share = Share;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
