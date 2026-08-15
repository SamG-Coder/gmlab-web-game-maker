/**
 * Standalone HTML export. Serializes the same project model + the same runtime.
 */
(function (root) {
  "use strict";

  var G = (root.Gmlab = root.Gmlab || {});

  function runtimeSource() {
    if (G.Export._runtimeSource) return G.Export._runtimeSource;
    if (typeof document !== "undefined") {
      var scripts = document.getElementsByTagName("script");
      for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].getAttribute("src") || "";
        if (/gmlab-runtime\.js(\?|$)/.test(src) && scripts[i].text) {
          return scripts[i].text;
        }
      }
    }
    return null;
  }

  function projectSource() {
    if (G.Export._projectSource) return G.Export._projectSource;
    return null;
  }

  function wrapScript(code) {
    return "<script>\n" + code + "\n</scr" + "ipt>\n";
  }

  function escapeJsonForScript(json) {
    return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/--/g, "\\u002d\\u002d");
  }

  var BOOT = [
    "var __bootProject = window.GMLAB_PROJECT;",
    "var __bootGame = Gmlab.Runtime.create(__bootProject, {",
    "  soundApi: (function () {",
    "    var nodes = {};",
    "    function make(sound) {",
    "      if (!sound || !sound.data || typeof Audio === 'undefined') return null;",
    "      var a = new Audio(sound.data);",
    "      a.loop = !!sound.loop;",
    "      return a;",
    "    }",
    "    return {",
    "      play: function (id, sound) {",
    "        var a = nodes[id] || make(sound);",
    "        if (!a) return;",
    "        nodes[id] = a;",
    "        try { a.currentTime = 0; a.play(); } catch (e) {}",
    "      },",
    "      stop: function (id) {",
    "        var a = nodes[id];",
    "        if (!a) return;",
    "        try { a.pause(); a.currentTime = 0; } catch (e) {}",
    "      }",
    "    };",
    "  })()",
    "});",
    "Gmlab.Runtime.start(__bootGame);",
    "window.GmlabExportedGame = __bootGame;",
    "function __sizeCanvas(canvas, game) {",
    "  var w = (game.room && game.room.width) || 640;",
    "  var h = (game.room && game.room.height) || 480;",
    "  canvas.width = w;",
    "  canvas.height = h;",
    "  canvas.style.width = w + 'px';",
    "  canvas.style.height = h + 'px';",
    "}",
    "function __bindKeys(game) {",
    "  if (typeof window === 'undefined' || !window.addEventListener) return;",
    "  function mapKey(ev) {",
    "    var k = ev.key;",
    "    if (k === 'ArrowLeft' || k === 'Left') return 'left';",
    "    if (k === 'ArrowRight' || k === 'Right') return 'right';",
    "    if (k === 'ArrowUp' || k === 'Up') return 'up';",
    "    if (k === 'ArrowDown' || k === 'Down') return 'down';",
    "    if (k === ' ') return 'space';",
    "    if (k === 'Enter') return 'enter';",
    "    if (k === 'Shift') return 'shift';",
    "    if (k && k.length === 1) return k.toLowerCase();",
    "    return '';",
    "  }",
    "  window.addEventListener('keydown', function (ev) {",
    "    var name = mapKey(ev);",
    "    if (name) { Gmlab.Runtime.setKey(game, name, true); ev.preventDefault(); }",
    "  });",
    "  window.addEventListener('keyup', function (ev) {",
    "    var name = mapKey(ev);",
    "    if (name) { Gmlab.Runtime.setKey(game, name, false); ev.preventDefault(); }",
    "  });",
    "}",
    "if (typeof document !== 'undefined' && document.getElementById) {",
    "  var canvas = document.getElementById('game');",
    "  if (canvas && canvas.getContext) {",
    "    __sizeCanvas(canvas, __bootGame);",
    "    __bindKeys(__bootGame);",
    "    var ctx = canvas.getContext('2d');",
    "    var acc = 0;",
    "    var last = (typeof performance !== 'undefined' ? performance.now() : Date.now());",
    "    var stepMs = 1000 / ((__bootGame.room && __bootGame.room.speed) || 30);",
    "    function frame(now) {",
    "      acc += now - last;",
    "      last = now;",
    "      var guard = 0;",
    "      while (acc >= stepMs && guard++ < 5) {",
    "        Gmlab.Runtime.step(__bootGame);",
    "        acc -= stepMs;",
    "      }",
    "      Gmlab.Runtime.draw(__bootGame, ctx);",
    "      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);",
    "    }",
    "    Gmlab.Runtime.draw(__bootGame, ctx);",
    "    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);",
    "  }",
    "}"
  ].join("\n");

  var Export = {
    _projectSource: null,
    _runtimeSource: null,
    _docsSource: null,

    setSources: function (sources) {
      sources = sources || {};
      if (sources.project) Export._projectSource = sources.project;
      if (sources.runtime) Export._runtimeSource = sources.runtime;
      if (sources.docs) Export._docsSource = sources.docs;
    },

    bootScript: function () {
      return BOOT;
    },

    toStandaloneHtml: function (project, options) {
      options = options || {};
      var title = (project && project.name) || "Gmlab Game";
      var json = G.Project.toJSON(project);
      var projectSrc = options.projectSource || projectSource() || Export._projectSource;
      var runtimeSrc = options.runtimeSource || runtimeSource() || Export._runtimeSource;
      if (!projectSrc || !runtimeSrc) {
        throw new Error("Gmlab.Export: project/runtime source is not available. Call setSources or export from the IDE.");
      }
      var html = [];
      html.push("<!DOCTYPE html>");
      html.push("<html lang=\"en\">");
      html.push("<head>");
      html.push("<meta charset=\"utf-8\">");
      html.push("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">");
      html.push("<title>" + escapeHtml(title) + "</title>");
      html.push("<style>");
      html.push("html,body{margin:0;padding:0;background:#111;color:#eee;font-family:sans-serif;}");
      html.push("#game{display:block;margin:0 auto;background:#444;image-rendering:pixelated;}");
      html.push("</style>");
      html.push("</head>");
      html.push("<body>");
      html.push("<canvas id=\"game\" width=\"640\" height=\"480\"></canvas>");
      html.push(wrapScript("window.GMLAB_PROJECT = " + escapeJsonForScript(json) + ";"));
      html.push(wrapScript(projectSrc));
      html.push(wrapScript(runtimeSrc));
      html.push(wrapScript(BOOT));
      html.push("</body>");
      html.push("</html>");
      return html.join("\n");
    },

    readProjectFromHtml: function (html) {
      if (!html) return null;
      var marker = "window.GMLAB_PROJECT = ";
      var idx = html.indexOf(marker);
      if (idx < 0) return null;
      var start = idx + marker.length;
      var scriptEnd = html.indexOf("</scr", start);
      var end = -1;
      if (scriptEnd >= 0) {
        end = html.lastIndexOf(";", scriptEnd);
      }
      if (end < start) end = html.indexOf(";", start);
      if (end < start) return null;
      var raw = html.slice(start, end).replace(/^\s+|\s+$/g, "");
      return G.Project.fromJSON(raw);
    },

    bootFromHtml: function (html, options) {
      var project = Export.readProjectFromHtml(html);
      if (!project) throw new Error("exported HTML has no project");
      var game = G.Runtime.create(project, options || {});
      G.Runtime.start(game);
      return game;
    },

    hasStandaloneShape: function (html) {
      return !!(html && html.indexOf("<canvas id=\"game\"") >= 0 && html.indexOf("window.GMLAB_PROJECT") >= 0 && html.indexOf("Gmlab.Runtime.start") >= 0);
    }
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  G.Export = Export;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
