/**
 * Gemini account hook. Sends the user's prompt with their credential.
 * Tests inject httpPost or point endpoint at a local echo server.
 */
(function (root) {
  "use strict";

  var G = (root.Gmlab = root.Gmlab || {});

  var DEFAULT_DIRECT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  var DEFAULT_PROXY = "/api/gemini";

  function buildUrl(endpoint, apiKey) {
    if (!endpoint) endpoint = DEFAULT_DIRECT;
    if (/^\/api\/gemini/.test(endpoint)) return endpoint;
    if (/[?&]key=/.test(endpoint)) return endpoint;
    return endpoint + (endpoint.indexOf("?") >= 0 ? "&" : "?") + "key=" + encodeURIComponent(apiKey);
  }

  function extractText(status, bodyText) {
    var json = null;
    try {
      json = bodyText ? JSON.parse(bodyText) : null;
    } catch (e) {
      json = null;
    }
    if (status === 401 || status === 403) {
      var authMsg = json && json.error ? String(json.error) : "auth: invalid credential";
      if (authMsg.indexOf("auth:") !== 0) authMsg = "auth: invalid credential";
      return { error: authMsg };
    }
    if (status < 200 || status >= 300) {
      var msg = json && json.error ? String(json.error) : ("http " + status + ": " + String(bodyText || "").slice(0, 200));
      if ((status === 400 || status === 401) && /key|auth|credential|permission/i.test(msg)) {
        return { error: "auth: invalid credential" };
      }
      return { error: msg };
    }
    if (json && typeof json.error === "string" && /auth:/i.test(json.error)) {
      return { error: json.error };
    }
    if (json && typeof json.text === "string") return { text: json.text };
    if (json && json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) {
      var parts = json.candidates[0].content.parts;
      var bits = [];
      for (var i = 0; i < parts.length; i++) {
        if (parts[i] && typeof parts[i].text === "string") bits.push(parts[i].text);
      }
      if (bits.length) return { text: bits.join("") };
    }
    return { text: bodyText || "" };
  }

  function normalizeHttpResult(raw) {
    if (!raw) return { error: "empty response" };
    if (raw.error && !raw.status) return raw;
    var status = raw.status != null ? raw.status : 200;
    var body = raw.body != null ? raw.body : raw.text != null ? raw.text : "";
    if (typeof body !== "string") body = JSON.stringify(body);
    return extractText(status, body);
  }

  var Gemini = {
    defaultDirectEndpoint: DEFAULT_DIRECT,
    defaultProxyEndpoint: DEFAULT_PROXY,

    buildUrl: buildUrl,
    extractText: extractText,

    complete: function (options) {
      options = options || {};
      var apiKey = options.apiKey || options.credential || "";
      var prompt = options.prompt || "";
      if (!apiKey) {
        return Promise.resolve({ error: "auth: missing API key" });
      }

      var endpoint = options.endpoint || (typeof window !== "undefined" && window.location && window.location.protocol !== "file:"
        ? DEFAULT_PROXY
        : DEFAULT_DIRECT);
      var url = buildUrl(endpoint, apiKey);
      var payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        prompt: prompt,
        apiKey: apiKey
      };
      var body = JSON.stringify(payload);
      var headers = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "x-goog-api-key": apiKey
      };

      if (typeof options.httpPost === "function") {
        try {
          var raw = options.httpPost({
            url: url,
            headers: headers,
            body: body,
            apiKey: apiKey,
            prompt: prompt
          });
          if (raw && typeof raw.then === "function") {
            return raw.then(normalizeHttpResult, function (err) {
              return { error: "network: " + (err && err.message ? err.message : String(err)) };
            });
          }
          return Promise.resolve(normalizeHttpResult(raw));
        } catch (err) {
          return Promise.resolve({ error: "network: " + (err && err.message ? err.message : String(err)) });
        }
      }

      var doFetch = options.fetchImpl || (typeof fetch === "function" ? fetch : null);
      if (!doFetch) {
        return Promise.resolve({ error: "no fetch available" });
      }

      return Promise.resolve()
        .then(function () {
          return doFetch(url, { method: "POST", headers: headers, body: body });
        })
        .then(function (res) {
          return res.text().then(function (text) {
            return extractText(res.status, text);
          });
        })
        .catch(function (err) {
          return { error: "network: " + (err && err.message ? err.message : String(err)) };
        });
    }
  };

  G.Gemini = Gemini;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
